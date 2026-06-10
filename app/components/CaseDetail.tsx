import type { EddRow, CaseStatus, UserPermissions, Market } from '../types';
import { STATUS_OPTIONS } from '../types';
import { resolveStatus } from '../sheetParser';
import { Badge } from './Badge';
import { UserToolPanel } from './UserToolPanel';

interface CaseDetailProps {
  row: EddRow | null;
  allSubmissions: EddRow[];
  statusOverrides: Record<number, CaseStatus>;
  hiddenRows: Set<number>;
  permissions: UserPermissions;
  market: Market;
  onStatusChange: (idx: number, status: CaseStatus) => void;
  onSendForm: (idx: number) => void;
  onAcceptEdd: (idx: number) => void;
  onRejectEdd: (idx: number) => void;
  onSendDetailsToCx: (idx: number, currentStatus: CaseStatus) => void;
  onHide: (idx: number) => void;
  onDelete: (idx: number) => void;
  onClose: () => void;
}

export function CaseDetail({
  row, allSubmissions, statusOverrides, hiddenRows, permissions, market,
  onStatusChange, onSendForm, onAcceptEdd, onRejectEdd,
  onSendDetailsToCx, onHide, onDelete, onClose,
}: CaseDetailProps) {
  if (!row) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 bg-white">
        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/>
        </svg>
        <p className="text-sm">Select a case to see submission and UserTool info side by side</p>
      </div>
    );
  }

  const status   = resolveStatus(row, statusOverrides);
  const isHidden = hiddenRows.has(row.idx);
  const initials = row.uid.slice(-3);
  const can      = (a: string) => permissions.actions.includes(a as any);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
            {initials}
          </div>
          <div>
            <div className="text-base font-medium text-gray-900">{row.uid}</div>
            <div className="text-xs text-gray-400">
              Submitted {row.submittedAt?.slice(0, 10) || '—'} · {row.country || '—'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={status} />
          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>

      {/* Panel labels */}
      <div className="flex flex-shrink-0 border-b border-gray-100">
        <PanelLabel icon="📄" text="Submission info" />
        <PanelLabel icon="📊" text={market === 'EG' ? 'Account info' : 'UserTool info'} bordered />
      </div>

      {/* Side-by-side panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto border-r border-gray-100 p-4">
          <SubmissionPanel row={row} allSubmissions={allSubmissions} />
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {market === 'EG' ? <SheetInfoPanel row={row} /> : <UserToolPanel uid={row.uid} />}
        </div>
      </div>

      {/* Action footer */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-t border-gray-100 flex-shrink-0 bg-white flex-wrap">
        {/* Status change */}
        {can('change_status') && (
          <>
            <select
              value={status}
              onChange={e => onStatusChange(row.idx, e.target.value as CaseStatus)}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:border-gray-400 flex-shrink-0"
            >
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button
              onClick={() => onStatusChange(row.idx, status)}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
            >
              Save
            </button>
          </>
        )}

        {/* EDD decision buttons */}
        {can('accept_edd') && (
          <button
            onClick={() => onAcceptEdd(row.idx)}
            className="text-xs px-3 py-1.5 border border-green-200 rounded text-green-700 bg-green-50 hover:bg-green-100"
          >
            Accept EDD
          </button>
        )}
        {can('reject_edd') && (
          <button
            onClick={() => onRejectEdd(row.idx)}
            className="text-xs px-3 py-1.5 border border-red-200 rounded text-red-600 bg-red-50 hover:bg-red-100"
          >
            Reject EDD
          </button>
        )}

        {/* Send actions */}
        {can('send_form') && (
          <button
            onClick={() => onSendForm(row.idx)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
          >
            Send form
          </button>
        )}
        {can('send_details_to_cx') && (
          <button
            onClick={() => onSendDetailsToCx(row.idx, status)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
          >
            Send details to CX
          </button>
        )}
        {can('mark_done') && (
          <button
            onClick={() => onStatusChange(row.idx, 'Done')}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
          >
            Mark done
          </button>
        )}

        <div className="flex-1" />

        {can('hide') && (
          <button
            onClick={() => onHide(row.idx)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
          >
            {isHidden ? 'Un-hide' : 'Hide'}
          </button>
        )}
        {can('delete') && (
          <button
            onClick={() => { onDelete(row.idx); onClose(); }}
            className="text-xs px-3 py-1.5 border border-red-100 rounded text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PanelLabel({ icon, text, bordered }: { icon: string; text: string; bordered?: boolean }) {
  return (
    <div className={`flex-1 flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400 font-medium ${bordered ? 'border-l border-gray-100' : ''}`}>
      <span aria-hidden="true">{icon}</span> {text}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
      <div className="text-xs font-medium text-gray-800 break-words">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2.5 mt-4 first:mt-0">
      {children}
    </div>
  );
}

function SheetInfoPanel({ row }: { row: EddRow }) {
  const hasDeposits =
    row.currentMonthDepositsCount || row.currentMonthDepositsValue ||
    row.prevMonthDepositsCount    || row.prevMonthDepositsValue;
  const hasBalances =
    row.portfolioValue || row.purchasePower || row.blockedCash ||
    row.bookBalance    || row.savingsWallet;

  return (
    <div className="p-4">
      <SectionTitle>Identity</SectionTitle>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Arabic Name"         value={row.arabicName} />
        <Field label="Is Minor"            value={row.isMinor} />
        <Field label="Occupation (Arabic)" value={row.occupationAr} />
        <Field label="Address (Arabic)"    value={row.addressAr} />
      </div>

      {hasBalances && (
        <>
          <hr className="border-gray-100 my-3" />
          <SectionTitle>Balances</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Portfolio Value" value={row.portfolioValue} />
            <Field label="Purchase Power"  value={row.purchasePower} />
            <Field label="Blocked Cash"    value={row.blockedCash} />
            <Field label="Book Balance"    value={row.bookBalance} />
            <Field label="Savings Wallet"  value={row.savingsWallet} />
          </div>
        </>
      )}

      {hasDeposits && (
        <>
          <hr className="border-gray-100 my-3" />
          <SectionTitle>Deposits</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="This Month (Count)" value={row.currentMonthDepositsCount} />
            <Field label="This Month (Value)" value={row.currentMonthDepositsValue} />
            <Field label="Last Month (Count)" value={row.prevMonthDepositsCount} />
            <Field label="Last Month (Value)" value={row.prevMonthDepositsValue} />
          </div>
        </>
      )}

      {!row.arabicName && !hasBalances && !hasDeposits && (
        <p className="text-xs text-gray-400 mt-2">No account data available for this case.</p>
      )}
    </div>
  );
}

function SubmissionPanel({ row, allSubmissions }: { row: EddRow; allSubmissions: EddRow[] }) {
  const others = allSubmissions
    .filter(r => r.idx !== row.idx)
    .sort((a, b) => b.idx - a.idx); // newest first
  return (
    <>
      <SectionTitle>Submission details</SectionTitle>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="User ID"         value={row.uid} />
        <Field label="Submitted"       value={row.submittedAt?.slice(0, 10)} />
        <Field label="Primary funding" value={row.funding} />
        <Field label="Employer"        value={row.employer} />
        <Field label="Job title"       value={row.jobTitle} />
        <Field label="Monthly income"  value={row.monthlyIncome} />
        <Field label="Country"         value={row.country} />
        <Field label="Notes"           value={row.notes} />
      </div>

      {row.documents.length > 0 && (
        <>
          <hr className="border-gray-100 my-3" />
          <SectionTitle>Documents</SectionTitle>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {row.documents.map((doc, i) => (
              <a
                key={i}
                href={doc.startsWith('http') ? doc : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-2.5 py-1 text-[11px] bg-gray-100 border border-gray-200 rounded text-gray-700 hover:bg-gray-200"
              >
                {doc.startsWith('http') ? `Document ${i + 1}` : doc}
              </a>
            ))}
          </div>
        </>
      )}

      {Object.keys(row.extra).length > 0 && (
        <>
          <hr className="border-gray-100 my-3" />
          <details>
            <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-700 select-none">
              All fields ({Object.keys(row.extra).length})
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-x-4">
              {Object.entries(row.extra).map(([k, v]) => (
                <Field key={k} label={k} value={v} />
              ))}
            </div>
          </details>
        </>
      )}

      {others.length > 0 && (
        <>
          <hr className="border-gray-100 my-3" />
          <details>
            <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-700 select-none">
              Previous submissions ({others.length})
            </summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {others.map(r => (
                <PastSubmission key={r.idx} row={r} />
              ))}
            </div>
          </details>
        </>
      )}
    </>
  );
}

function PastSubmission({ row }: { row: EddRow }) {
  const RESP_LABEL: Record<string, string> = {
    edd_requested: 'Requested',
    edd_accepted:  'Accepted',
    edd_rejected:  'Rejected',
    dup:           'DUP',
    '':            'Pending',
  };
  const status = RESP_LABEL[row.eddResponse] ?? 'Pending';
  return (
    <div className="rounded border border-gray-100 bg-white px-3 py-2 text-[11px] text-gray-700">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400">{row.submittedAt?.slice(0, 10) || '—'}</span>
        <Badge status={status} />
      </div>
      {row.funding && <div className="text-gray-500 truncate">{row.funding}</div>}
      {row.notes   && <div className="text-gray-400 truncate mt-0.5">{row.notes}</div>}
    </div>
  );
}
