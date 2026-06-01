import { useState, useEffect } from 'react';
import { fetchUserProfile } from '../api';
import type { UserProfile } from '../types';

interface UserToolPanelProps {
  uid: string;
}

export function UserToolPanel({ uid }: UserToolPanelProps) {
  const [data, setData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUserProfile(uid);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400 gap-2">
        <span className="animate-spin">↻</span> Fetching UserTool data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
          ⚠ {error}
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
        >
          ↻ Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4">
      <button
        onClick={load}
        className="text-[11px] px-2.5 py-1 border border-gray-200 rounded bg-white text-gray-500 hover:bg-gray-50 mb-4"
      >
        ↻ Refresh
      </button>
      <RenderValue label="root" value={data} depth={0} />
    </div>
  );
}

// ── Recursive JSON renderer (mirrors render_value() in member_app.py) ─────────

function RenderValue({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const indent = depth * 12;

  if (value === null || value === undefined || String(value).trim() === '') return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div style={{ marginLeft: indent }}>
        {depth > 0 && (
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mt-3 mb-1">
            {label}
          </div>
        )}
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <RenderValue key={k} label={k} value={v} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <div style={{ marginLeft: indent }}>
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mt-3 mb-1">
          {label} ({value.length})
        </div>
        {value.map((item, i) => (
          <RenderValue key={i} label={`[${i}]`} value={item} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div style={{ marginLeft: indent }} className="mb-2.5">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
        <BoolBadge value={value} />
      </div>
    );
  }

  const str = String(value);
  const isUrl = str.startsWith('http');

  return (
    <div style={{ marginLeft: indent }} className="mb-2.5">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
      {isUrl ? (
        <a
          href={str}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-blue-600 hover:underline break-all"
        >
          {str.length > 60 ? str.slice(0, 60) + '…' : str}
        </a>
      ) : (
        <div className="text-[12px] font-medium text-gray-800 break-all">{str}</div>
      )}
    </div>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#e8f4ee] text-[#2d7a4f]">
      {String(value)}
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#fdecea] text-[#c0392b]">
      {String(value)}
    </span>
  );
}