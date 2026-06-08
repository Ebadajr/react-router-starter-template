import { describe, it, expect } from 'vitest';

// ── Pure utility functions extracted from workers/app.ts for testing ──────────
// These are duplicated here since the worker module isn't importable in jsdom.

function toColLetter(n: number): string {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function dedupeHeaders(raw: string[]): string[] {
  const seen: Record<string, number> = {};
  return raw.map((h, i) => {
    const key = h.trim() || `__col_${i}__`;
    if (seen[key] == null) { seen[key] = 1; return key; }
    seen[key]++;
    return `${key} _${seen[key]}`;
  });
}

// ── toColLetter ───────────────────────────────────────────────────────────────

describe('toColLetter', () => {
  it('converts 1 → A', () => expect(toColLetter(1)).toBe('A'));
  it('converts 2 → B', () => expect(toColLetter(2)).toBe('B'));
  it('converts 26 → Z', () => expect(toColLetter(26)).toBe('Z'));
  it('converts 27 → AA', () => expect(toColLetter(27)).toBe('AA'));
  it('converts 28 → AB', () => expect(toColLetter(28)).toBe('AB'));
  it('converts 52 → AZ', () => expect(toColLetter(52)).toBe('AZ'));
  it('converts 53 → BA', () => expect(toColLetter(53)).toBe('BA'));
  it('converts 702 → ZZ', () => expect(toColLetter(702)).toBe('ZZ'));
  it('converts 703 → AAA', () => expect(toColLetter(703)).toBe('AAA'));
});

// ── dedupeHeaders ─────────────────────────────────────────────────────────────

describe('dedupeHeaders', () => {
  it('returns same headers when all unique', () => {
    expect(dedupeHeaders(['user_id', 'action_taken', 'assigned to']))
      .toEqual(['user_id', 'action_taken', 'assigned to']);
  });

  it('appends _2 for first duplicate', () => {
    expect(dedupeHeaders(['col', 'col'])).toEqual(['col', 'col _2']);
  });

  it('appends _3 for third occurrence', () => {
    expect(dedupeHeaders(['col', 'col', 'col'])).toEqual(['col', 'col _2', 'col _3']);
  });

  it('replaces empty header with __col_N__', () => {
    expect(dedupeHeaders(['', ''])).toEqual(['__col_0__', '__col_1__']);
  });

  it('trims whitespace before deduplication', () => {
    expect(dedupeHeaders([' col ', 'col'])).toEqual(['col', 'col _2']);
  });

  it('handles mixed empty and named headers', () => {
    const result = dedupeHeaders(['a', '', 'b', '']);
    expect(result[0]).toBe('a');
    expect(result[2]).toBe('b');
    expect(result[1]).toMatch(/^__col_/);
    expect(result[3]).toMatch(/^__col_/);
  });

  it('returns empty array for empty input', () => {
    expect(dedupeHeaders([])).toEqual([]);
  });

  it('handles duplicates that appear non-consecutively', () => {
    const result = dedupeHeaders(['a', 'b', 'a']);
    expect(result).toEqual(['a', 'b', 'a _2']);
  });
});
