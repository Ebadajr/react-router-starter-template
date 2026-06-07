import type { AppUser, Market } from './types';

// ── Users per market ──────────────────────────────────────────────────────────
// markets: which markets the user can see
// Admin can see all markets

export const USERS: Record<string, AppUser> = {
  Admin: {
    username:    'Admin',
    displayName: 'Admin',
    role:        'admin',
    avatar:      'AD',
    markets:     ['EG', 'UAE'],
  },
  Sara: {
    username:    'Sara',
    displayName: 'Sara Nour',
    role:        'user',
    avatar:      'SN',
    markets:     ['EG'],
  },
  Khaled: {
    username:    'Khaled',
    displayName: 'Khaled Farouk',
    role:        'user',
    avatar:      'KF',
    markets:     ['EG'],
  },
  Mazen: {
    username:    'Mazen',
    displayName: 'Mazen Ebada',
    role:        'user',
    avatar:      'ME',
    markets:     ['EG', 'UAE'],
  },
  Mohamed: {
    username:    'Mohamed',
    displayName: 'Mohamed Elgendy',
    role:        'user',
    avatar:      'MG',
    markets:     ['EG'],
  },
  // UAE market users — add as needed
  // UAEUser: {
  //   username: 'UAEUser', displayName: 'UAE Analyst', role: 'user',
  //   avatar: 'UA', markets: ['UAE'],
  // },
};

export function getUser(username: string): AppUser | null {
  return USERS[username] ?? null;
}

export function allUsernames(): string[] {
  return Object.keys(USERS);
}

export function getUsersForMarket(market: Market): AppUser[] {
  return Object.values(USERS).filter(u => u.markets.includes(market));
}

// ── Session ───────────────────────────────────────────────────────────────────

const SESSION_KEY    = 'edd_user';
const MARKET_KEY     = 'edd_market';

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