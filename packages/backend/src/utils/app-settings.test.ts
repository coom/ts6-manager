import { describe, it, expect } from 'vitest';
import { parseImportCap, DEFAULT_MAX_PLAYLIST_IMPORT } from './app-settings.js';

describe('parseImportCap', () => {
  it('falls back to the default when unset', () => {
    expect(parseImportCap(null)).toBe(DEFAULT_MAX_PLAYLIST_IMPORT);
    expect(parseImportCap(undefined)).toBe(DEFAULT_MAX_PLAYLIST_IMPORT);
    expect(parseImportCap('')).toBe(DEFAULT_MAX_PLAYLIST_IMPORT);
  });

  it('falls back to the default on a non-numeric value', () => {
    expect(parseImportCap('lots')).toBe(DEFAULT_MAX_PLAYLIST_IMPORT);
  });

  it('reads a valid value', () => {
    expect(parseImportCap('120')).toBe(120);
  });

  it('clamps a negative value to zero', () => {
    expect(parseImportCap('-5')).toBe(0);
  });

  it('floors a fractional value', () => {
    expect(parseImportCap('12.9')).toBe(12);
  });
});
