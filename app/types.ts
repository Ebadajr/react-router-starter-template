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

// A parsed, enriched row used throughout the UI
export interface EddRow {
  idx: number;
  uid: string;
  submittedAt: string;
  submittedDate: Date | null;   // parsed Date for staleness calc
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
  isStale: boolean;             // true if unreviewed for > 3 days
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
  markets: Market[];  // which markets this user can access
}