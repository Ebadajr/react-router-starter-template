import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { loadSession, saveMarket, loadMarket, loadUserPermissions } from '../auth';
import { loadSheet, writeAction, writeResponse, assignRows } from '../api';
import { parseSheetData, resolveStatus } from '../sheetParser';
import type { EddRow, CaseStatus, Market, TabId, UserPermissions } from '../types';
import { ALL_TABS } from '../types';
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

  const permissions: UserPermissions = user ? loadUserPermissions(user.username) : { tabs: [], actions: [] };

  // Default to the first accessible tab
  const visibleTabs = ALL_TABS.filter(t => permissions.tabs.includes(t.id));
  const defaultTab: TabId = visibleTabs[0]?.id ?? 'edd_submissions';

  // ── State ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]               = useState<TabId>(defaultTab);
  const [market, setMarket]                     = useState<Market>(loadMarket);
  const [rows, setRows]                         = useState<EddRow[]>([]);
  const [loading, setLoading]                   = useState(false);
  const [loadError, setLoadError]               = useState<string | null>(null);
  const [connected, setConnected]               = useState(false);
  const [statusOverrides, setStatusOverrides]   = useState<Record<number, CaseStatus>>({});
  const [hiddenRows, setHiddenRows]             = useState<Set<number>>(new Set());
  const [deletedRows, setDeletedRows]           = useState<Set<number>>(new Set());
  const [selectedIdx, setSelectedIdx]           = useState<number | null>(null);
  const [uidSearch, setUidSearch]               = useState('');
  const [statusFilter, setStatusFilter]         = useState<CaseStatus | ''>('');

  // ── Fetch sheet ─────────────────────────────────────────────────────────────
  const fetchSheet = useCallback(async (m: Market) => {
    setLoading(true);
    setLoadError(null);
    setSelectedIdx(null);
    try {
      const data = await loadSheet(m);
      setRows(parseSheetData(data));
      setConnected(true);
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

  function handleMarketChange(m: Market) {
    setMarket(m);
    saveMarket(m);
  }

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const visibleRows = rows.filter(r => {
    if (deletedRows.has(r.idx)) return false;
    if (uidSearch && !r.uid.toLowerCase().includes(uidSearch.toLowerCase())) return false;
    if (statusFilter && resolveStatus(r, statusOverrides) !== statusFilter) return false;
    return true;
  });

  // ── EDD actions ─────────────────────────────────────────────────────────────
  function handleStatusChange(idx: number, status: CaseStatus) {
    setStatusOverrides(prev => ({ ...prev, [idx]: status }));
    writeAction(idx, status, market).catch(console.error);
  }

  function handleSendForm(idx: number) {
    handleStatusChange(idx, 'Form Sent');
    writeResponse(idx, 'edd_requested', market).catch(console.error);
  }

  function handleAcceptEdd(idx: number) {
    handleStatusChange(idx, 'Done');
    writeResponse(idx, 'edd_accepted', market).catch(console.error);
  }

  function handleRejectEdd(idx: number) {
    handleStatusChange(idx, 'Done');
    writeResponse(idx, 'edd_rejected', market).catch(console.error);
  }

  function handleSendDetailsToCx(idx: number, currentStatus: CaseStatus) {
    writeAction(idx, `${currentStatus} — Send details to cx`, market).catch(console.error);
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

  function handleSelfAssign(idx: number) {
    if (!user) return;
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

      {/* Tab navigation */}
      <div className="flex px-4 bg-white border-b border-gray-100 flex-shrink-0">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'edd_submissions' && (
        <>
          <MetricsBar rows={visibleRows} statusOverrides={statusOverrides} />
          <div className="flex flex-1 overflow-hidden">
            <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
              <CaseList
                rows={visibleRows}
                statusOverrides={statusOverrides}
                hiddenRows={hiddenRows}
                selectedIdx={selectedIdx}
                currentUser={user.username}
                permissions={permissions}
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
                permissions={permissions}
                onStatusChange={handleStatusChange}
                onSendForm={handleSendForm}
                onAcceptEdd={handleAcceptEdd}
                onRejectEdd={handleRejectEdd}
                onSendDetailsToCx={handleSendDetailsToCx}
                onHide={handleHide}
                onDelete={handleDelete}
                onClose={() => setSelectedIdx(null)}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'alerts' && <AlertsTab currentUser={user.username} />}
      {activeTab === 'phone_requests' && <PlaceholderTab title="Phone Number Requests" description="Track and review phone number change requests from users." />}
      {activeTab === 'high_risk' && <PlaceholderTab title="High Risk Users" description="Monitor users flagged for elevated risk based on activity patterns." />}
      {activeTab === 'aml_alerts' && <PlaceholderTab title="AML Alerts" description="Anti-Money Laundering alerts requiring compliance review." />}
    </div>
  );
}

// ── Alerts Tab ────────────────────────────────────────────────────────────────

type AlertStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

interface Alert {
  id: string;
  title: string;
  description: string;
  uid: string;
  createdAt: string;
  severity: AlertSeverity;
  status: AlertStatus;
  assignedTo: string;
  history: { action: string; user: string; at: string }[];
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  low:      'bg-gray-50 text-gray-500 border-gray-200',
  medium:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  high:     'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_COLORS: Record<AlertStatus, string> = {
  open:        'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved:    'bg-green-50 text-green-700',
  dismissed:   'bg-gray-50 text-gray-400',
};

function AlertsTab({ currentUser }: { currentUser: string }) {
  const [alerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [statusFilter, setStatusFilter] = useState<AlertStatus | ''>('');

  const visible = alerts.filter(a => !statusFilter || a.status === statusFilter);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: alert list */}
      <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
            Alerts
          </span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as AlertStatus | '')}
            className="text-[11px] px-2 py-1 border border-gray-200 rounded bg-white text-gray-700 focus:outline-none"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 px-6 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                🔔
              </div>
              <p className="text-xs font-medium text-gray-500">No alerts</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Alerts will appear here once connected to a data source.
              </p>
            </div>
          ) : (
            visible.map(a => (
              <div
                key={a.id}
                onClick={() => setSelectedAlert(a)}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${selectedAlert?.id === a.id ? 'bg-gray-50 border-l-2 border-l-gray-800' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SEVERITY_COLORS[a.severity]}`}>
                    {a.severity}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[a.status]}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[13px] font-medium text-gray-900 truncate">{a.title}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">UID: {a.uid} · {a.createdAt.slice(0, 10)}</div>
                {a.assignedTo && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {a.assignedTo === currentUser ? (
                      <span className="text-blue-600">Assigned to me</span>
                    ) : (
                      `→ ${a.assignedTo}`
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: alert detail */}
      <div className="flex-1 bg-white overflow-hidden flex flex-col">
        {selectedAlert ? (
          <AlertDetail alert={selectedAlert} currentUser={currentUser} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">🔔</div>
            <p className="text-sm">Select an alert to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertDetail({ alert, currentUser }: { alert: Alert; currentUser: string }) {
  const isAssignedToMe = alert.assignedTo === currentUser;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <div className="text-base font-medium text-gray-900">{alert.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Created {alert.createdAt.slice(0, 10)} · UID: {alert.uid}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-1 rounded border font-medium ${SEVERITY_COLORS[alert.severity]}`}>
            {alert.severity}
          </span>
          <span className={`text-[10px] px-2 py-1 rounded font-medium ${STATUS_COLORS[alert.status]}`}>
            {alert.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">Description</div>
        <p className="text-xs text-gray-700 mb-6 leading-relaxed">{alert.description}</p>

        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-3">Assignment</div>
        <div className="flex items-center gap-3 mb-6">
          {alert.assignedTo ? (
            <span className="text-xs text-gray-700">
              {isAssignedToMe ? 'Assigned to you' : `Assigned to ${alert.assignedTo}`}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
          {!isAssignedToMe && (
            <button className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50">
              Assign to me
            </button>
          )}
        </div>

        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-3">History</div>
        {alert.history.length === 0 ? (
          <p className="text-xs text-gray-400">No actions taken yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {alert.history.map((h, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600 flex-shrink-0">
                  {h.user.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="font-medium text-gray-800">{h.user}</span>
                  <span className="text-gray-500"> {h.action}</span>
                  <div className="text-[10px] text-gray-400 mt-0.5">{h.at}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0 flex-wrap">
        {!isAssignedToMe && (
          <button className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700">
            Assign to me
          </button>
        )}
        <button className="text-xs px-3 py-1.5 border border-green-200 rounded text-green-700 bg-green-50 hover:bg-green-100">
          Mark resolved
        </button>
        <button className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50">
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Placeholder Tab ───────────────────────────────────────────────────────────

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 bg-[#f7f7f5]">
      <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-xl shadow-sm">
        🚧
      </div>
      <div>
        <div className="text-base font-semibold text-gray-900 mb-1">{title}</div>
        <div className="text-sm text-gray-400 max-w-sm leading-relaxed">{description}</div>
      </div>
      <div className="text-xs px-3 py-1.5 rounded bg-white border border-gray-200 text-gray-500">
        Coming soon
      </div>
    </div>
  );
}
