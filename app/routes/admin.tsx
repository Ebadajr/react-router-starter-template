import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  loadSession, clearSession,
  loadRuntimeUsers, saveRuntimeUsers,
  loadUserPermissions, saveUserPermissions,
} from '../auth';
import { loadSheet, assignRows } from '../api';
import { parseSheetData, resolveStatus } from '../sheetParser';
import type { EddRow, CaseStatus, Market, AppUser, UserPermissions, TabId, ActionId } from '../types';
import { ALL_TABS, ALL_ACTIONS, DEFAULT_PERMISSIONS, MARKETS } from '../types';
import { Badge } from '../components/Badge';

interface UserPerf {
  username: string;
  display: string;
  assigned: number;
  done: number;
  underReview: number;
  formSent: number;
  pending: number;
}

type AdminTab = 'overview' | 'users' | 'assign' | 'access';

export default function AdminPage() {
  const navigate = useNavigate();
  const user = loadSession();

  useEffect(() => {
    if (!user) navigate('/');
    else if (user.role !== 'admin') navigate('/dashboard');
  }, []);

  const [market, setMarket]         = useState<Market>('EG');
  const [rows, setRows]             = useState<EddRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [statusOverrides]           = useState<Record<number, CaseStatus>>({});
  const [activeTab, setActiveTab]   = useState<AdminTab>('overview');

  const fetchSheet = useCallback(async (m: Market) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadSheet(m);
      setRows(parseSheetData(data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSheet(market); }, [market, fetchSheet]);

  if (!user) return null;

  const runtimeUsers = loadRuntimeUsers();
  const nonAdminUsers = Object.values(runtimeUsers).filter(u => u.role !== 'admin');
  const statuses = rows.map(r => resolveStatus(r, statusOverrides));
  const counts = {
    total:       rows.length,
    assigned:    rows.filter(r => r.assignedTo?.trim()).length,
    unassigned:  rows.filter(r => !r.assignedTo?.trim()).length,
    underReview: statuses.filter(s => s === 'Under Review').length,
    done:        statuses.filter(s => s === 'Done').length,
  };

  const perfData: UserPerf[] = nonAdminUsers.map(u => {
    const userRows    = rows.filter(r => r.assignedTo?.trim().toLowerCase() === u.username.toLowerCase());
    const userStatuses = userRows.map(r => resolveStatus(r, statusOverrides));
    const done        = userStatuses.filter(s => s === 'Done').length;
    const underReview = userStatuses.filter(s => s === 'Under Review').length;
    const formSent    = userStatuses.filter(s => s === 'Form Sent').length;
    return {
      username:    u.username,
      display:     u.displayName,
      assigned:    userRows.length,
      done, underReview, formSent,
      pending: Math.max(0, userRows.length - done - underReview - formSent),
    };
  });

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'overview', label: 'Overview & Performance' },
    { key: 'users',    label: 'User Management' },
    { key: 'assign',   label: 'Assign Rows' },
    { key: 'access',   label: 'Access Control' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#f7f7f5] overflow-hidden">
      <header className="flex items-center justify-between px-5 h-[52px] bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900 tracking-tight">Compliance Portal</span>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-xs text-gray-400">Admin Dashboard</span>
          {loading && <span className="text-xs text-blue-400 animate-pulse">Loading…</span>}

          {/* Market selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 ml-2">
            {MARKETS.map(m => (
              <button
                key={m.id}
                onClick={() => setMarket(m.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  market === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m.flag} {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{user.displayName}</span>
          <button onClick={() => fetchSheet(market)} className="text-xs px-3 py-1.5 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50">
            ↻ Refresh
          </button>
          <button onClick={() => { clearSession(); navigate('/'); }} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600 flex-shrink-0">⚠ {error}</div>
      )}

      <div className="flex px-5 bg-white border-b border-gray-100 flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-3.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && <OverviewTab counts={counts} perfData={perfData} rows={rows} statusOverrides={statusOverrides} />}
        {activeTab === 'users'    && <UsersTab />}
        {activeTab === 'assign'   && <AssignTab rows={rows} market={market} onAssigned={() => fetchSheet(market)} />}
        {activeTab === 'access'   && <AccessControlTab />}
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ counts, perfData, rows, statusOverrides }: {
  counts: Record<string, number>;
  perfData: UserPerf[];
  rows: EddRow[];
  statusOverrides: Record<number, CaseStatus>;
}) {
  return (
    <div>
      <SectionTitle>Overall stats</SectionTitle>
      <div className="grid grid-cols-5 gap-3 mb-8">
        {[
          { label: 'Total rows',   value: counts.total,       cls: 'text-gray-900' },
          { label: 'Assigned',     value: counts.assigned,    cls: 'text-green-700' },
          { label: 'Unassigned',   value: counts.unassigned,  cls: 'text-amber-700' },
          { label: 'Under review', value: counts.underReview, cls: 'text-blue-700' },
          { label: 'Done',         value: counts.done,        cls: 'text-green-700' },
        ].map(m => (
          <div key={m.label} className="bg-white border border-gray-100 rounded-xl p-5 text-center">
            <div className={`text-3xl font-medium ${m.cls}`}>{m.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <SectionTitle>User performance</SectionTitle>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['User', 'Assigned', 'Done', 'Under Review', 'Form Sent', 'Pending', 'Completion'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perfData.map(u => (
              <tr key={u.username} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{u.display}</td>
                <td className="px-4 py-2.5 text-gray-700">{u.assigned}</td>
                <td className="px-4 py-2.5 text-gray-700">{u.done}</td>
                <td className="px-4 py-2.5 text-gray-700">{u.underReview}</td>
                <td className="px-4 py-2.5 text-gray-700">{u.formSent}</td>
                <td className="px-4 py-2.5 text-gray-700">{u.pending}</td>
                <td className="px-4 py-2.5 font-medium text-gray-700">
                  {u.assigned > 0 ? `${Math.round(u.done / u.assigned * 100)}%` : '—'}
                </td>
              </tr>
            ))}
            {perfData.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <SectionTitle>Row-level assignments</SectionTitle>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['User ID', 'Assigned To', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.filter(r => r.assignedTo?.trim()).slice(0, 50).map(r => (
              <tr key={r.idx} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">{r.uid}</td>
                <td className="px-4 py-2 text-gray-600">{r.assignedTo}</td>
                <td className="px-4 py-2"><Badge status={resolveStatus(r, statusOverrides)} /></td>
              </tr>
            ))}
            {rows.filter(r => r.assignedTo?.trim()).length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No assignments yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── User Management ───────────────────────────────────────────────────────────

interface NewUserForm {
  displayName: string;
  username: string;
  role: 'user' | 'admin';
  markets: Market[];
}

function UsersTab() {
  const [users, setUsers] = useState<Record<string, AppUser>>(loadRuntimeUsers);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState<NewUserForm>({ displayName: '', username: '', role: 'user', markets: ['EG'] });
  const [msg, setMsg] = useState<string | null>(null);

  function persist(next: Record<string, AppUser>) {
    saveRuntimeUsers(next);
    setUsers(next);
  }

  function initAdd() {
    setForm({ displayName: '', username: '', role: 'user', markets: ['EG'] });
    setEditTarget(null);
    setShowForm(true);
    setMsg(null);
  }

  function initEdit(u: AppUser) {
    setForm({ displayName: u.displayName, username: u.username, role: u.role as 'user' | 'admin', markets: [...u.markets] });
    setEditTarget(u.username);
    setShowForm(true);
    setMsg(null);
  }

  function handleRemove(username: string) {
    if (!confirm(`Remove user "${username}"?`)) return;
    const next = { ...users };
    delete next[username];
    persist(next);
    setMsg(`Removed ${username}`);
  }

  function handleSave() {
    const { displayName, username, role, markets } = form;
    if (!displayName.trim() || !username.trim()) {
      setMsg('Display name and username are required.');
      return;
    }
    if (!editTarget && users[username]) {
      setMsg(`Username "${username}" already exists.`);
      return;
    }
    const avatar = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const key = editTarget ?? username;
    const next = { ...users, [key]: { username: key, displayName: displayName.trim(), role, avatar, markets } };
    persist(next);
    setShowForm(false);
    setMsg(editTarget ? `Updated ${key}` : `Added ${key}`);
  }

  function toggleMarket(m: Market) {
    setForm(f => ({
      ...f,
      markets: f.markets.includes(m) ? f.markets.filter(x => x !== m) : [...f.markets, m],
    }));
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Team members</SectionTitle>
        <button onClick={initAdd} className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700">
          + Add user
        </button>
      </div>

      {msg && (
        <div className="text-xs px-3 py-2 rounded-lg mb-4 bg-green-50 text-green-700 border border-green-100">
          {msg}
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="text-xs font-medium text-gray-700 mb-4">
            {editTarget ? `Edit ${editTarget}` : 'New user'}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Display name</label>
              <input
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded bg-white text-gray-800 focus:outline-none focus:border-gray-400"
                placeholder="Sara Nour"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Username (login key)</label>
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                disabled={!!editTarget}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded bg-white text-gray-800 focus:outline-none focus:border-gray-400 disabled:opacity-50"
                placeholder="Sara"
              />
            </div>
          </div>
          <div className="flex gap-6 mb-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as 'user' | 'admin' }))}
                className="text-xs px-3 py-2 border border-gray-200 rounded bg-white text-gray-800 focus:outline-none"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Markets</label>
              <div className="flex gap-2">
                {MARKETS.map(m => (
                  <label key={m.id} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.markets.includes(m.id)}
                      onChange={() => toggleMarket(m.id)}
                    />
                    {m.flag} {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="text-xs px-4 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700">
              Save
            </button>
            <button onClick={() => { setShowForm(false); setMsg(null); }} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {Object.values(users).map(u => (
          <div key={u.username} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                {u.avatar}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-900">{u.displayName}</span>
                <div className="text-[11px] text-gray-400">{u.markets.join(', ')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2.5 py-1 rounded font-medium uppercase tracking-wider ${
                u.role === 'admin' ? 'bg-gray-900 text-white' : 'bg-blue-50 text-blue-700'
              }`}>
                {u.role}
              </span>
              <button onClick={() => initEdit(u)} className="text-[11px] px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
                Edit
              </button>
              {u.role !== 'admin' && (
                <button onClick={() => handleRemove(u.username)} className="text-[11px] px-2.5 py-1 border border-red-100 rounded text-red-500 hover:bg-red-50">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Assign Rows ───────────────────────────────────────────────────────────────

function AssignTab({ rows, market, onAssigned }: { rows: EddRow[]; market: Market; onAssigned: () => void }) {
  const users = loadRuntimeUsers();
  const nonAdminUsers = Object.values(users).filter(u => u.role !== 'admin');
  const [targetUser, setTargetUser] = useState(nonAdminUsers[0]?.username ?? '');
  const [filterMode, setFilterMode] = useState<'unassigned' | 'all'>('unassigned');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const displayRows = filterMode === 'unassigned' ? rows.filter(r => !r.assignedTo?.trim()) : rows;

  function toggleAll(val: boolean) {
    setSelected(val ? new Set(displayRows.map(r => r.idx)) : new Set());
  }

  function toggleOne(idx: number, val: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      if (val) next.add(idx); else next.delete(idx);
      return next;
    });
  }

  async function handleAssign() {
    if (!selected.size || !targetUser) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await assignRows([...selected], targetUser, market);
      const displayName = users[targetUser]?.displayName ?? targetUser;
      setSaveMsg(`Assigned ${selected.size} rows to ${displayName}`);
      setSelected(new Set());
      onAssigned();
    } catch (e) {
      setSaveMsg(`⚠ ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Assign to</label>
          <select
            value={targetUser}
            onChange={e => setTargetUser(e.target.value)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded bg-white text-gray-800 focus:outline-none"
          >
            {nonAdminUsers.map(u => <option key={u.username} value={u.username}>{u.displayName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Show</label>
          <div className="flex gap-1">
            {(['unassigned', 'all'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                className={`text-xs px-3 py-1.5 border rounded ${
                  filterMode === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {m === 'unassigned' ? 'Unassigned only' : 'All rows'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {saveMsg && (
        <div className={`text-xs px-3 py-2 rounded-lg mb-4 border ${
          saveMsg.startsWith('⚠') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'
        }`}>
          {saveMsg}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={displayRows.length > 0 && displayRows.every(r => selected.has(r.idx))}
            onChange={e => toggleAll(e.target.checked)}
          />
          Select all ({displayRows.length} rows)
        </label>
        {selected.size > 0 && (
          <button
            onClick={handleAssign}
            disabled={saving}
            className="text-xs px-4 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? 'Assigning…' : `Assign ${selected.size} rows to ${users[targetUser]?.displayName}`}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {displayRows.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-400">
            {filterMode === 'unassigned' ? 'All rows are assigned ✓' : 'No rows loaded'}
          </div>
        ) : (
          displayRows.map(r => (
            <label key={r.idx} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(r.idx)} onChange={e => toggleOne(r.idx, e.target.checked)} />
              <span className="text-xs font-medium text-gray-900 flex-1">{r.uid}</span>
              <span className="text-[11px] text-gray-400">{r.submittedAt?.slice(0, 10)}</span>
              {r.assignedTo?.trim() && (
                <span className="text-[11px] text-gray-400 italic">→ {r.assignedTo}</span>
              )}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

// ── Access Control ────────────────────────────────────────────────────────────

function AccessControlTab() {
  const [users] = useState<Record<string, AppUser>>(loadRuntimeUsers);
  const nonAdminUsers = Object.values(users).filter(u => u.role !== 'admin');
  const [selectedUser, setSelectedUser] = useState<string>(nonAdminUsers[0]?.username ?? '');
  const [perms, setPerms] = useState<UserPermissions>(() =>
    selectedUser ? loadUserPermissions(selectedUser) : { ...DEFAULT_PERMISSIONS }
  );
  const [saved, setSaved] = useState(false);

  function loadForUser(username: string) {
    setSelectedUser(username);
    setPerms(loadUserPermissions(username));
    setSaved(false);
  }

  function toggleTab(id: TabId) {
    setPerms(p => ({
      ...p,
      tabs: p.tabs.includes(id) ? p.tabs.filter(t => t !== id) : [...p.tabs, id],
    }));
    setSaved(false);
  }

  function toggleAction(id: ActionId) {
    setPerms(p => ({
      ...p,
      actions: p.actions.includes(id) ? p.actions.filter(a => a !== id) : [...p.actions, id],
    }));
    setSaved(false);
  }

  function handleSave() {
    if (!selectedUser) return;
    saveUserPermissions(selectedUser, perms);
    setSaved(true);
  }

  function handleResetDefaults() {
    setPerms({ ...DEFAULT_PERMISSIONS });
    setSaved(false);
  }

  if (nonAdminUsers.length === 0) {
    return (
      <div className="max-w-2xl">
        <SectionTitle>Access Control</SectionTitle>
        <p className="text-xs text-gray-400">No non-admin users found. Add users in the User Management tab first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <SectionTitle>Access Control</SectionTitle>
        <p className="text-[11px] text-gray-400">Configure tabs and actions each user can access</p>
      </div>

      <div className="flex gap-6">
        {/* User selector sidebar */}
        <div className="w-44 flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">Users</div>
          <div className="flex flex-col gap-1">
            {nonAdminUsers.map(u => (
              <button
                key={u.username}
                onClick={() => loadForUser(u.username)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                  selectedUser === u.username
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-100 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                  selectedUser === u.username ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {u.avatar}
                </div>
                <span className="truncate">{u.displayName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions panel */}
        {selectedUser && (
          <div className="flex-1">
            <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
              <div className="text-xs font-medium text-gray-700 mb-4">
                Tabs — {users[selectedUser]?.displayName}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_TABS.map(t => (
                  <label key={t.id} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={perms.tabs.includes(t.id)}
                      onChange={() => toggleTab(t.id)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs text-gray-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
              <div className="text-xs font-medium text-gray-700 mb-4">
                Actions — {users[selectedUser]?.displayName}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ACTIONS.map(a => (
                  <label key={a.id} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={perms.actions.includes(a.id)}
                      onChange={() => toggleAction(a.id)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs text-gray-700">{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="text-xs px-4 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
              >
                Save permissions
              </button>
              <button
                onClick={handleResetDefaults}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
              >
                Reset to defaults
              </button>
              {saved && (
                <span className="text-xs text-green-600">Saved</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-3">{children}</div>;
}
