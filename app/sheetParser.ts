import type { EddRow, SheetData, CaseStatus, STATUS_OPTIONS as _S } from './types';
import { STATUS_OPTIONS } from './types';

// ── Column detection (mirrors sheets.py keyword matching) ─────────────────────

function findCol(headers: string[], ...keywords: string[]): number {
  return headers.findIndex(h => {
    const l = h.toLowerCase();
    return keywords.some(k => l.includes(k));
  });
}

function exactCol(headers: string[], name: string): number {
  return headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
}

// ── Parse raw sheet data into typed rows ──────────────────────────────────────

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

  // All "upload document" columns
  const docIndices = headers
    .map((h, i) => (h.toLowerCase().startsWith('upload') ? i : -1))
    .filter(i => i !== -1);

  // Columns already claimed by known fields
  const knownIndices = new Set([
    iDate, iUid, iFunding, iEmployer, iJobTitle,
    iIncome, iCountry, iNotes, iAction, iAssigned,
    ...docIndices,
  ].filter(i => i !== -1));

  return rows.map((row, idx) => {
    const get = (i: number) => (i !== -1 ? (row[i] ?? '').trim() : '');

    // Deduplicate UID if the sheet has the same uid multiple times
    // (member_app.py labels them uid (1), uid (2) etc — we keep raw here)
    const uid = get(iUid) || `row-${idx}`;

    // Parse action_taken: may contain "Form Sent — 2024-01-01 12:00"
    const rawAction = get(iAction);
    const actionLabel = rawAction.split(' — ')[0].trim();

    // Document links: collect non-empty cells from doc columns
    const documents = docIndices
      .map(i => get(i))
      .filter(Boolean);

    // Extra: any column not in knownIndices
    const extra: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!knownIndices.has(i) && row[i]?.trim()) {
        extra[h] = row[i].trim();
      }
    });

    return {
      idx,
      uid,
      submittedAt: get(iDate),
      funding:     get(iFunding),
      employer:    get(iEmployer),
      jobTitle:    get(iJobTitle),
      monthlyIncome: get(iIncome),
      country:     get(iCountry),
      notes:       get(iNotes),
      documents,
      rawAction,
      assignedTo:  get(iAssigned),
      extra,
    } satisfies EddRow;
  });
}

// ── Status resolution (session override > sheet value) ────────────────────────

export function resolveStatus(
  row: EddRow,
  overrides: Record<number, CaseStatus>,
): CaseStatus {
  if (overrides[row.idx] !== undefined) return overrides[row.idx];
  const label = row.rawAction.split(' — ')[0].trim() as CaseStatus;
  return STATUS_OPTIONS.includes(label) ? label : 'Pending';
}