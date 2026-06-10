import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseDetail } from './CaseDetail';
import type { EddRow, UserPermissions } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<EddRow> = {}): EddRow {
  return {
    idx: 0,
    uid: 'TEST001',
    submittedAt: '2024-01-15',
    submittedDate: new Date('2024-01-15'),
    funding: 'Salary',
    employer: 'Acme Corp',
    jobTitle: 'Engineer',
    monthlyIncome: '5000',
    country: 'Egypt',
    notes: 'Some notes',
    documents: [],
    rawAction: 'Pending',
    assignedTo: 'Sara',
    extra: {},
    daysSinceSubmission: 1,
    isStale: false,
    eddResponse: '',
    arabicName: '', isMinor: '', occupationAr: '', addressAr: '',
    portfolioValue: '', purchasePower: '', blockedCash: '', bookBalance: '',
    savingsWallet: '', currentMonthDepositsCount: '', currentMonthDepositsValue: '',
    prevMonthDepositsCount: '', prevMonthDepositsValue: '',
    ...overrides,
  };
}

const allHandlers = {
  onStatusChange: vi.fn(),
  onSendForm: vi.fn(),
  onAcceptEdd: vi.fn(),
  onRejectEdd: vi.fn(),
  onSendDetailsToCx: vi.fn(),
  onHide: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
};

function renderDetail(row: EddRow | null, permOverrides: Partial<UserPermissions> = {}) {
  const handlers = {
    onStatusChange: vi.fn(),
    onSendForm: vi.fn(),
    onAcceptEdd: vi.fn(),
    onRejectEdd: vi.fn(),
    onSendDetailsToCx: vi.fn(),
    onHide: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };
  const perms: UserPermissions = {
    tabs: DEFAULT_PERMISSIONS.tabs,
    actions: permOverrides.actions ?? DEFAULT_PERMISSIONS.actions,
  };
  const { rerender } = render(
    <CaseDetail
      row={row}
      allSubmissions={row ? [row] : []}
      statusOverrides={{}}
      hiddenRows={new Set()}
      permissions={perms}
      market="EG"
      {...handlers}
    />
  );
  return { handlers, rerender };
}

// ── Empty state ───────────────────────────────────────────────────────────────

describe('CaseDetail empty state', () => {
  it('shows placeholder when no row is selected', () => {
    renderDetail(null);
    expect(screen.getByText(/Select a case/)).toBeInTheDocument();
  });
});

// ── Row display ───────────────────────────────────────────────────────────────

describe('CaseDetail row display', () => {
  it('shows uid in the header', () => {
    renderDetail(makeRow({ uid: 'ABC123' }));
    expect(screen.getAllByText('ABC123').length).toBeGreaterThan(0);
  });

  it('shows submission fields', () => {
    renderDetail(makeRow());
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Egypt')).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    renderDetail(makeRow({ notes: 'Very important note' }));
    expect(screen.getByText('Very important note')).toBeInTheDocument();
  });

  it('shows document links', () => {
    renderDetail(makeRow({ documents: ['http://example.com/doc.pdf'] }));
    expect(screen.getByText('Document 1')).toBeInTheDocument();
  });

  it('shows extra fields in details element', () => {
    renderDetail(makeRow({ extra: { custom_col: 'custom_value' } }));
    const details = document.querySelector('details');
    expect(details).toBeInTheDocument();
  });
});

// ── Action buttons ────────────────────────────────────────────────────────────

describe('CaseDetail actions - all permissions granted', () => {
  it('calls onAcceptEdd when Accept EDD clicked', () => {
    const { handlers } = renderDetail(makeRow({ idx: 3 }));
    fireEvent.click(screen.getByText('Accept EDD'));
    expect(handlers.onAcceptEdd).toHaveBeenCalledWith(3);
  });

  it('calls onRejectEdd when Reject EDD clicked', () => {
    const { handlers } = renderDetail(makeRow({ idx: 5 }));
    fireEvent.click(screen.getByText('Reject EDD'));
    expect(handlers.onRejectEdd).toHaveBeenCalledWith(5);
  });

  it('calls onSendForm when Send form clicked', () => {
    const { handlers } = renderDetail(makeRow({ idx: 2 }));
    fireEvent.click(screen.getByText('Send form'));
    expect(handlers.onSendForm).toHaveBeenCalledWith(2);
  });

  it('calls onSendDetailsToCx when Send details to CX clicked', () => {
    const { handlers } = renderDetail(makeRow({ idx: 4 }));
    fireEvent.click(screen.getByText('Send details to CX'));
    expect(handlers.onSendDetailsToCx).toHaveBeenCalledWith(4, 'Pending');
  });

  it('calls onStatusChange with Done when Mark done clicked', () => {
    const { handlers } = renderDetail(makeRow({ idx: 1 }));
    fireEvent.click(screen.getByText('Mark done'));
    expect(handlers.onStatusChange).toHaveBeenCalledWith(1, 'Done');
  });

  it('calls onHide when Hide clicked', () => {
    const { handlers } = renderDetail(makeRow({ idx: 0 }));
    fireEvent.click(screen.getByText('Hide'));
    expect(handlers.onHide).toHaveBeenCalledWith(0);
  });

  it('calls onDelete and onClose when Delete clicked', () => {
    const { handlers } = renderDetail(makeRow({ idx: 9 }));
    fireEvent.click(screen.getByText('Delete'));
    expect(handlers.onDelete).toHaveBeenCalledWith(9);
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('calls onClose when Close button clicked', () => {
    const { handlers } = renderDetail(makeRow());
    fireEvent.click(screen.getByText('Close'));
    expect(handlers.onClose).toHaveBeenCalled();
  });
});

// ── Permission gating ─────────────────────────────────────────────────────────

describe('CaseDetail permission gating', () => {
  it('hides Accept EDD when accept_edd not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'accept_edd') });
    expect(screen.queryByText('Accept EDD')).not.toBeInTheDocument();
  });

  it('hides Reject EDD when reject_edd not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'reject_edd') });
    expect(screen.queryByText('Reject EDD')).not.toBeInTheDocument();
  });

  it('hides Send form when send_form not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'send_form') });
    expect(screen.queryByText('Send form')).not.toBeInTheDocument();
  });

  it('hides Send details to CX when send_details_to_cx not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'send_details_to_cx') });
    expect(screen.queryByText('Send details to CX')).not.toBeInTheDocument();
  });

  it('hides Mark done when mark_done not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'mark_done') });
    expect(screen.queryByText('Mark done')).not.toBeInTheDocument();
  });

  it('hides Hide when hide not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'hide') });
    expect(screen.queryByText('Hide')).not.toBeInTheDocument();
  });

  it('hides Delete when delete not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'delete') });
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('hides status dropdown and Save when change_status not in permissions', () => {
    renderDetail(makeRow(), { actions: DEFAULT_PERMISSIONS.actions.filter(a => a !== 'change_status') });
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows all buttons when full permissions granted', () => {
    renderDetail(makeRow());
    expect(screen.getByText('Accept EDD')).toBeInTheDocument();
    expect(screen.getByText('Reject EDD')).toBeInTheDocument();
    expect(screen.getByText('Send form')).toBeInTheDocument();
    expect(screen.getByText('Send details to CX')).toBeInTheDocument();
    expect(screen.getByText('Mark done')).toBeInTheDocument();
    expect(screen.getByText('Hide')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('shows no action buttons when no actions granted', () => {
    renderDetail(makeRow(), { actions: [] });
    expect(screen.queryByText('Accept EDD')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject EDD')).not.toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});

// ── Status override display ───────────────────────────────────────────────────

describe('CaseDetail status display', () => {
  it('shows override status when provided', () => {
    const row = makeRow({ idx: 0, rawAction: 'Pending' });
    const perms = { ...DEFAULT_PERMISSIONS };
    render(
      <CaseDetail
        row={row}
        allSubmissions={[row]}
        statusOverrides={{ 0: 'Under Review' }}
        hiddenRows={new Set()}
        permissions={perms}
        market="EG"
        onStatusChange={vi.fn()}
        onSendForm={vi.fn()}
        onAcceptEdd={vi.fn()}
        onRejectEdd={vi.fn()}
        onSendDetailsToCx={vi.fn()}
        onHide={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    // The Badge should show "Under Review"
    expect(screen.getAllByText('Under Review').length).toBeGreaterThan(0);
  });

  it('shows Un-hide when row is hidden', () => {
    renderDetail(makeRow({ idx: 0 }), { actions: DEFAULT_PERMISSIONS.actions });
    // Re-render with the row in hiddenRows
    const { rerender } = render(
      <CaseDetail
        row={makeRow({ idx: 0 })}
        allSubmissions={[makeRow({ idx: 0 })]}
        statusOverrides={{}}
        hiddenRows={new Set([0])}
        permissions={DEFAULT_PERMISSIONS}
        market="EG"
        onStatusChange={vi.fn()}
        onSendForm={vi.fn()}
        onAcceptEdd={vi.fn()}
        onRejectEdd={vi.fn()}
        onSendDetailsToCx={vi.fn()}
        onHide={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Un-hide')).toBeInTheDocument();
  });
});
