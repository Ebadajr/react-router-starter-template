// ── Market ────────────────────────────────────────────────────────────────────

export type Market = 'EG' | 'UAE';

export const MARKETS: { id: Market; label: string; flag: string; worksheet: string }[] = [
  { id: 'EG',  label: 'Egypt', flag: '🇪🇬', worksheet: 'Response' },
  { id: 'UAE', label: 'UAE',   flag: '🇦🇪', worksheet: 'EDD UAE'  },
];

// ── EDD row as returned from /api/sheets ─────────────────────────────────────

export interface SheetData {
  headers: string[];
  rows: string[][];
}

export interface EddRow {
  idx: number;
  uid: string;
  submittedAt: string;
  submittedDate: Date | null;
  funding: string;
  employer: string;
  jobTitle: string;
  monthlyIncome: string;
  country: string;
  notes: string;
  documents: string[];
  rawAction: string;
  assignedTo: string;
  extra: Record<string, string>;
  daysSinceSubmission: number | null;
  isStale: boolean;
}

// ── Status ────────────────────────────────────────────────────────────────────

export type CaseStatus = 'Pending' | 'Form Sent' | 'Under Review' | 'Done';
export const STATUS_OPTIONS: CaseStatus[] = ['Pending', 'Form Sent', 'Under Review', 'Done'];

export interface ActionResult {
  ok: boolean;
  rowIndex: number;
  action: string;
}

export interface AssignResult {
  ok: boolean;
  assigned: number;
  username: string;
}

// ── UserTool profile ──────────────────────────────────────────────────────────

export type UserProfile = Record<string, unknown>;

// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user';

export interface AppUser {
  username: string;
  displayName: string;
  role: UserRole;
  avatar: string;
  markets: Market[];
}

// ── Alert rows (EDD Daily Deposits sheet) ────────────────────────────────────

export type AlertType = 'edd_deposits';

export type AlertResponseValue = 'edd_requested' | 'clear' | '';

export interface AlertRow {
  idx: number;
  userId: string;
  currency: string;
  updatedAt: string;
  amount: string;
  alertId: string;
  response: AlertResponseValue;   // Response column: edd_requested | clear | ''
  notes: string;
  isMinor: string;
  arabicName: string;
  englishName: string;
  address: string;
  companyName: string;
  phoneNumber: string;
  nationality: string;
  idType: string;
  idNumber: string;
  idExpiry: string;
  country: string;
  done: string;
  actionTaken: string;            // action_taken column — "{action} — {username}"
  assignedTo: string;             // assigned to column
}

// ── Permissions ───────────────────────────────────────────────────────────────

export type TabId =
  | 'edd_submissions'
  | 'alerts'
  | 'phone_requests'
  | 'high_risk'
  | 'aml_alerts';

export type ActionId =
  | 'self_assign'
  | 'accept_edd'
  | 'reject_edd'
  | 'send_form'
  | 'send_details_to_cx'
  | 'mark_done'
  | 'hide'
  | 'delete'
  | 'change_status';

export interface UserPermissions {
  tabs: TabId[];
  actions: ActionId[];
}

export const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'edd_submissions', label: 'EDD Submissions' },
  { id: 'alerts',          label: 'Alerts' },
  { id: 'phone_requests',  label: 'Phone Number Requests' },
  { id: 'high_risk',       label: 'High Risk Users' },
  { id: 'aml_alerts',      label: 'AML Alerts' },
];

export const ALL_ACTIONS: { id: ActionId; label: string }[] = [
  { id: 'self_assign',        label: 'Self Assign' },
  { id: 'accept_edd',         label: 'Accept EDD' },
  { id: 'reject_edd',         label: 'Reject EDD' },
  { id: 'send_form',          label: 'Send Form' },
  { id: 'send_details_to_cx', label: 'Send Details to CX' },
  { id: 'mark_done',          label: 'Mark Done' },
  { id: 'hide',               label: 'Hide' },
  { id: 'delete',             label: 'Delete' },
  { id: 'change_status',      label: 'Change Status' },
];

export const DEFAULT_PERMISSIONS: UserPermissions = {
  tabs:    ['edd_submissions', 'alerts', 'phone_requests', 'high_risk', 'aml_alerts'],
  actions: ['self_assign', 'accept_edd', 'reject_edd', 'send_form', 'send_details_to_cx', 'mark_done', 'hide', 'delete', 'change_status'],
};
