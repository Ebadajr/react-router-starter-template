import { getGoogleToken } from './google-auth';

export interface Env {
  ASSETS?: Fetcher;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  GOOGLE_SHEET_ID: string;
  GOOGLE_WORKSHEET_NAME: string;
  USERTOOL_ADMIN_TOKEN: string;
  DATA_START_ROW?: string; // if set, headers from row 1 + data from this row onwards
}

const MARKET_WORKSHEETS: Record<string, string> = {
  UAE: 'EDD_UAE_Response',
};

// UAE uses a different spreadsheet from EG.
// null means fall back to env.GOOGLE_SHEET_ID (EG default).
const UAE_SHEET_ID = '1Rii_zv90tF1Prso2e10Hy2APiWUEIt-Ehg6csKl8N8g';
const MARKET_SHEET_IDS: Record<string, string | null> = {
  EG:  null,
  UAE: UAE_SHEET_ID,
};

function sheetIdForMarket(market: string, env: Env): string {
  return MARKET_SHEET_IDS[market] ?? env.GOOGLE_SHEET_ID;
}

// Row offset: idx 0 maps to this sheet row number.
// Normal sheets: header=row1, data starts at row2 → offset=2
// With DATA_START_ROW: data starts at that row → offset=DATA_START_ROW
function dataRowOffset(env: Env): number {
  const n = env.DATA_START_ROW ? parseInt(env.DATA_START_ROW, 10) : 2;
  return isNaN(n) ? 2 : n;
}

// ── Alerts sheets — tab on the UAE spreadsheet ────────────────────────────────
const ALERTS_SHEET_ID = UAE_SHEET_ID;
const ALERT_WORKSHEETS: Record<string, string> = {
  edd_deposits: 'EDD-UAE-ALERTS',
};

const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/api/debug-sa' && request.method === 'GET') {
      const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON ?? 'undefined';
      try {
        const parsed = JSON.parse(raw) as { client_email: string; private_key: string };
        return new Response(JSON.stringify({
          success: true,
          client_email: parsed.client_email,
          sheet_id: env.GOOGLE_SHEET_ID,
          worksheet: env.GOOGLE_WORKSHEET_NAME,
          key_length: parsed.private_key?.length,
        }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        const err = e as SyntaxError;
        const match = err.message.match(/position (\d+)/);
        const pos = match ? parseInt(match[1]) : -1;
        return new Response(JSON.stringify({
          success: false,
          error: err.message,
          pos,
          char_at_pos: raw.charCodeAt(pos),
          char_display: raw.slice(pos - 5, pos + 5),
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/api/sheets' && request.method === 'GET') {
      return withCors(await handleSheetsLoad(url, env));
    }
    if (url.pathname === '/api/action' && request.method === 'POST') {
      return withCors(await handleWriteAction(request, env));
    }
    if (url.pathname === '/api/response' && request.method === 'POST') {
      return withCors(await handleWriteResponse(request, env));
    }
    if (url.pathname === '/api/assign' && request.method === 'POST') {
      return withCors(await handleAssign(request, env));
    }
    if (url.pathname === '/api/usertool' && request.method === 'GET') {
      return withCors(await handleUserTool(url, env));
    }
    if (url.pathname === '/api/alerts' && request.method === 'GET') {
      return withCors(await handleAlertsLoad(url, env));
    }
    if (url.pathname === '/api/alert-action' && request.method === 'POST') {
      return withCors(await handleAlertAction(request, env));
    }
    if (url.pathname === '/api/alert-assign' && request.method === 'POST') {
      return withCors(await handleAlertAssign(request, env));
    }

    try {
      const { default: handler } = await import('./index.js' as any);
      if (typeof handler?.fetch === 'function') {
        return handler.fetch(request, env, ctx);
      }
    } catch { }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};

// ── Resolve worksheet from market param ───────────────────────────────────────

function resolveWorksheet(url: URL, env: Env, bodyMarket?: string): string {
  const market = url.searchParams.get('market') ?? bodyMarket ?? 'EG';
  return MARKET_WORKSHEETS[market] ?? env.GOOGLE_WORKSHEET_NAME ?? 'Response';
}

// ── GET /api/sheets?market=EG|UAE ─────────────────────────────────────────────

async function handleSheetsLoad(url: URL, env: Env): Promise<Response> {
  try {
    const market = url.searchParams.get('market') ?? 'EG';
    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const tabName = resolveWorksheet(url, env);
    const sheetId = sheetIdForMarket(market, env);

    const dataStartRow = env.DATA_START_ROW ? parseInt(env.DATA_START_ROW, 10) : null;

    let headerRow: string[];
    let dataRows: string[][];

    if (dataStartRow && dataStartRow > 2) {
      // Fetch headers (row 1) and data (dataStartRow+) separately via batchGet
      const r1 = encodeURIComponent(`${tabName}!A1:ZZ1`);
      const r2 = encodeURIComponent(`${tabName}!A${dataStartRow}:ZZ`);
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=${r1}&ranges=${r2}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) return jsonError(`Sheets API error (${resp.status}): ${await resp.text()}`, resp.status);
      const { valueRanges = [] } = await resp.json() as { valueRanges?: { values?: string[][] }[] };
      headerRow = valueRanges[0]?.values?.[0] ?? [];
      dataRows  = valueRanges[1]?.values ?? [];
    } else {
      const range = encodeURIComponent(`${tabName}!A:ZZ`);
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) return jsonError(`Sheets API error (${resp.status}): ${await resp.text()}`, resp.status);
      const { values = [] } = await resp.json() as { values?: string[][] };
      if (values.length === 0) return jsonOk({ headers: [], rows: [] });
      headerRow = values[0];
      dataRows  = values.slice(1);
    }

    if (headerRow.length === 0) return jsonOk({ headers: [], rows: [] });

    const headers = dedupeHeaders(headerRow);
    const n = headers.length;
    const rows = dataRows.map(r =>
      r.length >= n ? r.slice(0, n) : [...r, ...Array(n - r.length).fill('')],
    );

    return jsonOk({ headers, rows });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── POST /api/action — writes to action_taken column ─────────────────────────

async function handleWriteAction(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { rowIndex?: number; action?: string; market?: string };
    const { rowIndex, action, market } = body;
    if (rowIndex == null || action == null) return jsonError('rowIndex and action are required', 400);

    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const tabName = MARKET_WORKSHEETS[market ?? 'EG'] ?? env.GOOGLE_WORKSHEET_NAME ?? 'Response';
    const sheetId = sheetIdForMarket(market ?? 'EG', env);

    const colIdx = await findColumnIndex(token, sheetId, tabName, 'action_taken');
    if (colIdx === null) return jsonError("Column 'action_taken' not found in sheet", 404);

    const range = encodeURIComponent(`${tabName}!${toColLetter(colIdx)}${rowIndex + dataRowOffset(env)}`);
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[action]] }),
      },
    );

    if (!resp.ok) return jsonError(`Sheets write error (${resp.status}): ${await resp.text()}`, resp.status);
    return jsonOk({ ok: true, rowIndex, action });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── POST /api/response — writes to Response column ───────────────────────────

async function handleWriteResponse(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { rowIndex?: number; response?: string; market?: string };
    const { rowIndex, response, market } = body;
    if (rowIndex == null || response == null) return jsonError('rowIndex and response are required', 400);

    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const tabName = MARKET_WORKSHEETS[market ?? 'EG'] ?? env.GOOGLE_WORKSHEET_NAME ?? 'Response';
    const sheetId = sheetIdForMarket(market ?? 'EG', env);

    const colIdx = await findColumnIndex(token, sheetId, tabName, 'response');
    if (colIdx === null) return jsonError("Column 'response' not found in sheet", 404);

    const range = encodeURIComponent(`${tabName}!${toColLetter(colIdx)}${rowIndex + dataRowOffset(env)}`);
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[response]] }),
      },
    );

    if (!resp.ok) return jsonError(`Sheets write error (${resp.status}): ${await resp.text()}`, resp.status);
    return jsonOk({ ok: true, rowIndex, action: response });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── POST /api/assign ──────────────────────────────────────────────────────────

async function handleAssign(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { rowIndices?: number[]; username?: string; market?: string };
    const { rowIndices, username, market } = body;
    if (!Array.isArray(rowIndices) || username == null) {
      return jsonError('rowIndices (array) and username are required', 400);
    }

    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const tabName = MARKET_WORKSHEETS[market ?? 'EG'] ?? env.GOOGLE_WORKSHEET_NAME ?? 'Response';
    const sheetId = sheetIdForMarket(market ?? 'EG', env);

    const colIdx = await findColumnIndex(token, sheetId, tabName, 'assigned to');
    if (colIdx === null) return jsonError("Column 'Assigned To' not found in sheet", 404);

    const colLetter = toColLetter(colIdx);
    const offset = dataRowOffset(env);
    const data = rowIndices.map(ridx => ({
      range: `${tabName}!${colLetter}${ridx + offset}`,
      values: [[username]],
    }));

    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data }),
      },
    );

    if (!resp.ok) return jsonError(`Sheets batch write error (${resp.status}): ${await resp.text()}`, resp.status);
    return jsonOk({ ok: true, assigned: rowIndices.length, username });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── GET /api/usertool?uid=X ───────────────────────────────────────────────────

async function handleUserTool(url: URL, env: Env): Promise<Response> {
  try {
    const uid = url.searchParams.get('uid');
    if (!uid) return jsonError('uid query param required', 400);

    const resp = await fetch(
      `https://admin-service.thndr-internal.app/compliance-service/admin/account-forms/${uid}`,
      {
        headers: {
          Authorization: `Bearer ${env.USERTOOL_ADMIN_TOKEN}`,
          Accept: 'application/json',
        },
      },
    );

    if (!resp.ok) return jsonError(`UserTool error (${resp.status}): ${await resp.text()}`, resp.status);
    return jsonOk(await resp.json());
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── GET /api/alerts?type=edd_deposits ─────────────────────────────────────────

async function handleAlertsLoad(url: URL, env: Env): Promise<Response> {
  try {
    const type = url.searchParams.get('type') ?? 'edd_deposits';
    const tabName = ALERT_WORKSHEETS[type];
    if (!tabName) return jsonError(`Unknown alert type: ${type}`, 400);

    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const range = encodeURIComponent(`${tabName}!A:ZZ`);

    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ALERTS_SHEET_ID}/values/${range}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!resp.ok) return jsonError(`Sheets API error (${resp.status}): ${await resp.text()}`, resp.status);

    const { values = [] } = await resp.json() as { values?: string[][] };
    if (values.length === 0) return jsonOk({ headers: [], rows: [] });

    const headers = dedupeHeaders(values[0]);
    const n = headers.length;
    const rows = values.slice(1).map(r =>
      r.length >= n ? r.slice(0, n) : [...r, ...Array(n - r.length).fill('')],
    );

    return jsonOk({ headers, rows });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── POST /api/alert-action ────────────────────────────────────────────────────
// Writes "{action} — {username}" to action_taken column.
// For edd_requested / clear, also writes the action to the Response column.

async function handleAlertAction(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      rowIndex?: number; action?: string; username?: string; type?: string;
    };
    const { rowIndex, action, username, type = 'edd_deposits' } = body;
    if (rowIndex == null || !action || !username) {
      return jsonError('rowIndex, action, and username are required', 400);
    }

    const tabName = ALERT_WORKSHEETS[type];
    if (!tabName) return jsonError(`Unknown alert type: ${type}`, 400);

    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const cellRow = rowIndex + 2;
    const updates: { range: string; values: string[][] }[] = [];

    // Always write to action_taken if the column exists
    const actionColIdx = await findColumnIndexInSheet(token, ALERTS_SHEET_ID, tabName, 'action_taken');
    if (actionColIdx !== null) {
      updates.push({
        range: `${tabName}!${toColLetter(actionColIdx)}${cellRow}`,
        values: [[`${action} — ${username}`]],
      });
    }

    // For the two main decisions, also update the Response column
    if (action === 'edd_requested' || action === 'clear') {
      const responseColIdx = await findColumnIndexInSheet(token, ALERTS_SHEET_ID, tabName, 'response');
      if (responseColIdx !== null) {
        updates.push({
          range: `${tabName}!${toColLetter(responseColIdx)}${cellRow}`,
          values: [[action]],
        });
      }
    }

    if (updates.length === 0) {
      return jsonError("Neither 'action_taken' nor 'Response' column found in sheet", 404);
    }

    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ALERTS_SHEET_ID}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
      },
    );

    if (!resp.ok) return jsonError(`Sheets write error (${resp.status}): ${await resp.text()}`, resp.status);
    return jsonOk({ ok: true, rowIndex, action });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── POST /api/alert-assign ────────────────────────────────────────────────────

async function handleAlertAssign(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      rowIndices?: number[]; username?: string; type?: string;
    };
    const { rowIndices, username, type = 'edd_deposits' } = body;
    if (!Array.isArray(rowIndices) || username == null) {
      return jsonError('rowIndices (array) and username are required', 400);
    }

    const tabName = ALERT_WORKSHEETS[type];
    if (!tabName) return jsonError(`Unknown alert type: ${type}`, 400);

    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const colIdx = await findColumnIndexInSheet(token, ALERTS_SHEET_ID, tabName, 'assigned to');
    if (colIdx === null) return jsonError("Column 'assigned to' not found in alerts sheet", 404);

    const colLetter = toColLetter(colIdx);
    const data = rowIndices.map(ridx => ({
      range: `${tabName}!${colLetter}${ridx + 2}`,
      values: [[username]],
    }));

    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ALERTS_SHEET_ID}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data }),
      },
    );

    if (!resp.ok) return jsonError(`Sheets batch write error (${resp.status}): ${await resp.text()}`, resp.status);
    return jsonOk({ ok: true, assigned: rowIndices.length, username });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

// Alias with a clearer name for the alerts sheet (different sheet ID)
async function findColumnIndexInSheet(
  token: string, sheetId: string, tabName: string, targetLower: string,
): Promise<number | null> {
  return findColumnIndex(token, sheetId, tabName, targetLower);
}

async function findColumnIndex(
  token: string, sheetId: string, tabName: string, targetLower: string,
): Promise<number | null> {
  const range = encodeURIComponent(`${tabName}!1:1`);
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) return null;
  const { values = [] } = await resp.json() as { values?: string[][] };
  if (!values[0]) return null;
  const idx = values[0].findIndex(h => h.trim().toLowerCase() === targetLower);
  return idx === -1 ? null : idx + 1;
}

function toColLetter(n: number): string {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function dedupeHeaders(raw: string[]): string[] {
  const seen: Record<string, number> = {};
  return raw.map((h, i) => {
    const key = h.trim() || `__col_${i}__`;
    if (seen[key] == null) { seen[key] = 1; return key; }
    seen[key]++;
    return `${key} _${seen[key]}`;
  });
}

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function withCors(response: Response): Response {
  const r = new Response(response.body, response);
  Object.entries(CORS).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}
