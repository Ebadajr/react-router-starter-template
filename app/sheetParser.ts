import type { EddRow, SheetData, CaseStatus } from './types';
import { STATUS_OPTIONS } from './types';

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

  const docIndices = headers
    .map((h, i) => (h.toLowerCase().startsWith('upload') ? i : -1))
    .filter(i => i !== -1);

  const knownIndices = new Set([
    iDate, iUid, iFunding, iEmployer, iJobTitle,
    iIncome, iCountry, iNotes, iAction, iAssigned,
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

    return {
      idx,
      uid,
      submittedAt,
      submittedDate,
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
    } satisfies EddRow;
  });
}

export function resolveStatus(
  row: EddRow,
  overrides: Record<number, CaseStatus>,
): CaseStatus {
  if (overrides[row.idx] !== undefined) return overrides[row.idx];
  const label = row.rawAction.split(' — ')[0].trim() as CaseStatus;
  return STATUS_OPTIONS.includes(label) ? label : 'Pending';
}