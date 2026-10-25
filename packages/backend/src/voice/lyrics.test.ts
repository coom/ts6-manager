import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanTrackTitle, chunkLyrics, lyricsInputFromTrack } from './lyrics.js';

describe('cleanTrackTitle', () => {
  it('strips bracketed YouTube noise', () => {
    expect(cleanTrackTitle('Bohemian Rhapsody (Official Video)')).toBe('Bohemian Rhapsody');
    expect(cleanTrackTitle('Alors on danse [Clip Officiel]')).toBe('Alors on danse');
    expect(cleanTrackTitle('Take on Me (Official 4K Video)')).toBe('Take on Me');
    expect(cleanTrackTitle('Numb (Official Music Video) [HD]')).toBe('Numb');
    expect(cleanTrackTitle('Shape of You (Lyrics)')).toBe('Shape of You');
  });

  it('keeps meaningful parentheses', () => {
    expect(cleanTrackTitle('Time (You and I)')).toBe('Time (You and I)');
  });

  it('collapses leftover whitespace', () => {
    expect(cleanTrackTitle('  Song   (Official Audio)  ')).toBe('Song');
  });

  it('returns plain titles untouched', () => {
    expect(cleanTrackTitle('Bohemian Rhapsody')).toBe('Bohemian Rhapsody');
  });
});

describe('chunkLyrics', () => {
  it('returns a single chunk when everything fits', () => {
    expect(chunkLyrics('HEAD', 'line1\nline2', 100)).toEqual(['HEAD\nline1\nline2']);
  });

  it('splits on line boundaries, never mid-line', () => {
    const chunks = chunkLyrics('', 'aaaa\nbbbb\ncccc', 9);
    expect(chunks).toEqual(['aaaa\nbbbb', 'cccc']);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(9);
  });

  it('puts the header in the first chunk only', () => {
    const chunks = chunkLyrics('🎤 Artist — Title', 'l1\nl2\nl3\nl4', 20);
    expect(chunks[0].startsWith('🎤 Artist — Title')).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1]).not.toContain('🎤');
  });

  it('hard-splits a single line longer than maxLen (degenerate case)', () => {
    const chunks = chunkLyrics('', 'x'.repeat(25), 10);
    expect(chunks).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  });

  it('drops empty/whitespace-only chunks', () => {
    expect(chunkLyrics('', '\n\n\n', 50)).toEqual([]);
  });

  it('works with an empty header (Discord mode)', () => {
    expect(chunkLyrics('', 'hello', 50)).toEqual(['hello']);
  });
});

import { fetchLyrics } from './lyrics.js';

describe('lyricsInputFromTrack', () => {
  it('keeps a real artist in both input and label', () => {
    const { input, label } = lyricsInputFromTrack({ artist: 'Queen', title: 'Bohemian Rhapsody' });
    expect(input).toEqual({ artist: 'Queen', title: 'Bohemian Rhapsody' });
    expect(label).toBe('Queen — Bohemian Rhapsody');
  });

  it('treats the "Unknown" sentinel as an absent artist', () => {
    const { input, label } = lyricsInputFromTrack({ artist: 'Unknown', title: 'Some Song' });
    expect(input.artist).toBeUndefined();
    expect(label).toBe('Some Song');
  });

  it('treats the "Unknown Artist" sentinel (Spotify metadata) as an absent artist', () => {
    const { input, label } = lyricsInputFromTrack({ artist: 'Unknown Artist', title: 'Some Song' });
    expect(input.artist).toBeUndefined();
    expect(label).toBe('Some Song');
  });

  it('cleans the title for search but keeps the raw title in the label', () => {
    const { input, label } = lyricsInputFromTrack({ artist: 'Artist', title: 'Song (Official Video)' });
    expect(input.title).toBe('Song');
    expect(label).toBe('Artist — Song (Official Video)');
  });

  it('handles a missing artist property', () => {
    const { input, label } = lyricsInputFromTrack({ title: 'Some Song' });
    expect(input.artist).toBeUndefined();
    expect(label).toBe('Some Song');
  });
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('fetchLyrics', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the LRCLIB exact match first', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      artistName: 'Queen', trackName: 'Bohemian Rhapsody',
      plainLyrics: 'Is this the real life?', instrumental: false,
    }));
    const r = await fetchLyrics({ artist: 'Queen', title: 'Bohemian Rhapsody' });
    expect(r).toMatchObject({ artist: 'Queen', lyrics: 'Is this the real life?', source: 'lrclib' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('lrclib.net/api/get?');
  });

  it('falls back to LRCLIB search when exact match 404s', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'not found' }, 404))
      .mockResolvedValueOnce(jsonResponse([
        { artistName: 'A', trackName: 'T', plainLyrics: '', instrumental: false },
        { artistName: 'Queen', trackName: 'Bohemian Rhapsody', plainLyrics: 'lyrics here', instrumental: false },
      ]));
    const r = await fetchLyrics({ artist: 'Queen', title: 'Bohemian Rhapsody' });
    expect(r).toMatchObject({ lyrics: 'lyrics here', source: 'lrclib' });
    expect(String(fetchMock.mock.calls[1][0])).toContain('lrclib.net/api/search?');
  });

  it('skips the exact-match step for free-text queries', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([
      { artistName: 'Queen', trackName: 'Bohemian Rhapsody', plainLyrics: 'found', instrumental: false },
    ]));
    const r = await fetchLyrics({ query: 'queen bohemian rhapsody' });
    expect(r?.lyrics).toBe('found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/search?');
  });

  it('falls back to lyrics.ovh when LRCLIB has nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ lyrics: 'ovh lyrics' }));
    const r = await fetchLyrics({ artist: 'Queen', title: 'Bohemian Rhapsody' });
    expect(r).toMatchObject({ lyrics: 'ovh lyrics', source: 'lyrics.ovh' });
    expect(String(fetchMock.mock.calls[2][0])).toContain('api.lyrics.ovh/v1/');
  });

  it('returns null when every source fails or is empty', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ error: 'No lyrics found' }, 404));
    const r = await fetchLyrics({ artist: 'Nobody', title: 'Nothing' });
    expect(r).toBeNull();
  });

  it('reports LRCLIB instrumentals explicitly', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      artistName: 'Vangelis', trackName: 'Chariots of Fire',
      plainLyrics: null, instrumental: true,
    }));
    const r = await fetchLyrics({ artist: 'Vangelis', title: 'Chariots of Fire' });
    expect(r).toMatchObject({ instrumental: true, lyrics: '' });
  });

  it('never calls lyrics.ovh without both artist and title', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const r = await fetchLyrics({ query: 'unknown song' });
    expect(r).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // search only
  });
});
