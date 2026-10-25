#### DISCLAIMER: 
![AI Assisted](https://img.shields.io/badge/AI%20Assisted-Project-00ADD8?style=for-the-badge&logo=dependabot&logoColor=white)

# TS6 Manager

[English](README.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Italiano**

Interfaccia di gestione web per server TeamSpeak. Controlla server virtuali, canali, client, permessi, bot musicali, flussi di lavoro automatizzati e widget incorporabili per il server — tutto dal tuo browser. L'interfaccia è disponibile in **inglese, francese, tedesco, spagnolo e italiano**.

## Cosa cambia in questa versione

Evoluzione consolidata e orientata all'affidabilità di [clusterzx/ts6-manager](https://github.com/clusterzx/ts6-manager):

**Account e accesso**
- Autenticazione a due fattori (TOTP) con codici di recupero monouso; gli amministratori possono richiedere MFA per singolo utente e forzare il cambio password al prossimo accesso
- Opzione "Computer fidato": salta la password **e** MFA su un dispositivo scelto per 30 giorni tramite un cookie `httpOnly` revocabile, con un elenco di dispositivi revocabile dal tuo account
- Policy password configurabile (lunghezza minima e complessità)
- **SSO tramite SAML** — single sign-on opzionale accanto al login locale, con provisioning degli account just-in-time e ruoli mappati dal tuo identity provider

**Integrazione Discord**
- Bridge Discord: comandi slash (`/play`, `/skip`, `/queue`, …), notifiche di connessione/disconnessione TeamSpeak e presenza, e un pannello live delle statistiche del server
- Notifiche AFK: pubblica su Discord quando un utente diventa AFK o torna attivo nel canale osservato
- Il bot musicale può trasmettere in streaming anche in un canale vocale Discord
- Limita chi può eseguire i comandi del bot a un insieme scelto di ruoli Discord

**Multilingua**
- Traduzione completa dell'interfaccia in inglese, francese, tedesco, spagnolo e italiano, memorizzata per utente

**Spotify e diario**
- I link Spotify vengono risolti su YouTube per la riproduzione, configurabile tramite WebUI
- Diario delle connessioni di accessi web e TeamSpeak con GeoIP offline, colonne ordinabili/filtrabili e ban IP con un clic (web e/o TeamSpeak)

**Affidabilità**
- Pool di connessioni auto-riparante: le connessioni al server aggiunte o modificate nell'interfaccia funzionano immediatamente — nessun riavvio del backend, mai
- Il client WebQuery ricostruisce il trasporto quando il suo socket keep-alive muore silenziosamente (Docker NAT, riavvii del server), con un circuit breaker che smette di alimentare il contatore flood di TS
- Risposte della dashboard memorizzate in cache per 5 s lato server: N schede aperte hanno lo stesso costo di una sola
- Una riga di credenziali non decifrabile non causa più il crash all'avvio

**Bot musicali**
- Riproduzione di file in streaming: primo audio in ~200 ms, memoria costante (in precedenza l'intera traccia veniva decodificata in RAM — ~690 MB per un mix da 1 h)
- Encoder Opus nativo (`@discordjs/opus`, ~5-10× meno CPU) con fallback automatico su WASM
- Pipeline yt-dlp robusta: timeout rigidi, pulizia di artefatti obsoleti, download concorrenti deduplicati, log completi degli errori, priorità CPU bassa, aggiornamento automatico all'avvio del container
- "Carica e riproduci" avvia la riproduzione; il conteggio dei brani nelle playlist rimane aggiornato

**Sicurezza**
- Valutatore di espressioni sicuro integrato sostituisce il pacchetto non mantenuto `expr-eval`
- Autenticazione bearer token per le API del sidecar, container rafforzati, binari committati rimossi
- Dipendenze aggiornate per eliminare tutti i risultati di audit; ESLint + CI GitHub Actions

**Distribuzione**
- `docker compose up -d --build` compila dal sorgente per impostazione predefinita (`docker-compose.hub.yml` per le immagini upstream di Docker Hub)
- Timeout nginx/client dimensionati per download YouTube lunghi; avvio del container silenzioso e pulito

Basato sulla **WebQuery HTTP API** (il sostituto di ServerQuery nelle versioni moderne di TeamSpeak). Telnet non è utilizzato né supportato.

![License](https://img.shields.io/badge/license-MIT-blue)

## Screenshot

### Dashboard
Panoramica in tempo reale del tuo server: utenti online, numero di canali, uptime, ping, grafico della banda e capacità del server a colpo d'occhio.

![Dashboard](docs/dashboard.png)

### Bot Musicali
Esegui più bot musicali per server. Ogni bot ha la propria coda, controllo del volume e stato di riproduzione. Supporta stream radio, YouTube e una libreria musicale locale. Gli utenti nel canale del bot possono controllarlo tramite comandi di testo (`!radio`, `!play`, `!vol`, ecc.).

![Music Bots](docs/musicbots.png)

### Bot Flow Engine
Editor visivo basato su nodi per la creazione di flussi di lavoro automatizzati per il server. Trascina trigger, condizioni e azioni sulla tela, collegali e distribuisci. Supporta eventi TS3, pianificazioni cron, webhook e comandi chat come trigger.

![Flow Editor](docs/flow-editor.png)

### Template di Flow
Inizia rapidamente con template di flow predefiniti. Copre casi d'uso comuni come la creazione di canali temporanei, spostatori AFK, espulsori di inattivi, contatori online e protezione dei gruppi. Un clic per importare, poi personalizza secondo le tue esigenze.

![Flow Templates](docs/flow-templates.png)

## Funzionalità

### Autenticazione e Account
- Procedura guidata di configurazione per l'account amministratore iniziale (nessuna credenziale predefinita)
- Autenticazione a due fattori (TOTP) compatibile con qualsiasi app di autenticazione, con codici di recupero monouso
- Gli amministratori possono richiedere MFA per utente e forzare il cambio password al prossimo accesso
- Opzione "Computer fidato": un cookie revocabile di 30 giorni che salta sia la password che MFA su quel dispositivo; i dispositivi fidati sono elencati e revocabili dal tuo account
- Policy password configurabile (lunghezza minima e complessità)
- Lingua dell'interfaccia per utente (inglese, francese, tedesco, spagnolo, italiano)
- SSO opzionale tramite SAML 2.0 (SP-initiated), mostrato come pulsante "Accedi tramite SSO" accanto al login locale
- Provisioning degli account just-in-time (attivabile/disattivabile) con il ruolo mappato da un gruppo/attributo SAML, rivalutato a ogni accesso, oltre a un ruolo predefinito configurabile
- Il controllo MFA si applica comunque dopo un login SAML; gli account SSO non hanno una password locale e non possono usare i flussi di password locale

### Gestione del Server
- Dashboard con statistiche live del server, grafico della banda e panoramica della capacità
- Elenco server virtuali con controlli di avvio/arresto
- Albero dei canali con ordinamento tramite drag-and-drop
- Elenco client con azioni di espulsione, ban, spostamento e poke
- Gestione dei gruppi server e di canale
- Editor dei permessi (livello server, canale, client, gruppo)
- Gestione della lista dei ban
- Gestione dei token / chiavi di privilegio
- Visualizzatore reclami
- Sistema di messaggi offline
- Visualizzatore del log del server con filtro
- Browser di file dei canali con upload/download
- Impostazioni a livello di istanza

### Bot Musicali
- Più bot per server, ciascuno con coda e riproduzione indipendenti
- Streaming di stazioni radio con metadati ICY e aggiornamenti del titolo in tempo reale
- Riproduzione YouTube tramite yt-dlp (ricerca, download, coda)
- Supporto link Spotify (metadati di tracce/album/playlist risolti su YouTube)
- Gestione della libreria musicale (upload, organizzazione, playlist)
- Controllo del volume, pausa, avanzamento, precedente, riproduzione casuale, ripetizione
- Supporto audio stereo con pacing stabile a 20ms
- Riconnessione automatica con backoff esponenziale in caso di disconnessione
- Comandi di testo nel canale per il controllo a mani libere, inclusi comandi per elencare i canali e per spostare gli utenti
- Limita i comandi musicali e i comandi di amministrazione a specifici gruppi server TeamSpeak
- Notifica opzionale del brano in riproduzione pubblicata nel canale TeamSpeak del bot
- Tracciamento della cronologia delle richieste musicali

### Integrazione Discord
- Bot bridge Discord con comandi slash: `/play`, `/stop`, `/pause`, `/skip`, `/next`, `/prev`, `/queue`, `/volume`, `/nowplaying`, `/stats`, `/join`, `/leave`
- Limita i comandi ai ruoli Discord selezionati (admin/proprietario sempre autorizzati; vuoto = aperto a tutti)
- Notifiche di connessione/disconnessione TeamSpeak e presenza per canale, con stile embed o testo semplice e auto-eliminazione opzionale
- Notifiche AFK: pubblica un messaggio personalizzabile quando un utente diventa AFK o torna attivo nel canale osservato (condivide lo stile embed/testo semplice e l'auto-eliminazione)
- Pannello statistiche server live mantenuto aggiornato in un canale Discord
- Il bot musicale può trasmettere il proprio audio in un canale vocale Discord
- Trigger messaggi Discord e azione di invio messaggi disponibili nel Bot Flow Engine

### Streaming Video
- Streaming video in tempo reale da YouTube, Twitch o URL diretti verso canali TeamSpeak
- Basato su WebRTC con relay sidecar Go (Pion) per la consegna a bassa latenza
- Preset di qualità (480p, 720p, 1080p)
- Anteprima nel browser con riproduzione WebRTC
- Sincronizzazione A/V tramite RTCP Sender Reports
- Eseguito come container Docker sidecar affianco al backend

### Bot Flow Engine
- Editor di flow visivo con canvas di nodi drag-and-drop
- Trigger: eventi TS3, pianificazioni cron, webhook (con segreti obbligatori), comandi chat (globali o specifici per canale), messaggi Discord
- Azioni: espulsione, ban, spostamento, messaggio, poke, creazione/modifica/eliminazione canale, richieste HTTP, comandi WebQuery, messaggi Discord
- Condizioni, variabili, ritardi, cicli, logging
- Nomi di canale animati (testo rotante su timer)
- Sistema di segnaposto con filtri ed espressioni
- Template predefiniti per le attività di automazione più comuni

### Diario delle Connessioni
- Registra gli accessi web e TeamSpeak con timestamp, nome utente e IP
- Arricchimento GeoIP offline (nessuna chiamata esterna)
- Colonne ordinabili e filtri per colonna
- Ban IP con un clic dal diario — sull'app web, sul server TeamSpeak, o su entrambi

### Widget per il Server
- Banner di stato del server incorporabile per siti web e forum
- Accesso pubblico basato su token (nessuna autenticazione richiesta)
- Disponibile come pagina live, SVG o immagine PNG
- Temi scuro e chiaro
- Configurabile: mostra/nascondi albero dei canali ed elenco client

### Sicurezza
- Crittografia AES-256-GCM per le credenziali memorizzate (chiavi API, password SSH)
- Autenticazione a due fattori (TOTP) con codici di recupero; applicabile per utente dagli amministratori
- Policy password configurabile e cambio password forzato al prossimo accesso
- Protezione SSRF su tutte le richieste HTTP in uscita, URL FFmpeg e redirect webhook
- Rate limiting sugli endpoint di autenticazione
- JWT access + rotazione refresh token con rilevamento del riutilizzo
- SSO SAML con validazione delle asserzioni firmate, binding dell'audience, protezione anti-replay e codici di accesso monouso
- Controllo degli accessi basato sui ruoli (admin / viewer)
- Controllo degli accessi per server per configurazioni multi-tenant
- Accesso ai comandi Discord limitato per ruolo
- Whitelist comandi WebQuery nei flow bot (blocca i comandi distruttivi)
- Connessioni WebSocket autenticate

### Impostazioni e Amministrazione
- Gestione degli utenti con applicazione MFA e cambio password forzato
- Impostazioni di integrazione Discord, Spotify e YouTube
- Configurazione dell'identity provider SSO / SAML: URL SSO dell'IdP e certificato di firma, mappatura di attributi e ruoli, opzione di auto-provisioning e ruolo predefinito (i metadati SP e gli URL ACS da configurare lato IdP sono mostrati nella scheda)
- Impostazioni dei comandi musicali: limita i comandi per gruppo server TeamSpeak e attiva/disattiva la notifica del brano in riproduzione
- Gestione file cookie yt-dlp per accedere a contenuti YouTube con restrizione d'età o riservati ai membri (carica un file o incolla direttamente nell'interfaccia)
- Gestione del diario delle connessioni e dei ban IP
- Pannello impostazioni riservato agli amministratori

## Architettura

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

**Quattro pacchetti** in un monorepo pnpm:

| Pacchetto | Descrizione |
|-----------|-------------|
| `@ts6/common` | Tipi condivisi, costanti, utilità |
| `@ts6/backend` | Express API, client WebQuery, motore bot, bot vocali, bridge Discord, widget |
| `@ts6/frontend` | React SPA con Vite, TailwindCSS, shadcn/ui |
| `sidecar` | Relay media WebRTC in Go (Pion) per lo streaming video |

Il backend fa da proxy per tutte le chiamate all'API TeamSpeak. Il frontend non ha mai accesso diretto alle chiavi API o alle credenziali del server.

## Stack Tecnologico

**Frontend:** React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query + Table, React Flow, Recharts, Zustand, react-i18next

**Backend:** Node.js, Express, Prisma (SQLite), autenticazione JWT, TOTP MFA, client WebQuery HTTP, listener eventi SSH, discord.js

**Voce/Audio:** Client personalizzato per il protocollo vocale TS3 (UDP), codifica Opus, FFmpeg, yt-dlp

**Streaming Video:** Sidecar Go con Pion WebRTC v4, RTCP Sender Reports per la sincronizzazione A/V

## Avvio Rapido (Docker)

La compilazione dal sorgente è l'impostazione predefinita in questo fork — `docker-compose.yml`
compila le tre immagini localmente. Per eseguire invece le immagini upstream di Docker Hub,
usa [`docker-compose.hub.yml`](docker-compose.hub.yml) (nota: quelle immagini non contengono
le correzioni e il rafforzamento di questo fork).

1. Clona il repository
2. Crea un file `.env` nella root del repository:

```env
JWT_SECRET=your-random-secret-at-least-32-characters
ENCRYPTION_KEY=another-random-secret-for-credential-encryption
SIDECAR_TOKEN=a-third-random-secret-for-the-media-sidecar
```

Genera valori sicuri:

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "SIDECAR_TOKEN=$(openssl rand -base64 32)" >> .env
```

3. Compila e avvia lo stack:

```bash
docker compose up -d --build
```

4. Apri `http://localhost:3000/setup` e crea il tuo account amministratore
5. Accedi, poi aggiungi la connessione al tuo server TeamSpeak in **Impostazioni → Connessioni** (host, porta WebQuery, chiave API)

> `JWT_SECRET` è **obbligatorio** — il backend si rifiuterà di avviarsi in produzione senza di esso.
> `ENCRYPTION_KEY` è **obbligatorio in produzione** e deve differire da `JWT_SECRET`. I valori cifrati prima di questo requisito (con il fallback su `JWT_SECRET`) sono ancora leggibili e vengono ri-cifrati al prossimo salvataggio.
> `SIDECAR_TOKEN` autentica il backend rispetto all'API del sidecar multimediale. Senza di esso il sidecar registra un avviso e accetta richieste non autenticate (accettabile solo su una rete isolata).

### Eseguire le immagini upstream di Docker Hub

```bash
docker compose -f docker-compose.hub.yml up -d
```

Le immagini di Hub ascoltano su porte interne diverse rispetto a quelle compilate
localmente — non mischiare mai container di entrambi i compose file nello stesso stack.

### Coolify / Reverse Proxy

Usa [`docker-compose.coolify.yml`](docker-compose.coolify.yml) come punto di partenza. Differenze principali rispetto al compose standard:

- Nessuna sezione `ports` — il reverse proxy gestisce il routing
- Imposta il dominio sul servizio **frontend** in Coolify (porta 8080 — nginx gira senza privilegi)
- Se il tuo server TS è in una rete Docker separata, aggiungila come rete esterna sul servizio backend:

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

## Sviluppo

Requisiti: Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm dev          # avvia backend + frontend in parallelo
```

Il backend gira su `:3001`, il frontend su `:5173` (server di sviluppo Vite).

### Database

Prisma con SQLite. Al primo avvio:

```bash
cd packages/backend
npx prisma migrate deploy
```

Le immagini Docker gestiscono le migrazioni automaticamente all'avvio.

## Variabili d'Ambiente

| Variabile | Predefinito | Descrizione |
|-----------|-------------|-------------|
| `JWT_SECRET` | — | **Obbligatorio.** Segreto per la firma JWT. Deve essere impostato in produzione. |
| `ENCRYPTION_KEY` | — | **Obbligatorio in produzione**, deve differire da `JWT_SECRET`. Chiave dedicata per la crittografia delle credenziali AES-256-GCM. In sviluppo ricade su `JWT_SECRET`. |
| `PORT` | `3001` | Porta del backend |
| `DATABASE_URL` | `file:./data/ts6webui.db` | Percorso del database SQLite |
| `JWT_ACCESS_EXPIRY` | `15m` | Durata del token di accesso |
| `JWT_REFRESH_EXPIRY` | `7d` | Durata del refresh token |
| `FRONTEND_URL` | `http://localhost:3000` | Origine CORS |
| `MUSIC_DIR` | `/data/music` | Directory per i file musicali scaricati |
| `SIDECAR_URL` | — | Opzionale. URL completo del servizio sidecar WebRTC (es. `http://ts6-sidecar:9800`). Da impostare in Docker quando il sidecar è eseguito come container separato. |
| `SIDECAR_TOKEN` | — | Segreto condiviso tra backend e sidecar. Il sidecar rifiuta le chiamate API senza `Authorization: Bearer <token>` quando impostato. |
| `SIDECAR_LISTEN_ADDR` | `127.0.0.1` | Interfaccia a cui si collega l'API del sidecar (`0.0.0.0` all'interno di Docker, impostato dall'immagine). Non esporre mai la porta 9800. |
| `YT_COOKIE_FILE` | — | Opzionale. Percorso di un file cookies.txt in formato Netscape per yt-dlp. Può anche essere gestito tramite **Impostazioni → YouTube** nell'interfaccia. |

## Variabili d'Ambiente del Sidecar (Streaming Video)

| Variabile | Predefinito | Descrizione |
|-----------|-------------|-------------|
| `VIDEO_QUEUE_SIZE` | `2048` | Dimensione della coda RTP video |
| `AUDIO_QUEUE_SIZE` | `4096` | Dimensione della coda RTP audio |
| `SYNC_PLAYOUT_BUFFER_MS` | `4` | Piccolo buffer di playout utilizzato dalla logica di pacing adattivo |
| `SYNC_VIDEO_BIAS_MS` | `4` | Holdback aggiuntivo opzionale per il video per ottimizzare la sincronizzazione |
| `AUDIO_DELAY_MS` | `0` | Opzione di ritardo audio legacy / manuale. Con la logica di pacing attuale ci si aspetta che rimanga tipicamente a 0 |
| `SIDECAR_DEBUG_LOGS` | `1` | Abilita il logging di debug verboso per i dettagli runtime ad alta frequenza |
| `VIDEO_READ_RTP_BUFFER` | `4194304` | Buffer socket OS UDP per la porta video |
| `AUDIO_READ_RTP_BUFFER` | `1048576` | Buffer socket OS UDP per la porta audio |
| `VIDEO_BUFSIZE` | `1M` | Buffer video FFmpeg |

## Comandi di Testo del Bot Musicale

Quando un bot musicale è connesso a un canale, gli utenti in quel canale possono controllarlo tramite chat:

| Comando | Descrizione |
|---------|-------------|
| `!radio` | Elenca le stazioni radio disponibili |
| `!radio <id>` | Riproduci una stazione radio |
| `!play <url>` | Riproduci dall'URL YouTube |
| `!play` | Riprendi la riproduzione in pausa |
| `!spotify <url>` | Riproduci da un link a traccia/album/playlist Spotify |
| `!queue <url>` / `!add <url>` | Aggiungi una traccia alla coda |
| `!stop` | Ferma la riproduzione |
| `!pause` | Attiva/disattiva pausa/ripresa |
| `!skip` / `!next` | Traccia successiva nella coda |
| `!prev` | Traccia precedente |
| `!vol` | Mostra il volume corrente |
| `!vol <0-100>` | Imposta il volume |
| `!np` / `!nowplaying` | Mostra la traccia corrente |
| `!info` | Traccia corrente con avanzamento della riproduzione |
| `!help` / `!aide` | Elenca i comandi disponibili |
| `!channels` | Elenca i canali con i rispettivi ID |
| `!move <user> <channel>` | Sposta un utente in un canale (admin) |
| `!moveall <channel>` | Sposta tutti in un canale (admin) |
| `!notif` | Attiva/disattiva la notifica del brano in riproduzione (admin) |

`!move`, `!moveall` e `!notif` sono comandi di amministrazione; l'accesso ai comandi musicali e ai comandi di amministrazione può essere limitato a specifici gruppi server TeamSpeak in **Impostazioni → Comandi Musicali**.

## Configurazione SSO / SAML

Single sign-on SAML 2.0 opzionale (SP-initiated) che funziona **accanto al** login locale. Configuralo in **Impostazioni → SSO / SAML** (solo admin). L'SSO diventa attivo solo quando **Attiva SSO (SAML)** è attivo **e** sia **URL SSO dell'IdP** che **Certificato di firma dell'IdP** sono compilati — fino ad allora il pulsante "Accedi tramite SSO" resta nascosto e gli endpoint SAML sono inattivi.

**Fornisci questi dati al tuo identity provider (mostrati in sola lettura nella scheda):**

| Valore | Cosa rappresenta | Come viene costruito |
|--------|-------------------|-----------------------|
| URL dei metadati del SP | L'EntityID / audience del service provider che l'IdP deve avere come target | `<FRONTEND_URL>/api/auth/saml/metadata` |
| URL ACS | Assertion Consumer Service — dove l'IdP invia (in POST) la risposta SAML | `<FRONTEND_URL>/api/auth/saml/acs` |

`<FRONTEND_URL>` corrisponde alla variabile d'ambiente `FRONTEND_URL` (l'origine pubblica della tua app).

**Campi:**

| Campo | Descrizione | Predefinito | Obbligatorio | Valori ammessi |
|-------|-------------|-------------|--------------|-----------------|
| Attiva SSO (SAML) | Interruttore principale. Se disattivato, l'SSO è nascosto e tutti gli endpoint SAML restituiscono 404 | `off` | — | on / off |
| Entity ID dell'IdP | L'issuer / EntityID dell'identity provider. Informativo per riferimento; l'asserzione viene considerata attendibile tramite il binding certificato + audience | vuoto | no | qualsiasi stringa (di solito un URL/URN) |
| URL SSO dell'IdP | L'endpoint SSO SAML di tipo **redirect** dell'IdP a cui viene inviata la richiesta di login (AuthnRequest) | vuoto | **sì** (per abilitare) | un URL `https://` |
| Certificato di firma dell'IdP | Il certificato di firma X.509 **pubblico** dell'IdP, usato per verificare la firma dell'asserzione. Solo scrittura: memorizzato in forma cifrata, mostrato solo come impostato/non impostato | vuoto | **sì** (per abilitare) | PEM (`-----BEGIN CERTIFICATE-----…`) o corpo base64 nudo (racchiuso automaticamente) |
| Provisioning automatico degli account | Crea un account locale al primo login SSO riuscito (JIT). Se disattivato, un login SAML per un account sconosciuto viene rifiutato | `on` | no | on / off |
| Ruolo predefinito degli account SSO | Ruolo assegnato quando nessuna mappatura admin corrisponde (vedi l'attributo ruolo qui sotto) | `viewer` | no | `viewer` o `admin` |
| Attributo: nome utente | Attributo dell'asserzione mappato al nome utente dell'account. Se assente, ricade sulla parte locale dell'e-mail, poi sul NameID | claim username di Authentik (`http://schemas.goauthentik.io/2021/02/saml/username`) | no | qualsiasi nome di attributo inviato dal tuo IdP |
| Attributo: e-mail | Attributo dell'asserzione mappato all'e-mail | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | no | qualsiasi nome di attributo |
| Attributo: nome visualizzato | Attributo dell'asserzione mappato al nome visualizzato (ricade sul nome utente) | claim displayname di Authentik (`http://schemas.goauthentik.io/2021/02/saml/displayname`) | no | qualsiasi nome di attributo |
| Attributo: ruolo / gruppo | Attributo dell'asserzione (spesso `groups`) i cui valori vengono controllati per la mappatura admin. Lascia vuoto per assegnare a ogni utente SSO il ruolo predefinito | vuoto | no | qualsiasi nome di attributo |
| Valore che concede il ruolo admin | Se questo valore esatto compare nell'attributo ruolo/gruppo, l'account diventa `admin`; altrimenti riceve il ruolo predefinito | vuoto | no | la stringa esatta di gruppo/ruolo del tuo IdP (es. `ts6-admins`) |

**Note sul comportamento:**

- **Chiave di identità:** gli account vengono associati in base al **NameID** SAML — configura un formato NameID **persistente** sull'IdP. Un NameID *transitorio* cambia a ogni login e creerebbe un nuovo account ogni volta.
- **Sincronizzazione del ruolo:** il ruolo viene **rivalutato a ogni login** (l'IdP fa fede). Una promozione manuale effettuata nell'app viene sovrascritta al login SSO successivo.
- **MFA:** il controllo MFA dell'app si applica comunque dopo un'asserzione valida (se l'account ha l'MFA abilitata). Gli account SSO **non hanno una password locale** e non possono usare i flussi di password locale / cambio password.
- **Postura di sicurezza (v1):** la firma dell'asserzione è **obbligatoria**, l'audience deve corrispondere all'URL dei metadati del SP e viene applicata la validazione anti-replay di `InResponseTo`. Il SP **non** firma le proprie AuthnRequest. L'importazione dei metadati dell'IdP via URL/XML non è ancora disponibile — inserisci manualmente l'URL SSO e il certificato.

**Mappatura rapida per Authentik:** *URL SSO dell'IdP* = il campo **SSO URL (Redirect)** del provider; *Certificato di firma dell'IdP* = il campo **Signing Certificate** del provider; *Entity ID dell'IdP* = il campo **Issuer** del provider. Per la mappatura admin, esponi un attributo groups (Property Mapping) e imposta **Valore che concede il ruolo admin** sul nome del tuo gruppo admin.

## Requisiti

- Server TeamSpeak con **WebQuery HTTP** abilitato (non raw/telnet)
- Chiave API WebQuery (generata tramite `apikeyadd` o strumenti di amministrazione del server)
- Accesso SSH al server TS (necessario solo per i trigger di eventi nei flow bot)
- `yt-dlp` e `ffmpeg` installati sul backend (inclusi nell'immagine Docker)

## Risoluzione dei problemi

### Accesso al server TeamSpeak perso dopo un aggiornamento

Se TS6 Manager improvvisamente non riesce più a raggiungere il server TeamSpeak — chiave API non valida, login SSH rifiutato, timeout, ban anti-flood — l'aggiornamento del server ha probabilmente fatto scadere la chiave API, rigenerato la password `serveradmin` o reimpostato la configurazione query. Segui la guida di recupero passo dopo passo: **[Recovering access to your TeamSpeak server](docs/recover-server-access.md)** (in inglese).

## Licenza

MIT
