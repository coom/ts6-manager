#### DISCLAIMER: 
![AI Assisted](https://img.shields.io/badge/AI%20Assisted-Project-00ADD8?style=for-the-badge&logo=dependabot&logoColor=white)

# TS6 Manager

[English](README.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Español** · [Italiano](README.it.md)

Interfaz de gestión web para servidores TeamSpeak. Controla servidores virtuales, canales, clientes, permisos, bots de música, flujos de trabajo automatizados y widgets embebibles para tu servidor — todo desde el navegador. La interfaz está disponible en **inglés, francés, alemán, español e italiano**.

## Qué cambia esta versión

Evolución reforzada y orientada a la fiabilidad de [clusterzx/ts6-manager](https://github.com/clusterzx/ts6-manager):

**Cuentas y acceso**
- Autenticación de dos factores (TOTP) con códigos de recuperación de un solo uso; los administradores pueden exigir MFA por usuario y forzar un cambio de contraseña en el próximo inicio de sesión
- Opción "Equipo de confianza": omite la contraseña **y** el MFA en un dispositivo elegido durante 30 días mediante una cookie `httpOnly` revocable, con una lista de dispositivos que puedes revocar desde tu cuenta
- Política de contraseñas configurable (longitud mínima y complejidad)
- **SSO mediante SAML** — inicio de sesión único opcional junto al inicio de sesión local, con aprovisionamiento de cuentas just-in-time y roles asignados desde tu proveedor de identidad

**Integración con Discord**
- Puente Discord: comandos de barra diagonal (`/play`, `/skip`, `/queue`, …), notificaciones de conexión/salida a TeamSpeak y de presencia, y un panel de estadísticas del servidor en directo
- Notificaciones de AFK: publica en Discord cuando un usuario se pone AFK o vuelve en el canal vigilado
- El bot de música también puede transmitir audio a un canal de voz de Discord
- Restricción de quién puede ejecutar los comandos del bot a un conjunto específico de roles de Discord

**Multiidioma**
- Traducción completa de la interfaz en inglés, francés, alemán, español e italiano, recordada por usuario

**Spotify y diario**
- Los enlaces de Spotify se resuelven en YouTube para la reproducción, configurable desde la interfaz web
- Diario de conexiones de inicios de sesión web y TeamSpeak con GeoIP sin conexión, columnas ordenables/filtrables y bloqueo de IP con un clic (web y/o TeamSpeak)

**Fiabilidad**
- Grupo de conexiones autocurativo: las conexiones de servidor añadidas o editadas en la interfaz funcionan de inmediato — sin reiniciar el backend, nunca
- El cliente WebQuery reconstruye su transporte cuando su socket de keep-alive muere silenciosamente (NAT de Docker, reinicios del servidor), con un disyuntor que deja de alimentar el contador de flood de TS
- Respuestas del panel de control en caché 5 s en el servidor: N pestañas abiertas cuestan lo mismo que una
- Una fila de credenciales indescifrable ya no provoca un fallo en el arranque

**Bots de música**
- Reproducción de archivos en streaming: primer audio en ~200 ms, memoria constante (anteriormente toda la pista se decodificaba en RAM — ~690 MB para una mezcla de 1 h)
- Codificador opus nativo (`@discordjs/opus`, ~5-10× menos CPU) con reserva automática en WASM
- Pipeline de yt-dlp robusto: tiempos de espera estrictos, limpieza de artefactos obsoletos, descargas concurrentes deduplicadas, registro completo de errores, prioridad de CPU baja, actualización automática al iniciar el contenedor
- Cargar y Reproducir inicia la reproducción; los conteos de canciones de la lista de reproducción se mantienen actualizados

**Seguridad**
- El evaluador de expresiones seguro integrado reemplaza el `expr-eval` sin mantenimiento
- Autenticación de token de portador para la API del sidecar, contenedores reforzados, binarios comprometidos eliminados
- Dependencias actualizadas para eliminar todos los hallazgos de auditoría; ESLint + CI con GitHub Actions

**Despliegue**
- `docker compose up -d --build` compila desde el código fuente por defecto (`docker-compose.hub.yml` para las imágenes de Docker Hub del upstream)
- Tiempos de espera de nginx/cliente dimensionados para descargas largas de YouTube; arranque limpio y silencioso del contenedor

Construido sobre la **API HTTP WebQuery** (el sustituto de ServerQuery en las versiones modernas de TeamSpeak). Telnet no se usa ni está soportado.

![License](https://img.shields.io/badge/license-MIT-blue)

## Capturas de pantalla

### Panel de control
Vista general en directo de tu servidor: usuarios en línea, número de canales, tiempo de actividad, ping, gráfico de ancho de banda y capacidad del servidor de un vistazo.

![Dashboard](docs/dashboard.png)

### Bots de música
Ejecuta múltiples bots de música por servidor. Cada bot tiene su propia cola, control de volumen y estado de reproducción. Compatible con streams de radio, YouTube y una biblioteca musical local. Los usuarios en el canal del bot pueden controlarlo mediante comandos de texto (`!radio`, `!play`, `!vol`, etc.).

![Music Bots](docs/musicbots.png)

### Motor de flujos de bot
Editor visual basado en nodos para construir flujos de trabajo automatizados del servidor. Arrastra disparadores, condiciones y acciones sobre el lienzo, conéctalos e impleméntalos. Compatible con eventos TS3, programaciones cron, webhooks y comandos de chat como disparadores.

![Flow Editor](docs/flow-editor.png)

### Plantillas de flujo
Empieza rápidamente con plantillas de flujo predefinidas. Cubre casos de uso comunes como la creación de canales temporales, movimientos por inactividad (AFK), expulsión por inactividad, contadores en línea y protección de grupos. Un clic para importar y después personaliza según tus necesidades.

![Flow Templates](docs/flow-templates.png)

## Características

### Autenticación y cuentas
- Asistente de configuración para la cuenta de administrador inicial (sin credenciales por defecto)
- Autenticación de dos factores (TOTP) compatible con cualquier aplicación de autenticación, con códigos de recuperación de un solo uso
- Los administradores pueden exigir MFA por usuario y forzar un cambio de contraseña en el próximo inicio de sesión
- Opción "Equipo de confianza": una cookie revocable de 30 días que omite tanto la contraseña como el MFA en ese dispositivo; los dispositivos de confianza se listan y pueden revocarse desde tu cuenta
- Política de contraseñas configurable (longitud mínima y complejidad)
- Idioma de la interfaz por usuario (inglés, francés, alemán, español, italiano)
- SSO opcional mediante SAML 2.0 (iniciado por el SP), mostrado como un botón "Iniciar sesión mediante SSO" junto al inicio de sesión local
- Aprovisionamiento de cuentas just-in-time (activable) con el rol asignado a partir de un grupo o atributo SAML, reevaluado en cada inicio de sesión, además de un rol predeterminado configurable
- El control de MFA sigue aplicándose después de un inicio de sesión SAML; las cuentas SSO no tienen contraseña local y no pueden usar los flujos de contraseña local

### Gestión del servidor
- Panel de control con estadísticas en directo, gráfico de ancho de banda y resumen de capacidad
- Lista de servidores virtuales con controles de inicio/detención
- Árbol de canales con ordenación mediante arrastrar y soltar
- Lista de clientes con acciones de expulsión, baneo, movimiento y aviso
- Gestión de grupos de servidores y canales
- Editor de permisos (a nivel de servidor, canal, cliente y grupo)
- Gestión de la lista de baneos
- Gestión de tokens/claves de privilegio
- Visualizador de quejas
- Sistema de mensajes sin conexión
- Visor de registros del servidor con filtrado
- Explorador de archivos de canal con carga/descarga
- Configuración a nivel de instancia

### Bots de música
- Múltiples bots por servidor, cada uno con cola y reproducción independientes
- Streaming de estaciones de radio con metadatos ICY y actualizaciones de título en directo
- Reproducción de YouTube mediante yt-dlp (búsqueda, descarga, cola)
- Compatibilidad con enlaces de Spotify (metadatos de pista/álbum/lista de reproducción resueltos en YouTube)
- Gestión de biblioteca musical (subida, organización, listas de reproducción)
- Control de volumen, pausa, saltar, anterior, aleatorio, repetición
- Compatibilidad con audio estéreo con pacing estable de 20 ms
- Reconexión automática con retroceso exponencial en caso de desconexión
- Comandos de texto en el canal para control manos libres, incluyendo listado de canales y comandos de movimiento
- Restringe los comandos de música y de administrador a grupos específicos del servidor de TeamSpeak
- Notificación opcional de reproducción actual publicada en el canal de TeamSpeak del bot
- Historial de solicitudes de música

### Integración con Discord
- Bot puente de Discord con comandos de barra diagonal: `/play`, `/stop`, `/pause`, `/skip`, `/next`, `/prev`, `/queue`, `/volume`, `/nowplaying`, `/stats`, `/join`, `/leave`
- Restringe los comandos a roles de Discord seleccionados (administradores/propietario siempre permitidos; vacío = abierto a todos)
- Notificaciones de conexión/salida a TeamSpeak y de presencia por canal, con estilo de embed o texto plano y eliminación automática opcional
- Notificaciones de AFK: publica un mensaje personalizable cuando un usuario se pone AFK o vuelve en el canal vigilado (comparte el estilo de embed/texto plano y la eliminación automática)
- Panel de estadísticas del servidor en directo actualizado en un canal de Discord
- El bot de música puede transmitir su audio a un canal de voz de Discord
- Disparador de mensajes de Discord y acción de envío de mensajes disponible en el Motor de flujos de bot

### Streaming de vídeo
- Streaming de vídeo en directo desde YouTube, Twitch o URLs directas a canales de TeamSpeak
- Basado en WebRTC con retransmisión mediante sidecar en Go (Pion) para entrega de baja latencia
- Preajustes de calidad (480p, 720p, 1080p)
- Vista previa en el navegador con reproducción WebRTC
- Sincronización A/V mediante RTCP Sender Reports
- Se ejecuta como un contenedor Docker sidecar junto al backend

### Motor de flujos de bot
- Editor de flujos visual con lienzo de nodos de arrastrar y soltar
- Disparadores: eventos TS3, programaciones cron, webhooks (con secretos obligatorios), comandos de chat (globales o específicos de canal), mensajes de Discord
- Acciones: expulsión, baneo, movimiento, mensaje, aviso, crear/editar/eliminar canal, peticiones HTTP, comandos WebQuery, mensajes de Discord
- Condiciones, variables, retrasos, bucles, registro
- Nombres de canal animados (texto rotativo con temporizador)
- Sistema de marcadores de posición con filtros y expresiones
- Plantillas predefinidas para tareas de automatización comunes

### Diario de conexiones
- Registra los inicios de sesión web y TeamSpeak con marca de tiempo, nombre de usuario e IP
- Enriquecimiento GeoIP sin conexión (sin llamadas externas)
- Columnas ordenables y filtros por columna
- Baneo de IP con un clic desde el diario — en la aplicación web, en el servidor TeamSpeak, o en ambos

### Widgets del servidor
- Banner de estado del servidor embebible para sitios web y foros
- Acceso público basado en tokens (sin autenticación requerida)
- Disponible como página en directo, SVG o imagen PNG
- Temas oscuro y claro
- Configurable: mostrar/ocultar árbol de canales y lista de clientes

### Seguridad
- Cifrado AES-256-GCM para credenciales almacenadas (claves de API, contraseñas SSH)
- Autenticación de dos factores (TOTP) con códigos de recuperación; exigible por el administrador por usuario
- Política de contraseñas configurable y cambio forzado de contraseña en el próximo inicio de sesión
- Protección SSRF en todas las solicitudes HTTP salientes, URLs de FFmpeg y redirecciones de webhooks
- Limitación de velocidad en los endpoints de autenticación
- JWT de acceso + rotación de tokens de actualización con detección de reutilización
- SSO SAML con validación de aserciones firmadas, vinculación de audiencia, protección contra repetición y códigos de inicio de sesión de un solo uso
- Control de acceso basado en roles (admin / viewer)
- Control de acceso por servidor para configuraciones multi-inquilino
- Acceso a comandos de Discord restringido por rol
- Lista blanca de comandos WebQuery en flujos de bot (bloquea comandos destructivos)
- Conexiones WebSocket autenticadas

### Configuración y administración
- Gestión de usuarios con aplicación de MFA y cambio forzado de contraseña
- Configuración de integración con Discord, Spotify y YouTube
- Configuración del proveedor de identidad SSO / SAML: URL de SSO del IdP y certificado de firma, asignación de atributos y roles, activación del aprovisionamiento automático y rol predeterminado (los metadatos del SP y las URL de ACS que hay que configurar en el IdP se muestran en la pestaña)
- Configuración de comandos de música: restringe los comandos por grupo de servidor de TeamSpeak y activa o desactiva la notificación de reproducción actual
- Gestión de archivos de cookies de yt-dlp para acceder a contenido de YouTube con restricción de edad o solo para miembros (sube un archivo o pega directamente en la interfaz)
- Gestión del diario de conexiones y de baneos de IP
- Panel de configuración solo para administradores

## Arquitectura

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

**Cuatro paquetes** en un monorepo pnpm:

| Paquete | Descripción |
|---------|-------------|
| `@ts6/common` | Tipos compartidos, constantes, utilidades |
| `@ts6/backend` | API Express, cliente WebQuery, motor de bots, bots de voz, puente Discord, widgets |
| `@ts6/frontend` | React SPA con Vite, TailwindCSS, shadcn/ui |
| `sidecar` | Retransmisión de medios WebRTC en Go (Pion) para streaming de vídeo |

El backend delega todas las llamadas a la API de TeamSpeak. El frontend nunca tiene acceso directo a claves de API ni credenciales del servidor.

## Pila tecnológica

**Frontend:** React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query + Table, React Flow, Recharts, Zustand, react-i18next

**Backend:** Node.js, Express, Prisma (SQLite), autenticación JWT, TOTP MFA, cliente HTTP WebQuery, listener de eventos SSH, discord.js

**Voz/Audio:** Cliente de protocolo de voz TS3 personalizado (UDP), codificación Opus, FFmpeg, yt-dlp

**Streaming de vídeo:** Sidecar en Go con Pion WebRTC v4, RTCP Sender Reports para sincronización A/V

## Inicio rápido (Docker)

La compilación desde el código fuente es la opción predeterminada en este fork — `docker-compose.yml`
compila las tres imágenes localmente. Para ejecutar las imágenes de Docker Hub del upstream
en su lugar, usa [`docker-compose.hub.yml`](docker-compose.hub.yml) (nota: esas
imágenes no contienen el refuerzo y las correcciones de este fork).

1. Clona el repositorio
2. Crea un archivo `.env` en la raíz del repositorio:

```env
JWT_SECRET=your-random-secret-at-least-32-characters
ENCRYPTION_KEY=another-random-secret-for-credential-encryption
SIDECAR_TOKEN=a-third-random-secret-for-the-media-sidecar
```

Genera valores seguros:

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "SIDECAR_TOKEN=$(openssl rand -base64 32)" >> .env
```

3. Compila e inicia el stack:

```bash
docker compose up -d --build
```

4. Abre `http://localhost:3000/setup` y crea tu cuenta de administrador
5. Inicia sesión y añade la conexión a tu servidor TeamSpeak en **Configuración → Conexiones** (host, puerto WebQuery, clave de API)

> `JWT_SECRET` es **obligatorio** — el backend se negará a arrancar en producción sin él.
> `ENCRYPTION_KEY` es **obligatorio en producción** y debe ser diferente de `JWT_SECRET`. Los valores cifrados antes de este requisito (con la reserva de `JWT_SECRET`) siguen siendo legibles y se vuelven a cifrar en el próximo guardado.
> `SIDECAR_TOKEN` autentica el backend contra la API del sidecar multimedia. Sin él, el sidecar registra una advertencia y acepta peticiones no autenticadas (aceptable solo en una red aislada).

### Ejecutar las imágenes de Docker Hub del upstream

```bash
docker compose -f docker-compose.hub.yml up -d
```

Las imágenes de Hub escuchan en puertos internos diferentes a las compiladas localmente
— nunca mezcles contenedores de ambos archivos compose en el mismo stack.

### Coolify / Proxy inverso

Usa [`docker-compose.coolify.yml`](docker-compose.coolify.yml) como punto de partida. Diferencias clave respecto al compose estándar:

- Sin sección `ports` — el proxy inverso gestiona el enrutamiento
- Establece el dominio en el servicio **frontend** en Coolify (puerto 8080 — nginx se ejecuta sin privilegios)
- Si tu servidor TS se ejecuta en una red Docker separada, añádela como red externa en el servicio backend:

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

## Desarrollo

Requisitos: Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm dev          # starts backend + frontend in parallel
```

El backend se ejecuta en `:3001`, el frontend en `:5173` (servidor de desarrollo Vite).

### Base de datos

Prisma con SQLite. En la primera ejecución:

```bash
cd packages/backend
npx prisma migrate deploy
```

Las imágenes Docker gestionan las migraciones automáticamente al arrancar.

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `JWT_SECRET` | — | **Obligatoria.** Secreto para la firma JWT. Debe establecerse en producción. |
| `ENCRYPTION_KEY` | — | **Obligatoria en producción**, debe ser diferente de `JWT_SECRET`. Clave dedicada para el cifrado de credenciales AES-256-GCM. En desarrollo usa `JWT_SECRET` como reserva. |
| `PORT` | `3001` | Puerto del backend |
| `DATABASE_URL` | `file:./data/ts6webui.db` | Ruta de la base de datos SQLite |
| `JWT_ACCESS_EXPIRY` | `15m` | Duración del token de acceso |
| `JWT_REFRESH_EXPIRY` | `7d` | Duración del token de actualización |
| `FRONTEND_URL` | `http://localhost:3000` | Origen CORS |
| `MUSIC_DIR` | `/data/music` | Directorio para los archivos de música descargados |
| `SIDECAR_URL` | — | Opcional. URL completa del servicio sidecar WebRTC (p. ej. `http://ts6-sidecar:9800`). Establecer en Docker cuando el sidecar se ejecuta como contenedor separado. |
| `SIDECAR_TOKEN` | — | Secreto compartido entre el backend y el sidecar. El sidecar rechaza las llamadas a la API sin `Authorization: Bearer <token>` cuando está establecido. |
| `SIDECAR_LISTEN_ADDR` | `127.0.0.1` | Interfaz a la que se vincula la API del sidecar (`0.0.0.0` dentro de Docker, establecido por la imagen). No publiques nunca el puerto 9800. |
| `YT_COOKIE_FILE` | — | Opcional. Ruta a un archivo cookies.txt en formato Netscape para yt-dlp. También puede gestionarse mediante **Configuración → YouTube** en la interfaz. |

## Variables de entorno del Sidecar (Streaming de vídeo)

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `VIDEO_QUEUE_SIZE` | `2048` | Tamaño de la cola RTP de vídeo |
| `AUDIO_QUEUE_SIZE` | `4096` | Tamaño de la cola RTP de audio |
| `SYNC_PLAYOUT_BUFFER_MS` | `4` | Pequeño búfer de reproducción utilizado por la lógica de pacing adaptativo |
| `SYNC_VIDEO_BIAS_MS` | `4` | Retención adicional opcional para vídeo para ajustar la sincronización |
| `AUDIO_DELAY_MS` | `0` | Opción de retraso de audio manual/heredada. Con la lógica de pacing actual se espera que permanezca en 0 |
| `SIDECAR_DEBUG_LOGS` | `1` | Habilita el registro de depuración detallado para detalles en tiempo de ejecución de alta frecuencia |
| `VIDEO_READ_RTP_BUFFER` | `4194304` | Búfer de socket OS UDP para el puerto de vídeo |
| `AUDIO_READ_RTP_BUFFER` | `1048576` | Búfer de socket OS UDP para el puerto de audio |
| `VIDEO_BUFSIZE` | `1M` | Búfer de vídeo FFmpeg |

## Comandos de texto del bot de música

Cuando un bot de música está conectado a un canal, los usuarios de ese canal pueden controlarlo mediante el chat:

| Comando | Descripción |
|---------|-------------|
| `!radio` | Listar las estaciones de radio disponibles |
| `!radio <id>` | Reproducir una estación de radio |
| `!play <url>` | Reproducir desde una URL de YouTube |
| `!play` | Reanudar la reproducción en pausa |
| `!spotify <url>` | Reproducir desde un enlace de pista/álbum/lista de reproducción de Spotify |
| `!queue <url>` / `!add <url>` | Añadir una pista a la cola |
| `!stop` | Detener la reproducción |
| `!pause` | Alternar pausa/reanudar |
| `!skip` / `!next` | Pista siguiente en la cola |
| `!prev` | Pista anterior |
| `!vol` | Mostrar el volumen actual |
| `!vol <0-100>` | Establecer el volumen |
| `!np` / `!nowplaying` | Mostrar la pista actual |
| `!info` | Pista actual con el progreso de reproducción |
| `!help` / `!aide` | Listar los comandos disponibles |
| `!channels` | Listar los canales con sus ID |
| `!move <user> <channel>` | Mover a un usuario a un canal (admin) |
| `!moveall <channel>` | Mover a todos a un canal (admin) |
| `!notif` | Alternar la notificación de reproducción actual (admin) |

`!move`, `!moveall` y `!notif` son comandos de administrador; el acceso a los comandos de música y de administrador puede restringirse a grupos específicos del servidor de TeamSpeak en **Configuración → Comandos de música**.

## Configuración SSO / SAML

Inicio de sesión único (SSO) SAML 2.0 opcional, iniciado por el SP, que funciona **junto con** el inicio de sesión local. Se configura en **Configuración → SSO / SAML** (solo administradores). El SSO solo se activa cuando **Habilitar SSO** está activado **y** tanto la **URL de SSO del IdP** como el **certificado de firma del IdP** están rellenados; hasta entonces, el botón "Iniciar sesión con SSO" permanece oculto y los endpoints SAML están inactivos.

**Proporciona esto a tu proveedor de identidad (se muestra de solo lectura en la pestaña):**

| Valor | Qué es | Cómo se construye |
|-------|--------|--------------------|
| URL de metadatos del SP | El EntityID / audiencia del proveedor de servicios que el IdP debe apuntar | `<FRONTEND_URL>/api/auth/saml/metadata` |
| URL ACS | Assertion Consumer Service — donde el IdP envía (POST) la respuesta SAML | `<FRONTEND_URL>/api/auth/saml/acs` |

`<FRONTEND_URL>` es la variable de entorno `FRONTEND_URL` (el origen público de tu aplicación).

**Campos:**

| Campo | Descripción | Predeterminado | Obligatorio | Valores admisibles |
|-------|-------------|-----------------|-------------|----------------------|
| Habilitar SSO (SAML) | Interruptor principal. Cuando está desactivado, el SSO queda oculto y todos los endpoints SAML devuelven 404 | `off` | — | on / off |
| ID de entidad del IdP | El emisor / EntityID del proveedor de identidad. Es informativo, para referencia; la aserción se confía mediante el certificado + el enlace de audiencia | vacío | no | cualquier cadena (normalmente una URL/URN) |
| URL de SSO del IdP | El endpoint SSO de **redirección** SAML del IdP al que se envía la solicitud de inicio de sesión (AuthnRequest) | vacío | **sí** (para habilitar) | una URL `https://` |
| Certificado de firma del IdP | El certificado de firma público X.509 del IdP utilizado para verificar la firma de la aserción. Solo escritura: se almacena cifrado, se muestra únicamente como establecido/no establecido | vacío | **sí** (para habilitar) | PEM (`-----BEGIN CERTIFICATE-----…`) o cuerpo en base64 sin formato (se envuelve automáticamente) |
| Aprovisionar cuentas automáticamente | Crear una cuenta local en el primer inicio de sesión SSO correcto (JIT). Cuando está desactivado, se rechaza un inicio de sesión SAML de una cuenta desconocida | `on` | no | on / off |
| Rol predeterminado para cuentas SSO | Rol asignado cuando ningún mapeo de administrador coincide (véase el atributo de rol más abajo) | `viewer` | no | `viewer` o `admin` |
| Atributo: nombre de usuario | Atributo de la aserción asignado al nombre de usuario de la cuenta. Si falta, recurre a la parte local del correo electrónico y luego al NameID | reclamación de nombre de usuario de Authentik (`http://schemas.goauthentik.io/2021/02/saml/username`) | no | cualquier nombre de atributo que envíe tu IdP |
| Atributo: correo electrónico | Atributo de la aserción asignado al correo electrónico | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | no | cualquier nombre de atributo |
| Atributo: nombre para mostrar | Atributo de la aserción asignado al nombre para mostrar (recurre al nombre de usuario) | reclamación de nombre para mostrar de Authentik (`http://schemas.goauthentik.io/2021/02/saml/displayname`) | no | cualquier nombre de atributo |
| Atributo: rol / grupo | Atributo de la aserción (a menudo `groups`) cuyos valores se comprueban para el mapeo de administrador. Déjalo vacío para dar a todos los usuarios SSO el rol predeterminado | vacío | no | cualquier nombre de atributo |
| Valor que concede el rol de administrador | Si este valor exacto aparece en el atributo de rol/grupo, la cuenta se convierte en `admin`; de lo contrario, obtiene el rol predeterminado | vacío | no | la cadena exacta de grupo/rol de tu IdP (p. ej. `ts6-admins`) |

**Notas de comportamiento:**

- **Clave de identidad:** las cuentas se emparejan mediante el **NameID** de SAML; configura un formato de NameID **persistente** en el IdP. Un NameID *transitorio* cambia en cada inicio de sesión y crearía una cuenta nueva cada vez.
- **Sincronización de rol:** el rol se **reevalúa en cada inicio de sesión** (el IdP es la autoridad). Un ascenso manual realizado dentro de la aplicación se sobrescribe en el siguiente inicio de sesión SSO.
- **MFA:** la verificación de MFA de la aplicación sigue aplicándose después de una aserción válida (si la cuenta tiene la MFA habilitada). Las cuentas SSO **no tienen contraseña local** y no pueden usar los flujos de contraseña local / cambio de contraseña.
- **Postura de seguridad (v1):** la firma de la aserción es **obligatoria**, la audiencia debe ser igual a la URL de metadatos del SP, y se aplica la validación contra repetición de `InResponseTo`. El SP **no** firma sus AuthnRequests. La importación de metadatos del IdP por URL/XML aún no está implementada; introduce la URL de SSO y el certificado manualmente.

**Mapeo rápido de Authentik:** *URL de SSO del IdP* = el **SSO URL (Redirect)** del proveedor; *Certificado de firma del IdP* = el **Signing Certificate** del proveedor; *ID de entidad del IdP* = el **Issuer** del proveedor. Para el mapeo de administrador, expón un atributo de grupos (Property Mapping) y establece **Valor que concede el rol de administrador** al nombre de tu grupo de administradores.

## Requisitos

- Servidor TeamSpeak con **WebQuery HTTP** habilitado (no raw/telnet)
- Clave de API WebQuery (generada mediante `apikeyadd` o las herramientas de administración del servidor)
- Acceso SSH al servidor TS (solo necesario para los disparadores de eventos de flujos de bot)
- `yt-dlp` y `ffmpeg` instalados en el backend (incluidos en la imagen Docker)

## Solución de problemas

### Acceso al servidor TeamSpeak perdido tras una actualización

Si TS6 Manager de repente no puede conectar con su servidor TeamSpeak — clave de API inválida, inicio de sesión SSH rechazado, timeouts, bloqueos anti-flood — lo más probable es que la actualización del servidor haya hecho expirar la clave de API, regenerado la contraseña de `serveradmin` o restablecido la configuración query. Siga la guía de recuperación paso a paso: **[Recovering access to your TeamSpeak server](docs/recover-server-access.md)** (en inglés).

## Licencia

MIT
