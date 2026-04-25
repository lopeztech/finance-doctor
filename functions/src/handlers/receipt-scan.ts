import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import { TAX_CATEGORIES, SPENDING_CATEGORIES } from '../lib/categorise';

interface ReceiptScanData {
  imageBase64: string;
  mimeType: string;
}

interface ReceiptScanResult {
  date?: string;
  amount?: number;
  description?: string;
  category?: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  merchant?: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const RECEIPT_PROMPT = `You are an Australian receipt-extraction engine. Read the receipt image and return a single JSON object with these fields:

- "date": purchase date in ISO format YYYY-MM-DD. If only a partial date is visible, infer the missing parts from context. Return null if absent.
- "amount": the final total paid as a positive number (decimal, no currency symbol). Use the GST-inclusive total. Return null if absent.
- "merchant": business / vendor name as printed on the receipt.
- "description": a short human-friendly description for an expense register, e.g. "Coles — Groceries" or "Caltex Strathpine — Fuel". Combine the merchant with the dominant purchase type.
- "category": ONE of these ATO tax-deduction categories (use exactly): ${TAX_CATEGORIES.join(', ')}. Pick "Other Deductions" if unsure or if the receipt is clearly personal.
- "spendingCategory": ONE of these spending categories (use exactly): ${SPENDING_CATEGORIES.join(', ')}. Pick "Other" if unsure.
- "spendingSubCategory": optional finer label (e.g. "Fuel", "Pharmacy", "Lunch"). Omit if not applicable.
- "notes": optional short note for anything ambiguous (e.g. "Tip not included in total").
- "confidence": "high" | "medium" | "low" — your confidence in the extracted total.

Rules:
- Return raw JSON only — no markdown fences, no commentary.
- Use Australian context (AUD currency, ATO categories, AU date conventions).
- If the image is not a receipt or cannot be read, return {"error": "Not a receipt"}.
- The total must be a number, not a string. Strip any "$" or "AUD".`;

export const expensesReceiptScan = onCall<ReceiptScanData>(
  {
    region: 'australia-southeast1',
    serviceAccount: 'finance-doctor-functions@',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request: CallableRequest<ReceiptScanData>): Promise<ReceiptScanResult> => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const { imageBase64, mimeType } = request.data ?? {};

    if (!imageBase64 || !mimeType) {
      throw new HttpsError('invalid-argument', 'imageBase64 and mimeType are required.');
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new HttpsError('invalid-argument', `Unsupported mime type: ${mimeType}. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}.`);
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
    const approxBytes = Math.floor((cleanBase64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      throw new HttpsError('invalid-argument', `Image is too large (${(approxBytes / 1024 / 1024).toFixed(1)} MB). Max ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
    }

    const model = getGeminiModel();
    let responseText = '';
    try {
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: 'Extract the receipt details as specified.' },
          ],
        }],
        systemInstruction: { role: 'system', parts: [{ text: RECEIPT_PROMPT }] },
      });
      responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      logger.error('Gemini receipt scan failed', { error: err instanceof Error ? err.message : err });
      throw new HttpsError('internal', 'Receipt scan failed — please try again.');
    }

    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.warn('Could not parse receipt JSON', { responseText });
      throw new HttpsError('internal', 'Could not read the receipt — try a clearer photo.');
    }

    if (typeof parsed.error === 'string') {
      throw new HttpsError('failed-precondition', parsed.error);
    }

    const out: ReceiptScanResult = {};
    if (typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) out.date = parsed.date;
    if (typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount > 0) out.amount = parsed.amount;
    if (typeof parsed.merchant === 'string' && parsed.merchant.trim()) out.merchant = parsed.merchant.trim();
    if (typeof parsed.description === 'string' && parsed.description.trim()) out.description = parsed.description.trim();
    else if (out.merchant) out.description = out.merchant;
    if (typeof parsed.category === 'string' && TAX_CATEGORIES.includes(parsed.category)) out.category = parsed.category;
    else out.category = 'Other Deductions';
    if (typeof parsed.spendingCategory === 'string' && SPENDING_CATEGORIES.includes(parsed.spendingCategory)) out.spendingCategory = parsed.spendingCategory;
    else out.spendingCategory = 'Other';
    if (typeof parsed.spendingSubCategory === 'string' && parsed.spendingSubCategory.trim()) out.spendingSubCategory = parsed.spendingSubCategory.trim();
    if (typeof parsed.notes === 'string' && parsed.notes.trim()) out.notes = parsed.notes.trim();
    if (parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low') {
      out.confidence = parsed.confidence;
    }

    auditLog({
      endpoint: 'expensesReceiptScan',
      email,
      durationMs: Date.now() - start,
      geminiCalled: true,
      mimeType,
      imageBytes: approxBytes,
      extractedAmount: out.amount ?? null,
      confidence: out.confidence ?? null,
    });

    return out;
  },
);
