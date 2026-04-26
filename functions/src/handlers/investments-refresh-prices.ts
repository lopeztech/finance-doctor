import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getDb } from '../lib/firestore';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import type { Investment } from '../lib/types';

interface RefreshPricesData {
  ids?: string[];
}

interface PriceUpdate {
  id: string;
  ticker: string;
  ok: boolean;
  price?: number;
  currency?: string;
  fxToAud?: number;
  currentValue?: number;
  previousValue?: number;
  updatedAt?: string;
  error?: string;
}

interface RefreshPricesResult {
  total: number;
  updated: number;
  failed: number;
  results: PriceUpdate[];
}

const TRADED_TYPES = new Set([
  'Australian Shares',
  'International Shares',
  'ETFs',
  'Cryptocurrency',
]);

const MAX_TICKERS_PER_CALL = 100;
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FETCH_TIMEOUT_MS = 10_000;

interface YahooQuote {
  price: number;
  currency: string;
}

async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinanceDoctor/1.0; +https://finance-doctor.app)',
        Accept: 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Yahoo returned HTTP ${res.status}`);
  const json = await res.json() as {
    chart?: {
      result?: { meta?: { regularMarketPrice?: number; currency?: string } }[];
      error?: { description?: string } | null;
    };
  };
  if (json?.chart?.error) {
    throw new Error(json.chart.error.description || 'Yahoo error');
  }
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('No quote data');
  const price = meta.regularMarketPrice;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    throw new Error('Invalid price');
  }
  return { price, currency: (meta.currency || 'USD').toUpperCase() };
}

function normaliseTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

export const investmentsRefreshPrices = onCall<RefreshPricesData>(
  {
    region: 'australia-southeast1',
    serviceAccount: 'finance-doctor-functions@',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request: CallableRequest<RefreshPricesData>): Promise<RefreshPricesResult> => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const idFilter = request.data?.ids;

    const db = getDb();
    const col = db.collection('users').doc(email).collection('investments');
    const snap = await col.get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment));

    const eligible = all.filter(inv => {
      if (!inv.ticker || !inv.ticker.trim()) return false;
      if (!TRADED_TYPES.has(inv.type)) return false;
      if (typeof inv.units !== 'number' || inv.units <= 0) return false;
      if (idFilter && idFilter.length > 0) return idFilter.includes(inv.id);
      return true;
    });

    if (eligible.length === 0) {
      auditLog({
        endpoint: 'investmentsRefreshPrices',
        email,
        durationMs: Date.now() - start,
        geminiCalled: false,
        considered: all.length,
        eligible: 0,
        updated: 0,
        failed: 0,
      });
      return { total: 0, updated: 0, failed: 0, results: [] };
    }
    if (eligible.length > MAX_TICKERS_PER_CALL) {
      throw new HttpsError(
        'invalid-argument',
        `Too many tickers (${eligible.length}). Limit is ${MAX_TICKERS_PER_CALL} per refresh.`,
      );
    }

    // De-dup tickers + collect non-AUD currencies for FX lookup.
    const tickers = Array.from(new Set(eligible.map(i => normaliseTicker(i.ticker!))));
    const quoteResults = await Promise.allSettled(tickers.map(t => fetchYahooQuote(t)));
    const quoteMap = new Map<string, YahooQuote | { error: string }>();
    tickers.forEach((t, i) => {
      const r = quoteResults[i];
      if (r.status === 'fulfilled') quoteMap.set(t, r.value);
      else quoteMap.set(t, { error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    });

    const neededFx = new Set<string>();
    for (const q of quoteMap.values()) {
      if ('price' in q && q.currency && q.currency !== 'AUD') neededFx.add(q.currency);
    }
    const fxRates = new Map<string, number>([['AUD', 1]]);
    if (neededFx.size > 0) {
      const fxList = [...neededFx];
      const fxResults = await Promise.allSettled(fxList.map(c => fetchYahooQuote(`${c}AUD=X`)));
      fxList.forEach((c, i) => {
        const r = fxResults[i];
        if (r.status === 'fulfilled') fxRates.set(c, r.value.price);
        else logger.warn('FX fetch failed', { currency: c, error: r.reason });
      });
    }

    const updates: PriceUpdate[] = [];
    const writeBatch = db.batch();
    const nowIso = new Date().toISOString();
    let updatedCount = 0;
    let failedCount = 0;

    for (const inv of eligible) {
      const ticker = normaliseTicker(inv.ticker!);
      const quote = quoteMap.get(ticker);
      if (!quote || 'error' in quote) {
        failedCount++;
        updates.push({
          id: inv.id,
          ticker,
          ok: false,
          error: quote && 'error' in quote ? quote.error : 'Unknown error',
        });
        continue;
      }
      const fx = fxRates.get(quote.currency);
      if (typeof fx !== 'number' || !Number.isFinite(fx) || fx <= 0) {
        failedCount++;
        updates.push({
          id: inv.id,
          ticker,
          ok: false,
          price: quote.price,
          currency: quote.currency,
          error: `No AUD FX rate available for ${quote.currency}`,
        });
        continue;
      }
      const audPrice = quote.price * fx;
      const newValue = Number((audPrice * (inv.units || 0)).toFixed(2));
      const prevValue = inv.currentValue;
      writeBatch.update(col.doc(inv.id), {
        currentValue: newValue,
        lastPrice: Number(audPrice.toFixed(4)),
        lastPriceCurrency: quote.currency,
        lastPriceUpdate: nowIso,
      });
      updatedCount++;
      updates.push({
        id: inv.id,
        ticker,
        ok: true,
        price: quote.price,
        currency: quote.currency,
        fxToAud: fx,
        currentValue: newValue,
        previousValue: prevValue,
        updatedAt: nowIso,
      });
    }

    if (updatedCount > 0) await writeBatch.commit();

    auditLog({
      endpoint: 'investmentsRefreshPrices',
      email,
      durationMs: Date.now() - start,
      geminiCalled: false,
      considered: all.length,
      eligible: eligible.length,
      updated: updatedCount,
      failed: failedCount,
      uniqueTickers: tickers.length,
      fxLookups: neededFx.size,
    });

    return {
      total: eligible.length,
      updated: updatedCount,
      failed: failedCount,
      results: updates,
    };
  },
);
