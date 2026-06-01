/**
 * api.ts
 * Thin fetch wrappers for all Worker API routes.
 * Import these in your React components instead of calling fetch() directly.
 *
 * All functions throw on non-2xx responses (with the server's error message).
 */

// ── Response types ────────────────────────────────────────────────────────────

export interface SheetData {
  headers: string[];
  rows: string[][];
}

export interface ActionResult {
  ok: boolean;
  rowIndex: number;
  action: string;
}

export interface AssignResult {
  ok: boolean;
  assigned: number;
  username: string;
}

// UserTool returns a dynamic object — use Record for now and narrow it
// in your components once you know the exact shape.
export type UserProfile = Record<string, unknown>;

// ── Internal helpers ──────────────────────────────────────────────────────────

const BASE = ''; // same origin — Worker serves both API and React bundle

async function _get<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`);
  if (!resp.ok) {
    const { error } = await resp
      .json()
      .catch(() => ({ error: resp.statusText })) as { error: string };
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
    const { error } = await resp
      .json()
      .catch(() => ({ error: resp.statusText })) as { error: string };
    throw new Error(error);
  }
  return resp.json() as Promise<T>;
}

// ── Sheet data ────────────────────────────────────────────────────────────────

/** Load all rows from the Google Sheet. */
export async function loadSheet(): Promise<SheetData> {
  return _get<SheetData>('/api/sheets');
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Write an action_taken value to a single row.
 * @param rowIndex  0-based row index (first data row = 0)
 * @param action    e.g. "Form Sent", "Under Review", "Done"
 */
export async function writeAction(rowIndex: number, action: string): Promise<ActionResult> {
  return _post<ActionResult>('/api/action', { rowIndex, action });
}

// ── Assignments ───────────────────────────────────────────────────────────────

/**
 * Assign one or many rows to a user.
 * @param rowIndices  0-based row indices
 * @param username    e.g. "Sara"
 */
export async function assignRows(rowIndices: number[], username: string): Promise<AssignResult> {
  return _post<AssignResult>('/api/assign', { rowIndices, username });
}

/** Assign a single row. */
export async function assignRow(rowIndex: number, username: string): Promise<AssignResult> {
  return assignRows([rowIndex], username);
}

/** Clear an assignment. */
export async function clearAssignment(rowIndex: number): Promise<AssignResult> {
  return assignRows([rowIndex], '');
}

// ── UserTool ──────────────────────────────────────────────────────────────────

/**
 * Fetch a UserTool profile for a given user ID.
 * The Worker proxies this so the admin token never reaches the browser.
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile> {
  return _get<UserProfile>(`/api/usertool?uid=${encodeURIComponent(uid)}`);
}