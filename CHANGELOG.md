# Changelog

Notable changes to TS6 Manager. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Started at the 2026-08-06 security review; earlier history is in the git log.

## [Unreleased]

### Security

Full security review of the codebase. Twelve issues, three of them high severity.

- **MFA bypass via JWT token-class confusion** (high). Access, MFA-challenge and
  forced-password-change tokens were all HS256 over the same secret with no
  discriminator any verifier read. The challenge token issued after the password
  step alone was therefore accepted as a full session, so knowing a password was
  enough to reach admin without the second factor. Tokens now carry a `typ`
  claim, asserted in `authMiddleware`, both short-lived token verifiers and the
  WebSocket handshake; `req.user` is built field by field instead of spreading
  the payload. Regression cover in `middleware/auth.test.ts`.
- **Bot-flow secrets readable by any account** (high). `GET /api/bots` and
  `GET /api/bots/:id` had no role guard while the writes did, exposing webhook
  secrets — the only control on the unauthenticated webhook endpoint — plus
  HTTP-action `Authorization` headers and channel passwords. Router is admin-only.
- **yt-dlp argument injection** (high). A URL beginning with `-` was parsed as an
  option; `--config-location` loads a config file that can carry `--exec`,
  giving command execution on the host. Every call site now rejects such URLs and
  places a literal `--` before the positional.
- **WebSocket had no authorization.** It accepted any signed token, never
  re-checked whether the account was still enabled, and broadcast every server's
  events to every socket. It now verifies the token class, confirms the account,
  and scopes each event by `serverConfigId`.
- **SSH host key was never verified.** Without a `hostVerifier`, ssh2 accepts any
  host key, handing the ServerQuery password to a machine-in-the-middle. The
  SHA-256 fingerprint is pinned on first connect and a change is refused.
- **Unguarded reads that crossed a privilege boundary.** `privilegekeylist`
  (redeemable as TeamSpeak Server Admin), the widget list (tokens for every
  server), and `clientdblist` / `clientdbinfo` / `banlist` / `logview` (the
  client IPs the existing control on `clientlist` deliberately withholds) are
  now admin-only.
- **SSRF from music commands.** `!play` / `!queue` / `!stream` reach yt-dlp and
  the sidecar's ffmpeg and are open to any TeamSpeak or Discord user when no
  command server-group is configured. URLs are now checked with `validateUrl`,
  matching the radio path.
- **MFA recovery codes had 32 bits of entropy** for a credential that replaces
  the second factor outright. Raised to 64 bits; comparison is constant-time.
- **Media sidecar.** Accepted local filesystem paths as an ffmpeg input, letting
  a caller relay host files to stream viewers, and served unauthenticated
  requests when `SIDECAR_TOKEN` was unset. Restricted to `http(s)` and fails
  closed; the backend mints a random token per spawn, so local mode needs no
  configuration.
- **Dependency advisories published after the review.** `pnpm audit` had gone
  from clean to one critical and 27 high. axios moves to 1.20 (outbound-request
  advisories, among them `maxRedirects: 0` not enforced by the fetch adapter;
  the backend uses the Node adapter, so the SSRF guard held). Also bumped:
  express, `@xmldom/xmldom` (SAML parsing), undici, proxy-addr, qs,
  body-parser, nanoid, ip-address, deepmerge-ts and the build tooling; the
  unused `pino` and `pino-pretty` are gone. The frontend moves from
  `react-router-dom` 6 to `react-router` 7.18, the last release line that
  supports React 18, for its fixes to an open redirect through a backslash in
  `<Link>` / `useNavigate` and a constructor injection in SSR error hydration
  (neither reachable here: no SSR, every navigation target is static or a
  numeric id). Navigation keeps the v6 behaviour (no React transitions).
  multer moves from 1.4.5-lts.2 to 2.4: the `-lts` suffix makes it a
  prerelease that advisory ranges never match, so the audit never reported its
  ten high-severity upload DoS advisories. The media sidecar now requires Go
  1.27.2, since 1.25 no longer gets security releases and six reachable stdlib
  advisories in `net/http` and `crypto/tls` are fixed only in 1.26.9 and
  1.27.2; `x/net` moves to 0.60 and `x/crypto` to 0.57. Two advisories are now
  ignored in `auditConfig.ignoreGhsas`, `braces` (no fix released) and
  `postcss-selector-parser`, both reached only through the Tailwind 3 build.
  The previously ignored esbuild advisory has been withdrawn and is no longer
  listed.

### Changed

- **BREAKING — `JWT_SECRET` and `ENCRYPTION_KEY` are now required in every
  environment**, minimum 32 characters. They previously fell back to a published
  default, and the guard only fired when `NODE_ENV` was exactly `production`,
  so any deployment run directly, under pm2 or under systemd shipped a known
  signing key. The backend now refuses to start without them.
- **BREAKING — `SIDECAR_TOKEN` is required when the sidecar runs as its own
  container** (`SIDECAR_URL` set). Generate one with `openssl rand -hex 32`.
  Not needed when the backend spawns the sidecar itself.
- The frontend's published host port is now `FRONTEND_PORT` (default 3000), so a
  deployment that does not use 3000 sets it in `.env` instead of editing the
  tracked `docker-compose.yml` and hitting a conflict on every pull. Remember
  `FRONTEND_URL` alongside it: it is the CORS allow-list value and must match
  the origin the browser actually uses.
- `ENCRYPTION_KEY` no longer falls back to `JWT_SECRET`. Existing values stay
  readable: `decrypt` retains its legacy-key path.

### Fixed

- Self-service MFA enrolment always returned 401. `/mfa/setup` and `/mfa/enable`
  sit on the public `/api/auth` mount, so `authMiddleware` never ran and
  `req.user` was always undefined, leaving MFA effectively impossible to turn on
  from the Account tab.
- **Refresh stampede logged users out of healthy sessions.** When the access
  token expired, every concurrent request 401'd at once and each fired its own
  `POST /auth/refresh`. Refresh tokens are single-use and rotate, so the first
  call won and the rest 401'd straight into `logout()` — ending a session that
  had just been renewed. Refreshes are now single-flight per tab and serialized
  across tabs with a Web Lock, re-reading persisted tokens under the lock so a
  rotation another tab performed is adopted rather than repeated. Reported in
  coom/ts6-manager#1.
- Only a 401/403 from `/auth/refresh` ends a session. Previously any failure did,
  so a 429 from the limiter that `/auth/refresh` shares with `/auth/login`, or a
  502 during a rolling deploy, signed users out over a token the server never
  looked at. The refresh request also has an explicit timeout — it bypasses the
  `api` instance to avoid interceptor recursion, which bypassed its timeout too,
  and axios defaults to none.
- A stale 401 from a request that predates a completed refresh now retries with
  the current token instead of spending another rotation.
- Role changes reach the navigation without a re-login, and a half-session
  holding tokens with `user: null` repairs itself. The persisted user was written
  only by `setAuth`, i.e. only on a real login, so a promoted user kept the
  viewer sidebar while every API call already returned 200. The identity is now
  re-read on layout mount, sharing the `['me']` query key Settings already uses.
  Reported in coom/ts6-manager#3.
- WebQuery boolean fields are compared numerically. The WebQuery returns every
  field as a string and `"0"` is truthy, so the clients table badged every
  connected client as away, permanently, and every message rendered as read.
  Reported in coom/ts6-manager#2.
- Rejected uploads answered 500 "Internal server error". A file over the size
  limit now gets 413 and any other multer rejection 400, with multer's message;
  an extension the music library does not accept gets 400.
- Accented upload filenames were decoded as Latin-1 (`été.mp3` became
  `Ã©tÃ©.mp3`), garbling the title and artist the music library derives from
  them. multer now decodes them as UTF-8; songs uploaded earlier keep their
  stored title.

### Added

- **YouTube playlist import.** Pasting a playlist URL in the music library, or
  sending it to `!play`, now downloads its tracks and creates a bot-side
  playlist named after the YouTube playlist. `!play` starts on the first track
  that lands and queues the rest as they download; re-importing adds only what
  is new to the library but still queues everything, so `!play` on a playlist
  imported earlier plays it. A `watch?v=…&list=…` link — what YouTube shows in
  the address bar for a video opened from a playlist — stays a single-video
  play; only a `/playlist?list=…` URL imports. Track failures never abort the
  run: the web UI lists them all, the chat summary shows the first five. The
  track cap is `max_playlist_import` (default 50), changeable under
  Settings → YouTube.
- `packages/sidecar/ts6-media-sidecar[.exe]` is gitignored, so the compiled Go
  binary cannot be committed.
- CI also runs every Monday and on demand (`workflow_dispatch`), so high and
  critical advisories published between pushes fail the audit step instead of
  going unnoticed. The sidecar job runs `govulncheck`, which fails on any
  vulnerability the code reaches, including the Go standard library at the
  version `go.mod` requires.
- CI warns before a base runtime goes out of support. A new `eol` job reads the
  Node, Go and Debian versions pinned in the Dockerfiles, `go.mod` and `ci.yml`,
  fails 60 days before any of them reaches end of life and warns once one has
  left active support; for Go, which only patches its two latest releases, it
  warns as soon as a newer release ships. `node:22-slim` is now spelled
  `node:22-bookworm-slim` (the same image) so the Debian release is visible.
- Each Docker image is scanned with Trivy for high and critical vulnerabilities
  in its system packages that already have a fix. Trivy is installed from its
  release archive with a pinned checksum rather than through
  `aquasecurity/trivy-action`, whose tags were hijacked in March 2026. The
  images now apply the distribution's pending security updates at build
  (`apt-get upgrade`, `apk upgrade`): the first scan found seven critical and
  high Perl fixes the Debian base image did not carry yet. That layer is cached,
  so rebuild with `docker compose build --pull --no-cache` from time to time to
  pick up new updates.
