import type { EddRow, SheetData, CaseStatus, EddResponseValue } from './types';

const STALE_DAYS = 3;

function findCol(headers: string[], ...keywords: string[]): number {
  return headers.findIndex(h => {
    const l = h.toLowerCase();
    return keywords.some(k => l.includes(k));
  });
}

function exactCol(headers: string[], name: string): number {
  return headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function parseSheetData(data: SheetData): EddRow[] {
  const { headers, rows } = data;

  const iDate     = findCol(headers, 'submitted', 'date', 'time');
  const iUid      = exactCol(headers, 'user_id') !== -1
                      ? exactCol(headers, 'user_id')
                      : findCol(headers, 'user', 'uid', 'id');
  const iFunding  = findCol(headers, 'funding', 'source of income', 'primary');
  const iEmployer = findCol(headers, 'employer');
  const iJobTitle = findCol(headers, 'job titl', 'occupation');
  const iIncome   = findCol(headers, 'monthly income');
  const iCountry  = findCol(headers, 'country of resid', 'residency', 'country');
  const iNotes    = findCol(headers, 'added to notes', 'notes', 'note');
  const iAction   = exactCol(headers, 'action_taken');
  const iAssigned = exactCol(headers, 'assigned to');
  const iResponse = exactCol(headers, 'Response') !== -1
                      ? exactCol(headers, 'Response')
                      : exactCol(headers, 'response');

  // Sheet-sourced account info columns (EG market)
  const iArabicName         = exactCol(headers, 'Arabic Name');
  const iIsMinor            = exactCol(headers, 'Is Minor');
  const iOccupationAr       = exactCol(headers, 'Occupation in Arabic');
  const iAddressAr          = exactCol(headers, 'Address in Arabic');
  const iPortfolioValue     = exactCol(headers, 'Portfolio Value');
  const iPurchasePower      = exactCol(headers, 'Purchase Power');
  const iBlockedCash        = exactCol(headers, 'Blocked Cash');
  const iBookBalance        = exactCol(headers, 'Book Balance');
  const iSavingsWallet      = exactCol(headers, 'Savings Wallet');
  const iCurrDepCount       = exactCol(headers, 'Current Month Number of Deposits');
  const iCurrDepValue       = exactCol(headers, 'Current Month Value of Deposits');
  const iPrevDepCount       = exactCol(headers, 'Previous Month Number of Deposits');
  const iPrevDepValue       = exactCol(headers, 'Previous Month Value of Deposits');

  const docIndices = headers
    .map((h, i) => (h.toLowerCase().startsWith('upload') ? i : -1))
    .filter(i => i !== -1);

  const knownIndices = new Set([
    iDate, iUid, iFunding, iEmployer, iJobTitle,
    iIncome, iCountry, iNotes, iAction, iAssigned, iResponse,
    iArabicName, iIsMinor, iOccupationAr, iAddressAr,
    iPortfolioValue, iPurchasePower, iBlockedCash, iBookBalance, iSavingsWallet,
    iCurrDepCount, iCurrDepValue, iPrevDepCount, iPrevDepValue,
    ...docIndices,
  ].filter(i => i !== -1));

  return rows.map((row, idx) => {
    const get = (i: number) => (i !== -1 ? (row[i] ?? '').trim() : '');

    const uid        = get(iUid) || `row-${idx}`;
    const rawAction  = get(iAction);
    const submittedAt = get(iDate);
    const submittedDate = parseDate(submittedAt);
    const days = daysSince(submittedDate);

    // A case is stale if it's been > STALE_DAYS and not Done
    const actionLabel = rawAction.split(' — ')[0].trim();
    const isDone = actionLabel.toLowerCase().startsWith('done');
    const isStale = !isDone && days !== null && days > STALE_DAYS;

    const documents = docIndices.map(i => get(i)).filter(Boolean);

    const extra: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!knownIndices.has(i) && row[i]?.trim()) {
        extra[h] = row[i].trim();
      }
    });

    const rawResp = get(iResponse).toLowerCase();
    const eddResponse: EddResponseValue =
      rawResp === 'edd_requested' || rawResp === 'edd_accepted' ||
      rawResp === 'edd_rejected'  || rawResp === 'dup'
        ? rawResp as EddResponseValue : '';

    return {
      idx,
      uid,
      submittedAt,
      submittedDate,
      eddResponse,
      funding:       get(iFunding),
      employer:      get(iEmployer),
      jobTitle:      get(iJobTitle),
      monthlyIncome: get(iIncome),
      country:       get(iCountry),
      notes:         get(iNotes),
      documents,
      rawAction,
      assignedTo:    get(iAssigned),
      extra,
      daysSinceSubmission: days,
      isStale,
      arabicName:                get(iArabicName),
      isMinor:                   get(iIsMinor),
      occupationAr:              get(iOccupationAr),
      addressAr:                 get(iAddressAr),
      portfolioValue:            get(iPortfolioValue),
      purchasePower:             get(iPurchasePower),
      blockedCash:               get(iBlockedCash),
      bookBalance:               get(iBookBalance),
      savingsWallet:             get(iSavingsWallet),
      currentMonthDepositsCount: get(iCurrDepCount),
      currentMonthDepositsValue: get(iCurrDepValue),
      prevMonthDepositsCount:    get(iPrevDepCount),
      prevMonthDepositsValue:    get(iPrevDepValue),
    } satisfies EddRow;
  });
}

// Groups rows by uid. Representative = latest non-DUP row per user.
// If the latest row is DUP, walk backwards to find the latest non-DUP.
export function deduplicateRows(rows: EddRow[]): { deduped: EddRow[]; byUid: Map<string, EddRow[]> } {
  const byUid = new Map<string, EddRow[]>();
  for (const row of rows) {
    const list = byUid.get(row.uid) ?? [];
    list.push(row);
    byUid.set(row.uid, list);
  }

  const deduped: EddRow[] = [];
  for (const userRows of byUid.values()) {
    let rep = userRows[userRows.length - 1];
    if (rep.eddResponse === 'dup') {
      const nonDup = [...userRows].reverse().find(r => r.eddResponse !== 'dup');
      if (nonDup) rep = nonDup;
    }
    deduped.push(rep);
  }

  return { deduped, byUid };
}

export function resolveStatus(
  row: EddRow,
  overrides: Record<number, CaseStatus>,
): CaseStatus {
  if (overrides[row.idx] !== undefined) return overrides[row.idx];
  if (row.eddResponse === 'edd_requested') return 'Requested';
  if (row.eddResponse === 'edd_accepted')  return 'Accepted';
  if (row.eddResponse === 'edd_rejected')  return 'Rejected';
  return 'Pending';
}