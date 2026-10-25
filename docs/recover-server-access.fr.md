# Récupérer l'accès à votre serveur TeamSpeak (WebQuery / SSH)

[English](recover-server-access.md) · **Français**

TS6 Manager communique avec votre serveur TeamSpeak par deux canaux, tous deux
configurés sous **Settings → Connections** :

| Canal | Sert à | Identifiant |
|-------|--------|-------------|
| WebQuery (HTTP, port par défaut `10080`) | tous les appels API : dashboard, salons, clients, logs… | clé API (`x-api-key`) |
| SSH query (port par défaut `10022`) | événements serveur en direct (déclencheurs d'événements des bot flows) | utilisateur query + mot de passe (généralement `serveradmin`) |

Après une **mise à jour ou une recréation du conteneur** du serveur TeamSpeak,
il est courant de perdre l'un ou l'autre, typiquement parce que :

1. **La clé API a expiré** — `apikeyadd` crée des clés avec une durée de vie
   par défaut de **14 jours** si vous n'avez pas passé `lifetime=0`.
2. **Le volume de données du serveur a été recréé** — un `/var/tsserver` neuf
   signifie une base de données vierge : toutes les clés API ont disparu et le
   mot de passe `serveradmin` a été régénéré.
3. **La protection anti-flood query a banni l'IP du manager** — les tentatives
   de reconnexion après la mise à jour ont compté comme du flood (erreur
   WebQuery id `524`).
4. **WebQuery ou SSH query n'est plus activé** — le nouveau conteneur a été
   démarré sans les variables d'environnement `TSSERVER_QUERY_*`.

Suivez les étapes ci-dessous dans l'ordre. Les commandes supposent un serveur
TeamSpeak 6 sous Docker dans un conteneur nommé `teamspeak-server` ; adaptez
l'hôte, les ports et le nom du conteneur à votre installation.

## Étape 0 — Identifier ce qui est cassé

Testez WebQuery avec la clé API actuellement configurée dans TS6 Manager :

```bash
curl -s -H "x-api-key: VOTRE_CLE_ACTUELLE" "http://HOTE_TS:10080/1/version"
```

| Résultat | Signification | Aller à |
|----------|---------------|---------|
| `"code": 0` avec les infos de version | La clé API est bonne — le problème vient du SSH ou d'un ban anti-flood | Étape 3 / Étape 4 |
| Une erreur mentionnant la clé API / les permissions | Clé expirée, supprimée, ou base réinitialisée | Étape 1 |
| Connection refused / timeout | WebQuery désactivé, mauvais port, ou pare-feu | Étape 5 |
| Coupures après quelques essais, ou erreur id `524` | Ban de la protection anti-flood | Étape 4 |

Testez ensuite le SSH query (nécessaire uniquement si vous utilisez les
déclencheurs d'événements des bot flows) :

```bash
ssh -p 10022 serveradmin@HOTE_TS
# puis saisissez le mot de passe query admin
```

`Permission denied` signifie que le mot de passe est incorrect (ou a été
régénéré) → Étape 1.

## Étape 1 — Reprendre l'accès query admin (`serveradmin`)

Si vous connaissez encore le mot de passe **query** de `serveradmin`, passez à
l'Étape 2.

Sinon, réinitialisez-le avec le mécanisme officiel. Dans le fichier compose du
serveur TeamSpeak (ou les options `docker run`), ajoutez :

```yaml
services:
  teamspeak-server:
    environment:
      TSSERVER_QUERY_ADMIN_PASSWORD: "un-mot-de-passe-fort-de-votre-choix"
```

puis recréez le conteneur :

```bash
docker compose up -d teamspeak-server
```

Tant que cette variable est définie, elle **est** le mot de passe query de
`serveradmin`. La laisser en permanence dans le compose est le moyen le plus
simple de garantir qu'une future mise à jour ne pourra plus jamais vous
bloquer (voir la checklist de prévention plus bas).

> Astuce : lors d'un **premier** démarrage (volume de données vierge), le
> serveur affiche aussi des identifiants initiaux — clé de privilège, etc. —
> dans les logs du conteneur :
> `docker logs teamspeak-server 2>&1 | grep -iE "token|password|apikey"`

## Étape 2 — Créer une nouvelle clé API WebQuery

Connectez-vous en SSH query et créez une clé avec le scope `manage` qui
n'expire jamais :

```bash
ssh -p 10022 serveradmin@HOTE_TS
apikeyadd scope=manage lifetime=0
quit
```

La réponse contient `apikey=...`. **Copiez-la immédiatement — elle n'est
affichée qu'une seule fois.**

Remarques :

- `lifetime=0` = n'expire jamais. Sans ce paramètre, la clé meurt au bout de
  **14 jours** — la cause classique du « le manager a cessé de fonctionner
  deux semaines après l'installation ».
- Si le SSH query est désactivé, activez-le d'abord sur le conteneur TeamSpeak
  avec `TSSERVER_QUERY_SSH_ENABLED=1` (et `TSSERVER_QUERY_SSH_PORT` pour un
  port non standard), puis recréez le conteneur.
- S'il vous reste une *autre* clé valide avec le scope `manage`, vous pouvez
  aussi renouveler vos clés via WebQuery, sans SSH :
  `curl -H "x-api-key: ANCIENNE_CLE" "http://HOTE_TS:10080/apikeyadd?scope=manage&lifetime=0"`

## Étape 3 — Mettre à jour les identifiants dans TS6 Manager

1. Connectez-vous à TS6 Manager, ouvrez **Settings → Connections**.
2. Éditez l'entrée de votre serveur :
   - **API key** : collez la nouvelle clé de l'Étape 2.
   - **SSH username / password** : `serveradmin` + le mot de passe query admin
     de l'Étape 1 (requis uniquement pour les déclencheurs d'événements des
     bot flows).
3. Enregistrez. Le pool de connexions applique les changements immédiatement —
   aucun redémarrage du backend n'est nécessaire. Le dashboard doit se
   remplir en quelques secondes.

## Étape 4 — Lever un ban de la protection anti-flood

Si les identifiants sont corrects mais que les connexions tombent quand même
(erreur id `524`, « banned », ou coupures après une rafale de requêtes), l'IP
du manager a déclenché la protection anti-flood query de TeamSpeak.
Exemptez-la définitivement :

1. Créez un fichier d'allowlist dans le volume de données TeamSpeak, une IP ou
   un CIDR par ligne. Si le backend tourne sous Docker, le serveur TeamSpeak
   le voit avec l'**IP de la gateway Docker**, pas votre IP LAN — autorisez la
   plage Docker :

   ```
   # /var/tsserver/query_ip_allowlist.txt
   127.0.0.1
   172.16.0.0/12
   ```

2. Faites-le pointer par le serveur et redémarrez :

   ```yaml
   services:
     teamspeak-server:
       environment:
         TSSERVER_QUERY_ALLOW_LIST: "/var/tsserver/query_ip_allowlist.txt"
   ```

   ```bash
   docker compose up -d teamspeak-server
   ```

## Étape 5 — Vérifier que les interfaces query sont activées

Un conteneur recréé n'a que les interfaces que vous avez demandées. Vérifiez
l'environnement du serveur TeamSpeak :

| Variable | Rôle |
|----------|------|
| `TSSERVER_QUERY_HTTP_ENABLED=1` | WebQuery en HTTP (port `TSSERVER_QUERY_HTTP_PORT`, défaut `10080`) |
| `TSSERVER_QUERY_HTTPS_ENABLED=1` | WebQuery en HTTPS (défaut `10443` ; activez **Use HTTPS** sur la connexion dans TS6 Manager) |
| `TSSERVER_QUERY_SSH_ENABLED=1` | SSH query (défaut `10022`) — requis pour les déclencheurs d'événements |

Après tout changement : `docker compose up -d teamspeak-server`, puis rejouez
l'Étape 0 pour confirmer.

## Checklist de prévention

- Créez les clés API avec **`lifetime=0`** (ou planifiez une rotation avant
  l'expiration).
- Gardez `TSSERVER_QUERY_ADMIN_PASSWORD` défini dans le compose du serveur
  TeamSpeak pour que le mot de passe `serveradmin` survive à chaque mise à
  jour.
- Persistez `/var/tsserver` dans un **volume nommé** et ne le supprimez jamais
  lors des mises à jour (`docker compose pull && docker compose up -d` le
  conserve ; supprimer le volume efface les clés, les mots de passe et toute
  la base du serveur).
- Conservez le fichier d'allowlist query (Étape 4) dans le volume de données
  pour qu'il survive à la recréation du conteneur.
- Les lignes `rejecting myteamspeakid: revoke list out of date` parfois vues
  après une mise à jour sont **sans rapport** avec l'accès query/API — elles
  concernent la validation des identités myTeamSpeak et se résorbent
  généralement seules dès que le serveur parvient à télécharger sa liste de
  révocation.
