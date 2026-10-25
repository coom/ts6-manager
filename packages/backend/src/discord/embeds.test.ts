import { describe, it, expect } from 'vitest';
import {
  awayStatusEmbed,
  clientConnectedEmbed,
  clientDisconnectedEmbed,
  nowPlayingEmbed,
  statsEmbed,
  queueEmbed,
  lyricsEmbeds,
  formatDuration,
  formatUptime,
  formatBytes,
  renderTemplate,
  DEFAULT_JOIN_TEMPLATE,
  DEFAULT_AWAY_TEMPLATE,
  DEFAULT_BACK_TEMPLATE,
} from './embeds.js';

describe('discord embeds', () => {
  it('connect/disconnect embeds carry the nickname', () => {
    expect(clientConnectedEmbed('Guillaume').description).toContain('**Guillaume**');
    expect(clientDisconnectedEmbed('Guillaume').description).toContain('**Guillaume**');
  });

  it('now-playing embed hides an unknown artist', () => {
    const withArtist = nowPlayingEmbed('DJ Bot', { title: 'Song', artist: 'Artist', duration: 65 });
    expect(withArtist.description).toContain('Artist — ');
    expect(withArtist.description).toContain('[1:05]');

    const noArtist = nowPlayingEmbed('DJ Bot', { title: 'Song', artist: 'Unknown' });
    expect(noArtist.description).not.toContain('Unknown');
  });

  it('stats embed exposes the four fields', () => {
    const embed = statsEmbed({
      serverName: 'My TS', onlineUsers: 5, maxClients: 32, channelCount: 12,
      uptime: 90061, bandwidthIn: 2048, bandwidthOut: 1048576,
    });
    expect(embed.title).toContain('My TS');
    expect(embed.fields.map((f) => f.value)).toEqual(
      expect.arrayContaining(['5 / 32', '12', '1j 1h 1m', '↓ 2.0 Ko/s  ↑ 1.0 Mo/s'])
    );
  });

  it('queue embed marks the current track and truncates at 15', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: String(i), title: `Track ${i}`, filePath: '', source: 'youtube' as const,
    }));
    const embed = queueEmbed(items, 2);
    expect(embed.description).toContain('▶ **3.** Track 2');
    expect(embed.description).toContain('… et 5 de plus');
  });

  it('renders join/leave templates with action, user, channel and member count', () => {
    const out = renderTemplate(DEFAULT_JOIN_TEMPLATE, { user: 'Alice', channel: 'Lobby', totalMembers: 3, action: '🟢' });
    expect(out).toBe('🟢 Alice a rejoint le canal Lobby du TeamSpeak (3 connectés)');
    // custom template, all tokens incl. the {{...}} form and aliases
    expect(renderTemplate('{action} {user}/{channel}/{{TotalMembersOfChannel}}', { user: 'Bob', channel: 'X', totalMembers: 7, action: '🔴' }))
      .toBe('🔴 Bob/X/7');
  });

  it('formatters', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect(formatUptime(3660)).toBe('1h 1m');
    expect(formatBytes(512)).toBe('512 o');
  });
});

describe('awayStatusEmbed', () => {
  it('colore en violet et garde le message quand AFK', () => {
    const e = awayStatusEmbed('Bob est passé AFK', true);
    expect(e.color).toBe(0x9b59b6);
    expect(e.description).toBe('Bob est passé AFK');
    expect(typeof e.timestamp).toBe('string');
  });

  it('colore en vert quand de retour', () => {
    const e = awayStatusEmbed('Bob est de retour', false);
    expect(e.color).toBe(0x2ecc71);
  });
});

describe('templates AFK par défaut', () => {
  it('rend le template away avec le pseudo', () => {
    const msg = renderTemplate(DEFAULT_AWAY_TEMPLATE, { user: 'Bob', channel: 'Lobby', totalMembers: 3, action: '💤' });
    expect(msg).toBe('💤 Bob est passé AFK');
  });

  it('rend le template back avec le pseudo', () => {
    const msg = renderTemplate(DEFAULT_BACK_TEMPLATE, { user: 'Bob', channel: 'Lobby', totalMembers: 3, action: '✅' });
    expect(msg).toBe('✅ Bob est de retour');
  });
});

describe('lyricsEmbeds', () => {
  it('puts the 🎤 title on the first embed only', () => {
    const embeds = lyricsEmbeds('Queen', 'Bohemian Rhapsody', 'line\n'.repeat(1000));
    expect(embeds.length).toBeGreaterThan(1);
    expect(embeds[0].title).toBe('🎤 Queen — Bohemian Rhapsody');
    expect(embeds[1].title).toBeUndefined();
  });

  it('keeps every description within the 4096-char embed limit', () => {
    const embeds = lyricsEmbeds('A', 'B', 'x'.repeat(10_000));
    for (const e of embeds) expect(e.description.length).toBeLessThanOrEqual(4096);
  });

  it('omits the artist when unknown', () => {
    const embeds = lyricsEmbeds('', 'Title', 'some lyrics');
    expect(embeds[0].title).toBe('🎤 Title');
  });
});
