import type { CaseStatus } from '../types';

interface BadgeProps {
  status: CaseStatus | string;
  className?: string;
}

const MAP: Record<string, string> = {
  Pending:       'bg-[#f0ede8] text-[#8a7560]',
  DUP:           'bg-gray-100 text-gray-400',
  Requested:     'bg-[#e8edf5] text-[#3a5a8a]',
  Accepted:      'bg-[#e8f4ee] text-[#2d7a4f]',
  Rejected:      'bg-[#fdecea] text-[#c0392b]',
  'Form Sent':   'bg-[#e8edf5] text-[#3a5a8a]',
  'Under Review':'bg-[#fef3e2] text-[#9a6820]',
  Done:          'bg-[#e8f4ee] text-[#2d7a4f]',
  High:          'bg-[#fdecea] text-[#c0392b]',
  Medium:        'bg-[#fef3e2] text-[#9a6820]',
  Low:           'bg-[#e8edf5] text-[#3a5a8a]',
};

export function Badge({ status, className = '' }: BadgeProps) {
  const cls = MAP[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wide ${cls} ${className}`}
    >
      {status}
    </span>
  );
}