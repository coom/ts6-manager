import { describe, it, expect } from 'vitest';
import { pickDownloadedFile, parseUrlInfo } from './youtube.js';

const ID = 'dQw4w9WgXcQ';

describe('pickDownloadedFile', () => {
  it('picks the expected opus file', () => {
    expect(pickDownloadedFile([`${ID}.opus`], ID)).toBe(`${ID}.opus`);
  });

  it('ignores a stale .part file left by an interrupted download', () => {
    // Regression: the old code picked the alphabetically last match, so a
    // leftover "<id>.webm.part" beat the freshly converted "<id>.opus" and a
    // corrupt path was stored in the library.
    expect(pickDownloadedFile([`${ID}.opus`, `${ID}.webm.part`], ID)).toBe(`${ID}.opus`);
  });

  it('ignores temp and metadata artifacts', () => {
    expect(
      pickDownloadedFile([`${ID}.webm.ytdl`, `${ID}.temp.opus`, `${ID}.webp`, `${ID}.info.json`], ID)
    ).toBeNull();
  });

  it('falls back to another audio extension when opus is absent', () => {
    expect(pickDownloadedFile([`${ID}.m4a`], ID)).toBe(`${ID}.m4a`);
  });

  it('prefers opus over other audio files', () => {
    expect(pickDownloadedFile([`${ID}.m4a`, `${ID}.opus`], ID)).toBe(`${ID}.opus`);
  });

  it('returns null when only temp files exist', () => {
    expect(pickDownloadedFile([`${ID}.webm.part`], ID)).toBeNull();
  });

  it('returns null for an empty directory', () => {
    expect(pickDownloadedFile([], ID)).toBeNull();
  });
});

describe('parseUrlInfo', () => {
  const entry = (id: string, title: string) => ({
    id, title, uploader: 'Chan', duration: 200, thumbnails: [{ url: `http://t/${id}` }],
  });

  it('reads a playlist title, id and entries', () => {
    const info = parseUrlInfo(JSON.stringify({
      _type: 'playlist', id: 'PL123', title: 'Road Trip',
      entries: [entry('a', 'One'), entry('b', 'Two')],
    }));
    expect(info.type).toBe('playlist');
    expect(info.title).toBe('Road Trip');
    expect(info.sourceId).toBe('PL123');
    expect(info.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(info.items[0].artist).toBe('Chan');
  });

  it('treats a one-video playlist as a playlist', () => {
    // Regression: the old code inferred the type from items.length > 1, so a
    // playlist holding a single video was imported as a bare video and no
    // Playlist row was ever created for it.
    const info = parseUrlInfo(JSON.stringify({
      _type: 'playlist', id: 'PL1', title: 'Solo', entries: [entry('a', 'One')],
    }));
    expect(info.type).toBe('playlist');
    expect(info.sourceId).toBe('PL1');
    expect(info.items).toHaveLength(1);
  });

  it('reads a single video, which has no entries', () => {
    const info = parseUrlInfo(JSON.stringify(entry('solo', 'Just Me')));
    expect(info.type).toBe('video');
    expect(info.sourceId).toBeNull();
    expect(info.items).toHaveLength(1);
    expect(info.items[0].title).toBe('Just Me');
  });

  it('drops null entries left by unavailable videos', () => {
    // --flat-playlist emits null for deleted/private videos.
    const info = parseUrlInfo(JSON.stringify({
      _type: 'playlist', id: 'PL2', title: 'Gappy',
      entries: [entry('a', 'One'), null, entry('c', 'Three')],
    }));
    expect(info.items.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('throws a clear error on unparseable output', () => {
    expect(() => parseUrlInfo('not json')).toThrow(/Failed to parse/);
  });
});
