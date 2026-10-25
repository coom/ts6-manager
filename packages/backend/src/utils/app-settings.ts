/** Typed access to AppSetting rows, shared by routes and services. */

export const MAX_PLAYLIST_IMPORT_KEY = 'max_playlist_import';
export const DEFAULT_MAX_PLAYLIST_IMPORT = 50;

/** Read the stored cap, tolerating anything a hand-edited row might contain. */
export function parseImportCap(raw: string | null | undefined): number {
  if (raw == null || raw === '') return DEFAULT_MAX_PLAYLIST_IMPORT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_MAX_PLAYLIST_IMPORT;
  return Math.max(0, Math.floor(n));
}
