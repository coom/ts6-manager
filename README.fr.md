[English](README.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

#### DISCLAIMER: 
![AI Assisted](https://img.shields.io/badge/AI%20Assisted-Project-00ADD8?style=for-the-badge&logo=dependabot&logoColor=white)

# TS6 Manager

Interface de gestion web pour les serveurs TeamSpeak. Contrôlez les serveurs virtuels, les canaux, les clients, les permissions, les bots musicaux, les workflows automatisés et les widgets de serveur intégrables — le tout depuis votre navigateur. L'interface est disponible en **anglais, français, allemand, espagnol et italien**.

## Ce que cette version apporte

Évolution renforcée et axée sur la fiabilité de [clusterzx/ts6-manager](https://github.com/clusterzx/ts6-manager) :

**Comptes & accès**
- Authentification à deux facteurs (TOTP) avec codes de récupération à usage unique ; les administrateurs peuvent exiger le MFA par utilisateur et forcer un changement de mot de passe à la prochaine connexion
- Option « ordinateur de confiance » : ignorer le mot de passe **et** le MFA sur un appareil choisi pendant 30 jours via un cookie `httpOnly` révocable, avec une liste d'appareils révocables depuis votre compte
- Politique de mot de passe configurable (longueur minimale + complexité)
- **SSO via SAML** — authentification unique optionnelle en complément de la connexion locale, avec provisionnement de compte à la volée (just-in-time) et rôles mappés depuis votre fournisseur d'identité

**Intégration Discord**
- Passerelle Discord : commandes slash (`/play`, `/skip`, `/queue`, …), notifications de connexion/déconnexion TeamSpeak et de présence, ainsi qu'un panneau de statistiques du serveur en temps réel
- Notifications AFK : publier sur Discord lorsqu'un utilisateur passe AFK ou revient dans le canal surveillé
- Le bot musical peut également diffuser dans un salon vocal Discord
- Restreindre l'accès aux commandes du bot à un ensemble de rôles Discord sélectionnés

**Multi-langue**
- Traduction complète de l'interface en anglais, français, allemand, espagnol et italien, mémorisée par utilisateur

**Spotify & journal**
- Les liens Spotify sont résolus vers YouTube pour la lecture, configuré dans la WebUI
- Journal de connexion pour les connexions web et TeamSpeak avec GeoIP hors ligne, colonnes triables/filtrables et bannissements d'IP en un clic (web et/ou TeamSpeak)

**Fiabilité**
- Pool de connexions auto-réparant : les connexions aux serveurs ajoutées ou modifiées dans l'interface fonctionnent immédiatement — sans jamais redémarrer le backend
- Le client WebQuery reconstruit son transport lorsque sa socket keep-alive meurt silencieusement (NAT Docker, redémarrages de serveur), avec un disjoncteur qui stoppe l'alimentation du compteur anti-flood TS
- Réponses du tableau de bord mises en cache 5 s côté serveur : N onglets ouverts ne coûtent pas plus qu'un seul
- Une ligne d'accrédentiel indéchiffrable ne fait plus planter le démarrage

**Bots musicaux**
- Lecture de fichiers en streaming : premier audio en ~200 ms, mémoire constante (auparavant, la piste entière était décodée en RAM — ~690 Mo pour un mix d'1 h)
- Encodeur Opus natif (`@discordjs/opus`, ~5-10× moins de CPU) avec repli automatique sur WASM
- Pipeline yt-dlp robuste : timeouts stricts, nettoyage des artefacts périmés, téléchargements concurrents dédupliqués, journalisation complète des erreurs, faible priorité CPU, mise à jour automatique au démarrage du conteneur
- « Load & Play » lance la lecture ; le nombre de pistes dans les playlists reste à jour

**Sécurité**
- Évaluateur d'expressions sûr intégré, remplaçant le paquet `expr-eval` non maintenu
- Authentification par bearer token pour l'API du sidecar, conteneurs renforcés, binaires committés supprimés
- Dépendances mises à jour pour éliminer tous les problèmes d'audit ; ESLint + CI GitHub Actions

**Déploiement**
- `docker compose up -d --build` compile depuis les sources par défaut (`docker-compose.hub.yml` pour les images Docker Hub amont)
- Timeouts nginx/client dimensionnés pour les longs téléchargements YouTube ; démarrage du conteneur silencieux et propre

Construit sur l'**API HTTP WebQuery** (le remplaçant de ServerQuery dans les versions récentes de TeamSpeak). Telnet n'est ni utilisé ni supporté.

![License](https://img.shields.io/badge/license-MIT-blue)

## Captures d'écran

### Tableau de bord
Vue d'ensemble en temps réel de votre serveur : utilisateurs en ligne, nombre de canaux, disponibilité, ping, graphique de bande passante et capacité du serveur d'un coup d'œil.

![Dashboard](docs/dashboard.png)

### Bots musicaux
Faites tourner plusieurs bots musicaux par serveur. Chaque bot possède sa propre file d'attente, son contrôle du volume et son état de lecture. Prend en charge les flux radio, YouTube et une bibliothèque musicale locale. Les utilisateurs dans le canal du bot peuvent le contrôler via des commandes texte (`!radio`, `!play`, `!vol`, etc.).

![Music Bots](docs/musicbots.png)

### Moteur de flux bot
Éditeur visuel basé sur des nœuds pour créer des workflows automatisés pour le serveur. Faites glisser des déclencheurs, des conditions et des actions sur le canevas, connectez-les et déployez. Prend en charge les événements TS3, les planifications cron, les webhooks et les commandes de chat comme déclencheurs.

![Flow Editor](docs/flow-editor.png)

### Modèles de flux
Démarrez rapidement grâce à des modèles de flux préconstruits. Couvre les cas d'usage courants tels que la création de canaux temporaires, les déplaceurs AFK, les expulseurs d'inactifs, les compteurs en ligne et la protection de groupe. Un clic pour importer, puis personnalisez selon vos besoins.

![Flow Templates](docs/flow-templates.png)

## Fonctionnalités

### Authentification & Comptes
- Assistant de configuration pour le compte administrateur initial (aucune accrédentiel par défaut)
- Authentification à deux facteurs (TOTP) compatible avec toute application d'authentification, avec codes de récupération à usage unique
- Les administrateurs peuvent exiger le MFA par utilisateur et forcer un changement de mot de passe à la prochaine connexion
- Option « ordinateur de confiance » : un cookie révocable de 30 jours qui ignore à la fois le mot de passe et le MFA sur cet appareil ; les appareils de confiance sont listés et révocables depuis votre compte
- Politique de mot de passe configurable (longueur minimale + complexité)
- Langue d'interface par utilisateur (anglais, français, allemand, espagnol, italien)
- SSO optionnel via SAML 2.0 (initié par le fournisseur de service), affiché comme un bouton « Se connecter via SSO » à côté de la connexion locale
- Provisionnement de compte à la volée (activable/désactivable) avec le rôle mappé depuis un groupe/attribut SAML, réévalué à chaque connexion, plus un rôle par défaut configurable
- Le contrôle MFA s'applique toujours après une connexion SAML ; les comptes SSO n'ont pas de mot de passe local et ne peuvent pas utiliser les parcours de mot de passe local

### Gestion du serveur
- Tableau de bord avec statistiques du serveur en direct, graphique de bande passante et vue d'ensemble de la capacité
- Liste des serveurs virtuels avec contrôles de démarrage/arrêt
- Arborescence des canaux avec tri par glisser-déposer
- Liste des clients avec actions d'expulsion, bannissement, déplacement et poke
- Gestion des groupes de serveurs et de canaux
- Éditeur de permissions (niveau serveur, canal, client, groupe)
- Gestion de la liste de bannissement
- Gestion des tokens / clés de privilège
- Visionneuse de plaintes
- Système de messagerie hors ligne
- Visionneuse des journaux du serveur avec filtrage
- Explorateur de fichiers des canaux avec upload/téléchargement
- Paramètres au niveau de l'instance

### Bots musicaux
- Plusieurs bots par serveur, chacun avec une file d'attente et une lecture indépendantes
- Streaming de stations radio avec métadonnées ICY et mises à jour du titre en direct
- Lecture YouTube via yt-dlp (recherche, téléchargement, file d'attente)
- Support des liens Spotify (métadonnées de piste/album/playlist résolues vers YouTube)
- Gestion de bibliothèque musicale (upload, organisation, playlists)
- Contrôle du volume, pause, suivant, précédent, lecture aléatoire, répétition
- Support audio stéréo avec un cadencement stable de 20 ms
- Reconnexion automatique avec reprise exponentielle en cas de déconnexion
- Commandes texte dans le canal pour un contrôle sans les mains, y compris la liste des canaux et les commandes de déplacement
- Restreindre les commandes musicales et les commandes d'administration à des groupes de serveurs TeamSpeak spécifiques
- Notification optionnelle « lecture en cours » publiée dans le canal TeamSpeak du bot
- Suivi de l'historique des requêtes musicales

### Intégration Discord
- Bot passerelle Discord avec commandes slash : `/play`, `/stop`, `/pause`, `/skip`, `/next`, `/prev`, `/queue`, `/volume`, `/nowplaying`, `/stats`, `/join`, `/leave`
- Restreindre les commandes aux rôles Discord sélectionnés (admins/propriétaire toujours autorisés ; vide = ouvert à tous)
- Notifications de connexion/déconnexion TeamSpeak et de présence à l'échelle du canal, avec style embed ou texte brut et suppression automatique optionnelle
- Notifications AFK : publier un message personnalisable lorsqu'un utilisateur passe AFK ou revient dans le canal surveillé (partage le style embed/texte brut et la suppression automatique)
- Panneau de statistiques du serveur en direct maintenu à jour dans un salon Discord
- Le bot musical peut diffuser son audio dans un salon vocal Discord
- Déclencheur de message Discord et action d'envoi de message disponibles dans le moteur de flux bot

### Diffusion vidéo
- Diffusion vidéo en direct depuis YouTube, Twitch ou des URLs directes vers des canaux TeamSpeak
- Basé sur WebRTC avec relais sidecar Go (Pion) pour une diffusion à faible latence
- Préréglages de qualité (480p, 720p, 1080p)
- Aperçu dans le navigateur avec lecture WebRTC
- Synchronisation A/V via RTCP Sender Reports
- S'exécute en tant que conteneur Docker sidecar aux côtés du backend

### Moteur de flux bot
- Éditeur de flux visuel avec canevas de nœuds par glisser-déposer
- Déclencheurs : événements TS3, planifications cron, webhooks (avec secrets obligatoires), commandes de chat (globales ou spécifiques à un canal), messages Discord
- Actions : expulsion, bannissement, déplacement, message, poke, création/modification/suppression de canal, requêtes HTTP, commandes WebQuery, messages Discord
- Conditions, variables, délais, boucles, journalisation
- Noms de canaux animés (texte rotatif sur minuterie)
- Système de variables de substitution avec filtres et expressions
- Modèles préconstruits pour les tâches d'automatisation courantes

### Journal de connexion
- Enregistre les connexions web et TeamSpeak avec horodatage, nom d'utilisateur et IP
- Enrichissement GeoIP hors ligne (aucun appel externe)
- Colonnes triables et filtres par colonne
- Bannissement d'IP en un clic depuis le journal — sur l'application web, sur le serveur TeamSpeak, ou les deux

### Widgets de serveur
- Bannière de statut du serveur intégrable pour les sites web et les forums
- Accès public par token (aucune authentification requise)
- Disponible en page live, SVG ou image PNG
- Thèmes sombre et clair
- Configurable : afficher/masquer l'arborescence des canaux et la liste des clients

### Sécurité
- Chiffrement AES-256-GCM pour les accrédentiels stockés (clés API, mots de passe SSH)
- Authentification à deux facteurs (TOTP) avec codes de récupération ; applicable par administrateur par utilisateur
- Politique de mot de passe configurable et changement de mot de passe forcé à la prochaine connexion
- Protection SSRF sur toutes les requêtes HTTP sortantes, les URLs FFmpeg et les redirections de webhook
- Limitation du débit sur les points de terminaison d'authentification
- JWT : rotation des tokens d'accès et de rafraîchissement avec détection de réutilisation
- SSO SAML avec validation des assertions signées, liaison d'audience, protection contre le rejeu et codes de connexion à usage unique
- Contrôle d'accès basé sur les rôles (admin / lecteur)
- Contrôle d'accès par serveur pour les configurations multi-tenant
- Accès aux commandes Discord restreint par rôle
- Liste blanche de commandes WebQuery dans les flux de bots (bloque les commandes destructrices)
- Connexions WebSocket authentifiées

### Paramètres & Administration
- Gestion des utilisateurs avec application du MFA et changement de mot de passe forcé
- Paramètres d'intégration Discord, Spotify et YouTube
- Configuration du fournisseur d'identité SSO / SAML : URL SSO de l'IdP et certificat de signature, mappage des attributs et des rôles, activation du provisionnement automatique et rôle par défaut (les URL de métadonnées SP et ACS à configurer côté IdP sont affichées dans l'onglet)
- Paramètres des commandes musicales : restreindre les commandes par groupe de serveurs TeamSpeak et activer/désactiver la notification « lecture en cours »
- Gestion des fichiers de cookies yt-dlp pour accéder au contenu YouTube réservé aux membres ou à accès restreint par âge (uploadez un fichier ou collez directement dans l'interface)
- Journal de connexion et gestion des bannissements d'IP
- Panneau de paramètres réservé aux administrateurs

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

**Quatre packages** dans un monorepo pnpm :

| Package | Description |
|---------|-------------|
| `@ts6/common` | Types partagés, constantes, utilitaires |
| `@ts6/backend` | API Express, client WebQuery, moteur de bots, bots vocaux, passerelle Discord, widgets |
| `@ts6/frontend` | SPA React avec Vite, TailwindCSS, shadcn/ui |
| `sidecar` | Relais média WebRTC en Go (Pion) pour la diffusion vidéo |

Le backend relaie tous les appels à l'API TeamSpeak. Le frontend n'a jamais accès direct aux clés API ni aux accrédentiels du serveur.

## Stack technique

**Frontend :** React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query + Table, React Flow, Recharts, Zustand, react-i18next

**Backend :** Node.js, Express, Prisma (SQLite), authentification JWT, MFA TOTP, client HTTP WebQuery, écouteur d'événements SSH, discord.js

**Voix/Audio :** Client protocole vocal TS3 personnalisé (UDP), encodage Opus, FFmpeg, yt-dlp

**Diffusion vidéo :** Sidecar Go avec Pion WebRTC v4, RTCP Sender Reports pour la synchronisation A/V

## Démarrage rapide (Docker)

La compilation depuis les sources est le comportement par défaut dans ce fork — `docker-compose.yml`
compile les trois images localement. Pour utiliser les images Docker Hub amont
à la place, utilisez [`docker-compose.hub.yml`](docker-compose.hub.yml) (note : ces images
ne contiennent pas les durcissements et corrections de ce fork).

1. Clonez le dépôt
2. Créez un fichier `.env` à la racine du dépôt :

```env
JWT_SECRET=your-random-secret-at-least-32-characters
ENCRYPTION_KEY=another-random-secret-for-credential-encryption
SIDECAR_TOKEN=a-third-random-secret-for-the-media-sidecar
```

Générez des valeurs sécurisées :

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "SIDECAR_TOKEN=$(openssl rand -base64 32)" >> .env
```

3. Compilez et démarrez la stack :

```bash
docker compose up -d --build
```

4. Ouvrez `http://localhost:3000/setup` et créez votre compte administrateur
5. Connectez-vous, puis ajoutez votre connexion au serveur TeamSpeak sous **Paramètres → Connexions** (hôte, port WebQuery, clé API)

> `JWT_SECRET` est **obligatoire** — le backend refusera de démarrer en production sans lui.
> `ENCRYPTION_KEY` est **obligatoire en production** et doit différer de `JWT_SECRET`. Les valeurs chiffrées avant cette exigence (avec le repli sur `JWT_SECRET`) restent lisibles et sont rechiffrées à la prochaine sauvegarde.
> `SIDECAR_TOKEN` authentifie le backend auprès de l'API du sidecar média. Sans lui, le sidecar journalise un avertissement et accepte les requêtes non authentifiées (acceptable uniquement sur un réseau isolé).

### Utiliser les images Docker Hub amont

```bash
docker compose -f docker-compose.hub.yml up -d
```

Les images Hub écoutent sur des ports internes différents de ceux des images compilées localement — ne mélangez jamais les conteneurs des deux fichiers compose dans la même stack.

### Coolify / Proxy inverse

Utilisez [`docker-compose.coolify.yml`](docker-compose.coolify.yml) comme point de départ. Différences clés par rapport au compose standard :

- Pas de section `ports` — le proxy inverse gère le routage
- Définissez le domaine sur le service **frontend** dans Coolify (port 8080 — nginx s'exécute sans privilèges)
- Si votre serveur TS tourne dans un réseau Docker séparé, ajoutez-le comme réseau externe sur le service backend :

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

## Développement

Prérequis : Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm dev          # starts backend + frontend in parallel
```

Le backend tourne sur `:3001`, le frontend sur `:5173` (serveur de développement Vite).

### Base de données

Prisma avec SQLite. Lors du premier lancement :

```bash
cd packages/backend
npx prisma migrate deploy
```

Les images Docker gèrent les migrations automatiquement au démarrage.

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `JWT_SECRET` | — | **Obligatoire.** Secret pour la signature JWT. Doit être défini en production. |
| `ENCRYPTION_KEY` | — | **Obligatoire en production**, doit différer de `JWT_SECRET`. Clé dédiée au chiffrement AES-256-GCM des accrédentiels. En développement, elle se replie sur `JWT_SECRET`. |
| `PORT` | `3001` | Port du backend |
| `DATABASE_URL` | `file:./data/ts6webui.db` | Chemin de la base de données SQLite |
| `JWT_ACCESS_EXPIRY` | `15m` | Durée de vie du token d'accès |
| `JWT_REFRESH_EXPIRY` | `7d` | Durée de vie du token de rafraîchissement |
| `FRONTEND_URL` | `http://localhost:3000` | Origine CORS |
| `MUSIC_DIR` | `/data/music` | Répertoire pour les fichiers musicaux téléchargés |
| `SIDECAR_URL` | — | Optionnel. URL complète du service sidecar WebRTC (ex. `http://ts6-sidecar:9800`). À définir dans Docker lorsque le sidecar tourne en conteneur séparé. |
| `SIDECAR_TOKEN` | — | Secret partagé entre le backend et le sidecar. Le sidecar rejette les appels API sans `Authorization: Bearer <token>` lorsqu'il est défini. |
| `SIDECAR_LISTEN_ADDR` | `127.0.0.1` | Interface sur laquelle l'API du sidecar écoute (`0.0.0.0` dans Docker, défini par l'image). N'exposez jamais le port 9800. |
| `YT_COOKIE_FILE` | — | Optionnel. Chemin vers un fichier cookies.txt au format Netscape pour yt-dlp. Peut également être géré via **Paramètres → YouTube** dans l'interface. |

## Variables d'environnement du sidecar (diffusion vidéo)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `VIDEO_QUEUE_SIZE` | `2048` | Taille de la file RTP vidéo |
| `AUDIO_QUEUE_SIZE` | `4096` | Taille de la file RTP audio |
| `SYNC_PLAYOUT_BUFFER_MS` | `4` | Petit tampon de lecture utilisé par la logique de cadencement adaptatif |
| `SYNC_VIDEO_BIAS_MS` | `4` | Retard supplémentaire optionnel pour la vidéo afin d'affiner la synchronisation |
| `AUDIO_DELAY_MS` | `0` | Option de retard audio hérité / manuel. Avec la logique de cadencement actuelle, cette valeur est généralement censée rester à 0 |
| `SIDECAR_DEBUG_LOGS` | `1` | Active la journalisation de débogage verbeuse pour les détails d'exécution à haute fréquence |
| `VIDEO_READ_RTP_BUFFER` | `4194304` | Tampon socket UDP OS pour le port vidéo |
| `AUDIO_READ_RTP_BUFFER` | `1048576` | Tampon socket UDP OS pour le port audio |
| `VIDEO_BUFSIZE` | `1M` | Tampon vidéo FFmpeg |

## Commandes texte du bot musical

Lorsqu'un bot musical est connecté à un canal, les utilisateurs de ce canal peuvent le contrôler via le chat :

| Commande | Description |
|----------|-------------|
| `!radio` | Lister les stations radio disponibles |
| `!radio <id>` | Jouer une station radio |
| `!play <url>` | Lire depuis une URL YouTube |
| `!play` | Reprendre la lecture en pause |
| `!spotify <url>` | Lire depuis un lien Spotify (piste/album/playlist) |
| `!queue <url>` / `!add <url>` | Ajouter une piste à la file d'attente |
| `!stop` | Arrêter la lecture |
| `!pause` | Basculer pause/lecture |
| `!skip` / `!next` | Piste suivante dans la file |
| `!prev` | Piste précédente |
| `!vol` | Afficher le volume actuel |
| `!vol <0-100>` | Régler le volume |
| `!np` / `!nowplaying` | Afficher la piste en cours |
| `!info` | Piste en cours avec la progression de lecture |
| `!help` / `!aide` | Lister les commandes disponibles |
| `!channels` | Lister les canaux avec leurs identifiants |
| `!move <user> <channel>` | Déplacer un utilisateur vers un canal (admin) |
| `!moveall <channel>` | Déplacer tout le monde vers un canal (admin) |
| `!notif` | Activer/désactiver la notification « lecture en cours » (admin) |

`!move`, `!moveall` et `!notif` sont des commandes d'administration ; l'accès aux commandes musicales et aux commandes d'administration peut être restreint à des groupes de serveurs TeamSpeak spécifiques dans **Paramètres → Commandes musicales**.

## Configuration SSO / SAML

Authentification unique SAML 2.0 initiée par le SP (optionnelle), fonctionnant **en parallèle** de la connexion locale. À configurer dans **Paramètres → SSO / SAML** (administrateurs uniquement). Le SSO ne devient actif que lorsque **Activer le SSO** est activé **et** que l'**URL SSO de l'IdP** et le **certificat de signature de l'IdP** sont tous deux renseignés — jusque-là, le bouton « Se connecter via SSO » reste masqué et les points de terminaison SAML restent inertes.

**À fournir à votre fournisseur d'identité (affiché en lecture seule dans l'onglet) :**

| Valeur | Ce que c'est | Comment elle est construite |
|-------|------------|-----------------|
| URL de métadonnées SP | L'EntityID / audience du fournisseur de services que l'IdP doit cibler | `<FRONTEND_URL>/api/auth/saml/metadata` |
| URL ACS | Assertion Consumer Service — où l'IdP envoie (POST) la réponse SAML | `<FRONTEND_URL>/api/auth/saml/acs` |

`<FRONTEND_URL>` correspond à la variable d'environnement `FRONTEND_URL` (l'origine publique de votre application).

**Champs :**

| Champ | Description | Défaut | Requis | Valeurs admissibles |
|-------|-------------|---------|----------|-------------------|
| Activer le SSO (SAML) | Interrupteur principal. Lorsqu'il est désactivé, le SSO est masqué et tous les points de terminaison SAML renvoient 404 | `off` | — | on / off |
| Entity ID de l'IdP | L'émetteur / EntityID du fournisseur d'identité. Informatif à titre de référence ; l'assertion est validée via le certificat et la liaison d'audience | vide | non | n'importe quelle chaîne (généralement une URL/URN) |
| URL SSO de l'IdP | Le point de terminaison SSO **redirect** SAML de l'IdP vers lequel la demande de connexion (AuthnRequest) est envoyée | vide | **oui** (pour activer) | une URL `https://` |
| Certificat de signature de l'IdP | Le certificat de signature X.509 **public** de l'IdP utilisé pour vérifier la signature de l'assertion. Écriture seule : stocké chiffré, affiché uniquement comme défini/non défini | vide | **oui** (pour activer) | PEM (`-----BEGIN CERTIFICATE-----…`) ou corps base64 brut (encapsulé automatiquement) |
| Provisionner automatiquement les comptes | Crée un compte local à la première connexion SSO réussie (JIT). Lorsque désactivé, une connexion SAML pour un compte inconnu est rejetée | `on` | non | on / off |
| Rôle par défaut pour les comptes SSO | Rôle attribué lorsqu'aucun mappage admin ne correspond (voir l'attribut de rôle ci-dessous) | `viewer` | non | `viewer` ou `admin` |
| Attribut : nom d'utilisateur | Attribut d'assertion mappé au nom d'utilisateur du compte. Si absent, revient à la partie locale de l'e-mail, puis au NameID | Revendication du nom d'utilisateur Authentik (`http://schemas.goauthentik.io/2021/02/saml/username`) | non | n'importe quel nom d'attribut envoyé par votre IdP |
| Attribut : e-mail | Attribut d'assertion mappé à l'e-mail | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | non | n'importe quel nom d'attribut |
| Attribut : nom d'affichage | Attribut d'assertion mappé au nom d'affichage (revient au nom d'utilisateur en cas d'absence) | Revendication du nom d'affichage Authentik (`http://schemas.goauthentik.io/2021/02/saml/displayname`) | non | n'importe quel nom d'attribut |
| Attribut : rôle / groupe | Attribut d'assertion (souvent `groups`) dont les valeurs sont vérifiées pour le mappage admin. Laisser vide pour attribuer le rôle par défaut à tous les utilisateurs SSO | vide | non | n'importe quel nom d'attribut |
| Valeur accordant le rôle admin | Si cette valeur exacte apparaît dans l'attribut rôle/groupe, le compte devient `admin` ; sinon il obtient le rôle par défaut | vide | non | la chaîne exacte de groupe/rôle de votre IdP (ex. `ts6-admins`) |

**Notes de comportement :**

- **Clé d'identité :** les comptes sont associés sur le **NameID** SAML — configurez un format de NameID **persistant** sur l'IdP. Un NameID *transitoire* change à chaque connexion et créerait un nouveau compte à chaque fois.
- **Synchronisation des rôles :** le rôle est **réévalué à chaque connexion** (l'IdP fait autorité). Une promotion manuelle effectuée dans l'application est écrasée à la connexion SSO suivante.
- **MFA :** la vérification MFA de l'application s'applique toujours après une assertion valide (si le compte a le MFA activé). Les comptes SSO n'ont **pas de mot de passe local** et ne peuvent pas utiliser les flux de mot de passe local / changement de mot de passe.
- **Posture de sécurité (v1) :** la signature de l'assertion est **obligatoire**, l'audience doit être égale à l'URL de métadonnées SP, et la validation anti-rejeu de `InResponseTo` est appliquée. Le SP ne signe **pas** ses AuthnRequests. L'import des métadonnées de l'IdP par URL/XML n'est pas encore câblé — saisissez manuellement l'URL SSO et le certificat.

**Mappage rapide Authentik :** *URL SSO de l'IdP* = **SSO URL (Redirect)** du fournisseur ; *Certificat de signature de l'IdP* = **Signing Certificate** du fournisseur ; *Entity ID de l'IdP* = **Issuer** du fournisseur. Pour le mappage admin, exposez un attribut groupes (Property Mapping) et définissez **Valeur accordant le rôle admin** avec le nom de votre groupe admin.

## Prérequis

- Serveur TeamSpeak avec **WebQuery HTTP** activé (pas raw/telnet)
- Clé API WebQuery (générée via `apikeyadd` ou les outils d'administration du serveur)
- Accès SSH au serveur TS (uniquement nécessaire pour les déclencheurs d'événements dans les flux de bots)
- `yt-dlp` et `ffmpeg` installés sur le backend (inclus dans l'image Docker)

## Dépannage

### Accès au serveur TeamSpeak perdu après une mise à jour

Si TS6 Manager ne parvient soudainement plus à joindre votre serveur TeamSpeak — clé API invalide, connexion SSH refusée, timeouts, bannissements anti-flood — la mise à jour du serveur a probablement fait expirer la clé API, régénéré le mot de passe `serveradmin` ou réinitialisé la configuration query. Suivez le guide de récupération pas à pas : **[Récupérer l'accès à votre serveur TeamSpeak](docs/recover-server-access.fr.md)**.

## Licence

MIT
