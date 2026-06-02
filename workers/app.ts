/**
 * workers/app.ts
 * Cloudflare Worker — API routes + React Router frontend handler.
 */

import { getGoogleToken } from './google-auth';

export interface Env {
  ASSETS?: Fetcher;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  GOOGLE_SHEET_ID: string;
  GOOGLE_WORKSHEET_NAME: string;
  USERTOOL_ADMIN_TOKEN: string;
}

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

    if (url.pathname === '/api/sheets' && request.method === 'GET') {
      return withCors(await handleSheetsLoad(env));
    }
    if (url.pathname === '/api/action' && request.method === 'POST') {
      return withCors(await handleWriteAction(request, env));
    }
    if (url.pathname === '/api/assign' && request.method === 'POST') {
      return withCors(await handleAssign(request, env));
    }
    if (url.pathname === '/api/usertool' && request.method === 'GET') {
      return withCors(await handleUserTool(url, env));
    }

    // Fall through to React Router SSR handler
  

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};

async function handleSheetsLoad(env: Env): Promise<Response> {
  try {
    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const tabName = env.GOOGLE_WORKSHEET_NAME || 'Response';
    const range = encodeURIComponent(`${tabName}!A:ZZ`);
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${range}`,
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

async function handleWriteAction(request: Request, env: Env): Promise<Response> {
  try {
    const { rowIndex, action } = await request.json() as { rowIndex?: number; action?: string };
    if (rowIndex == null || action == null) return jsonError('rowIndex and action are required', 400);
    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const tabName = env.GOOGLE_WORKSHEET_NAME || 'Response';
    const colIdx = await findColumnIndex(token, env.GOOGLE_SHEET_ID, tabName, 'action_taken');
    if (colIdx === null) return jsonError("Column 'action_taken' not found in sheet", 404);
    const range = encodeURIComponent(`${tabName}!${toColLetter(colIdx)}${rowIndex + 2}`);
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${range}?valueInputOption=RAW`,
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

async function handleAssign(request: Request, env: Env): Promise<Response> {
  try {
    const { rowIndices, username } = await request.json() as { rowIndices?: number[]; username?: string };
    if (!Array.isArray(rowIndices) || username == null) {
      return jsonError('rowIndices (array) and username are required', 400);
    }
    const token = await getGoogleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPES);
    const tabName = env.GOOGLE_WORKSHEET_NAME || 'Response';
    const colIdx = await findColumnIndex(token, env.GOOGLE_SHEET_ID, tabName, 'assigned to');
    if (colIdx === null) return jsonError("Column 'Assigned To' not found in sheet", 404);
    const colLetter = toColLetter(colIdx);
    const data = rowIndices.map(ridx => ({
      range: `${tabName}!${colLetter}${ridx + 2}`,
      values: [[username]],
    }));
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values:batchUpdate`,
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

async function handleUserTool(url: URL, env: Env): Promise<Response> {
  try {
    const uid = url.searchParams.get('uid');
    if (!uid) return jsonError('uid query param required', 400);
    const resp = await fetch(
      `https://admin-service.thndr-internal.app/compliance-service/admin/account-forms/${uid}`,
      {
        headers: {
          Authorization: `${env.USERTOOL_ADMIN_TOKEN}`,
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