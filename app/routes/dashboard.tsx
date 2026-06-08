import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { loadSession, saveMarket, loadMarket, loadUserPermissions } from '../auth';
import { loadSheet, writeAction, writeResponse, assignRows, loadAlerts, writeAlertAction, assignAlertRows } from '../api';
import { parseSheetData, resolveStatus } from '../sheetParser';
import { parseAlertData } from '../alertParser';
import type { EddRow, CaseStatus, Market, TabId, UserPermissions, AlertRow, AlertType } from '../types';
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

      {activeTab === 'alerts' && (
        <AlertsTab market={market} currentUser={user.username} permissions={permissions} />
      )}
      {activeTab === 'phone_requests' && <PlaceholderTab title="Phone Number Requests" description="Track and review phone number change requests from users." />}
      {activeTab === 'high_risk' && <PlaceholderTab title="High Risk Users" description="Monitor users flagged for elevated risk based on activity patterns." />}
      {activeTab === 'aml_alerts' && <PlaceholderTab title="AML Alerts" description="Anti-Money Laundering alerts requiring compliance review." />}
    </div>
  );
}

// ── EDD Daily Deposits Alerts Tab ─────────────────────────────────────────────

const RESPONSE_BADGE: Record<string, string> = {
  edd_requested: 'bg-blue-50 text-blue-700 border border-blue-200',
  clear:         'bg-green-50 text-green-700 border border-green-200',
  '':            'bg-amber-50 text-amber-700 border border-amber-200',
};

const RESPONSE_LABEL: Record<string, string> = {
  edd_requested: 'EDD Requested',
  clear:         'Cleared',
  '':            'Pending',
};

function AlertsTab({ market, currentUser, permissions }: {
  market: Market;
  currentUser: string;
  permissions: UserPermissions;
}) {
  const [alerts, setAlerts]         = useState<AlertRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [responseFilter, setResponseFilter] = useState<string>('');
  const [uidSearch, setUidSearch]   = useState('');
  const alertType: AlertType        = 'edd_deposits';

  const canSelfAssign = permissions.actions.includes('self_assign');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadAlerts(alertType);
      setAlerts(parseAlertData(data));
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (market === 'UAE') fetchAlerts();
  }, [market, fetchAlerts]);

  // UAE only — EG has no alert feed yet
  if (market !== 'UAE') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 bg-[#f7f7f5]">
        <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-xl shadow-sm">🔔</div>
        <div>
          <div className="text-base font-semibold text-gray-900 mb-1">No alerts for Egypt market</div>
          <div className="text-sm text-gray-400 max-w-sm">Switch to UAE market to see EDD Daily Deposit alerts.</div>
        </div>
      </div>
    );
  }

  const visible = alerts.filter(a => {
    if (uidSearch && !a.userId.toLowerCase().includes(uidSearch.toLowerCase())) return false;
    if (responseFilter && a.response !== responseFilter) return false;
    return true;
  });

  const selected = selectedIdx !== null ? alerts.find(a => a.idx === selectedIdx) ?? null : null;

  function handleSelfAssign(idx: number) {
    setAlerts(prev => prev.map(a => a.idx === idx ? { ...a, assignedTo: currentUser } : a));
    assignAlertRows([idx], currentUser, alertType).catch(console.error);
  }

  function handleAction(idx: number, action: string) {
    // Optimistic update for response
    if (action === 'edd_requested' || action === 'clear') {
      setAlerts(prev => prev.map(a =>
        a.idx === idx ? { ...a, response: action as any, actionTaken: `${action} — ${currentUser}` } : a
      ));
    } else {
      setAlerts(prev => prev.map(a =>
        a.idx === idx ? { ...a, actionTaken: `${action} — ${currentUser}` } : a
      ));
    }
    writeAlertAction(idx, action, currentUser, alertType).catch(console.error);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: list */}
      <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* Section header */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">EDD Daily Deposits</div>
          <div className="text-[10px] text-gray-400 mt-0.5">UAE · Auto-flagged daily</div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <input
            type="text"
            placeholder="Search user ID…"
            value={uidSearch}
            onChange={e => setUidSearch(e.target.value)}
            className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
          />
          <select
            value={responseFilter}
            onChange={e => setResponseFilter(e.target.value)}
            className="text-[11px] px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-700 focus:outline-none"
          >
            <option value="">All</option>
            <option value="">Pending</option>
            <option value="edd_requested">EDD Requested</option>
            <option value="clear">Cleared</option>
          </select>
          <button onClick={fetchAlerts} className="text-[11px] px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50">
            ↻
          </button>
        </div>

        {loading && (
          <div className="px-4 py-2 text-xs text-blue-500 flex-shrink-0 animate-pulse">Loading…</div>
        )}
        {loadError && (
          <div className="px-4 py-2 text-xs text-red-500 flex-shrink-0">⚠ {loadError}</div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!loading && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 px-4 text-center">
              <div className="text-lg">🔔</div>
              <p className="text-xs">No alerts match the current filter.</p>
            </div>
          )}
          {visible.map(a => {
            const isMe = a.assignedTo?.trim().toLowerCase() === currentUser.toLowerCase();
            const isSel = selectedIdx === a.idx;
            return (
              <div
                key={a.idx}
                onClick={() => setSelectedIdx(a.idx)}
                className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer gap-2
                  ${isSel ? 'bg-gray-50 border-l-2 border-l-gray-800 pl-2.5' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-gray-900">{a.userId}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RESPONSE_BADGE[a.response]}`}>
                    {RESPONSE_LABEL[a.response]}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  {a.amount} {a.currency} · {a.updatedAt?.slice(0, 10)}
                </div>
                {a.assignedTo?.trim() && (
                  <div className="text-[10px] mt-0.5">
                    {isMe
                      ? <span className="text-blue-600">mine</span>
                      : <span className="text-gray-400">→ {a.assignedTo}</span>
                    }
                  </div>
                )}
                {canSelfAssign && !isMe && (
                  <button
                    onClick={e => { e.stopPropagation(); handleSelfAssign(a.idx); }}
                    className="mt-1 text-[10px] px-2 py-0.5 border border-gray-200 rounded bg-white text-gray-500 hover:bg-gray-50"
                  >
                    + Assign to me
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-gray-100 flex-shrink-0">
          <span className="text-[11px] text-gray-400">{visible.length} of {alerts.length} alerts</span>
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 bg-white overflow-hidden flex flex-col">
        {selected ? (
          <AlertDetail
            row={selected}
            currentUser={currentUser}
            permissions={permissions}
            onAction={handleAction}
            onSelfAssign={handleSelfAssign}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">🔔</div>
            <p className="text-sm">Select an alert to view details and take action</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertDetail({ row, currentUser, permissions, onAction, onSelfAssign }: {
  row: AlertRow;
  currentUser: string;
  permissions: UserPermissions;
  onAction: (idx: number, action: string) => void;
  onSelfAssign: (idx: number) => void;
}) {
  const isMe = row.assignedTo?.trim().toLowerCase() === currentUser.toLowerCase();
  const canAssign = permissions.actions.includes('self_assign');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <div className="text-base font-medium text-gray-900">{row.userId}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {row.updatedAt?.slice(0, 10)} · {row.amount} {row.currency} · {row.country}
          </div>
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded font-medium ${RESPONSE_BADGE[row.response]}`}>
          {RESPONSE_LABEL[row.response]}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* KYC info from sheet */}
        <AlertSection title="Identity">
          <AlertGrid>
            <AlertField label="English Name"  value={row.englishName} />
            <AlertField label="Arabic Name"   value={row.arabicName} />
            <AlertField label="Nationality"   value={row.nationality} />
            <AlertField label="Is Minor"      value={row.isMinor} />
            <AlertField label="ID Type"       value={row.idType} />
            <AlertField label="ID Number"     value={row.idNumber} />
            <AlertField label="ID Expiry"     value={row.idExpiry} />
            <AlertField label="Phone"         value={row.phoneNumber} />
          </AlertGrid>
        </AlertSection>

        <AlertSection title="Address & Employment">
          <AlertGrid>
            <AlertField label="Address"       value={row.address} />
            <AlertField label="Company"       value={row.companyName} />
            <AlertField label="Country"       value={row.country} />
          </AlertGrid>
        </AlertSection>

        <AlertSection title="Deposit">
          <AlertGrid>
            <AlertField label="Amount"        value={row.amount} />
            <AlertField label="Currency"      value={row.currency} />
            <AlertField label="Date"          value={row.updatedAt?.slice(0, 10)} />
            <AlertField label="Alert ID"      value={row.alertId} />
          </AlertGrid>
        </AlertSection>

        {row.notes && (
          <AlertSection title="Notes">
            <p className="text-xs text-gray-700 leading-relaxed">{row.notes}</p>
          </AlertSection>
        )}

        <AlertSection title="Assignment">
          <div className="flex items-center gap-3">
            {row.assignedTo?.trim() ? (
              <span className="text-xs text-gray-700">
                {isMe ? 'Assigned to you' : `Assigned to ${row.assignedTo}`}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Unassigned</span>
            )}
            {canAssign && !isMe && (
              <button
                onClick={() => onSelfAssign(row.idx)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
              >
                Assign to me
              </button>
            )}
          </div>
        </AlertSection>

        {row.actionTaken && (
          <AlertSection title="Last Action">
            <p className="text-xs text-gray-600">{row.actionTaken}</p>
          </AlertSection>
        )}
      </div>

      {/* Action footer */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0 bg-white flex-wrap">
        <button
          onClick={() => onAction(row.idx, 'edd_requested')}
          disabled={row.response === 'edd_requested'}
          className="text-xs px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Request EDD
        </button>
        <button
          onClick={() => onAction(row.idx, 'clear')}
          disabled={row.response === 'clear'}
          className="text-xs px-4 py-1.5 border border-green-200 rounded text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        {row.done !== 'TRUE' && row.done !== 'true' && row.done !== '1' && (
          <button
            onClick={() => onAction(row.idx, 'mark_done')}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
          >
            Mark done
          </button>
        )}
      </div>
    </div>
  );
}

function AlertSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">{title}</div>
      {children}
    </div>
  );
}

function AlertGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>;
}

function AlertField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-xs font-medium text-gray-800 break-words">{value}</div>
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
