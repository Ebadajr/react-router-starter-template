import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { loadSession } from '../auth';
import { loadSheet, writeAction, assignRow } from '../api';
import { parseSheetData, resolveStatus } from '../sheetParser';
import type { EddRow, CaseStatus } from '../types';
import { TopBar } from '../components/TopBar';
import { MetricsBar } from '../components/MetricsBar';
import { CaseList } from '../components/CaseList';
import { CaseDetail } from '../components/CaseDetail';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = loadSession();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) navigate('/');
    else if (user.role === 'admin') navigate('/admin');
  }, []);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [rows, setRows]               = useState<EddRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [connected, setConnected]     = useState(false);

  // ── Session state (mirrors Streamlit session_state) ─────────────────────────
  const [statusOverrides, setStatusOverrides] = useState<Record<number, CaseStatus>>({});
  const [hiddenRows, setHiddenRows]           = useState<Set<number>>(new Set());
  const [deletedRows, setDeletedRows]         = useState<Set<number>>(new Set());
  const [selectedIdx, setSelectedIdx]         = useState<number | null>(null);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [uidSearch, setUidSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');

  // ── Load sheet ───────────────────────────────────────────────────────────────
  const fetchSheet = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadSheet();
      setRows(parseSheetData(data));
      setConnected(true);
    } catch (e) {
      setLoadError((e as Error).message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  // ── Filtered rows (what CaseList sees) ──────────────────────────────────────
  const visibleRows = rows.filter(r => {
    if (deletedRows.has(r.idx)) return false;
    if (uidSearch && !r.uid.toLowerCase().includes(uidSearch.toLowerCase())) return false;
    if (statusFilter) {
      const s = resolveStatus(r, statusOverrides);
      if (s !== statusFilter) return false;
    }
    return true;
  });

  // ── Actions ──────────────────────────────────────────────────────────────────
  function handleStatusChange(idx: number, status: CaseStatus) {
    setStatusOverrides(prev => ({ ...prev, [idx]: status }));
    // Write-back to sheet (fire-and-forget — UI updates immediately)
    writeAction(idx, status).catch(console.error);
  }

  function handleBulkAction(indices: number[], action: CaseStatus | 'hide' | 'delete') {
    if (action === 'hide') {
      setHiddenRows(prev => { const next = new Set(prev); indices.forEach(i => next.add(i)); return next; });
    } else if (action === 'delete') {
      setDeletedRows(prev => { const next = new Set(prev); indices.forEach(i => next.add(i)); return next; });
      if (selectedIdx !== null && indices.includes(selectedIdx)) setSelectedIdx(null);
    } else {
      const updates: Record<number, CaseStatus> = {};
      indices.forEach(i => { updates[i] = action; });
      setStatusOverrides(prev => ({ ...prev, ...updates }));
      indices.forEach(i => writeAction(i, action).catch(console.error));
    }
  }

  function handleHide(idx: number) {
    setHiddenRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function handleDelete(idx: number) {
    setDeletedRows(prev => { const next = new Set(prev); next.add(idx); return next; });
  }

  // ── Selected row ─────────────────────────────────────────────────────────────
  const selectedRow = selectedIdx !== null ? rows.find(r => r.idx === selectedIdx) ?? null : null;

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen bg-[#f7f7f5] overflow-hidden">
      <TopBar
        user={user}
        uidSearch={uidSearch}
        statusFilter={statusFilter}
        onUidSearch={setUidSearch}
        onStatusFilter={setStatusFilter}
        onRefresh={fetchSheet}
        onSignOut={() => navigate('/')}
        connected={connected}
        rowCount={rows.length}
      />

      {loading && (
        <div className="flex items-center justify-center h-12 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex-shrink-0">
          Connecting to Google Sheets…
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600 flex-shrink-0">
          <span>⚠ {loadError}</span>
          <button onClick={fetchSheet} className="underline">Retry</button>
        </div>
      )}

      <MetricsBar rows={visibleRows} statusOverrides={statusOverrides} />

      <div className="flex flex-1 overflow-hidden">
        {/* Case list — fixed width */}
        <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <CaseList
            rows={visibleRows}
            statusOverrides={statusOverrides}
            hiddenRows={hiddenRows}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            onBulkAction={handleBulkAction}
          />
        </div>

        {/* Detail panel — fills remaining space */}
        <div className="flex-1 flex overflow-hidden">
          <CaseDetail
            row={selectedRow}
            statusOverrides={statusOverrides}
            hiddenRows={hiddenRows}
            onStatusChange={handleStatusChange}
            onHide={handleHide}
            onDelete={handleDelete}
            onClose={() => setSelectedIdx(null)}
          />
        </div>
      </div>
    </div>
  );
}