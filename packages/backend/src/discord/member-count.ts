/** Identity of the running TS music bots, used to exclude them from
 *  member counts and presence notifications. */
export interface MusicBotIdentity {
  clids: Set<string>;
  nicknames: Set<string>;
}

/** True when the given TS client is one of our music bots — by clid, with a
 *  nickname fallback for the connect window where the clid is not yet known. */
export function isMusicBotClient(clid: string, nickname: string, bots: MusicBotIdentity): boolean {
  return bots.clids.has(clid) || bots.nicknames.has(nickname);
}

/** Number of real clients in the given channel — or on the whole server when
 *  channelId is null — music bots excluded. */
export function countChannelClients(list: unknown, channelId: string | null, bots: MusicBotIdentity): number {
  return (Array.isArray(list) ? list : []).filter(
    (c: any) =>
      (channelId === null || String(c.cid) === channelId) &&
      String(c.client_type) === '0' &&
      !isMusicBotClient(String(c.clid), c.client_nickname || '', bots),
  ).length;
}

/** Strip a trailing " (N)" member-count suffix from a bot display name. */
export function stripCountSuffix(name: string): string {
  return name.replace(/\s*\(\d+\)$/, '');
}

const DISCORD_NICKNAME_MAX = 32;

/** "Base (N)" when N ≥ 1, plain base when 0 — capped at Discord's 32-char limit. */
export function formatCountNickname(base: string, count: number): string {
  if (count < 1) return base.slice(0, DISCORD_NICKNAME_MAX);
  const suffix = ` (${count})`;
  return base.slice(0, DISCORD_NICKNAME_MAX - suffix.length) + suffix;
}
