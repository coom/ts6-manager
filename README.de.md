#### DISCLAIMER: 
![AI Assisted](https://img.shields.io/badge/AI%20Assisted-Project-00ADD8?style=for-the-badge&logo=dependabot&logoColor=white)

# TS6 Manager

[English](README.md) · [Français](README.fr.md) · **Deutsch** · [Español](README.es.md) · [Italiano](README.it.md)

Webbasierte Verwaltungsoberfläche für TeamSpeak-Server. Verwalten Sie virtuelle Server, Kanäle, Clients, Berechtigungen, Musik-Bots, automatisierte Abläufe und einbettbare Server-Widgets – alles im Browser. Die Oberfläche ist auf **Englisch, Französisch, Deutsch, Spanisch und Italienisch** verfügbar.

## Was diese Version ändert

Eine robuste, auf Zuverlässigkeit ausgerichtete Weiterentwicklung von [clusterzx/ts6-manager](https://github.com/clusterzx/ts6-manager):

**Konten & Zugriff**
- Zwei-Faktor-Authentifizierung (TOTP) mit Einmal-Wiederherstellungscodes; Administratoren können MFA pro Benutzer erzwingen und beim nächsten Anmelden eine Passwortänderung verlangen
- Option „Vertrauenswürdiger Computer": Passwort **und** MFA auf einem gewählten Gerät für 30 Tage per widerrufbarem `httpOnly`-Cookie überspringen, mit einer Geräteliste, die vom Konto aus widerrufbar ist
- Konfigurierbares Passwortrichtlinien-System (Mindestlänge + Komplexität)
- **SSO via SAML** — optionales Single Sign-On zusätzlich zur lokalen Anmeldung, mit Just-in-Time-Kontoerstellung und Rollen, die von Ihrem Identity Provider zugeordnet werden

**Discord-Integration**
- Discord-Bridge: Slash-Befehle (`/play`, `/skip`, `/queue`, …), TeamSpeak-Verbindungs-/Trennbenachrichtigungen und Anwesenheitsmeldungen sowie ein Live-Serverstatistik-Panel
- AFK-Benachrichtigungen: Meldung an Discord, wenn ein Benutzer im überwachten Kanal AFK wird oder zurückkehrt
- Der Musik-Bot kann auch in einen Discord-Sprachkanal streamen
- Einschränkung, welche Discord-Rollen die Bot-Befehle ausführen dürfen

**Mehrsprachigkeit**
- Vollständige UI-Übersetzung in Englisch, Französisch, Deutsch, Spanisch und Italienisch, je Benutzer gespeichert

**Spotify & Journal**
- Spotify-Links werden für die Wiedergabe zu YouTube aufgelöst, konfigurierbar in der WebUI
- Verbindungsjournal für Web- und TeamSpeak-Anmeldungen mit Offline-GeoIP, sortierbaren/filterbaren Spalten und Einzel-Klick-IP-Sperren (Web und/oder TeamSpeak)

**Zuverlässigkeit**
- Selbstheilender Verbindungspool: Im UI hinzugefügte oder bearbeitete Serververbindungen funktionieren sofort – kein Backend-Neustart erforderlich
- WebQuery-Client baut seinen Transport neu auf, wenn der Keep-Alive-Socket still stirbt (Docker NAT, Server-Neustarts), mit einem Circuit Breaker, der den TS-Flood-Zähler nicht weiter belastet
- Dashboard-Antworten werden 5 Sekunden serverseitig gecacht: N offene Tabs kosten so viel wie einer
- Eine nicht entschlüsselbare Credential-Zeile bringt den Start nicht mehr zum Absturz

**Musik-Bots**
- Gestreamte Datei-Wiedergabe: erstes Audio nach ~200 ms, konstanter Speicherbedarf (zuvor wurde der gesamte Track in den RAM dekodiert – ~690 MB für einen 1-Stunden-Mix)
- Nativer Opus-Encoder (`@discordjs/opus`, ~5–10× weniger CPU) mit automatischem WASM-Fallback
- Robuste yt-dlp-Pipeline: harte Timeouts, Bereinigung veralteter Artefakte, deduplizierte parallele Downloads, vollständiges Fehler-Logging, niedrige CPU-Priorität, automatisches Update beim Container-Start
- „Laden & Abspielen" startet die Wiedergabe; Playlist-Songzahlen bleiben aktuell

**Sicherheit**
- Eingebauter sicherer Ausdrucksauswerter ersetzt das nicht mehr gewartete `expr-eval`
- Sidecar-API Bearer-Token-Authentifizierung, gehärtete Container, committete Binärdateien entfernt
- Abhängigkeiten aktualisiert, um alle Audit-Befunde zu beheben; ESLint + GitHub Actions CI

**Deployment**
- `docker compose up -d --build` baut standardmäßig aus dem Quellcode (`docker-compose.hub.yml` für die vorgelagerten Docker-Hub-Images)
- nginx/Client-Timeouts für lange YouTube-Downloads ausgelegt; stiller, sauberer Container-Start

Basiert auf der **WebQuery HTTP API** (dem ServerQuery-Ersatz in modernen TeamSpeak-Builds). Telnet wird nicht verwendet und nicht unterstützt.

![License](https://img.shields.io/badge/license-MIT-blue)

## Screenshots

### Dashboard
Live-Übersicht Ihres Servers: Online-Benutzer, Kanalanzahl, Laufzeit, Ping, Bandbreitengraph und Serverauslastung auf einen Blick.

![Dashboard](docs/dashboard.png)

### Musik-Bots
Betreiben Sie mehrere Musik-Bots pro Server. Jeder Bot hat seine eigene Warteschlange, Lautstärkeregelung und Wiedergabestatus. Unterstützt Radio-Streams, YouTube und eine lokale Musikbibliothek. Benutzer im Kanal des Bots können ihn per Textbefehlen steuern (`!radio`, `!play`, `!vol`, usw.).

![Music Bots](docs/musicbots.png)

### Bot-Flow-Engine
Visueller, knotenbasierter Editor zum Erstellen automatisierter Server-Workflows. Ziehen Sie Trigger, Bedingungen und Aktionen auf die Arbeitsfläche, verbinden Sie sie und aktivieren Sie den Ablauf. Unterstützt TS3-Ereignisse, Cron-Zeitpläne, Webhooks und Chat-Befehle als Trigger.

![Flow Editor](docs/flow-editor.png)

### Flow-Vorlagen
Starten Sie schnell mit vorgefertigten Flow-Vorlagen. Deckt häufige Anwendungsfälle ab: temporäre Kanalerstellung, AFK-Mover, Inaktivitäts-Kicker, Online-Zähler und Gruppenschutz. Ein Klick zum Importieren, dann nach Bedarf anpassen.

![Flow Templates](docs/flow-templates.png)

## Funktionen

### Authentifizierung & Konten
- Einrichtungsassistent für das erste Admin-Konto (keine Standard-Anmeldedaten)
- Zwei-Faktor-Authentifizierung (TOTP), kompatibel mit jeder Authenticator-App, mit Einmal-Wiederherstellungscodes
- Administratoren können MFA pro Benutzer erzwingen und eine Passwortänderung beim nächsten Anmelden verlangen
- Option „Vertrauenswürdiger Computer": ein widerrufbares 30-Tage-Cookie, das Passwort und MFA auf dem jeweiligen Gerät überspringt; vertrauenswürdige Geräte werden aufgelistet und sind vom Konto aus widerrufbar
- Konfigurierbares Passwortrichtlinien-System (Mindestlänge + Komplexität)
- Sprachauswahl der UI pro Benutzer (Englisch, Französisch, Deutsch, Spanisch, Italienisch)
- Optionales SSO via SAML 2.0 (SP-initiiert), angezeigt als Schaltfläche „Über SSO anmelden" neben der lokalen Anmeldung
- Just-in-Time-Kontoerstellung (umschaltbar) mit der Rolle, die aus einer SAML-Gruppe/einem SAML-Attribut zugeordnet und bei jeder Anmeldung neu ausgewertet wird, sowie einer konfigurierbaren Standardrolle
- Die MFA-Prüfung gilt weiterhin nach einer SAML-Anmeldung; SSO-Konten haben kein lokales Passwort und können die lokalen Passwort-Abläufe nicht nutzen

### Serververwaltung
- Dashboard mit Live-Serverstatistiken, Bandbreitengraph und Kapazitätsübersicht
- Virtuelle Serverliste mit Start-/Stopp-Steuerung
- Kanalbaum mit Drag-and-Drop-Sortierung
- Client-Liste mit Kick-, Ban-, Verschiebe- und Poke-Aktionen
- Verwaltung von Server- und Kanalgruppen
- Berechtigungseditor (Server-, Kanal-, Client- und Gruppenebene)
- Verwaltung der Banliste
- Token-/Privilegienschlüsselverwaltung
- Beschwerde-Anzeige
- Offline-Nachrichtensystem
- Server-Protokollbetrachter mit Filterung
- Kanaldatei-Browser mit Upload/Download
- Instanz-weite Einstellungen

### Musik-Bots
- Mehrere Bots pro Server, jeder mit eigenständiger Warteschlange und Wiedergabe
- Radio-Station-Streaming mit ICY-Metadaten und Live-Titelupdates
- YouTube-Wiedergabe via yt-dlp (Suche, Download, Warteschlange)
- Spotify-Link-Unterstützung (Track-/Album-/Playlist-Metadaten zu YouTube aufgelöst)
- Musikbibliotheksverwaltung (Upload, Organisation, Playlists)
- Lautstärkeregelung, Pause, Überspringen, Zurück, Zufallswiedergabe, Wiederholen
- Stereo-Audio-Unterstützung mit stabilem 20-ms-Takt
- Automatische Wiederverbindung mit exponentiellem Backoff bei Verbindungsabbruch
- Textbefehle im Kanal für freihändige Steuerung, einschließlich Kanalauflistung und Verschiebe-Befehlen
- Musikbefehle und Admin-Befehle auf bestimmte TeamSpeak-Servergruppen beschränken
- Optionale „Jetzt läuft"-Benachrichtigung im TeamSpeak-Kanal des Bots
- Verlaufsverfolgung von Musikanfragen

### Discord-Integration
- Discord-Bridge-Bot mit Slash-Befehlen: `/play`, `/stop`, `/pause`, `/skip`, `/next`, `/prev`, `/queue`, `/volume`, `/nowplaying`, `/stats`, `/join`, `/leave`
- Befehle auf ausgewählte Discord-Rollen beschränken (Admins/Owner immer erlaubt; leer = offen für alle)
- TeamSpeak-Verbindungs-/Trennbenachrichtigungen und kanalspezifische Anwesenheitsmeldungen, mit Embed- oder Nur-Text-Stil und optionalem automatischen Löschen
- AFK-Benachrichtigungen: eine anpassbare Nachricht senden, wenn ein Benutzer im überwachten Kanal AFK wird oder zurückkehrt (nutzt denselben Embed-/Nur-Text-Stil und das automatische Löschen)
- Live-Serverstatistik-Panel, das in einem Discord-Kanal aktuell gehalten wird
- Der Musik-Bot kann sein Audio in einen Discord-Sprachkanal streamen
- Discord-Nachrichten-Trigger und Nachricht-senden-Aktion in der Bot-Flow-Engine verfügbar

### Video-Streaming
- Live-Video-Streaming von YouTube, Twitch oder direkten URLs in TeamSpeak-Kanäle
- WebRTC-basiert mit Go-Sidecar-Relay (Pion) für latenzarme Übertragung
- Qualitätsstufen (480p, 720p, 1080p)
- Browser-interne Vorschau mit WebRTC-Wiedergabe
- A/V-Synchronisation via RTCP Sender Reports
- Läuft als Docker-Sidecar-Container neben dem Backend

### Bot-Flow-Engine
- Visueller Flow-Editor mit Drag-and-Drop-Knotenarbeitsfläche
- Trigger: TS3-Ereignisse, Cron-Zeitpläne, Webhooks (mit Pflichtgeheimnissen), Chat-Befehle (global oder kanalspezifisch), Discord-Nachrichten
- Aktionen: Kick, Ban, Verschieben, Nachricht, Poke, Kanal erstellen/bearbeiten/löschen, HTTP-Anfragen, WebQuery-Befehle, Discord-Nachrichten
- Bedingungen, Variablen, Verzögerungen, Schleifen, Protokollierung
- Animierte Kanalnamen (rotierender Text auf einem Timer)
- Platzhaltersystem mit Filtern und Ausdrücken
- Vorgefertigte Vorlagen für häufige Automatisierungsaufgaben

### Verbindungsjournal
- Erfasst Web- und TeamSpeak-Anmeldungen mit Zeitstempel, Benutzername und IP
- Offline-GeoIP-Anreicherung (keine externen Aufrufe)
- Sortierbare Spalten und spaltenweise Filter
- Einzel-Klick-IP-Sperre aus dem Journal – für die Web-App, den TeamSpeak-Server oder beides

### Server-Widgets
- Einbettbares Server-Status-Banner für Websites und Foren
- Token-basierter öffentlicher Zugriff (keine Authentifizierung erforderlich)
- Verfügbar als Live-Seite, SVG oder PNG-Bild
- Dunkles und helles Design
- Konfigurierbar: Kanalbaum und Client-Liste ein-/ausblenden

### Sicherheit
- AES-256-GCM-Verschlüsselung für gespeicherte Anmeldedaten (API-Schlüssel, SSH-Passwörter)
- Zwei-Faktor-Authentifizierung (TOTP) mit Wiederherstellungscodes; vom Administrator pro Benutzer erzwingbar
- Konfigurierbares Passwortrichtlinien-System und erzwungene Passwortänderung beim nächsten Anmelden
- SSRF-Schutz für alle ausgehenden HTTP-Anfragen, FFmpeg-URLs und Webhook-Weiterleitungen
- Rate-Limiting auf Authentifizierungsendpunkten
- JWT-Zugriffstoken + Refresh-Token-Rotation mit Wiederverwendungserkennung
- SAML-SSO mit Validierung signierter Assertions, Audience-Bindung, Replay-Schutz und Einmal-Anmeldecodes
- Rollenbasierte Zugriffskontrolle (Admin / Betrachter)
- Serverspezifische Zugriffskontrolle für Mehrmandanten-Setups
- Discord-Befehlszugriff per Rolle eingeschränkt
- WebQuery-Befehlsallowlist in Bot-Flows (blockiert destruktive Befehle)
- Authentifizierte WebSocket-Verbindungen

### Einstellungen & Administration
- Benutzerverwaltung mit MFA-Erzwingung und erzwungener Passwortänderung
- Discord-, Spotify- und YouTube-Integrationseinstellungen
- SSO/SAML-Identity-Provider-Konfiguration: IdP-SSO-URL & Signaturzertifikat, Attribut- und Rollenzuordnung, Umschalter für die automatische Kontoerstellung und Standardrolle (die auf Seiten des IdP zu konfigurierenden SP-Metadaten und ACS-URLs werden im Tab angezeigt)
- Musikbefehls-Einstellungen: Befehle nach TeamSpeak-Servergruppe einschränken und die „Jetzt läuft"-Benachrichtigung umschalten
- yt-dlp-Cookie-Datei-Verwaltung für den Zugriff auf altersbeschränkte oder mitgliedspflichtige YouTube-Inhalte (Datei hochladen oder direkt in der UI einfügen)
- Verbindungsjournal und IP-Sperrverwaltung
- Nur für Administratoren zugängliches Einstellungspanel

## Architektur

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

**Vier Pakete** in einem pnpm-Monorepo:

| Paket | Beschreibung |
|-------|--------------|
| `@ts6/common` | Gemeinsam genutzte Typen, Konstanten, Hilfsfunktionen |
| `@ts6/backend` | Express API, WebQuery-Client, Bot-Engine, Voice-Bots, Discord-Bridge, Widgets |
| `@ts6/frontend` | React SPA mit Vite, TailwindCSS, shadcn/ui |
| `sidecar` | Go WebRTC Media-Relay (Pion) für Video-Streaming |

Das Backend vermittelt alle TeamSpeak-API-Aufrufe. Das Frontend hat niemals direkten Zugriff auf API-Schlüssel oder Server-Anmeldedaten.

## Tech Stack

**Frontend:** React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query + Table, React Flow, Recharts, Zustand, react-i18next

**Backend:** Node.js, Express, Prisma (SQLite), JWT-Authentifizierung, TOTP MFA, WebQuery HTTP-Client, SSH-Ereignis-Listener, discord.js

**Voice/Audio:** Benutzerdefinierter TS3-Voice-Protokoll-Client (UDP), Opus-Kodierung, FFmpeg, yt-dlp

**Video-Streaming:** Go-Sidecar mit Pion WebRTC v4, RTCP Sender Reports für A/V-Sync

## Schnellstart (Docker)

Das Bauen aus dem Quellcode ist in diesem Fork die Standardeinstellung – `docker-compose.yml`
baut die drei Images lokal. Um stattdessen die vorgelagerten Docker-Hub-Images zu verwenden,
nutzen Sie [`docker-compose.hub.yml`](docker-compose.hub.yml) (Hinweis: diese Images enthalten
nicht die Härtungen und Bugfixes dieses Forks).

1. Repository klonen
2. Eine `.env`-Datei im Repository-Stammverzeichnis erstellen:

```env
JWT_SECRET=your-random-secret-at-least-32-characters
ENCRYPTION_KEY=another-random-secret-for-credential-encryption
SIDECAR_TOKEN=a-third-random-secret-for-the-media-sidecar
```

Sichere Werte generieren:

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "SIDECAR_TOKEN=$(openssl rand -base64 32)" >> .env
```

3. Stack bauen und starten:

```bash
docker compose up -d --build
```

4. `http://localhost:3000/setup` öffnen und das Admin-Konto erstellen
5. Anmelden, dann die TeamSpeak-Serververbindung unter **Einstellungen → Verbindungen** hinzufügen (Host, WebQuery-Port, API-Schlüssel)

> `JWT_SECRET` ist **erforderlich** – das Backend verweigert im Produktionsbetrieb den Start ohne diesen Wert.
> `ENCRYPTION_KEY` ist **im Produktionsbetrieb erforderlich** und muss sich von `JWT_SECRET` unterscheiden. Vor dieser Anforderung verschlüsselte Werte (mit dem `JWT_SECRET`-Fallback) sind weiterhin lesbar und werden beim nächsten Speichern neu verschlüsselt.
> `SIDECAR_TOKEN` authentifiziert das Backend gegenüber der Media-Sidecar-API. Ohne diesen Wert protokolliert der Sidecar eine Warnung und akzeptiert nicht authentifizierte Anfragen (nur in einem isolierten Netzwerk akzeptabel).

### Vorgelagerte Docker-Hub-Images verwenden

```bash
docker compose -f docker-compose.hub.yml up -d
```

Die Hub-Images lauschen auf anderen internen Ports als die lokal gebauten –
mischen Sie niemals Container aus beiden Compose-Dateien im selben Stack.

### Coolify / Reverse Proxy

Verwenden Sie [`docker-compose.coolify.yml`](docker-compose.coolify.yml) als Ausgangspunkt. Wesentliche Unterschiede zur Standard-Compose-Konfiguration:

- Kein `ports`-Abschnitt – der Reverse Proxy übernimmt das Routing
- Legen Sie die Domain am **Frontend**-Dienst in Coolify fest (Port 8080 – nginx läuft ohne Root-Rechte)
- Wenn Ihr TS-Server in einem separaten Docker-Netzwerk läuft, fügen Sie es als externes Netzwerk am Backend-Dienst hinzu:

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

## Entwicklung

Voraussetzungen: Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm dev          # starts backend + frontend in parallel
```

Backend läuft auf `:3001`, Frontend auf `:5173` (Vite Dev-Server).

### Datenbank

Prisma mit SQLite. Beim ersten Start:

```bash
cd packages/backend
npx prisma migrate deploy
```

Die Docker-Images führen Migrationen beim Start automatisch durch.

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `JWT_SECRET` | — | **Erforderlich.** Geheimnis für JWT-Signierung. Muss im Produktionsbetrieb gesetzt sein. |
| `ENCRYPTION_KEY` | — | **Im Produktionsbetrieb erforderlich**, muss sich von `JWT_SECRET` unterscheiden. Dedizierter Schlüssel für AES-256-GCM-Credential-Verschlüsselung. In der Entwicklung fällt es auf `JWT_SECRET` zurück. |
| `PORT` | `3001` | Backend-Port |
| `DATABASE_URL` | `file:./data/ts6webui.db` | SQLite-Datenbankpfad |
| `JWT_ACCESS_EXPIRY` | `15m` | Lebensdauer des Zugriffstokens |
| `JWT_REFRESH_EXPIRY` | `7d` | Lebensdauer des Refresh-Tokens |
| `FRONTEND_URL` | `http://localhost:3000` | CORS-Ursprung |
| `MUSIC_DIR` | `/data/music` | Verzeichnis für heruntergeladene Musikdateien |
| `SIDECAR_URL` | — | Optional. Vollständige URL des WebRTC-Sidecar-Dienstes (z. B. `http://ts6-sidecar:9800`). In Docker setzen, wenn der Sidecar als separater Container läuft. |
| `SIDECAR_TOKEN` | — | Gemeinsames Geheimnis zwischen Backend und Sidecar. Der Sidecar lehnt API-Aufrufe ohne `Authorization: Bearer <token>` ab, wenn gesetzt. |
| `SIDECAR_LISTEN_ADDR` | `127.0.0.1` | Interface, an das die Sidecar-API gebunden wird (`0.0.0.0` innerhalb von Docker, vom Image gesetzt). Port 9800 niemals veröffentlichen. |
| `YT_COOKIE_FILE` | — | Optional. Pfad zu einer Netscape-Format-cookies.txt-Datei für yt-dlp. Kann auch über **Einstellungen → YouTube** in der UI verwaltet werden. |

## Umgebungsvariablen Sidecar (Video-Streaming)

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `VIDEO_QUEUE_SIZE` | `2048` | Größe der Video-RTP-Warteschlange |
| `AUDIO_QUEUE_SIZE` | `4096` | Größe der Audio-RTP-Warteschlange |
| `SYNC_PLAYOUT_BUFFER_MS` | `4` | Kleiner Playout-Puffer für die adaptive Taktlogik |
| `SYNC_VIDEO_BIAS_MS` | `4` | Optionaler zusätzlicher Holdback für Video zur Feinabstimmung der Synchronisation |
| `AUDIO_DELAY_MS` | `0` | Legacy-/manueller Audio-Delay-Option. Mit der aktuellen Taktlogik wird typischerweise 0 erwartet |
| `SIDECAR_DEBUG_LOGS` | `1` | Aktiviert ausführliches Debug-Logging für hochfrequente Laufzeitdetails |
| `VIDEO_READ_RTP_BUFFER` | `4194304` | UDP-OS-Socketpuffer für den Video-Port |
| `AUDIO_READ_RTP_BUFFER` | `1048576` | UDP-OS-Socketpuffer für den Audio-Port |
| `VIDEO_BUFSIZE` | `1M` | FFmpeg Video-Puffer |

## Musik-Bot-Textbefehle

Wenn ein Musik-Bot mit einem Kanal verbunden ist, können Benutzer in diesem Kanal ihn per Chat steuern:

| Befehl | Beschreibung |
|--------|--------------|
| `!radio` | Verfügbare Radiosender auflisten |
| `!radio <id>` | Einen Radiosender abspielen |
| `!play <url>` | Von YouTube-URL abspielen |
| `!play` | Pausierte Wiedergabe fortsetzen |
| `!spotify <url>` | Von einem Spotify-Track-/Album-/Playlist-Link abspielen |
| `!queue <url>` / `!add <url>` | Einen Titel zur Warteschlange hinzufügen |
| `!stop` | Wiedergabe stoppen |
| `!pause` | Pause ein-/ausschalten |
| `!skip` / `!next` | Nächster Titel in der Warteschlange |
| `!prev` | Vorheriger Titel |
| `!vol` | Aktuelle Lautstärke anzeigen |
| `!vol <0-100>` | Lautstärke setzen |
| `!np` / `!nowplaying` | Aktuellen Titel anzeigen |
| `!info` | Aktueller Titel mit Wiedergabefortschritt |
| `!help` / `!aide` | Verfügbare Befehle auflisten |
| `!channels` | Kanäle mit ihren IDs auflisten |
| `!move <user> <channel>` | Einen Benutzer in einen Kanal verschieben (Admin) |
| `!moveall <channel>` | Alle in einen Kanal verschieben (Admin) |
| `!notif` | Die „Jetzt läuft"-Benachrichtigung umschalten (Admin) |

`!move`, `!moveall` und `!notif` sind Admin-Befehle; der Zugriff auf Musik- und Admin-Befehle kann unter **Einstellungen → Musikbefehle** auf bestimmte TeamSpeak-Servergruppen beschränkt werden.

## SSO / SAML-Konfiguration

Optionales SP-initiiertes SAML-2.0-Single-Sign-On, das **zusätzlich** zum lokalen Login läuft. Konfigurieren Sie es unter **Einstellungen → SSO / SAML** (nur Admin). SSO wird erst aktiv, wenn **SSO aktivieren** eingeschaltet ist **und** sowohl die **IdP-SSO-URL** als auch das **IdP-Signaturzertifikat** ausgefüllt sind – bis dahin bleibt die Schaltfläche „Über SSO anmelden" ausgeblendet und die SAML-Endpunkte sind inaktiv.

**Diese Angaben an Ihren Identity Provider weitergeben (im Tab schreibgeschützt angezeigt):**

| Wert | Was es ist | Wie es gebildet wird |
|-------|------------|-----------------|
| SP-Metadaten-URL | Die EntityID / Audience des Service Providers, auf die der IdP zielen muss | `<FRONTEND_URL>/api/auth/saml/metadata` |
| ACS-URL | Assertion Consumer Service – wohin der IdP die SAML-Antwort per POST sendet | `<FRONTEND_URL>/api/auth/saml/acs` |

`<FRONTEND_URL>` ist die Umgebungsvariable `FRONTEND_URL` (der öffentliche Ursprung Ihrer App).

**Felder:**

| Feld | Beschreibung | Standard | Erforderlich | Zulässige Werte |
|-------|-------------|---------|----------|-------------------|
| SSO (SAML) aktivieren | Hauptschalter. Wenn aus, ist SSO ausgeblendet und alle SAML-Endpunkte liefern 404 | `aus` | — | ein / aus |
| IdP-Entity-ID | Der Issuer / die EntityID des Identity Providers. Dient nur zur Information; die Assertion wird über Zertifikat + Audience-Bindung vertraut | leer | nein | beliebige Zeichenkette (meist eine URL/URN) |
| IdP-SSO-URL | Der **Redirect**-SSO-Endpunkt des IdP, an den die Login-Anfrage (AuthnRequest) gesendet wird | leer | **ja** (zur Aktivierung) | eine `https://`-URL |
| IdP-Signaturzertifikat | Das **öffentliche** X.509-Signaturzertifikat des IdP zur Prüfung der Assertion-Signatur. Nur schreibend: wird verschlüsselt gespeichert, angezeigt nur als gesetzt/nicht gesetzt | leer | **ja** (zur Aktivierung) | PEM (`-----BEGIN CERTIFICATE-----…`) oder reiner Base64-Inhalt (wird automatisch umschlossen) |
| Konten automatisch anlegen | Beim ersten erfolgreichen SSO-Login ein lokales Konto anlegen (JIT). Wenn aus, wird ein SAML-Login für ein unbekanntes Konto abgelehnt | `ein` | nein | ein / aus |
| Standardrolle für SSO-Konten | Rolle, die vergeben wird, wenn kein Admin-Mapping zutrifft (siehe Rollen-Attribut unten) | `viewer` | nein | `viewer` oder `admin` |
| Attribut: Benutzername | Assertion-Attribut, das dem Kontonamen zugeordnet wird. Falls nicht vorhanden, wird auf den lokalen Teil der E-Mail-Adresse, dann auf die NameID zurückgegriffen | Authentik-Benutzername-Claim (`http://schemas.goauthentik.io/2021/02/saml/username`) | nein | beliebiger Attributname, den Ihr IdP sendet |
| Attribut: E-Mail | Assertion-Attribut, das der E-Mail-Adresse zugeordnet wird | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | nein | beliebiger Attributname |
| Attribut: Anzeigename | Assertion-Attribut, das dem Anzeigenamen zugeordnet wird (fällt zurück auf den Benutzernamen) | Authentik-Anzeigename-Claim (`http://schemas.goauthentik.io/2021/02/saml/displayname`) | nein | beliebiger Attributname |
| Attribut: Rolle / Gruppe | Assertion-Attribut (oft `groups`), dessen Werte für das Admin-Mapping geprüft werden. Leer lassen, um jedem SSO-Benutzer die Standardrolle zu geben | leer | nein | beliebiger Attributname |
| Wert, der die Admin-Rolle vergibt | Wenn genau dieser Wert im Rollen-/Gruppen-Attribut vorkommt, wird das Konto zu `admin`; andernfalls erhält es die Standardrolle | leer | nein | die exakte Gruppen-/Rollenzeichenkette Ihres IdP (z. B. `ts6-admins`) |

**Verhaltenshinweise:**

- **Identitätsschlüssel:** Konten werden anhand der SAML-**NameID** abgeglichen – konfigurieren Sie am IdP ein **persistentes** NameID-Format. Eine *transiente* NameID ändert sich bei jedem Login und würde jedes Mal ein neues Konto anlegen.
- **Rollen-Synchronisierung:** Die Rolle wird **bei jedem Login neu ausgewertet** (der IdP ist maßgeblich). Eine manuelle Beförderung innerhalb der App wird beim nächsten SSO-Login überschrieben.
- **MFA:** Die MFA-Sperre der App gilt auch nach einer gültigen Assertion weiterhin (falls für das Konto MFA aktiviert ist). SSO-Konten haben **kein lokales Passwort** und können die lokalen Passwort- / Passwort-ändern-Abläufe nicht nutzen.
- **Sicherheitsstatus (v1):** Die Assertion-Signatur ist **erforderlich**, die Audience muss der SP-Metadaten-URL entsprechen, und die `InResponseTo`-Replay-Prüfung wird durchgesetzt. Der SP signiert seine AuthnRequests **nicht**. Der Import von IdP-Metadaten per URL/XML ist noch nicht implementiert – geben Sie SSO-URL und Zertifikat manuell ein.

**Schnelles Authentik-Mapping:** *IdP-SSO-URL* = die **SSO URL (Redirect)** des Providers; *IdP-Signaturzertifikat* = das **Signing Certificate** des Providers; *IdP-Entity-ID* = der **Issuer** des Providers. Für das Admin-Mapping ein Gruppen-Attribut (Property Mapping) bereitstellen und **Wert, der die Admin-Rolle vergibt** auf den Namen Ihrer Admin-Gruppe setzen.

## Anforderungen

- TeamSpeak-Server mit aktiviertem **WebQuery HTTP** (kein Raw-/Telnet-Modus)
- WebQuery-API-Schlüssel (generiert via `apikeyadd` oder Server-Admin-Tools)
- SSH-Zugriff auf den TS-Server (nur für Bot-Flow-Ereignis-Trigger benötigt)
- `yt-dlp` und `ffmpeg` auf dem Backend installiert (im Docker-Image enthalten)

## Fehlerbehebung

### Zugriff auf den TeamSpeak-Server nach einem Update verloren

Wenn TS6 Manager Ihren TeamSpeak-Server plötzlich nicht mehr erreicht — ungültiger API-Schlüssel, abgelehnter SSH-Login, Timeouts, Flood-Sperren — hat das Server-Update vermutlich den API-Schlüssel ablaufen lassen, das `serveradmin`-Passwort neu generiert oder die Query-Konfiguration zurückgesetzt. Folgen Sie der Schritt-für-Schritt-Anleitung: **[Recovering access to your TeamSpeak server](docs/recover-server-access.md)** (auf Englisch).

## Lizenz

MIT
