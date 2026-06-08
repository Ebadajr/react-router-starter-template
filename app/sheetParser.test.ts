import { describe, it, expect, beforeEach } from 'vitest';
import { parseSheetData, resolveStatus } from './sheetParser';
import type { SheetData, EddRow } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSheet(extraHeaders: string[] = [], extraCols: string[] = []): SheetData {
  const headers = [
    'Timestamp', 'user_id', 'Primary Funding Source', 'Employer',
    'Job Title', 'Monthly Income', 'Country of Residency', 'Added to Notes',
    'action_taken', 'assigned to',
    ...extraHeaders,
  ];
  const row = [
    '2024-01-15', 'UID001', 'Salary', 'Acme Corp',
    'Engineer', '5000', 'Egypt', 'No notes',
    'Pending', 'Sara',
    ...extraCols,
  ];
  return { headers, rows: [row] };
}

// ── parseSheetData ────────────────────────────────────────────────────────────

describe('parseSheetData', () => {
  it('maps known columns to EddRow fields', () => {
    const data = makeSheet();
    const [row] = parseSheetData(data);

    expect(row.uid).toBe('UID001');
    expect(row.submittedAt).toBe('2024-01-15');
    expect(row.funding).toBe('Salary');
    expect(row.employer).toBe('Acme Corp');
    expect(row.jobTitle).toBe('Engineer');
    expect(row.monthlyIncome).toBe('5000');
    expect(row.country).toBe('Egypt');
    expect(row.notes).toBe('No notes');
    expect(row.rawAction).toBe('Pending');
    expect(row.assignedTo).toBe('Sara');
  });

  it('assigns sequential idx values starting from 0', () => {
    const data: SheetData = {
      headers: ['user_id'],
      rows: [['A'], ['B'], ['C']],
    };
    const rows = parseSheetData(data);
    expect(rows.map(r => r.idx)).toEqual([0, 1, 2]);
  });

  it('falls back to row-N uid when user_id column is empty', () => {
    const data: SheetData = { headers: ['user_id'], rows: [[''], [''], ['']] };
    const rows = parseSheetData(data);
    expect(rows[0].uid).toBe('row-0');
    expect(rows[1].uid).toBe('row-1');
  });

  it('parses submittedDate as a Date object', () => {
    const data = makeSheet();
    const [row] = parseSheetData(data);
    expect(row.submittedDate).toBeInstanceOf(Date);
  });

  it('returns null submittedDate for unparseable dates', () => {
    const data: SheetData = { headers: ['Timestamp', 'user_id'], rows: [['not-a-date', 'U1']] };
    const [row] = parseSheetData(data);
    expect(row.submittedDate).toBeNull();
  });

  it('collects document upload columns', () => {
    const data = makeSheet(['Upload 1', 'Upload 2'], ['http://doc1.pdf', 'http://doc2.pdf']);
    const [row] = parseSheetData(data);
    expect(row.documents).toEqual(['http://doc1.pdf', 'http://doc2.pdf']);
  });

  it('ignores empty document values', () => {
    const data = makeSheet(['Upload 1', 'Upload 2'], ['', 'http://doc.pdf']);
    const [row] = parseSheetData(data);
    expect(row.documents).toEqual(['http://doc.pdf']);
  });

  it('places unknown columns in extra', () => {
    const data = makeSheet(['custom_field'], ['custom_value']);
    const [row] = parseSheetData(data);
    expect(row.extra['custom_field']).toBe('custom_value');
  });

  it('handles rows shorter than the header row by padding with empty strings', () => {
    const data: SheetData = {
      headers: ['user_id', 'action_taken', 'assigned to'],
      rows: [['UID001']],
    };
    const [row] = parseSheetData(data);
    expect(row.uid).toBe('UID001');
    expect(row.rawAction).toBe('');
    expect(row.assignedTo).toBe('');
  });

  it('calculates daysSinceSubmission from submittedDate', () => {
    // Use a date 10 days ago
    const d = new Date();
    d.setDate(d.getDate() - 10);
    const data: SheetData = {
      headers: ['Timestamp', 'user_id'],
      rows: [[d.toISOString(), 'U1']],
    };
    const [row] = parseSheetData(data);
    expect(row.daysSinceSubmission).toBeGreaterThanOrEqual(9);
    expect(row.daysSinceSubmission).toBeLessThanOrEqual(11);
  });

  it('marks row as stale when unreviewed for > 3 days', () => {
    const old = new Date();
    old.setDate(old.getDate() - 5);
    const data: SheetData = {
      headers: ['Timestamp', 'user_id', 'action_taken'],
      rows: [[old.toISOString(), 'U1', 'Pending']],
    };
    const [row] = parseSheetData(data);
    expect(row.isStale).toBe(true);
  });

  it('does not mark Done rows as stale', () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    const data: SheetData = {
      headers: ['Timestamp', 'user_id', 'action_taken'],
      rows: [[old.toISOString(), 'U1', 'Done']],
    };
    const [row] = parseSheetData(data);
    expect(row.isStale).toBe(false);
  });

  it('does not mark recent rows as stale', () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 1);
    const data: SheetData = {
      headers: ['Timestamp', 'user_id', 'action_taken'],
      rows: [[recent.toISOString(), 'U1', 'Pending']],
    };
    const [row] = parseSheetData(data);
    expect(row.isStale).toBe(false);
  });

  it('handles " — " separator in action_taken for staleness check', () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    const data: SheetData = {
      headers: ['Timestamp', 'user_id', 'action_taken'],
      rows: [[old.toISOString(), 'U1', 'Done — some note']],
    };
    const [row] = parseSheetData(data);
    expect(row.isStale).toBe(false);
  });

  it('returns empty array for empty sheet', () => {
    expect(parseSheetData({ headers: [], rows: [] })).toEqual([]);
  });

  it('handles deduped headers (e.g. _2 suffix) without crashing', () => {
    const data: SheetData = {
      headers: ['user_id', 'user_id _2'],
      rows: [['U1', 'U2']],
    };
    expect(() => parseSheetData(data)).not.toThrow();
  });
});

// ── resolveStatus ─────────────────────────────────────────────────────────────

describe('resolveStatus', () => {
  function row(rawAction: string): EddRow {
    return {
      idx: 0, uid: 'U', submittedAt: '', submittedDate: null,
      funding: '', employer: '', jobTitle: '', monthlyIncome: '',
      country: '', notes: '', documents: [], rawAction,
      assignedTo: '', extra: {}, daysSinceSubmission: null, isStale: false,
    };
  }

  it('returns Pending for empty rawAction', () => {
    expect(resolveStatus(row(''), {})).toBe('Pending');
  });

  it('returns the valid status from rawAction', () => {
    expect(resolveStatus(row('Form Sent'), {})).toBe('Form Sent');
    expect(resolveStatus(row('Under Review'), {})).toBe('Under Review');
    expect(resolveStatus(row('Done'), {})).toBe('Done');
  });

  it('extracts status from "Status — detail" format', () => {
    expect(resolveStatus(row('Under Review — Send details to cx'), {})).toBe('Under Review');
    expect(resolveStatus(row('Done — edd_accepted'), {})).toBe('Done');
  });

  it('falls back to Pending for unrecognised rawAction', () => {
    expect(resolveStatus(row('edd_requested'), {})).toBe('Pending');
    expect(resolveStatus(row('Send details to cx'), {})).toBe('Pending');
    expect(resolveStatus(row('some garbage'), {})).toBe('Pending');
  });

  it('prefers override over rawAction', () => {
    const r = row('Pending');
    expect(resolveStatus(r, { 0: 'Done' })).toBe('Done');
  });

  it('override does not affect other rows', () => {
    const r0 = { ...row('Pending'), idx: 0 };
    const r1 = { ...row('Pending'), idx: 1 };
    const overrides = { 0: 'Done' as const };
    expect(resolveStatus(r0, overrides)).toBe('Done');
    expect(resolveStatus(r1, overrides)).toBe('Pending');
  });
});
