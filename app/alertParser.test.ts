import { describe, it, expect } from 'vitest';
import { parseAlertData } from './alertParser';
import type { SheetData } from './types';

const HEADERS = [
  'user_id', 'currency', 'updated_at', 'amount', 'id',
  'Response', 'Notes', 'Is minor', 'Arabic Name', 'English name',
  'Address', 'Company name', 'Phone number', 'Nationality',
  'ID type', 'ID Number', 'ID Expiry', 'Country', 'done',
  'action_taken', 'assigned to',
];

function makeSheet(row: string[]): SheetData {
  return { headers: HEADERS, rows: [row] };
}

const FULL_ROW = [
  'UID001', 'AED', '2024-06-01', '15000', 'ALERT-1',
  'edd_requested', 'Some note', 'No', 'محمد', 'Mohamed Ahmed',
  '123 Main St', 'Acme LLC', '+971501234567', 'EGY',
  'National ID', 'ID-999', '2030-01-01', 'UAE', 'FALSE',
  'edd_requested — Sara', 'Sara',
];

describe('parseAlertData', () => {
  it('maps all columns correctly', () => {
    const [row] = parseAlertData(makeSheet(FULL_ROW));
    expect(row.userId).toBe('UID001');
    expect(row.currency).toBe('AED');
    expect(row.updatedAt).toBe('2024-06-01');
    expect(row.amount).toBe('15000');
    expect(row.alertId).toBe('ALERT-1');
    expect(row.response).toBe('edd_requested');
    expect(row.notes).toBe('Some note');
    expect(row.isMinor).toBe('No');
    expect(row.arabicName).toBe('محمد');
    expect(row.englishName).toBe('Mohamed Ahmed');
    expect(row.address).toBe('123 Main St');
    expect(row.companyName).toBe('Acme LLC');
    expect(row.phoneNumber).toBe('+971501234567');
    expect(row.nationality).toBe('EGY');
    expect(row.idType).toBe('National ID');
    expect(row.idNumber).toBe('ID-999');
    expect(row.idExpiry).toBe('2030-01-01');
    expect(row.country).toBe('UAE');
    expect(row.done).toBe('FALSE');
    expect(row.actionTaken).toBe('edd_requested — Sara');
    expect(row.assignedTo).toBe('Sara');
  });

  it('assigns sequential idx', () => {
    const data: SheetData = {
      headers: HEADERS,
      rows: [FULL_ROW, [...FULL_ROW.slice(0, -2), '', '']],
    };
    const rows = parseAlertData(data);
    expect(rows[0].idx).toBe(0);
    expect(rows[1].idx).toBe(1);
  });

  it('maps "clear" response correctly', () => {
    const row = [...FULL_ROW];
    row[5] = 'clear';
    const [parsed] = parseAlertData(makeSheet(row));
    expect(parsed.response).toBe('clear');
  });

  it('maps empty response to empty string', () => {
    const row = [...FULL_ROW];
    row[5] = '';
    const [parsed] = parseAlertData(makeSheet(row));
    expect(parsed.response).toBe('');
  });

  it('ignores unknown response values (treats as empty)', () => {
    const row = [...FULL_ROW];
    row[5] = 'some_garbage';
    const [parsed] = parseAlertData(makeSheet(row));
    expect(parsed.response).toBe('');
  });

  it('handles missing action_taken / assigned to columns gracefully', () => {
    const headers = HEADERS.slice(0, -2); // remove action_taken and assigned to
    const shortRow = FULL_ROW.slice(0, -2);
    const [parsed] = parseAlertData({ headers, rows: [shortRow] });
    expect(parsed.actionTaken).toBe('');
    expect(parsed.assignedTo).toBe('');
  });

  it('uses row-N as userId when user_id is empty', () => {
    const row = [...FULL_ROW];
    row[0] = '';
    const [parsed] = parseAlertData(makeSheet(row));
    expect(parsed.userId).toBe('row-0');
  });

  it('returns empty array for empty sheet', () => {
    expect(parseAlertData({ headers: [], rows: [] })).toEqual([]);
  });

  it('pads short rows with empty strings', () => {
    const data: SheetData = { headers: HEADERS, rows: [['UID001']] };
    const [parsed] = parseAlertData(data);
    expect(parsed.userId).toBe('UID001');
    expect(parsed.currency).toBe('');
    expect(parsed.amount).toBe('');
  });
});
