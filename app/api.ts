import type { SheetData, ActionResult, AssignResult, UserProfile, Market } from './types';

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

// Re-export types for convenience
export type { SheetData, ActionResult, AssignResult };