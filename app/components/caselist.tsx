import { useState } from 'react';
import type { EddRow, CaseStatus } from '../types';
import { STATUS_OPTIONS } from '../types';
import { resolveStatus } from '../sheetParser';
import { Badge } from './Badge';

const PAGE_SIZE = 20;

interface CaseListProps {
  rows: EddRow[];
  statusOverrides: Record<number, CaseStatus>;
  hiddenRows: Set<number>;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onBulkAction: (indices: number[], action: CaseStatus | 'hide' | 'delete') => void;
}

export function CaseList({
  rows, statusOverrides, hiddenRows, selectedIdx, onSelect, onBulkAction,
}: CaseListProps) {
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function toggleCheck(idx: number, val: boolean) {
    setChecked(prev => {
      const next = new Set(prev);
      if (val) next.add(idx); else next.delete(idx);
      return next;
    });
  }

  function toggleAll(val: boolean) {
    setChecked(val ? new Set(slice.map(r => r.idx)) : new Set());
  }

  function handleBulk(action: CaseStatus | 'hide' | 'delete') {
    onBulkAction([...checked], action);
    setChecked(new Set());
  }

  // Reset to page 0 when rows change length significantly
  const currentPage = safePage;

  return (
    <div className="flex flex-col h-full">
      {/* Bulk toolbar */}
      {checked.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 flex-wrap flex-shrink-0">
          <span className="text-xs font-medium text-gray-700">{checked.size} selected</span>
          {(['Form Sent', 'Under Review', 'Done'] as CaseStatus[]).map(s => (
            <button
              key={s}
              onClick={() => handleBulk(s)}
              className="text-[11px] px-2.5 py-1 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => handleBulk('hide')}
            className="text-[11px] px-2.5 py-1 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
          >
            Hide
          </button>
          <button
            onClick={() => handleBulk('delete')}
            className="text-[11px] px-2.5 py-1 border border-gray-200 rounded bg-white text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}

      {/* List header */}
      <div className="flex items-center px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <input
          type="checkbox"
          className="mr-2 flex-shrink-0"
          checked={slice.length > 0 && slice.every(r => checked.has(r.idx))}
          onChange={e => toggleAll(e.target.checked)}
          aria-label="Select all on page"
        />
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium flex-1">
          Submissions
        </span>
        <span className="text-[11px] text-gray-400">{rows.length} rows</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {slice.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-gray-400">
            No submissions match the current filters
          </div>
        )}
        {slice.map(r => {
          const status = resolveStatus(r, statusOverrides);
          const isHidden = hiddenRows.has(r.idx);
          const isSelected = selectedIdx === r.idx;

          return (
            <div
              key={r.idx}
              onClick={() => onSelect(r.idx)}
              className={`
                flex items-center px-3 py-2.5 border-b border-gray-50 cursor-pointer gap-2
                ${isSelected ? 'bg-gray-50 border-l-2 border-l-gray-800 pl-2.5' : 'hover:bg-gray-50'}
                ${isHidden ? 'opacity-40' : ''}
              `}
            >
              <input
                type="checkbox"
                checked={checked.has(r.idx)}
                onClick={e => e.stopPropagation()}
                onChange={e => toggleCheck(r.idx, e.target.checked)}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900 flex items-center gap-1">
                  {r.uid}
                  {isHidden && <span className="text-[10px] text-gray-400 font-normal">[hidden]</span>}
                </div>
                <div className="text-[11px] text-gray-400 truncate mt-0.5">
                  {r.funding} · {r.country}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[11px] text-gray-400">{r.submittedAt?.slice(0, 10)}</span>
                <Badge status={status} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 flex-shrink-0">
        <span className="text-[11px] text-gray-400">
          Page {currentPage + 1} of {totalPages}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="text-[11px] px-2.5 py-1 border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="text-[11px] px-2.5 py-1 border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}