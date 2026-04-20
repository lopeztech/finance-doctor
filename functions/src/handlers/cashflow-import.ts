import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import { normaliseInvestment } from '../lib/investments';
import type { FamilyMember, IncomeSource, IncomeSourceType, IncomeCadence } from '../lib/types';

const INCOME_SOURCE_TYPES: Record<string, IncomeSourceType> = {
  'dividend': 'dividend',
  'dividends': 'dividend',
  'interest': 'interest',
  'side income': 'side',
  'side': 'side',
  'other income': 'other',
  'other': 'other',
};

const CADENCES: Record<string, IncomeCadence> = {
  'weekly': 'weekly',
  'fortnightly': 'fortnightly',
  'monthly': 'monthly',
  'annual': 'annual',
  'annually': 'annual',
  'yearly': 'annual',
};

export type CashflowDestination = 'family-member' | 'income-source' | 'property' | 'skip';
export type CashflowAction = 'create' | 'update' | 'skip';

export interface CashflowPreviewRow {
  rowIndex: number;
  rawType: string;
  destination: CashflowDestination;
  action: CashflowAction;
  label: string;
  amount: number;
  cadence?: IncomeCadence;
  owner?: string;
  error?: string;
  familyMember?: Omit<FamilyMember, 'id'>;
  familyMemberId?: string;
  incomeSource?: Omit<IncomeSource, 'id'>;
  investmentId?: string;
  investmentRentalMonthly?: number;
}

interface PreviewData {
  action: 'preview';
  csvText: string;
}

interface SaveData {
  action: 'save';
  rows: CashflowPreviewRow[];
}

type CashflowImportData = PreviewData | SaveData;

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
}

function parseAmount(raw: string): number {
  return Math.abs(parseFloat((raw || '').replace(/[,$"]/g, '')));
}

function normaliseCadence(raw: string): IncomeCadence | undefined {
  return CADENCES[(raw || '').trim().toLowerCase()];
}

export const cashflowImport = onCall<CashflowImportData>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<CashflowImportData>) => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const db = getDb();

    if (request.data.action === 'preview') {
      const { csvText } = request.data;
      if (!csvText) throw new HttpsError('invalid-argument', 'No CSV content provided.');

      const rows = parseCSV(csvText);
      if (rows.length === 0) {
        throw new HttpsError('invalid-argument', 'No data rows found. Expected header + at least one row.');
      }

      const [membersSnap, investmentsSnap, incomeSnap] = await Promise.all([
        db.collection('users').doc(email).collection('family-members').get(),
        db.collection('users').doc(email).collection('investments').get(),
        db.collection('users').doc(email).collection('income-sources').get(),
      ]);
      const members = membersSnap.docs.map(d => d.data() as FamilyMember);
      const investments = investmentsSnap.docs.map(d => normaliseInvestment(d.data()));
      const existingIncome = incomeSnap.docs.map(d => d.data() as IncomeSource);

      const membersByName = new Map(members.map(m => [m.name.toLowerCase(), m]));
      const propertyInvestments = investments.filter(i => i.type === 'Property');
      const incomeKey = (s: { type: string; description: string; owner?: string }) =>
        `${s.type}|${s.description.toLowerCase()}|${(s.owner || '').toLowerCase()}`;
      const existingIncomeKeys = new Set(existingIncome.map(s => incomeKey(s)));

      const preview: CashflowPreviewRow[] = rows.map((row, i) => {
        const rawType = row['type'] || '';
        const typeKey = rawType.trim().toLowerCase();
        const owner = row['owner']?.trim() || undefined;
        const description = row['description']?.trim() || '';
        const amount = parseAmount(row['amount']);

        if (!typeKey) {
          return { rowIndex: i, rawType, destination: 'skip', action: 'skip', label: '(missing Type)', amount, error: 'Missing Type' };
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          return { rowIndex: i, rawType, destination: 'skip', action: 'skip', label: description || rawType, amount: 0, error: 'Missing or invalid Amount' };
        }

        // Salary → family member (upsert by Owner name)
        if (typeKey === 'salary') {
          if (!owner) {
            return { rowIndex: i, rawType, destination: 'skip', action: 'skip', label: '(missing Owner)', amount, error: 'Salary rows need Owner' };
          }
          const existing = membersByName.get(owner.toLowerCase());
          const job = row['job']?.trim();
          const sss = parseFloat((row['super salary sacrifice'] || '0').replace(/[,$"]/g, ''));
          const fm: Omit<FamilyMember, 'id'> = {
            name: existing?.name || owner,
            salary: amount,
            ...(job ? { job } : (existing?.job ? { job: existing.job } : {})),
            ...(Number.isFinite(sss) && sss > 0 ? { superSalarySacrifice: sss } : {}),
          };
          return {
            rowIndex: i, rawType, destination: 'family-member',
            action: existing ? 'update' : 'create',
            label: `${owner} — $${amount.toLocaleString()} p.a.`,
            amount, owner,
            familyMember: fm,
            familyMemberId: existing?.id,
          };
        }

        // Rental → update existing Property investment (match on description vs address/name)
        if (typeKey === 'rental') {
          const needle = description.toLowerCase();
          if (!needle) {
            return { rowIndex: i, rawType, destination: 'skip', action: 'skip', label: '(missing Description)', amount, error: 'Rental rows need Description matching a property' };
          }
          const cadence = normaliseCadence(row['cadence']) || 'monthly';
          const monthly = cadence === 'monthly' ? amount : (cadence === 'annual' ? amount / 12 : cadence === 'weekly' ? amount * 52 / 12 : amount * 26 / 12);
          const match = propertyInvestments.find(inv =>
            (inv.address && inv.address.toLowerCase().includes(needle)) ||
            inv.name.toLowerCase().includes(needle)
          );
          if (!match) {
            return {
              rowIndex: i, rawType, destination: 'skip', action: 'skip',
              label: description, amount,
              error: `No property matches "${description}"`,
            };
          }
          return {
            rowIndex: i, rawType, destination: 'property', action: 'update',
            label: `${match.name} — $${Math.round(monthly).toLocaleString()}/mo`,
            amount, cadence,
            investmentId: match.id,
            investmentRentalMonthly: monthly,
          };
        }

        // Income source types
        const isType = INCOME_SOURCE_TYPES[typeKey];
        if (isType) {
          const cadence = normaliseCadence(row['cadence']);
          if (!cadence) {
            return { rowIndex: i, rawType, destination: 'skip', action: 'skip', label: description || rawType, amount, error: 'Missing or invalid Cadence (weekly/fortnightly/monthly/annual)' };
          }
          if (!description) {
            return { rowIndex: i, rawType, destination: 'skip', action: 'skip', label: rawType, amount, error: 'Income rows need Description' };
          }
          const src: Omit<IncomeSource, 'id'> = {
            type: isType,
            description,
            amount,
            cadence,
            ...(owner ? { owner } : {}),
          };
          const duplicate = existingIncomeKeys.has(incomeKey(src));
          return {
            rowIndex: i, rawType, destination: duplicate ? 'skip' : 'income-source',
            action: duplicate ? 'skip' : 'create',
            label: `${description} — $${amount.toLocaleString()} ${cadence}`,
            amount, cadence, owner,
            error: duplicate ? 'Duplicate of existing income source' : undefined,
            incomeSource: src,
          };
        }

        return { rowIndex: i, rawType, destination: 'skip', action: 'skip', label: rawType, amount, error: `Unknown Type "${rawType}"` };
      });

      const counts = preview.reduce((c, p) => {
        if (p.action === 'skip') c.skipped++;
        else if (p.action === 'create') c.creates++;
        else c.updates++;
        return c;
      }, { skipped: 0, creates: 0, updates: 0 });

      auditLog({
        endpoint: 'cashflowImport', email, durationMs: Date.now() - start, action: 'preview',
        rowCount: rows.length, ...counts,
      });
      return { preview, total: preview.length, ...counts };
    }

    if (request.data.action === 'save') {
      const { rows } = request.data;
      if (!rows?.length) throw new HttpsError('invalid-argument', 'No rows to save.');

      const batch = db.batch();
      let familyMembersWritten = 0;
      let incomeSourcesWritten = 0;
      let propertiesUpdated = 0;

      for (const row of rows) {
        if (row.destination === 'skip' || row.action === 'skip') continue;

        if (row.destination === 'family-member' && row.familyMember) {
          const col = db.collection('users').doc(email).collection('family-members');
          const ref = row.familyMemberId ? col.doc(row.familyMemberId) : col.doc();
          const data: FamilyMember = { id: ref.id, ...row.familyMember };
          batch.set(ref, data, { merge: row.action === 'update' });
          familyMembersWritten++;
        } else if (row.destination === 'income-source' && row.incomeSource) {
          const col = db.collection('users').doc(email).collection('income-sources');
          const ref = col.doc();
          const data: IncomeSource = { id: ref.id, ...row.incomeSource };
          batch.set(ref, data);
          incomeSourcesWritten++;
        } else if (row.destination === 'property' && row.investmentId && row.investmentRentalMonthly != null) {
          const ref = db.collection('users').doc(email).collection('investments').doc(row.investmentId);
          batch.update(ref, { rentalIncomeMonthly: row.investmentRentalMonthly });
          propertiesUpdated++;
        }
      }

      await batch.commit();
      auditLog({
        endpoint: 'cashflowImport', email, durationMs: Date.now() - start, action: 'save',
        familyMembersWritten, incomeSourcesWritten, propertiesUpdated,
      });
      return { familyMembersWritten, incomeSourcesWritten, propertiesUpdated };
    }

    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
);
