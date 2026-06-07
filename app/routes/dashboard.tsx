import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { loadSession, saveMarket, loadMarket } from '../auth';
import { loadSheet, writeAction, assignRows } from '../api';
import { parseSheetData, resolveStatus } from '../sheetParser';
import type { EddRow, CaseStatus, Market } from '../types';
import { TopBar } from '../components/TopBar';
import { MetricsBar } from '../components/MetricsBar';
import { CaseList } from '../components/CaseList';
import { CaseDetail } from '../components/CaseDetail';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = loadSession();

  useEffect(() => {
    if (!user) navigate('/');
    else if (user.role === 'admin') navigate('/admin');
  }, []);

  // ── State ───────────────────────────────────────────────────────────────────
  const [market, setMarket]               = useState<Market>(loadMarket);
  const [rows, setRows]                   = useState<EddRow[]>([]);
  const [loading, setLoading]             = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [connected, setConnected]         = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, CaseStatus>>({});
  const [hiddenRows, setHiddenRows]       = useState<Set<number>>(new Set());
  const [deletedRows, setDeletedRows]     = useState<Set<number>>(new Set());
  const [selectedIdx, setSelectedIdx]     = useState<number | null>(null);
  const [uidSearch, setUidSearch]         = useState('');
  const [statusFilter, setStatusFilter]   = useState<CaseStatus | ''>('');

  // ── Fetch sheet ─────────────────────────────────────────────────────────────
  const fetchSheet = useCallback(async (m: Market) => {
    setLoading(true);
    setLoadError(null);
    setSelectedIdx(null);
    try {
      const data = await loadSheet(m);
      setRows(parseSheetData(data));
      setConnected(true);
      // Reset session state when market changes
      setStatusOverrides({});
      setHiddenRows(new Set());
      setDeletedRows(new Set());
    } catch (e) {
      setLoadError((e as Error).message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSheet(market); }, [market]);

  // ── Market change ───────────────────────────────────────────────────────────
  function handleMarketChange(m: Market) {
    setMarket(m);
    saveMarket(m);
  }

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const visibleRows = rows.filter(r => {
    if (deletedRows.has(r.idx)) return false;
    if (uidSearch && !r.uid.toLowerCase().includes(uidSearch.toLowerCase())) return false;
    if (statusFilter) {
      if (resolveStatus(r, statusOverrides) !== statusFilter) return false;
    }
    return true;
  });

  // ── Actions ─────────────────────────────────────────────────────────────────
  function handleStatusChange(idx: number, status: CaseStatus) {
    setStatusOverrides(prev => ({ ...prev, [idx]: status }));
    writeAction(idx, status, market).catch(console.error);
  }

  function handleBulkAction(indices: number[], action: CaseStatus | 'hide' | 'delete') {
    if (action === 'hide') {
      setHiddenRows(prev => { const n = new Set(prev); indices.forEach(i => n.add(i)); return n; });
    } else if (action === 'delete') {
      setDeletedRows(prev => { const n = new Set(prev); indices.forEach(i => n.add(i)); return n; });
      if (selectedIdx !== null && indices.includes(selectedIdx)) setSelectedIdx(null);
    } else {
      const updates: Record<number, CaseStatus> = {};
      indices.forEach(i => { updates[i] = action; });
      setStatusOverrides(prev => ({ ...prev, ...updates }));
      indices.forEach(i => writeAction(i, action, market).catch(console.error));
    }
  }

  function handleHide(idx: number) {
    setHiddenRows(prev => {
      const n = new Set(prev);
      if (n.has(idx)) n.delete(idx); else n.add(idx);
      return n;
    });
  }

  function handleDelete(idx: number) {
    setDeletedRows(prev => { const n = new Set(prev); n.add(idx); return n; });
  }

  // Self-assign: member clicks "Assign to me" on an unassigned row
  function handleSelfAssign(idx: number) {
    if (!user) return;
    // Optimistic update
    setRows(prev => prev.map(r =>
      r.idx === idx ? { ...r, assignedTo: user.username } : r
    ));
    assignRows([idx], user.username, market).catch(console.error);
  }

  const selectedRow = selectedIdx !== null ? rows.find(r => r.idx === selectedIdx) ?? null : null;

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen bg-[#f7f7f5] overflow-hidden">
      <TopBar
        user={user}
        market={market}
        uidSearch={uidSearch}
        statusFilter={statusFilter}
        onUidSearch={setUidSearch}
        onStatusFilter={setStatusFilter}
        onMarketChange={handleMarketChange}
        onRefresh={() => fetchSheet(market)}
        onSignOut={() => navigate('/')}
        connected={connected}
        rowCount={rows.length}
      />

      {loading && (
        <div className="flex items-center justify-center h-10 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex-shrink-0">
          Connecting to Google Sheets…
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600 flex-shrink-0">
          <span>⚠ {loadError}</span>
          <button onClick={() => fetchSheet(market)} className="underline">Retry</button>
        </div>
      )}

      <MetricsBar rows={visibleRows} statusOverrides={statusOverrides} />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <CaseList
            rows={visibleRows}
            statusOverrides={statusOverrides}
            hiddenRows={hiddenRows}
            selectedIdx={selectedIdx}
            currentUser={user.username}
            market={market}
            onSelect={setSelectedIdx}
            onBulkAction={handleBulkAction}
            onSelfAssign={handleSelfAssign}
          />
        </div>
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