import type { EddRow, CaseStatus } from '../types';
import { resolveStatus } from '../sheetParser';

interface MetricsBarProps {
  rows: EddRow[];
  statusOverrides: Record<number, CaseStatus>;
}

export function MetricsBar({ rows, statusOverrides }: MetricsBarProps) {
  const counts = { Pending: 0, 'Form Sent': 0, 'Under Review': 0, Done: 0 };
  rows.forEach(r => {
    const s = resolveStatus(r, statusOverrides);
    if (s in counts) counts[s]++;
  });

  const metrics = [
    { label: 'Total',      value: rows.length },
    { label: 'Pending',    value: counts['Pending'] },
    { label: 'Form sent',  value: counts['Form Sent'] },
    { label: 'In review',  value: counts['Under Review'] },
    { label: 'Done',       value: counts['Done'] },
  ];

  return (
    <div className="flex gap-2 px-5 py-3 bg-white border-b border-gray-100 flex-shrink-0">
      {metrics.map(m => (
        <div key={m.label} className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
          <div className="text-xl font-medium text-gray-900">{m.value}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">{m.label}</div>
        </div>
      ))}
    </div>
  );
}