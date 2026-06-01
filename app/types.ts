// ── EDD row as returned from /api/sheets ─────────────────────────────────────

export interface SheetData {
  headers: string[];
  rows: string[][];
}

// A parsed, enriched row used throughout the UI
export interface EddRow {
  idx: number;           // 0-based row index (used for sheet writes)
  uid: string;
  submittedAt: string;
  funding: string;
  employer: string;
  jobTitle: string;
  monthlyIncome: string;
  country: string;
  notes: string;
  documents: string[];   // links / labels found in upload columns
  rawAction: string;     // raw value of action_taken column
  assignedTo: string;
  extra: Record<string, string>; // all columns not mapped to known fields
}

// ── Status ────────────────────────────────────────────────────────────────────

export type CaseStatus = 'Pending' | 'Form Sent' | 'Under Review' | 'Done';
export const STATUS_OPTIONS: CaseStatus[] = ['Pending', 'Form Sent', 'Under Review', 'Done'];

// ── UserTool profile (dynamic — shape depends on API response) ─────────────────

export type UserProfile = Record<string, unknown>;

// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user';

export interface AppUser {
  username: string;
  displayName: string;
  role: UserRole;
  avatar: string;
}