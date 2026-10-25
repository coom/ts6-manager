#### DISCLAIMER: 
![AI Assisted](https://img.shields.io/badge/AI%20Assisted-Project-00ADD8?style=for-the-badge&logo=dependabot&logoColor=white)

# TS6 Manager

**English** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

Web-based management interface for TeamSpeak servers. Control virtual servers, channels, clients, permissions, music bots, automated workflows, and embeddable server widgets — all from your browser. The interface is available in **English, French, German, Spanish, and Italian**.

## What this version changes

Hardened, reliability-focused evolution of [clusterzx/ts6-manager](https://github.com/clusterzx/ts6-manager):

**Accounts & access**
- Two-factor authentication (TOTP) with one-time recovery codes; admins can require MFA per user and force a password change at next logon
- "Trusted computer" option: skip password **and** MFA on a chosen device for 30 days via a revocable `httpOnly` cookie, with a device list you can revoke from your account
- Configurable password policy (minimum length + complexity)
- **SSO via SAML** — optional single sign-on alongside local login, with just-in-time account provisioning and roles mapped from your identity provider

**Discord integration**
- Discord bridge: slash commands (`/play`, `/skip`, `/queue`, …), TeamSpeak connect/leave + presence notifications, and a live server-stats panel
- AFK notifications: post to Discord when a user goes AFK or comes back in the watched channel
- The music bot can also stream into a Discord voice channel
- Restrict who may run the bot's commands to a chosen set of Discord roles

**Multi-language**
- Full UI translation in English, French, German, Spanish, and Italian, remembered per user

**Spotify & journal**
- Spotify links resolve to YouTube for playback, configured in the WebUI
- Connection journal of web + TeamSpeak logins with offline GeoIP, sortable/filterable columns, and one-click IP bans (web and/or TeamSpeak)

**Reliability**
- Self-healing connection pool: server connections added or edited in the UI work immediately — no backend restart, ever
- WebQuery client rebuilds its transport when its keep-alive socket dies silently (Docker NAT, server restarts), with a circuit breaker that stops feeding the TS flood counter
- Dashboard responses cached 5 s server-side: N open tabs cost the same as one
- One undecryptable credential row no longer crashes startup

**Music bots**
- Streamed file playback: first audio in ~200 ms, constant memory (previously the entire track was decoded to RAM — ~690 MB for a 1 h mix)
- Native opus encoder (`@discordjs/opus`, ~5-10× less CPU) with automatic WASM fallback
- Robust yt-dlp pipeline: hard timeouts, stale-artifact cleanup, deduplicated concurrent downloads, full error logging, low CPU priority, auto-update at container start
- Load & Play starts playback; playlist song counts stay fresh

**Security**
- Built-in safe expression evaluator replaces the unmaintained `expr-eval`
- Sidecar API bearer-token auth, hardened containers, committed binaries removed
- Dependencies upgraded to clear all audit findings; ESLint + GitHub Actions CI

**Deployment**
- `docker compose up -d --build` builds from source by default (`docker-compose.hub.yml` for the upstream Docker Hub images)
- nginx/client timeouts sized for long YouTube downloads; silent, clean container startup

Built on the **WebQuery HTTP API** (the ServerQuery replacement in modern TeamSpeak builds). Telnet is not used or supported.

![License](https://img.shields.io/badge/license-MIT-blue)

## Screenshots

### Dashboard
Live overview of your server: online users, channel count, uptime, ping, bandwidth graph, and server capacity at a glance.

![Dashboard](docs/dashboard.png)

### Music Bots
Run multiple music bots per server. Each bot has its own queue, volume control, and playback state. Supports radio streams, YouTube, and a local music library. Users in the bot's channel can control it via text commands (`!radio`, `!play`, `!vol`, etc.).

![Music Bots](docs/musicbots.png)

### Bot Flow Engine
Visual node-based editor for building automated server workflows. Drag triggers, conditions, and actions onto the canvas, connect them, and deploy. Supports TS3 events, cron schedules, webhooks, and chat commands as triggers.

![Flow Editor](docs/flow-editor.png)

### Flow Templates
Get started quickly with pre-built flow templates. Covers common use cases like temporary channel creation, AFK movers, idle kickers, online counters, and group protection. One click to import, then customize to your needs.

![Flow Templates](docs/flow-templates.png)

## Features

### Authentication & Accounts
- Setup wizard for the initial admin account (no default credentials)
- Two-factor authentication (TOTP) compatible with any authenticator app, with one-time recovery codes
- Admins can require MFA per user and force a password change at next logon
- "Trusted computer" option: a revocable 30-day cookie that skips both password and MFA on that device; trusted devices are listed and revocable from your account
- Configurable password policy (minimum length + complexity)
- Per-user UI language (English, French, German, Spanish, Italian)
- Optional SSO via SAML 2.0 (SP-initiated), shown as a "Sign in via SSO" button next to local login
- Just-in-time account provisioning (toggleable) with the role mapped from a SAML group/attribute, re-evaluated on each login, plus a configurable default role
- The MFA gate still applies after a SAML login; SSO accounts have no local password and cannot use the local password flows

### Server Management
- Dashboard with live server stats, bandwidth graph, and capacity overview
- Virtual server list with start/stop controls
- Channel tree with drag-and-drop ordering
- Client list with kick, ban, move, poke actions
- Server & channel group management
- Permission editor (server, channel, client, group-level)
- Ban list management
- Token / privilege key management
- Complaint viewer
- Offline message system
- Server log viewer with filtering
- Channel file browser with upload/download
- Instance-level settings

### Music Bots
- Multiple bots per server, each with independent queue and playback
- Radio station streaming with ICY metadata and live title updates
- YouTube playback via yt-dlp (search, download, queue)
- Spotify link support (track/album/playlist metadata resolved to YouTube)
- Music library management (upload, organize, playlists)
- Volume control, pause, skip, previous, shuffle, repeat
- Stereo audio support with stable 20ms pacing
- Auto-reconnect with exponential backoff on disconnect
- In-channel text commands for hands-free control, including channel listing and move commands
- Restrict music commands and admin commands to specific TeamSpeak server groups
- Optional now-playing notification posted in the bot's TeamSpeak channel
- Music request history tracking

### Discord Integration
- Discord bridge bot with slash commands: `/play`, `/stop`, `/pause`, `/skip`, `/next`, `/prev`, `/queue`, `/volume`, `/nowplaying`, `/stats`, `/join`, `/leave`
- Restrict commands to selected Discord roles (admins/owner always allowed; empty = open to everyone)
- TeamSpeak connect/leave and channel-scoped presence notifications, with embed or plain style and optional auto-delete
- AFK notifications: post a customizable message when a user goes AFK or comes back in the watched channel (shares the embed/plain style and auto-delete)
- Live server-stats panel kept up to date in a Discord channel
- The music bot can stream its audio into a Discord voice channel
- Discord message trigger and send-message action available in the Bot Flow Engine

### Video Streaming
- Live video streaming from YouTube, Twitch, or direct URLs to TeamSpeak channels
- WebRTC-based with Go sidecar relay (Pion) for low-latency delivery
- Quality presets (480p, 720p, 1080p)
- In-browser preview with WebRTC playback
- A/V synchronization via RTCP Sender Reports
- Runs as a Docker sidecar container alongside the backend

### Bot Flow Engine
- Visual flow editor with drag-and-drop node canvas
- Triggers: TS3 events, cron schedules, webhooks (with mandatory secrets), chat commands (global or channel-specific), Discord messages
- Actions: kick, ban, move, message, poke, channel create/edit/delete, HTTP requests, WebQuery commands, Discord messages
- Conditions, variables, delays, loops, logging
- Animated channel names (rotating text on a timer)
- Placeholder system with filters and expressions
- Pre-built templates for common automation tasks

### Connection Journal
- Records web and TeamSpeak logins with timestamp, username, and IP
- Offline GeoIP enrichment (no external calls)
- Sortable columns and per-column filters
- One-click IP ban from the journal — on the web app, on the TeamSpeak server, or both

### Server Widgets
- Embeddable server status banner for websites and forums
- Token-based public access (no authentication required)
- Available as live page, SVG, or PNG image
- Dark and light themes
- Configurable: show/hide channel tree and client list

### Security
- AES-256-GCM encryption for stored credentials (API keys, SSH passwords)
- Two-factor authentication (TOTP) with recovery codes; admin-enforceable per user
- Configurable password policy and forced password change at next logon
- SSRF protection on all outbound HTTP requests, FFmpeg URLs, and webhook redirects
- Rate limiting on authentication endpoints
- JWT access + refresh token rotation with reuse detection
- SAML SSO with signed-assertion validation, audience binding, replay protection, and one-time login codes
- Role-based access control (admin / viewer)
- Per-server access control for multi-tenant setups
- Discord command access restricted by role
- WebQuery command whitelist in bot flows (blocks destructive commands)
- Authenticated WebSocket connections

### Settings & Administration
- User management with MFA enforcement and forced password change
- Discord, Spotify, and YouTube integration settings
- SSO / SAML identity-provider configuration: IdP SSO URL & signing certificate, attribute and role mapping, auto-provisioning toggle and default role (the SP metadata and ACS URLs to configure on the IdP side are shown in the tab)
- Music command settings: restrict commands by TeamSpeak server group and toggle the now-playing notification
- yt-dlp cookie file management for accessing age-restricted or member-only YouTube content (upload a file or paste directly in the UI)
- Connection journal and IP ban management
- Admin-only settings panel

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Backend    │────▶│  TS Server      │
│  React SPA   │     │  Express API │     │  WebQuery HTTP  │
│  nginx :8080 │     │  Node :3001  │     │  SSH (events)   │
└──────────────┘     └──────┬───────┘     └─────────────────┘
                            │
                     ┌──────┴───────┐
                     │   SQLite     │
                     │   (Prisma)   │
                     └──────────────┘
                            │
                     ┌──────┴───────┐
                     │   Sidecar    │
                     │  Go/Pion     │
                     │  WebRTC :9800│
                     └──────────────┘

Public:  /widget/:token  ──▶  SVG / PNG / JSON (no auth)
```

**Four packages** in a pnpm monorepo:

| Package | Description |
|---------|-------------|
| `@ts6/common` | Shared types, constants, utilities |
| `@ts6/backend` | Express API, WebQuery client, bot engine, voice bots, Discord bridge, widgets |
| `@ts6/frontend` | React SPA with Vite, TailwindCSS, shadcn/ui |
| `sidecar` | Go WebRTC media relay (Pion) for video streaming |

The backend proxies all TeamSpeak API calls. The frontend never has direct access to API keys or server credentials.

## Tech Stack

**Frontend:** React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query + Table, React Flow, Recharts, Zustand, react-i18next

**Backend:** Node.js, Express, Prisma (SQLite), JWT authentication, TOTP MFA, WebQuery HTTP client, SSH event listener, discord.js

**Voice/Audio:** Custom TS3 voice protocol client (UDP), Opus encoding, FFmpeg, yt-dlp

**Video Streaming:** Go sidecar with Pion WebRTC v4, RTCP Sender Reports for A/V sync

## Quick Start (Docker)

Building from source is the default in this fork — `docker-compose.yml`
builds the three images locally. To run the upstream Docker Hub images
instead, use [`docker-compose.hub.yml`](docker-compose.hub.yml) (note: those
images do not contain this fork's hardening and fixes).

1. Clone the repository
2. Create a `.env` file at the repository root:

```env
JWT_SECRET=your-random-secret-at-least-32-characters
ENCRYPTION_KEY=another-random-secret-for-credential-encryption
SIDECAR_TOKEN=a-third-random-secret-for-the-media-sidecar
```

Generate secure values:

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "SIDECAR_TOKEN=$(openssl rand -base64 32)" >> .env
```

3. Build and start the stack:

```bash
docker compose up -d --build
```

4. Open `http://localhost:3000/setup` and create your admin account
5. Log in, then add your TeamSpeak server connection under **Settings → Connections** (host, WebQuery port, API key)

> `JWT_SECRET` is **required** — the backend will refuse to start in production without it.
> `ENCRYPTION_KEY` is **required in production** and must differ from `JWT_SECRET`. Values encrypted before this requirement (with the `JWT_SECRET` fallback) are still readable and get re-encrypted on next save.
> `SIDECAR_TOKEN` authenticates the backend against the media sidecar API. Without it the sidecar logs a warning and accepts unauthenticated requests (acceptable only on an isolated network).

### Running the upstream Docker Hub images

```bash
docker compose -f docker-compose.hub.yml up -d
```

The Hub images listen on different internal ports than the locally built
ones — never mix containers from both compose files in the same stack.

### Coolify / Reverse Proxy

Use [`docker-compose.coolify.yml`](docker-compose.coolify.yml) as a starting point. Key differences from the standard compose:

- No `ports` section — the reverse proxy handles routing
- Set the domain on the **frontend** service in Coolify (port 8080 — nginx runs unprivileged)
- If your TS server runs in a separate Docker network, add it as an external network on the backend service:

```yaml
services:
  backend:
    networks:
      - ts6-network
      - ts-server-net

networks:
  ts-server-net:
    external: true
    name: your-ts-server-network-id
```

## Development

Requires: Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm dev          # starts backend + frontend in parallel
```

Backend runs on `:3001`, frontend on `:5173` (Vite dev server).

### Database

Prisma with SQLite. On first run:

```bash
cd packages/backend
npx prisma migrate deploy
```

The Docker images handle migrations automatically on startup.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | — | **Required.** Secret for JWT signing. Must be set in production. |
| `ENCRYPTION_KEY` | — | **Required in production**, must differ from `JWT_SECRET`. Dedicated key for AES-256-GCM credential encryption. In development it falls back to `JWT_SECRET`. |
| `PORT` | `3001` | Backend port |
| `DATABASE_URL` | `file:./data/ts6webui.db` | SQLite database path |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `MUSIC_DIR` | `/data/music` | Directory for downloaded music files |
| `SIDECAR_URL` | — | Optional. Full URL of the WebRTC sidecar service (e.g. `http://ts6-sidecar:9800`). Set in Docker when sidecar runs as a separate container. |
| `SIDECAR_TOKEN` | — | Shared secret between backend and sidecar. The sidecar rejects API calls without `Authorization: Bearer <token>` when set. |
| `SIDECAR_LISTEN_ADDR` | `127.0.0.1` | Interface the sidecar API binds to (`0.0.0.0` inside Docker, set by the image). Never publish port 9800. |
| `YT_COOKIE_FILE` | — | Optional. Path to a Netscape-format cookies.txt file for yt-dlp. Can also be managed via **Settings → YouTube** in the UI. |

## Environment Variables Sidecar(VideoStreaming)

| Variable | Default | Description |
|----------|---------|-------------|
| `VIDEO_QUEUE_SIZE` | `2048` | Size of the video RTP queue |
| `AUDIO_QUEUE_SIZE` | `4096` | Size of the audio RTP queue |
| `SYNC_PLAYOUT_BUFFER_MS` | `4` | Small playout buffer used by the adaptive pacing logic |
| `SYNC_VIDEO_BIAS_MS` | `4` | Optional extra holdback for video to fine-tune sync |
| `AUDIO_DELAY_MS` | `0` | Legacy / manual audio delay option With the current pacing logic this is typically expected to stay at 0 |
| `SIDECAR_DEBUG_LOGS` | `1` | Enables verbose debug logging for high-frequency runtime details |
| `VIDEO_READ_RTP_BUFFER` | `4194304` | UDP OS-socketbuffer for video port |
| `AUDIO_READ_RTP_BUFFER` | `1048576` | UDP OS-socketbuffer for audio port |
| `VIDEO_BUFSIZE` | `1M` | FFmpeg Video Buffer |

## Music Bot Text Commands

When a music bot is connected to a channel, users in that channel can control it via chat:

| Command | Description |
|---------|-------------|
| `!radio` | List available radio stations |
| `!radio <id>` | Play a radio station |
| `!play <url>` | Play from YouTube URL |
| `!play` | Resume paused playback |
| `!spotify <url>` | Play from a Spotify track/album/playlist link |
| `!queue <url>` / `!add <url>` | Add a track to the queue |
| `!stop` | Stop playback |
| `!pause` | Toggle pause/resume |
| `!skip` / `!next` | Next track in queue |
| `!prev` | Previous track |
| `!vol` | Show current volume |
| `!vol <0-100>` | Set volume |
| `!np` / `!nowplaying` | Show current track |
| `!info` | Current track with playback progress |
| `!help` / `!aide` | List available commands |
| `!channels` | List channels with their IDs |
| `!move <user> <channel>` | Move a user to a channel (admin) |
| `!moveall <channel>` | Move everyone to a channel (admin) |
| `!notif` | Toggle the now-playing notification (admin) |

`!move`, `!moveall`, and `!notif` are admin commands; access to music and admin commands can be restricted to specific TeamSpeak server groups under **Settings → Music Commands**.

## SSO / SAML Configuration

Optional SP-initiated SAML 2.0 single sign-on that runs **alongside** local login. Configure it under **Settings → SSO / SAML** (admin only). SSO only becomes active once **Enable SSO** is on **and** both the **IdP SSO URL** and **IdP signing certificate** are filled in — until then the "Sign in via SSO" button stays hidden and the SAML endpoints are inert.

**Give these to your identity provider (shown read-only in the tab):**

| Value | What it is | How it is built |
|-------|------------|-----------------|
| SP metadata URL | The service-provider EntityID / audience the IdP must target | `<FRONTEND_URL>/api/auth/saml/metadata` |
| ACS URL | Assertion Consumer Service — where the IdP POSTs the SAML response | `<FRONTEND_URL>/api/auth/saml/acs` |

`<FRONTEND_URL>` is the `FRONTEND_URL` environment variable (your public app origin).

**Fields:**

| Field | Description | Default | Required | Admissible values |
|-------|-------------|---------|----------|-------------------|
| Enable SSO (SAML) | Master switch. When off, SSO is hidden and all SAML endpoints return 404 | `off` | — | on / off |
| IdP Entity ID | The identity provider's issuer / EntityID. Informational for reference; the assertion is trusted via the certificate + audience binding | empty | no | any string (usually a URL/URN) |
| IdP SSO URL | The IdP's SAML **redirect** SSO endpoint where the login request (AuthnRequest) is sent | empty | **yes** (to enable) | an `https://` URL |
| IdP signing certificate | The IdP's X.509 **public** signing certificate used to verify the assertion signature. Write-only: stored encrypted, shown only as set/not-set | empty | **yes** (to enable) | PEM (`-----BEGIN CERTIFICATE-----…`) or bare base64 body (auto-wrapped) |
| Automatically provision accounts | Create a local account on first successful SSO login (JIT). When off, a SAML login for an unknown account is rejected | `on` | no | on / off |
| Default role for SSO accounts | Role assigned when no admin mapping matches (see role attribute below) | `viewer` | no | `viewer` or `admin` |
| Attribute: username | Assertion attribute mapped to the account username. If missing, falls back to the email local-part, then the NameID | Authentik username claim (`http://schemas.goauthentik.io/2021/02/saml/username`) | no | any attribute name your IdP sends |
| Attribute: email | Assertion attribute mapped to the email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | no | any attribute name |
| Attribute: display name | Assertion attribute mapped to the display name (falls back to the username) | Authentik displayname claim (`http://schemas.goauthentik.io/2021/02/saml/displayname`) | no | any attribute name |
| Attribute: role / group | Assertion attribute (often `groups`) whose values are checked for the admin mapping. Leave empty to give every SSO user the default role | empty | no | any attribute name |
| Value granting the admin role | If this exact value appears in the role/group attribute, the account becomes `admin`; otherwise it gets the default role | empty | no | the exact group/role string from your IdP (e.g. `ts6-admins`) |

**Behaviour notes:**

- **Identity key:** accounts are matched on the SAML **NameID** — configure a **persistent** NameID format on the IdP. A *transient* NameID changes every login and would create a new account each time.
- **Role sync:** the role is **re-evaluated on every login** (the IdP is authoritative). A manual promotion made inside the app is overwritten at the next SSO login.
- **MFA:** the app's MFA gate still applies after a valid assertion (if the account has MFA enabled). SSO accounts have **no local password** and cannot use the local password / change-password flows.
- **Security posture (v1):** assertion signature is **required**, the audience must equal the SP metadata URL, and `InResponseTo` replay validation is enforced. The SP does **not** sign its AuthnRequests. Importing IdP metadata by URL/XML is not wired yet — enter the SSO URL and certificate manually.

**Authentik quick mapping:** *IdP SSO URL* = the provider's **SSO URL (Redirect)**; *IdP signing certificate* = the provider's **Signing Certificate**; *IdP Entity ID* = the provider's **Issuer**. For admin mapping, expose a groups attribute (Property Mapping) and set **Value granting the admin role** to your admin group's name.

## Requirements

- TeamSpeak server with **WebQuery HTTP** enabled (not raw/telnet)
- WebQuery API key (generated via `apikeyadd` or server admin tools)
- SSH access to the TS server (only needed for bot flow event triggers)
- `yt-dlp` and `ffmpeg` installed on the backend (included in the Docker image)

## Troubleshooting

### Lost access to the TeamSpeak server after an update

If TS6 Manager suddenly cannot reach your TeamSpeak server — invalid API key, SSH login refused, timeouts, flood bans — the server update most likely expired the API key, regenerated the `serveradmin` password, or reset the query configuration. Follow the step-by-step recovery guide: **[Recovering access to your TeamSpeak server](docs/recover-server-access.md)**.

## License

MIT
