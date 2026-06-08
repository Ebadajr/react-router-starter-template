import { describe, it, expect, beforeEach } from 'vitest';
import {
  USERS,
  loadRuntimeUsers, saveRuntimeUsers,
  loadUserPermissions, saveUserPermissions, loadAllPermissions,
  getUser, allUsernames, getUsersForMarket,
  saveSession, loadSession, clearSession,
  saveMarket, loadMarket,
} from './auth';
import { DEFAULT_PERMISSIONS } from './types';
import type { AppUser, UserPermissions } from './types';

const SARA: AppUser = {
  username: 'Sara', displayName: 'Sara Nour', role: 'user', avatar: 'SN', markets: ['EG'],
};

// ── Default USERS constant ────────────────────────────────────────────────────

describe('USERS constant', () => {
  it('contains Admin user with admin role', () => {
    expect(USERS.Admin.role).toBe('admin');
  });

  it('contains non-admin users', () => {
    const nonAdmin = Object.values(USERS).filter(u => u.role !== 'admin');
    expect(nonAdmin.length).toBeGreaterThan(0);
  });

  it('each user has required fields', () => {
    for (const u of Object.values(USERS)) {
      expect(u.username).toBeTruthy();
      expect(u.displayName).toBeTruthy();
      expect(u.role).toMatch(/^(admin|user)$/);
      expect(u.avatar).toBeTruthy();
      expect(Array.isArray(u.markets)).toBe(true);
    }
  });
});

// ── Runtime users ─────────────────────────────────────────────────────────────

describe('loadRuntimeUsers', () => {
  it('returns USERS defaults when localStorage is empty', () => {
    const users = loadRuntimeUsers();
    expect(Object.keys(users)).toEqual(expect.arrayContaining(Object.keys(USERS)));
  });

  it('returns stored users when localStorage has data', () => {
    const custom = { TestUser: { username: 'TestUser', displayName: 'Test', role: 'user' as const, avatar: 'TU', markets: ['EG' as const] } };
    localStorage.setItem('compliance_users', JSON.stringify(custom));
    const users = loadRuntimeUsers();
    expect(users.TestUser).toBeDefined();
    expect(users.TestUser.displayName).toBe('Test');
  });

  it('falls back to USERS on corrupt localStorage', () => {
    localStorage.setItem('compliance_users', 'not-json{{{');
    const users = loadRuntimeUsers();
    expect(users.Admin).toBeDefined();
  });
});

describe('saveRuntimeUsers', () => {
  it('persists to localStorage', () => {
    const custom = { NewUser: SARA };
    saveRuntimeUsers(custom);
    const raw = localStorage.getItem('compliance_users');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.NewUser.username).toBe('Sara');
  });

  it('is read back by loadRuntimeUsers', () => {
    saveRuntimeUsers({ Sara: SARA });
    expect(loadRuntimeUsers().Sara).toEqual(SARA);
  });
});

// ── Permissions ───────────────────────────────────────────────────────────────

describe('loadUserPermissions', () => {
  it('returns DEFAULT_PERMISSIONS when nothing is stored', () => {
    const perms = loadUserPermissions('Sara');
    expect(perms).toEqual(DEFAULT_PERMISSIONS);
  });

  it('returns stored permissions for a user', () => {
    const custom: UserPermissions = { tabs: ['edd_submissions'], actions: ['self_assign'] };
    saveUserPermissions('Sara', custom);
    expect(loadUserPermissions('Sara')).toEqual(custom);
  });

  it('returns defaults for a user with no stored entry even when others exist', () => {
    saveUserPermissions('Khaled', { tabs: ['edd_submissions'], actions: [] });
    const perms = loadUserPermissions('Sara');
    expect(perms).toEqual(DEFAULT_PERMISSIONS);
  });

  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('compliance_permissions', 'bad-json');
    expect(loadUserPermissions('Sara')).toEqual(DEFAULT_PERMISSIONS);
  });
});

describe('saveUserPermissions', () => {
  it('overwrites existing permissions for a user', () => {
    saveUserPermissions('Sara', { tabs: ['edd_submissions'], actions: ['self_assign'] });
    saveUserPermissions('Sara', { tabs: ['alerts'], actions: [] });
    expect(loadUserPermissions('Sara').tabs).toEqual(['alerts']);
  });

  it('does not overwrite other users when saving one user', () => {
    saveUserPermissions('Sara', { tabs: ['edd_submissions'], actions: [] });
    saveUserPermissions('Khaled', { tabs: ['alerts'], actions: ['accept_edd'] });
    expect(loadUserPermissions('Sara').tabs).toEqual(['edd_submissions']);
    expect(loadUserPermissions('Khaled').tabs).toEqual(['alerts']);
  });
});

describe('loadAllPermissions', () => {
  it('returns empty object when nothing stored', () => {
    expect(loadAllPermissions()).toEqual({});
  });

  it('returns all saved permissions', () => {
    saveUserPermissions('Sara', { tabs: ['edd_submissions'], actions: [] });
    saveUserPermissions('Khaled', { tabs: ['alerts'], actions: ['self_assign'] });
    const all = loadAllPermissions();
    expect(all.Sara).toBeDefined();
    expect(all.Khaled).toBeDefined();
  });
});

// ── User helpers ──────────────────────────────────────────────────────────────

describe('getUser', () => {
  it('returns user from runtime storage', () => {
    saveRuntimeUsers({ Sara: SARA });
    expect(getUser('Sara')).toEqual(SARA);
  });

  it('returns null for unknown username', () => {
    saveRuntimeUsers({ Sara: SARA });
    expect(getUser('Unknown')).toBeNull();
  });
});

describe('allUsernames', () => {
  it('returns all keys from runtime users', () => {
    saveRuntimeUsers({ Sara: SARA });
    expect(allUsernames()).toEqual(['Sara']);
  });
});

describe('getUsersForMarket', () => {
  it('filters by market correctly', () => {
    const mazen: AppUser = { username: 'Mazen', displayName: 'Mazen', role: 'user', avatar: 'ME', markets: ['EG', 'UAE'] };
    saveRuntimeUsers({ Sara: SARA, Mazen: mazen });
    const uae = getUsersForMarket('UAE');
    expect(uae.map(u => u.username)).toContain('Mazen');
    expect(uae.map(u => u.username)).not.toContain('Sara');
  });
});

// ── Session ───────────────────────────────────────────────────────────────────

describe('session management', () => {
  it('saveSession / loadSession round-trip', () => {
    saveSession(SARA);
    expect(loadSession()).toEqual(SARA);
  });

  it('loadSession returns null when nothing saved', () => {
    expect(loadSession()).toBeNull();
  });

  it('clearSession removes user and market', () => {
    saveSession(SARA);
    saveMarket('UAE');
    clearSession();
    expect(loadSession()).toBeNull();
    expect(loadMarket()).toBe('EG'); // default
  });

  it('loadSession returns null on corrupt data', () => {
    sessionStorage.setItem('edd_user', 'not-json');
    expect(loadSession()).toBeNull();
  });
});

// ── Market ────────────────────────────────────────────────────────────────────

describe('market helpers', () => {
  it('saveMarket / loadMarket round-trip', () => {
    saveMarket('UAE');
    expect(loadMarket()).toBe('UAE');
  });

  it('loadMarket defaults to EG', () => {
    expect(loadMarket()).toBe('EG');
  });
});
