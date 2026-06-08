import { clearSession } from '../auth';
import type { AppUser, CaseStatus, Market } from '../types';
import { STATUS_OPTIONS, MARKETS } from '../types';

interface TopBarProps {
  user: AppUser;
  market: Market;
  uidSearch: string;
  statusFilter: CaseStatus | '';
  onUidSearch: (v: string) => void;
  onStatusFilter: (v: CaseStatus | '') => void;
  onMarketChange: (m: Market) => void;
  onRefresh: () => void;
  onSignOut: () => void;
  connected: boolean;
  rowCount: number;
}

export function TopBar({
  user, market, uidSearch, statusFilter,
  onUidSearch, onStatusFilter, onMarketChange,
  onRefresh, onSignOut, connected, rowCount,
}: TopBarProps) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  const accessibleMarkets = MARKETS.filter(m => user.markets.includes(m.id));

  return (
    <header className="flex items-center justify-between px-5 h-[52px] bg-white border-b border-gray-100 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 tracking-tight">Compliance Portal</div>
          <div className="text-[11px] text-gray-400">Internal Compliance Tool</div>
        </div>
        <div className="w-px h-5 bg-gray-200" />

        {/* Market switcher */}
        {accessibleMarkets.length > 1 ? (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {accessibleMarkets.map(m => (
              <button
                key={m.id}
                onClick={() => onMarketChange(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  market === m.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{m.flag}</span> {m.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-700">
            <span>{MARKETS.find(m => m.id === market)?.flag}</span>
            {MARKETS.find(m => m.id === market)?.label}
          </div>
        )}

        <span className="text-xs text-gray-400">
          Welcome, <strong className="text-gray-800 font-medium">{user.displayName}</strong>
        </span>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-100">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-[11px] text-gray-500">
            {connected ? `${rowCount} rows` : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search user ID…"
          value={uidSearch}
          onChange={e => onUidSearch(e.target.value)}
          className="w-44 text-xs px-3 py-1.5 border border-gray-200 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
        />
        <select
          value={statusFilter}
          onChange={e => onStatusFilter(e.target.value as CaseStatus | '')}
          className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white text-gray-800 focus:outline-none focus:border-gray-400"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={onRefresh}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50"
        >
          ↻ Refresh
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Session</div>
          <div className="text-[11px] font-medium text-gray-700">{today}</div>
        </div>
        <div className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-600">
          {user.avatar}
        </div>
        <button
          onClick={() => { clearSession(); onSignOut(); }}
          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}