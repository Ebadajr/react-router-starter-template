import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseList } from './CaseList';
import type { EddRow, CaseStatus, UserPermissions } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<EddRow> = {}): EddRow {
  return {
    idx: 0,
    uid: 'TEST001',
    submittedAt: '2024-01-15',
    submittedDate: new Date('2024-01-15'),
    funding: 'Salary',
    employer: 'Acme',
    jobTitle: 'Engineer',
    monthlyIncome: '5000',
    country: 'Egypt',
    notes: '',
    documents: [],
    rawAction: 'Pending',
    assignedTo: '',
    extra: {},
    daysSinceSubmission: 1,
    isStale: false,
    ...overrides,
  };
}

const allPerms: UserPermissions = { ...DEFAULT_PERMISSIONS };
const noAssignPerms: UserPermissions = {
  tabs: [...DEFAULT_PERMISSIONS.tabs],
  actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'self_assign'),
};

function renderList(rows: EddRow[], opts: {
  currentUser?: string;
  permissions?: UserPermissions;
  selectedIdx?: number | null;
  statusOverrides?: Record<number, CaseStatus>;
  hiddenRows?: Set<number>;
  onSelect?: (i: number) => void;
  onBulkAction?: (indices: number[], action: any) => void;
  onSelfAssign?: (i: number) => void;
} = {}) {
  const props = {
    rows,
    statusOverrides: opts.statusOverrides ?? {},
    hiddenRows: opts.hiddenRows ?? new Set(),
    selectedIdx: opts.selectedIdx ?? null,
    currentUser: opts.currentUser ?? 'Sara',
    permissions: opts.permissions ?? allPerms,
    onSelect: opts.onSelect ?? vi.fn(),
    onBulkAction: opts.onBulkAction ?? vi.fn(),
    onSelfAssign: opts.onSelfAssign ?? vi.fn(),
  };
  return render(<CaseList {...props} />);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('CaseList rendering', () => {
  it('shows row count', () => {
    renderList([makeRow(), makeRow({ idx: 1, uid: 'TEST002' })]);
    expect(screen.getByText('2 rows')).toBeInTheDocument();
  });

  it('renders each row uid', () => {
    renderList([makeRow({ uid: 'ABC123' }), makeRow({ idx: 1, uid: 'DEF456' })]);
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('DEF456')).toBeInTheDocument();
  });

  it('shows "No submissions match" when rows is empty', () => {
    renderList([]);
    expect(screen.getByText(/No submissions match/)).toBeInTheDocument();
  });

  it('shows stale badge when row is stale', () => {
    renderList([makeRow({ isStale: true, daysSinceSubmission: 5 })]);
    expect(screen.getByText(/5d/)).toBeInTheDocument();
  });

  it('shows "mine" badge when row is assigned to current user', () => {
    renderList([makeRow({ assignedTo: 'Sara' })], { currentUser: 'Sara' });
    expect(screen.getByText('mine')).toBeInTheDocument();
  });

  it('shows assignee indicator when assigned to someone else', () => {
    renderList([makeRow({ assignedTo: 'Khaled' })], { currentUser: 'Sara' });
    expect(screen.getByText(/→ Khaled/)).toBeInTheDocument();
  });

  it('dims hidden rows', () => {
    const row = makeRow({ idx: 0 });
    renderList([row], { hiddenRows: new Set([0]) });
    // The row container should have opacity-40
    const rowEl = screen.getByText('TEST001').closest('[class*="border-b"]');
    expect(rowEl?.className).toMatch(/opacity-40/);
  });
});

// ── Self-assign button ────────────────────────────────────────────────────────

describe('self-assign button', () => {
  it('shows "Assign to me" for unassigned row', () => {
    renderList([makeRow({ assignedTo: '' })], { currentUser: 'Sara' });
    expect(screen.getByText('+ Assign to me')).toBeInTheDocument();
  });

  it('shows "Assign to me" for row assigned to someone else', () => {
    renderList([makeRow({ assignedTo: 'Khaled' })], { currentUser: 'Sara' });
    expect(screen.getByText('+ Assign to me')).toBeInTheDocument();
  });

  it('does NOT show "Assign to me" for row already assigned to current user', () => {
    renderList([makeRow({ assignedTo: 'Sara' })], { currentUser: 'Sara' });
    expect(screen.queryByText('+ Assign to me')).not.toBeInTheDocument();
  });

  it('calls onSelfAssign with correct idx when clicked', () => {
    const onSelfAssign = vi.fn();
    renderList([makeRow({ idx: 7, assignedTo: '' })], { onSelfAssign });
    fireEvent.click(screen.getByText('+ Assign to me'));
    expect(onSelfAssign).toHaveBeenCalledWith(7);
  });

  it('does not show "Assign to me" when self_assign permission is removed', () => {
    renderList([makeRow({ assignedTo: '' })], { permissions: noAssignPerms });
    expect(screen.queryByText('+ Assign to me')).not.toBeInTheDocument();
  });
});

// ── Selection ─────────────────────────────────────────────────────────────────

describe('row selection', () => {
  it('calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn();
    renderList([makeRow({ idx: 3 })], { onSelect });
    fireEvent.click(screen.getByText('TEST001'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('highlighted selected row has border-l styling', () => {
    renderList([makeRow({ idx: 0 })], { selectedIdx: 0 });
    const rowEl = screen.getByText('TEST001').closest('[class*="border-b"]');
    expect(rowEl?.className).toMatch(/border-l-2/);
  });
});

// ── Bulk actions ──────────────────────────────────────────────────────────────

describe('bulk actions toolbar', () => {
  it('is hidden when nothing selected', () => {
    renderList([makeRow()]);
    expect(screen.queryByText(/\d+ selected/)).not.toBeInTheDocument();
  });

  it('appears after checking a row', () => {
    renderList([makeRow()]);
    const checkboxes = screen.getAllByRole('checkbox');
    // The row-level checkbox (index 1, after select-all)
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('calls onBulkAction with correct args when status button clicked', () => {
    const onBulkAction = vi.fn();
    renderList([makeRow({ idx: 5 })], { onBulkAction });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Done'));
    expect(onBulkAction).toHaveBeenCalledWith([5], 'Done');
  });

  it('selects all on page when select-all checked', () => {
    const rows = [makeRow({ idx: 0 }), makeRow({ idx: 1, uid: 'U2' })];
    renderList(rows);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // select-all
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('pagination', () => {
  it('shows page 1 of 1 for a small list', () => {
    renderList([makeRow()]);
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });

  it('Prev button is disabled on first page', () => {
    renderList([makeRow()]);
    expect(screen.getByText('← Prev')).toBeDisabled();
  });

  it('Next button is disabled on last page', () => {
    renderList([makeRow()]);
    expect(screen.getByText('Next →')).toBeDisabled();
  });
});
