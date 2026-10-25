# Recovering access to your TeamSpeak server (WebQuery / SSH)

**English** · [Français](recover-server-access.fr.md)

TS6 Manager talks to your TeamSpeak server over two channels, both configured
under **Settings → Connections**:

| Channel | Used for | Credential |
|---------|----------|------------|
| WebQuery (HTTP, default port `10080`) | every API call: dashboard, channels, clients, logs… | API key (`x-api-key`) |
| SSH query (default port `10022`) | live server events (bot flow event triggers) | query username + password (usually `serveradmin`) |

After a TeamSpeak server **update or container re-creation** it is common to
lose one or both of these, typically because:

1. **The API key expired** — `apikeyadd` creates keys with a default lifetime
   of **14 days** unless you passed `lifetime=0`.
2. **The server's data volume was re-created** — a fresh `/var/tsserver`
   volume means a brand-new database: all API keys are gone and the
   `serveradmin` password was regenerated.
3. **The query flood protection banned the manager's IP** — reconnection
   attempts after the update counted as flooding (WebQuery error id `524`).
4. **WebQuery or SSH query is no longer enabled** — the new container was
   started without the `TSSERVER_QUERY_*` environment flags.

Work through the steps below in order. The commands assume a TeamSpeak 6
server running in Docker as container `teamspeak-server`; adapt host, ports
and container name to your setup.

## Step 0 — Identify what is broken

Test WebQuery with the API key currently configured in TS6 Manager:

```bash
curl -s -H "x-api-key: YOUR_CURRENT_KEY" "http://TS_HOST:10080/1/version"
```

| Result | Meaning | Go to |
|--------|---------|-------|
| `"code": 0` with version info | The API key is fine — the problem is SSH or the flood ban | Step 3 / Step 4 |
| An error mentioning the api key / permissions | Key expired, deleted, or the database was reset | Step 1 |
| Connection refused / timeout | WebQuery disabled, wrong port, or firewall | Step 5 |
| Connection resets after a few tries, or error id `524` | Flood protection ban | Step 4 |

Then test SSH query (only needed if you use bot flow event triggers):

```bash
ssh -p 10022 serveradmin@TS_HOST
# then type the query admin password
```

`Permission denied` means the password is wrong (or was regenerated) → Step 1.

## Step 1 — Regain query admin access (`serveradmin`)

If you still know the `serveradmin` **query** password, skip to Step 2.

Otherwise, reset it with the official override. In the TeamSpeak server's
compose file (or `docker run` flags) add:

```yaml
services:
  teamspeak-server:
    environment:
      TSSERVER_QUERY_ADMIN_PASSWORD: "a-strong-password-of-your-choice"
```

then recreate the container:

```bash
docker compose up -d teamspeak-server
```

While this variable is set it **is** the `serveradmin` query password.
Keeping it permanently in the compose file is the simplest way to make sure a
future update can never lock you out again (see Prevention below).

> Tip: on a **first** start (fresh data volume) the server also prints initial
> credentials — privilege key, etc. — to the container logs:
> `docker logs teamspeak-server 2>&1 | grep -iE "token|password|apikey"`

## Step 2 — Create a new WebQuery API key

Connect through SSH query and create a key with the `manage` scope that never
expires:

```bash
ssh -p 10022 serveradmin@TS_HOST
apikeyadd scope=manage lifetime=0
quit
```

The response contains `apikey=...`. **Copy it now — it is shown only once.**

Notes:

- `lifetime=0` = never expires. Omitting it gives you a key that dies after
  **14 days** — the classic cause of "the manager stopped working two weeks
  after I set it up".
- If SSH query is disabled, enable it first on the TeamSpeak container with
  `TSSERVER_QUERY_SSH_ENABLED=1` (and `TSSERVER_QUERY_SSH_PORT` if you need a
  non-default port), then recreate the container.
- If you still have *another* valid `manage`-scope key, you can also rotate
  keys over WebQuery without SSH:
  `curl -H "x-api-key: OLD_KEY" "http://TS_HOST:10080/apikeyadd?scope=manage&lifetime=0"`

## Step 3 — Update the credentials in TS6 Manager

1. Log in to TS6 Manager, open **Settings → Connections**.
2. Edit your server entry:
   - **API key**: paste the new key from Step 2.
   - **SSH username / password**: `serveradmin` + the query admin password
     from Step 1 (only required for bot flow event triggers).
3. Save. The connection pool applies changes immediately — no backend
   restart is needed. The dashboard should populate within a few seconds.

## Step 4 — Lift a query flood-protection ban

If the credentials are correct but connections still drop (error id `524`,
"banned", or resets after a burst of requests), the manager's IP tripped the
TeamSpeak query flood protection. Exempt it permanently:

1. Create an allow-list file inside the TeamSpeak data volume, one IP or CIDR
   per line. If the backend runs in Docker, the TeamSpeak server sees it as
   the **Docker gateway IP**, not your LAN IP — allow the Docker range:

   ```
   # /var/tsserver/query_ip_allowlist.txt
   127.0.0.1
   172.16.0.0/12
   ```

2. Point the server at it and restart:

   ```yaml
   services:
     teamspeak-server:
       environment:
         TSSERVER_QUERY_ALLOW_LIST: "/var/tsserver/query_ip_allowlist.txt"
   ```

   ```bash
   docker compose up -d teamspeak-server
   ```

## Step 5 — Make sure the query interfaces are enabled

A re-created container only has the interfaces you asked for. Check the
TeamSpeak server's environment:

| Variable | Purpose |
|----------|---------|
| `TSSERVER_QUERY_HTTP_ENABLED=1` | WebQuery over HTTP (port `TSSERVER_QUERY_HTTP_PORT`, default `10080`) |
| `TSSERVER_QUERY_HTTPS_ENABLED=1` | WebQuery over HTTPS (default `10443`; enable **Use HTTPS** on the connection in TS6 Manager) |
| `TSSERVER_QUERY_SSH_ENABLED=1` | SSH query (default `10022`) — needed for event triggers |

After changing any of them: `docker compose up -d teamspeak-server`, then
re-run Step 0 to confirm.

## Prevention checklist

- Create API keys with **`lifetime=0`** (or calendar a rotation before expiry).
- Keep `TSSERVER_QUERY_ADMIN_PASSWORD` set in the TeamSpeak compose file so
  the `serveradmin` password survives every update.
- Persist `/var/tsserver` in a **named volume** and never remove it during
  updates (`docker compose pull && docker compose up -d` keeps it; deleting
  the volume wipes keys, passwords, and the whole server database).
- Keep the query allow list (Step 4) in the data volume so it survives
  container re-creation.
- The `rejecting myteamspeakid: revoke list out of date` lines sometimes seen
  after an update are **unrelated** to query/API access — they concern
  myTeamSpeak ID badge validation and usually resolve on their own once the
  server manages to download its revocation list.
