import { describe, it, expect } from 'vitest';
import { planImport, youtubeWatchUrl, isYouTubePlaylistUrl, type PlanEntry } from './playlist-import-plan.js';

const e = (id: string): PlanEntry => ({ id, title: `Track ${id}`, url: youtubeWatchUrl(id) });

describe('youtubeWatchUrl', () => {
  it('builds a canonical watch url', () => {
    expect(youtubeWatchUrl('abc')).toBe('https://www.youtube.com/watch?v=abc');
  });
});

describe('isYouTubePlaylistUrl', () => {
  it('accepts a bare playlist url', () => {
    expect(isYouTubePlaylistUrl('https://www.youtube.com/playlist?list=PL123')).toBe(true);
    expect(isYouTubePlaylistUrl('https://youtube.com/playlist?list=PL123')).toBe(true);
    expect(isYouTubePlaylistUrl('https://music.youtube.com/playlist?list=PL123')).toBe(true);
    expect(isYouTubePlaylistUrl('https://m.youtube.com/playlist?list=PL123')).toBe(true);
  });

  it('rejects a video opened from a playlist', () => {
    // What YouTube puts in the address bar for any video played from a
    // playlist — !play on it must still play that single video.
    expect(isYouTubePlaylistUrl('https://www.youtube.com/watch?v=abc&list=PL123')).toBe(false);
    expect(isYouTubePlaylistUrl('https://www.youtube.com/watch?v=abc&list=PL123&index=4')).toBe(false);
  });

  it('rejects an autoplay/Mix link', () => {
    expect(isYouTubePlaylistUrl('https://www.youtube.com/watch?v=abc&list=RDabc&start_radio=1')).toBe(false);
  });

  it('rejects a plain video url', () => {
    expect(isYouTubePlaylistUrl('https://www.youtube.com/watch?v=abc')).toBe(false);
    expect(isYouTubePlaylistUrl('https://youtu.be/abc')).toBe(false);
  });

  it('rejects a list= parameter on an unrelated host', () => {
    expect(isYouTubePlaylistUrl('https://example.com/playlist?list=PL123')).toBe(false);
    expect(isYouTubePlaylistUrl('https://youtube.com.evil.test/playlist?list=PL123')).toBe(false);
  });

  it('rejects a malformed url instead of throwing', () => {
    expect(isYouTubePlaylistUrl('not a url at all')).toBe(false);
    expect(isYouTubePlaylistUrl('')).toBe(false);
  });

  it('ignores a youtu.be short link even with a list', () => {
    // The video id is in the path, so there is no v= to disqualify it —
    // excluded by host instead.
    expect(isYouTubePlaylistUrl('https://youtu.be/abc?list=PL123')).toBe(false);
  });
});

describe('planImport', () => {
  it('returns everything empty for an empty playlist', () => {
    const plan = planImport([], new Set(), 50);
    expect(plan.toImport).toEqual([]);
    expect(plan.alreadyPresent).toEqual([]);
    expect(plan.truncated).toBe(0);
  });

  it('imports every entry when under the cap', () => {
    const plan = planImport([e('a'), e('b')], new Set(), 50);
    expect(plan.toImport.map((x) => x.id)).toEqual(['a', 'b']);
    expect(plan.truncated).toBe(0);
  });

  it('caps the import and reports how many were cut', () => {
    const plan = planImport([e('a'), e('b'), e('c')], new Set(), 2);
    expect(plan.toImport.map((x) => x.id)).toEqual(['a', 'b']);
    expect(plan.truncated).toBe(1);
  });

  it('skips entries already attached to this playlist', () => {
    const plan = planImport([e('a'), e('b')], new Set([youtubeWatchUrl('a')]), 50);
    expect(plan.toImport.map((x) => x.id)).toEqual(['b']);
    expect(plan.alreadyPresent.map((x) => x.id)).toEqual(['a']);
    expect(plan.truncated).toBe(0);
  });

  it('does not let already-present entries consume the cap', () => {
    // The cap bounds downloads. Tracks already attached cost nothing, so a
    // playlist that is mostly imported already must still make progress.
    const entries = [e('a'), e('b'), e('c'), e('d')];
    const attached = new Set([youtubeWatchUrl('a'), youtubeWatchUrl('b'), youtubeWatchUrl('c')]);
    const plan = planImport(entries, attached, 2);
    expect(plan.toImport.map((x) => x.id)).toEqual(['d']);
    expect(plan.alreadyPresent).toHaveLength(3);
    expect(plan.truncated).toBe(0);
  });

  it('treats a cap of zero as importing nothing', () => {
    const plan = planImport([e('a'), e('b')], new Set(), 0);
    expect(plan.toImport).toEqual([]);
    expect(plan.truncated).toBe(2);
  });

  it('drops entries with no id', () => {
    const plan = planImport([{ id: '', title: 'broken', url: '' }, e('a')], new Set(), 50);
    expect(plan.toImport.map((x) => x.id)).toEqual(['a']);
  });
});
