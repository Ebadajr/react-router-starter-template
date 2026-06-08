import type { SheetData, ActionResult, AssignResult, UserProfile, Market, AlertType } from './types';

const BASE = '';

async function _get<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`);
  if (!resp.ok) {
    const { error } = await resp.json().catch(() => ({ error: resp.statusText })) as { error: string };
    throw new Error(error);
  }
  return resp.json() as Promise<T>;
}

async function _post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const { error } = await resp.json().catch(() => ({ error: resp.statusText })) as { error: string };
    throw new Error(error);
  }
  return resp.json() as Promise<T>;
}

export async function loadSheet(market: Market): Promise<SheetData> {
  return _get<SheetData>(`/api/sheets?market=${market}`);
}

export async function writeAction(rowIndex: number, action: string, market: Market): Promise<ActionResult> {
  return _post<ActionResult>('/api/action', { rowIndex, action, market });
}

// Writes to the "Response" column — used for edd_accepted / edd_rejected / edd_requested
export async function writeResponse(rowIndex: number, response: string, market: Market): Promise<ActionResult> {
  return _post<ActionResult>('/api/response', { rowIndex, response, market });
}

export async function assignRows(rowIndices: number[], username: string, market: Market): Promise<AssignResult> {
  return _post<AssignResult>('/api/assign', { rowIndices, username, market });
}

export async function assignRow(rowIndex: number, username: string, market: Market): Promise<AssignResult> {
  return assignRows([rowIndex], username, market);
}

export async function clearAssignment(rowIndex: number, market: Market): Promise<AssignResult> {
  return assignRows([rowIndex], '', market);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile> {
  return _get<UserProfile>(`/api/usertool?uid=${encodeURIComponent(uid)}`);
}

// ── Alerts API ────────────────────────────────────────────────────────────────

export async function loadAlerts(type: AlertType): Promise<SheetData> {
  return _get<SheetData>(`/api/alerts?type=${type}`);
}

// action = edd_requested | clear | any other string
// Also writes to the Response column when action is a decision
export async function writeAlertAction(
  rowIndex: number,
  action: string,
  username: string,
  type: AlertType,
): Promise<ActionResult> {
  return _post<ActionResult>('/api/alert-action', { rowIndex, action, username, type });
}

export async function assignAlertRows(
  rowIndices: number[],
  username: string,
  type: AlertType,
): Promise<AssignResult> {
  return _post<AssignResult>('/api/alert-assign', { rowIndices, username, type });
}

export type { SheetData, ActionResult, AssignResult };
