import type { AlertRow, SheetData, AlertResponseValue } from './types';

function col(headers: string[], ...names: string[]): number {
  return headers.findIndex(h => {
    const l = h.trim().toLowerCase();
    return names.some(n => l === n.toLowerCase());
  });
}

function get(row: string[], idx: number): string {
  return idx !== -1 ? (row[idx] ?? '').trim() : '';
}

export function parseAlertData(data: SheetData): AlertRow[] {
  const { headers, rows } = data;

  const iUserId      = col(headers, 'user_id');
  const iCurrency    = col(headers, 'currency');
  const iUpdatedAt   = col(headers, 'updated_at');
  const iAmount      = col(headers, 'amount');
  const iId          = col(headers, 'id');
  const iResponse    = col(headers, 'response');
  const iNotes       = col(headers, 'notes');
  const iIsMinor     = col(headers, 'is minor');
  const iArabicName  = col(headers, 'arabic name');
  const iEnglishName = col(headers, 'english name');
  const iAddress     = col(headers, 'address');
  const iCompany     = col(headers, 'company name');
  const iPhone       = col(headers, 'phone number');
  const iNationality = col(headers, 'nationality');
  const iIdType      = col(headers, 'id type');
  const iIdNumber    = col(headers, 'id number');
  const iIdExpiry    = col(headers, 'id expiry');
  const iCountry     = col(headers, 'country');
  const iDone        = col(headers, 'done');
  const iActionTaken = col(headers, 'action_taken');
  const iAssignedTo  = col(headers, 'assigned to');

  return rows.map((row, idx) => {
    const rawResponse = get(row, iResponse).toLowerCase() as AlertResponseValue;
    const response: AlertResponseValue =
      rawResponse === 'edd_requested' || rawResponse === 'clear' ? rawResponse : '';

    return {
      idx,
      userId:      get(row, iUserId)      || `row-${idx}`,
      currency:    get(row, iCurrency),
      updatedAt:   get(row, iUpdatedAt),
      amount:      get(row, iAmount),
      alertId:     get(row, iId),
      response,
      notes:       get(row, iNotes),
      isMinor:     get(row, iIsMinor),
      arabicName:  get(row, iArabicName),
      englishName: get(row, iEnglishName),
      address:     get(row, iAddress),
      companyName: get(row, iCompany),
      phoneNumber: get(row, iPhone),
      nationality: get(row, iNationality),
      idType:      get(row, iIdType),
      idNumber:    get(row, iIdNumber),
      idExpiry:    get(row, iIdExpiry),
      country:     get(row, iCountry),
      done:        get(row, iDone),
      actionTaken: get(row, iActionTaken),
      assignedTo:  get(row, iAssignedTo),
    } satisfies AlertRow;
  });
}
