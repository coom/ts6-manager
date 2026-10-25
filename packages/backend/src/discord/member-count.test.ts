import { describe, it, expect } from 'vitest';
import {
  isMusicBotClient,
  countChannelClients,
  stripCountSuffix,
  formatCountNickname,
  type MusicBotIdentity,
} from './member-count.js';

const bots = (clids: string[] = [], nicknames: string[] = []): MusicBotIdentity => ({
  clids: new Set(clids),
  nicknames: new Set(nicknames),
});

describe('isMusicBotClient', () => {
  it('reconnaît un music bot par son clid', () => {
    expect(isMusicBotClient('42', 'Peu importe', bots(['42']))).toBe(true);
  });

  it('reconnaît un music bot par son nickname (fenêtre de connexion)', () => {
    expect(isMusicBotClient('99', 'MusicBot', bots([], ['MusicBot']))).toBe(true);
  });

  it('ne matche pas un client ordinaire', () => {
    expect(isMusicBotClient('7', 'Guillaume', bots(['42'], ['MusicBot']))).toBe(false);
  });
});

describe('countChannelClients', () => {
  const list = [
    { clid: '1', cid: '5', client_type: '0', client_nickname: 'Alice' },
    { clid: '2', cid: '5', client_type: '0', client_nickname: 'Bob' },
    { clid: '3', cid: '5', client_type: '1', client_nickname: 'serveradmin' }, // query client
    { clid: '4', cid: '9', client_type: '0', client_nickname: 'Ailleurs' },   // other channel
    { clid: '42', cid: '5', client_type: '0', client_nickname: 'MusicBot' },  // music bot
  ];

  it('compte les vrais clients du canal, music bots exclus', () => {
    expect(countChannelClients(list, '5', bots(['42']))).toBe(2);
  });

  it('exclut aussi par nickname quand le clid est inconnu', () => {
    expect(countChannelClients(list, '5', bots([], ['MusicBot']))).toBe(2);
  });

  it('retourne 0 sur une réponse non-tableau', () => {
    expect(countChannelClients({ error: 'x' }, '5', bots())).toBe(0);
  });

  it('compte tout le serveur quand channelId est null, music bots exclus', () => {
    // Alice + Bob (cid 5) + Ailleurs (cid 9); query client et music bot exclus
    expect(countChannelClients(list, null, bots(['42']))).toBe(3);
  });

  it('exclut par nickname en mode serveur entier', () => {
    expect(countChannelClients(list, null, bots([], ['MusicBot']))).toBe(3);
  });

  it('retourne 0 en mode serveur entier sur une réponse non-tableau', () => {
    expect(countChannelClients({ error: 'x' }, null, bots())).toBe(0);
  });
});

describe('stripCountSuffix', () => {
  it('retire un suffixe " (N)" final', () => {
    expect(stripCountSuffix('E-Odyssey (4)')).toBe('E-Odyssey');
  });

  it('laisse un nom sans suffixe intact', () => {
    expect(stripCountSuffix('E-Odyssey')).toBe('E-Odyssey');
  });

  it('ne retire pas une parenthèse non numérique', () => {
    expect(stripCountSuffix('Team (FR)')).toBe('Team (FR)');
  });
});

describe('formatCountNickname', () => {
  it('affiche "Base (N)" quand N ≥ 1', () => {
    expect(formatCountNickname('E-Odyssey', 4)).toBe('E-Odyssey (4)');
  });

  it('affiche le nom seul quand N = 0', () => {
    expect(formatCountNickname('E-Odyssey', 0)).toBe('E-Odyssey');
  });

  it('respecte la limite Discord de 32 caractères', () => {
    const long = 'A'.repeat(32);
    const result = formatCountNickname(long, 12);
    expect(result.length).toBeLessThanOrEqual(32);
    expect(result.endsWith(' (12)')).toBe(true);
  });
});
