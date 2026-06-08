import type { AppUser, Market, UserPermissions } from './types';
import { DEFAULT_PERMISSIONS } from './types';

const USERS_KEY       = 'compliance_users';
const PERMISSIONS_KEY = 'compliance_permissions';
const SESSION_KEY     = 'edd_user';
const MARKET_KEY      = 'edd_market';

// Default/seed users — used when localStorage has no data
export const USERS: Record<string, AppUser> = {
  Admin: {
    username: 'Admin', displayName: 'Admin', role: 'admin', avatar: 'AD', markets: ['EG', 'UAE'],
  },
  Sara: {
    username: 'Sara', displayName: 'Sara Nour', role: 'user', avatar: 'SN', markets: ['EG'],
  },
  Khaled: {
    username: 'Khaled', displayName: 'Khaled Farouk', role: 'user', avatar: 'KF', markets: ['EG'],
  },
  Mazen: {
    username: 'Mazen', displayName: 'Mazen Ebada', role: 'user', avatar: 'ME', markets: ['EG', 'UAE'],
  },
  Mohamed: {
    username: 'Mohamed', displayName: 'Mohamed Elgendy', role: 'user', avatar: 'MG', markets: ['EG'],
  },
};

// ── Runtime user management (persisted in localStorage) ───────────────────────

export function loadRuntimeUsers(): Record<string, AppUser> {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AppUser>) : { ...USERS };
  } catch { return { ...USERS }; }
}

export function saveRuntimeUsers(users: Record<string, AppUser>): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {}
}

// ── Permissions ───────────────────────────────────────────────────────────────

export function loadUserPermissions(username: string): UserPermissions {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return { ...DEFAULT_PERMISSIONS };
    const all = JSON.parse(raw) as Record<string, UserPermissions>;
    return all[username] ?? { ...DEFAULT_PERMISSIONS };
  } catch { return { ...DEFAULT_PERMISSIONS }; }
}

export function saveUserPermissions(username: string, perms: UserPermissions): void {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, UserPermissions>) : {};
    all[username] = perms;
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(all));
  } catch {}
}

export function loadAllPermissions(): Record<string, UserPermissions> {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserPermissions>) : {};
  } catch { return {}; }
}

// ── User helpers ──────────────────────────────────────────────────────────────

export function getUser(username: string): AppUser | null {
  return loadRuntimeUsers()[username] ?? null;
}

export function allUsernames(): string[] {
  return Object.keys(loadRuntimeUsers());
}

export function getUsersForMarket(market: Market): AppUser[] {
  return Object.values(loadRuntimeUsers()).filter(u => u.markets.includes(market));
}

// ── Session ───────────────────────────────────────────────────────────────────

export function saveSession(user: AppUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function loadSession(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch { return null; }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(MARKET_KEY);
}

export function saveMarket(market: Market): void {
  sessionStorage.setItem(MARKET_KEY, market);
}

export function loadMarket(): Market {
  return (sessionStorage.getItem(MARKET_KEY) as Market) ?? 'EG';
}
