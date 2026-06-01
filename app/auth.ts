import type { AppUser } from './types';

// Replaces auth.py — same users, same roles
export const USERS: Record<string, AppUser> = {
  Admin: {
    username:    'Admin',
    displayName: 'Admin',
    role:        'admin',
    avatar:      'AD',
  },
  Sara: {
    username:    'Sara',
    displayName: 'Sara Nour',
    role:        'user',
    avatar:      'SN',
  },
  Khaled: {
    username:    'Khaled',
    displayName: 'Khaled Farouk',
    role:        'user',
    avatar:      'KF',
  },
  Mazen: {
    username:    'Mazen',
    displayName: 'Mazen Ebada',
    role:        'user',
    avatar:      'ME',
  },
  Mohamed: {
    username:    'Mohamed',
    displayName: 'Mohamed Elgendy',
    role:        'user',
    avatar:      'MG',
  },
};

export function getUser(username: string): AppUser | null {
  return USERS[username] ?? null;
}

export function allUsernames(): string[] {
  return Object.keys(USERS);
}

// ── Session helpers (sessionStorage — clears on tab close, like Streamlit session) ──

const SESSION_KEY = 'edd_user';

export function saveSession(user: AppUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function loadSession(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}