import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSheet, writeAction, writeResponse, assignRows, assignRow, clearAssignment, fetchUserProfile } from './api';

// ── Fetch mock helpers ────────────────────────────────────────────────────────

function mockOk(body: unknown) {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  );
}

function mockErr(body: unknown, status = 500) {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

beforeEach(() => { vi.restoreAllMocks(); });

// ── loadSheet ─────────────────────────────────────────────────────────────────

describe('loadSheet', () => {
  it('GETs /api/sheets with the correct market param', async () => {
    const spy = mockOk({ headers: ['user_id'], rows: [] });
    await loadSheet('EG');
    expect(spy).toHaveBeenCalledWith('/api/sheets?market=EG');
  });

  it('GETs with UAE market when requested', async () => {
    const spy = mockOk({ headers: [], rows: [] });
    await loadSheet('UAE');
    expect(spy).toHaveBeenCalledWith('/api/sheets?market=UAE');
  });

  it('returns parsed SheetData', async () => {
    mockOk({ headers: ['user_id', 'action_taken'], rows: [['U1', 'Pending']] });
    const result = await loadSheet('EG');
    expect(result.headers).toEqual(['user_id', 'action_taken']);
    expect(result.rows[0]).toEqual(['U1', 'Pending']);
  });

  it('throws on error response', async () => {
    mockErr({ error: 'Sheet not found' }, 404);
    await expect(loadSheet('EG')).rejects.toThrow('Sheet not found');
  });
});

// ── writeAction ───────────────────────────────────────────────────────────────

describe('writeAction', () => {
  it('POSTs to /api/action with correct body', async () => {
    const spy = mockOk({ ok: true, rowIndex: 3, action: 'Done' });
    await writeAction(3, 'Done', 'EG');
    expect(spy).toHaveBeenCalledWith(
      '/api/action',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rowIndex: 3, action: 'Done', market: 'EG' }),
      })
    );
  });

  it('passes "Send details to cx" action string correctly', async () => {
    const spy = mockOk({ ok: true, rowIndex: 5, action: 'Under Review — Send details to cx' });
    await writeAction(5, 'Under Review — Send details to cx', 'UAE');
    const call = spy.mock.calls[0];
    const body = JSON.parse(call[1]!.body as string);
    expect(body.action).toBe('Under Review — Send details to cx');
    expect(body.market).toBe('UAE');
  });

  it('throws on error response', async () => {
    mockErr({ error: 'Column not found' });
    await expect(writeAction(0, 'Done', 'EG')).rejects.toThrow('Column not found');
  });
});

// ── writeResponse ─────────────────────────────────────────────────────────────

describe('writeResponse', () => {
  it('POSTs to /api/response with correct body', async () => {
    const spy = mockOk({ ok: true, rowIndex: 2, action: 'edd_accepted' });
    await writeResponse(2, 'edd_accepted', 'EG');
    expect(spy).toHaveBeenCalledWith(
      '/api/response',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rowIndex: 2, response: 'edd_accepted', market: 'EG' }),
      })
    );
  });

  it('sends edd_rejected correctly', async () => {
    const spy = mockOk({ ok: true, rowIndex: 1, action: 'edd_rejected' });
    await writeResponse(1, 'edd_rejected', 'UAE');
    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.response).toBe('edd_rejected');
  });

  it('sends edd_requested correctly', async () => {
    const spy = mockOk({ ok: true, rowIndex: 0, action: 'edd_requested' });
    await writeResponse(0, 'edd_requested', 'EG');
    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.response).toBe('edd_requested');
  });

  it('throws on error', async () => {
    mockErr({ error: 'Response column not found' });
    await expect(writeResponse(0, 'edd_accepted', 'EG')).rejects.toThrow('Response column not found');
  });
});

// ── assignRows ────────────────────────────────────────────────────────────────

describe('assignRows', () => {
  it('POSTs correct body for batch assign', async () => {
    const spy = mockOk({ ok: true, assigned: 3, username: 'Sara' });
    await assignRows([0, 1, 2], 'Sara', 'EG');
    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.rowIndices).toEqual([0, 1, 2]);
    expect(body.username).toBe('Sara');
    expect(body.market).toBe('EG');
  });

  it('returns assignment result', async () => {
    mockOk({ ok: true, assigned: 2, username: 'Khaled' });
    const result = await assignRows([5, 6], 'Khaled', 'UAE');
    expect(result.assigned).toBe(2);
    expect(result.username).toBe('Khaled');
  });
});

describe('assignRow', () => {
  it('wraps assignRows with a single index', async () => {
    const spy = mockOk({ ok: true, assigned: 1, username: 'Sara' });
    await assignRow(7, 'Sara', 'EG');
    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.rowIndices).toEqual([7]);
  });
});

describe('clearAssignment', () => {
  it('sends empty string as username', async () => {
    const spy = mockOk({ ok: true, assigned: 1, username: '' });
    await clearAssignment(3, 'EG');
    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.username).toBe('');
    expect(body.rowIndices).toEqual([3]);
  });
});

// ── fetchUserProfile ──────────────────────────────────────────────────────────

describe('fetchUserProfile', () => {
  it('GETs /api/usertool with encoded uid', async () => {
    const spy = mockOk({ id: 'abc123', name: 'Test User' });
    await fetchUserProfile('abc123');
    expect(spy).toHaveBeenCalledWith('/api/usertool?uid=abc123');
  });

  it('URL-encodes uid with special characters', async () => {
    const spy = mockOk({});
    await fetchUserProfile('user id with spaces');
    expect(spy).toHaveBeenCalledWith('/api/usertool?uid=user%20id%20with%20spaces');
  });

  it('throws on non-OK response', async () => {
    mockErr({ error: 'User not found' }, 404);
    await expect(fetchUserProfile('unknown')).rejects.toThrow('User not found');
  });
});
