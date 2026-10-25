import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

/**
 * Access-token refresh, collapsed to one request at a time.
 *
 * Refresh tokens are single-use and rotate server-side (auth.routes.ts claims
 * the row with an atomic updateMany, so the second caller gets a 401). When the
 * 15-minute access token expires, every in-flight React Query request 401s at
 * the same moment — firing one refresh per failing request meant the first won
 * and the rest 401'd into logout(), ending a session that had just been renewed
 * successfully. Whether a user survived was decided by race ordering.
 */

const REFRESH_TIMEOUT_MS = 15_000;
const PERSIST_KEY = 'ts6-auth';
const LOCK_NAME = 'ts6-auth-refresh';

/** Refresh in flight for this tab. Concurrent callers await it rather than racing. */
let inFlight: Promise<string | null> | null = null;

interface PersistedTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * Tokens as they currently sit in localStorage.
 *
 * zustand's `persist` writes on every set but does not push state into other
 * tabs, so getState() can be stale after a sibling tab rotates. Reading storage
 * directly is the only way to notice that and adopt the result.
 */
function readPersistedTokens(): PersistedTokens | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state) return null;
    return { accessToken: state.accessToken ?? null, refreshToken: state.refreshToken ?? null };
  } catch {
    return null;
  }
}

/** Serialize across tabs where the Web Locks API exists; run bare where it does not. */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, fn) as Promise<T>;
  }
  return fn();
}

async function doRefresh(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return null;
  }

  // Another tab may have rotated while we waited for the lock. Adopt its tokens
  // instead of spending ours, which the server has already invalidated.
  const persisted = readPersistedTokens();
  if (persisted?.accessToken && persisted.refreshToken && persisted.refreshToken !== refreshToken) {
    setTokens(persisted.accessToken, persisted.refreshToken);
    return persisted.accessToken;
  }

  try {
    // Deliberately not the `api` instance — that would recurse through this
    // very interceptor. Its timeout has to be restated, since axios defaults to
    // none and a hung proxy would otherwise leave this promise unsettled and
    // every later 401 awaiting it forever.
    const res = await axios.post(
      '/api/auth/refresh',
      { refreshToken },
      { timeout: REFRESH_TIMEOUT_MS },
    );
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  } catch (err: any) {
    // Only the server actually rejecting the token ends the session. A 429 from
    // the limiter that /auth/refresh shares with /auth/login, a 502 during a
    // rolling deploy or a network blip must not: the refresh token is still
    // valid and the next attempt will succeed.
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      logout();
    }
    return null;
  }
}

/**
 * Current access token after a refresh, or null if the caller should give up.
 *
 * Never rejects: doRefresh already turns a failed refresh into null, and the
 * remaining way to throw is the lock itself being unavailable. Surfacing that
 * would replace the caller's original 401 with an unrelated error.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inFlight) return inFlight;
  inFlight = withLock(doRefresh)
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
