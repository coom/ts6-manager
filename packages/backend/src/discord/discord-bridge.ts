import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
  type GuildMember,
} from 'discord.js';
import { DiscordVoiceRelay } from './discord-voice.js';
import type { PrismaClient, DiscordSettings } from '../../generated/prisma/index.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';
import type { VoiceBotManager } from '../voice/voice-bot-manager.js';
import type { VoiceBot } from '../voice/voice-bot.js';
import type { QueueItem } from '../voice/playlist/queue.js';
import { EventBridge } from '../bot-engine/event-bridge.js';
import { decrypt } from '../utils/crypto.js';
import { resolvePlayQuery, downloadAndEnqueue, isSpotifyUrl, loadSpotifyConfig, enqueueSpotify } from '../voice/music-ops.js';
import { fetchLyrics, lyricsInputFromTrack } from '../voice/lyrics.js';
import { isCommandAllowed, parseRoleIds } from './command-permissions.js';
import {
  clientConnectedEmbed,
  clientDisconnectedEmbed,
  channelPresenceEmbed,
  actionEmoji,
  renderTemplate,
  nowPlayingEmbed,
  statsEmbed,
  queueEmbed,
  lyricsEmbeds,
  DEFAULT_JOIN_TEMPLATE,
  DEFAULT_LEAVE_TEMPLATE,
  awayStatusEmbed,
  DEFAULT_AWAY_TEMPLATE,
  DEFAULT_BACK_TEMPLATE,
  type ServerStats,
} from './embeds.js';
import { diffAwayState, mapAwayClients, type AwayClient } from './away-diff.js';
import {
  isMusicBotClient,
  countChannelClients,
  stripCountSuffix,
  formatCountNickname,
  type MusicBotIdentity,
} from './member-count.js';

const STATS_PANEL_INTERVAL_MS = 60_000;
const AWAY_POLL_INTERVAL_MS = 10_000;
const NICKNAME_REFRESH_INTERVAL_MS = 60_000;

export interface DiscordStatus {
  enabled: boolean;
  running: boolean;
  error: string | null;
  guildName: string | null;
  warnings: string[];
}

export interface DiscordFlowMessage {
  channelId: string;
  content: string;
  authorId: string;
  authorName: string;
}

/**
 * Bridges Discord and the TS manager: slash commands for music and stats,
 * TS connect/disconnect notifications, now-playing announcements, and an
 * optional auto-updated stats panel. Fully hot-reloadable from the settings.
 */
export class DiscordBridge {
  private client: Client | null = null;
  private settings: DiscordSettings | null = null;
  private eventBridge: EventBridge | null = null;
  private voiceRelay: DiscordVoiceRelay | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private awayTimer: ReturnType<typeof setInterval> | null = null;
  private nicknameTimer: ReturnType<typeof setInterval> | null = null;
  private baseNickname: string | null = null;
  private lastAppliedNickname: string | null = null;
  private nicknameWarned = false;
  private clientAwayState = new Map<string, boolean>(); // clid → isAway
  private nowPlayingListeners = new Map<number, (item: QueueItem) => void>();
  private clientNicknames = new Map<string, string>(); // clid → nickname (for leave events)
  private clientChannels = new Map<string, string>(); // clid → current channel id (for channel mode)
  private channelNameCache: { at: number; names: Map<string, string> } | null = null;
  private lastError: string | null = null;
  private warnings: string[] = [];
  private startEpoch = 0; // guards async callbacks across reloads
  private messageHandler: ((msg: DiscordFlowMessage) => void) | null = null;

  /** Register a handler for channel messages (used by the bot-flow engine). */
  setMessageHandler(handler: ((msg: DiscordFlowMessage) => void) | null): void {
    this.messageHandler = handler;
  }

  /** Send a plain message to a Discord channel (used by flow actions). */
  async sendFlowMessage(channelId: string, content: string): Promise<void> {
    await this.postToChannel(channelId, { content });
  }

  constructor(
    private prisma: PrismaClient,
    private pool: ConnectionPool,
    private voiceBotManager: VoiceBotManager,
  ) {
    // Attach now-playing listeners to bots created after startup too, and
    // re-attach the voice relay when the default music bot is recreated
    this.voiceBotManager.onBotCreated((botId, bot) => {
      if (this.client) this.attachNowPlaying(botId, bot);
      if (this.voiceRelay && this.settings?.defaultMusicBotId === botId) {
        this.voiceRelay.attachBot(bot);
      }
    });
  }

  async start(): Promise<void> {
    const epoch = ++this.startEpoch;
    this.lastError = null;
    this.warnings = [];

    this.settings = await this.prisma.discordSettings.findFirst();
    if (!this.settings?.enabled || !this.settings.botToken) return;

    let token: string;
    try {
      token = decrypt(this.settings.botToken);
    } catch {
      this.lastError = 'Stored bot token cannot be decrypted — re-enter it';
      return;
    }

    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
    if (this.settings.flowMessageTrigger) {
      // Privileged: must also be enabled in the Discord developer portal.
      intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
    }
    const client = new Client({ intents, allowedMentions: { parse: [] } });
    this.client = client;

    client.on(Events.ClientReady, () => {
      if (epoch !== this.startEpoch) return;
      console.log(`[Discord] Connected as ${client.user?.tag}`);
      this.registerCommands().catch((err) => {
        this.lastError = `Slash command registration failed: ${err.message}`;
        console.error(`[Discord] ${this.lastError}`);
      });
      this.startStatsPanel();
      this.startNicknameUpdater();
      this.startVoiceRelay().catch((err) => {
        console.error(`[Discord] Voice relay start failed: ${err.message}`);
      });
    });

    client.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      this.handleCommand(interaction).catch(async (err) => {
        console.error(`[Discord] /${interaction.commandName} failed: ${err.message}`);
        const msg = { content: `❌ ${err.message}` };
        try {
          if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
          else await interaction.reply({ ...msg, ephemeral: true });
        } catch { /* interaction expired */ }
      });
    });

    if (this.settings.flowMessageTrigger) {
      client.on(Events.MessageCreate, (message) => {
        if (epoch !== this.startEpoch) return;
        if (message.author?.bot) return; // ignore bots (incl. ourselves)
        if (!message.guildId) return; // ignore DMs
        this.messageHandler?.({
          channelId: message.channelId,
          content: message.content || '',
          authorId: message.author.id,
          authorName: message.author.username,
        });
      });
    }

    client.on(Events.Error, (err) => {
      console.error(`[Discord] Client error: ${err.message}`);
    });

    try {
      await client.login(token);
    } catch (err: any) {
      this.lastError = `Login failed: ${err.message}`;
      console.error(`[Discord] ${this.lastError}`);
      await this.teardownClient();
      return;
    }

    this.attachNowPlayingToAllBots();
    await this.startTsEventBridge();
    this.startAwayPoll();
  }

  async stop(): Promise<void> {
    this.startEpoch++;
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.awayTimer) {
      clearInterval(this.awayTimer);
      this.awayTimer = null;
    }
    if (this.nicknameTimer) {
      clearInterval(this.nicknameTimer);
      this.nicknameTimer = null;
    }
    this.baseNickname = null;
    this.lastAppliedNickname = null;
    this.nicknameWarned = false;
    this.clientAwayState.clear();
    if (this.voiceRelay) {
      this.voiceRelay.destroy();
      this.voiceRelay = null;
    }
    this.detachNowPlayingFromAllBots();
    if (this.eventBridge) {
      const settings = this.settings;
      if (settings?.serverConfigId) {
        try {
          await this.eventBridge.disconnectServer(settings.serverConfigId, settings.virtualServerId);
        } catch { /* already gone */ }
      }
      this.eventBridge.removeAllListeners();
      this.eventBridge = null;
    }
    await this.teardownClient();
  }

  async reload(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getStatus(): DiscordStatus {
    return {
      enabled: !!this.settings?.enabled,
      running: !!this.client?.isReady(),
      error: this.lastError,
      guildName: this.guild()?.name ?? null,
      warnings: this.warnings,
    };
  }

  /** Guilds the bot is a member of — lets the UI offer a picker instead of a raw ID field. */
  listGuilds(): Array<{ id: string; name: string }> {
    if (!this.client?.isReady()) return [];
    return this.client.guilds.cache
      .map((g) => ({ id: g.id, name: g.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Text + voice channels of the configured guild, for the settings UI dropdowns. */
  listChannels(): { text: Array<{ id: string; name: string }>; voice: Array<{ id: string; name: string }> } {
    const guild = this.guild();
    if (!guild) return { text: [], voice: [] };
    const ofType = (type: ChannelType) =>
      guild.channels.cache
        .filter((c) => c.type === type)
        .map((c) => ({ id: c.id, name: `#${c.name}` }))
        .sort((a, b) => a.name.localeCompare(b.name));
    return { text: ofType(ChannelType.GuildText), voice: ofType(ChannelType.GuildVoice) };
  }

  /** Selectable guild roles for the command-permission picker. Excludes
   *  @everyone and integration/bot-managed roles. Empty if not connected. */
  listRoles(): Array<{ id: string; name: string; color: number }> {
    const guild = this.guild();
    if (!guild) return [];
    return guild.roles.cache
      .filter((r) => r.id !== guild.id && !r.managed)
      .map((r) => ({ id: r.id, name: r.name, color: r.color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── Internals ──────────────────────────────────────────────

  private guild() {
    if (!this.client?.isReady() || !this.settings?.guildId) return null;
    return this.client.guilds.cache.get(this.settings.guildId) ?? null;
  }

  private async teardownClient(): Promise<void> {
    if (!this.client) return;
    try { await this.client.destroy(); } catch { }
    this.client = null;
  }

  private async registerCommands(): Promise<void> {
    if (!this.client?.application || !this.settings?.guildId) {
      this.warnings.push('No guild ID configured — slash commands not registered');
      return;
    }

    const defs = [
      new SlashCommandBuilder().setName('play').setDescription('Jouer une musique (URL ou recherche YouTube)')
        .addStringOption((o) => o.setName('query').setDescription('URL ou termes de recherche').setRequired(true)),
      new SlashCommandBuilder().setName('stop').setDescription('Arrêter la lecture'),
      new SlashCommandBuilder().setName('pause').setDescription('Pause / reprise'),
      new SlashCommandBuilder().setName('skip').setDescription('Piste suivante'),
      new SlashCommandBuilder().setName('next').setDescription('Piste suivante (alias de /skip)'),
      new SlashCommandBuilder().setName('prev').setDescription('Piste précédente'),
      new SlashCommandBuilder().setName('queue').setDescription("Afficher la file d'attente"),
      new SlashCommandBuilder().setName('volume').setDescription('Régler le volume')
        .addIntegerOption((o) => o.setName('level').setDescription('0-100').setMinValue(0).setMaxValue(100).setRequired(true)),
      new SlashCommandBuilder().setName('nowplaying').setDescription('Piste en cours'),
      new SlashCommandBuilder().setName('lyrics').setDescription('Paroles de la piste en cours ou d\'une recherche')
        .addStringOption((o) => o.setName('query').setDescription('Artiste et titre — vide = piste en cours').setRequired(false)),
      new SlashCommandBuilder().setName('stats').setDescription('Stats du serveur TeamSpeak'),
      new SlashCommandBuilder().setName('join').setDescription('Faire venir le bot dans ton salon vocal'),
      new SlashCommandBuilder().setName('leave').setDescription('Faire quitter le salon vocal au bot'),
    ].map((c) => c.toJSON());

    await this.client.application.commands.set(defs, this.settings.guildId);
    console.log(`[Discord] Registered ${defs.length} slash commands on guild ${this.settings.guildId}`);
  }

  private musicBot(): VoiceBot {
    const id = this.settings?.defaultMusicBotId;
    if (!id) throw new Error('Aucun bot musique par défaut configuré (Settings → Discord)');
    const bot = this.voiceBotManager.getBot(id);
    if (!bot) throw new Error(`Le bot musique #${id} n'est pas démarré`);
    return bot;
  }

  /** Whether the interaction's author may run commands, per configured roles. */
  private commandAllowed(i: ChatInputCommandInteraction): boolean {
    // this.settings is loaded in start() before the interaction handler is wired,
    // so it is non-null here; a null would parse to [] (fail-open) anyway.
    const allowedRoleIds = parseRoleIds(this.settings?.commandRoleIds);
    if (allowedRoleIds.length === 0) return true;
    const member = i.member as GuildMember | null;
    const memberRoleIds =
      member && 'roles' in member && member.roles?.cache ? [...member.roles.cache.keys()] : [];
    const isAdmin = !!i.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isOwner = !!i.guild && i.guild.ownerId === i.user.id;
    return isCommandAllowed({ allowedRoleIds, memberRoleIds, isAdmin, isOwner });
  }

  private async handleCommand(i: ChatInputCommandInteraction): Promise<void> {
    if (!this.commandAllowed(i)) {
      await i.reply({ content: '⛔ Tu n\'as pas la permission d\'utiliser cette commande.', ephemeral: true });
      return;
    }
    switch (i.commandName) {
      case 'play': {
        await i.deferReply();
        const bot = this.musicBot();
        const query = i.options.getString('query', true);

        // Spotify links are metadata-only → resolve to YouTube
        if (isSpotifyUrl(query)) {
          const config = await loadSpotifyConfig(this.prisma);
          if (!config) {
            await i.editReply('Spotify non configuré (Settings → Spotify).');
            return;
          }
          const result = await enqueueSpotify(this.prisma, bot, config, query);
          if (result.type === 'album') {
            await i.editReply(`💿 Album **${result.name}** : ${result.added}/${result.total} piste(s) ajoutée(s).`);
          } else if (result.added > 0) {
            await i.editReply(result.firstStarted ? `🎵 Lecture : **${result.name}**` : `➕ En file : **${result.name}**`);
          } else {
            await i.editReply(`❌ ${result.failed[0] || 'Aucune piste ajoutée'}`);
          }
          return;
        }

        const url = await resolvePlayQuery(query);
        const { item, queued } = await downloadAndEnqueue(this.prisma, bot, url);
        const artist = item.artist && item.artist !== 'Unknown' ? `${item.artist} — ` : '';
        await i.editReply(queued
          ? `➕ En file (#${bot.queue.length}) : ${artist}**${item.title}**`
          : `🎵 Lecture : ${artist}**${item.title}**`);
        break;
      }
      case 'stop': {
        this.musicBot().stopAudio();
        await i.reply('⏹️ Lecture arrêtée.');
        break;
      }
      case 'pause': {
        const bot = this.musicBot();
        if (bot.status === 'paused') {
          bot.resume();
          await i.reply('▶️ Reprise.');
        } else if (bot.status === 'playing') {
          bot.pause();
          await i.reply('⏸️ Pause.');
        } else {
          await i.reply({ content: 'Rien en cours de lecture.', ephemeral: true });
        }
        break;
      }
      case 'skip':
      case 'next': {
        await i.deferReply();
        const bot = this.musicBot();
        const next = bot.queue.next();
        if (next) {
          if (next.streamUrl) await bot.playStream(next);
          else await bot.play(next);
          await i.editReply(`⏭️ ${next.title}`);
        } else {
          bot.stopAudio();
          await i.editReply('⏹️ File vide — lecture arrêtée.');
        }
        break;
      }
      case 'prev': {
        await i.deferReply();
        const bot = this.musicBot();
        const prev = bot.queue.previous();
        if (prev) {
          if (prev.streamUrl) await bot.playStream(prev);
          else await bot.play(prev);
          await i.editReply(`⏮️ ${prev.title}`);
        } else {
          await i.editReply('Pas de piste précédente.');
        }
        break;
      }
      case 'queue': {
        const bot = this.musicBot();
        await i.reply({ embeds: [queueEmbed(bot.queue.getAll(), bot.queue.index)] });
        break;
      }
      case 'volume': {
        const level = i.options.getInteger('level', true);
        this.musicBot().setVolume(level);
        await i.reply(`🔊 Volume : ${level}%`);
        break;
      }
      case 'nowplaying': {
        const bot = this.musicBot();
        const np = bot.nowPlaying;
        if (!np) {
          await i.reply({ content: 'Rien en cours de lecture.', ephemeral: true });
        } else {
          await i.reply({ embeds: [nowPlayingEmbed(bot.currentConfig.name, np)] });
        }
        break;
      }
      case 'lyrics': {
        await i.deferReply();
        const query = i.options.getString('query');

        let input: { artist?: string; title?: string; query?: string };
        let label: string;
        if (query) {
          input = { query };
          label = query;
        } else {
          const np = this.musicBot().nowPlaying;
          if (!np) {
            await i.editReply('Rien en cours de lecture. Précise un titre : `/lyrics query`');
            return;
          }
          ({ input, label } = lyricsInputFromTrack(np));
        }

        const result = await fetchLyrics(input);
        if (!result) {
          await i.editReply(`❌ Paroles introuvables pour « ${label} ».`);
          return;
        }
        if (result.instrumental) {
          await i.editReply(`♪ **${result.artist} — ${result.title}** : morceau instrumental.`);
          return;
        }

        // Discord allows up to 10 embeds per message, one is plenty here;
        // longer lyrics go out as follow-ups in the same channel.
        const embeds = lyricsEmbeds(result.artist, result.title, result.lyrics);
        await i.editReply({ embeds: [embeds[0]] });
        for (const embed of embeds.slice(1)) {
          await i.followUp({ embeds: [embed] });
        }
        break;
      }
      case 'stats': {
        await i.deferReply();
        await i.editReply({ embeds: [statsEmbed(await this.fetchStats())] });
        this.scheduleAutoDelete(() => i.deleteReply());
        break;
      }
      case 'join': {
        const member = i.member as GuildMember | null;
        const channelId = member?.voice?.channelId;
        if (!channelId || !i.guild) {
          await i.reply({ content: "Rejoins d'abord un salon vocal.", ephemeral: true });
          return;
        }
        if (!this.voiceRelay) throw new Error('Relais vocal non initialisé');
        await i.deferReply();
        await this.voiceRelay.joinChannel(i.guild, channelId);
        await i.editReply(`🔊 Connecté à <#${channelId}> — la musique du bot y est diffusée.`);
        break;
      }
      case 'leave': {
        this.voiceRelay?.leaveChannel();
        await i.reply('👋 Salon vocal quitté.');
        break;
      }
    }
  }

  // ─── Voice relay ────────────────────────────────────────────

  private async startVoiceRelay(): Promise<void> {
    const settings = this.settings;
    if (!settings) return;

    this.voiceRelay = new DiscordVoiceRelay();

    if (settings.defaultMusicBotId) {
      const bot = this.voiceBotManager.getBot(settings.defaultMusicBotId);
      if (bot) this.voiceRelay.attachBot(bot);
    } else if (settings.voiceChannelId) {
      this.warnings.push('Voice channel configured but no default music bot — nothing to relay');
    }

    if (settings.voiceChannelId) {
      const guild = this.guild();
      if (guild) {
        await this.voiceRelay.joinChannel(guild, settings.voiceChannelId);
      }
    }
  }

  private async fetchStats(): Promise<ServerStats> {
    const settings = this.settings;
    if (!settings?.serverConfigId) throw new Error('Aucun serveur TS configuré (Settings → Discord)');

    const client = await this.pool.getOrLoad(settings.serverConfigId);
    const sid = settings.virtualServerId;
    const [serverInfo, clientList, channelList, connectionInfo] = await Promise.all([
      client.execute(sid, 'serverinfo'),
      client.execute(sid, 'clientlist'),
      client.execute(sid, 'channellist'),
      client.execute(sid, 'serverrequestconnectioninfo'),
    ]);

    const info = Array.isArray(serverInfo) ? serverInfo[0] : serverInfo;
    const connInfo = Array.isArray(connectionInfo) ? connectionInfo[0] : connectionInfo;
    const clients = Array.isArray(clientList) ? clientList : [];
    const channels = Array.isArray(channelList) ? channelList : [];

    return {
      serverName: info.virtualserver_name,
      onlineUsers: clients.filter((c: any) => String(c.client_type) === '0').length,
      maxClients: Number(info.virtualserver_maxclients) || 0,
      channelCount: channels.length,
      uptime: Number(info.virtualserver_uptime) || 0,
      bandwidthIn: Number(connInfo.connection_bandwidth_received_last_second_total) || 0,
      bandwidthOut: Number(connInfo.connection_bandwidth_sent_last_second_total) || 0,
    };
  }

  // ─── TS connect/disconnect notifications ───────────────────

  private async startTsEventBridge(): Promise<void> {
    const settings = this.settings;
    if (!settings) return;
    // Presence events feed two independent features: connect/disconnect
    // notifications and the member-count nickname. The nickname counter is
    // always on (watched channel or whole server), so the bridge runs
    // whenever a TS server is configured — Discord posts are gated
    // separately in onTsEvent().
    const wantsNotifications = !!(settings.notifyConnections && settings.notificationsChannelId);
    if (!settings.serverConfigId) {
      if (wantsNotifications) this.warnings.push('TS presence features enabled but no TS server configured');
      return;
    }

    const server = await this.prisma.tsServerConfig.findUnique({ where: { id: settings.serverConfigId } });
    if (!server?.sshUsername || !server?.sshPassword) {
      this.warnings.push('TS presence events (notifications, member-count nickname) need SSH credentials on the server connection');
      return;
    }

    // Own EventBridge instance: the flow engine prunes SSH connections its
    // flows no longer use, which would silently kill a shared subscription.
    this.eventBridge = new EventBridge(this.prisma);
    const epoch = this.startEpoch;
    this.eventBridge.on('tsEvent', (_configId, _sid, eventName, data) => {
      if (eventName === 'notifycliententerview' || eventName === 'notifyclientmoved' || eventName === 'notifyclientleftview') {
        console.log(`[Discord] TS event ${eventName}: clid=${data.clid} ctid=${data.ctid ?? ''} cfid=${data.cfid ?? ''} type=${data.client_type ?? ''}`);
        // In whole-server mode a move never changes the total — skip the refresh.
        const affectsCount = eventName !== 'notifyclientmoved' || !!this.settings?.notifyChannelId;
        if (epoch === this.startEpoch && affectsCount) {
          this.refreshMemberCountNickname().catch(() => { /* logged in the periodic path */ });
        }
      }
      this.onTsEvent(eventName, data).catch((err) => {
        console.error(`[Discord] TS event handling failed: ${err.message}`);
      });
    });
    await this.eventBridge.connectServer(settings.serverConfigId, settings.virtualServerId);
    console.log(`[Discord] TS presence bridge active: server=${settings.serverConfigId} sid=${settings.virtualServerId} watchedChannel=${settings.notifyChannelId ?? '(whole server)'} notifChannel=${settings.notificationsChannelId ?? '(none)'} notifications=${wantsNotifications}`);

    // Seed the nickname/channel maps with clients already connected before the
    // bridge started (non-blocking: must never gate the event subscription).
    this.seedClientState().catch(() => { });
  }

  /** Populate clientNicknames/clientChannels from the current clientlist. */
  private async seedClientState(): Promise<void> {
    const settings = this.settings;
    if (!settings?.serverConfigId) return;
    try {
      const client = await this.pool.getOrLoad(settings.serverConfigId);
      const list = await client.execute(settings.virtualServerId, 'clientlist');
      const bots = this.musicBotIdentity();
      for (const c of Array.isArray(list) ? list : []) {
        if (String(c.client_type) !== '0') continue;
        if (isMusicBotClient(String(c.clid), c.client_nickname || '', bots)) continue;
        const clid = String(c.clid);
        if (!this.clientNicknames.has(clid)) this.clientNicknames.set(clid, c.client_nickname || `Client #${clid}`);
        if (!this.clientChannels.has(clid)) this.clientChannels.set(clid, String(c.cid));
      }
    } catch (err: any) {
      console.warn(`[Discord] Could not seed client state: ${err.message}`);
    }
  }

  // ─── AFK (away) notifications ───────────────────────────────

  private startAwayPoll(): void {
    const settings = this.settings;
    if (!settings?.notifyAway) return;
    if (!settings.notificationsChannelId || !settings.serverConfigId) return;
    const epoch = this.startEpoch;
    this.clientAwayState.clear();
    const tick = () => {
      if (epoch !== this.startEpoch) return;
      this.pollAwayState(epoch).catch((err) => {
        console.error(`[Discord] Away poll failed: ${err.message}`);
      });
    };
    this.awayTimer = setInterval(tick, AWAY_POLL_INTERVAL_MS);
    tick();
  }

  private async pollAwayState(epoch: number): Promise<void> {
    const settings = this.settings;
    if (!settings?.serverConfigId) return;
    const watchedChannel = settings.notifyChannelId;

    const client = await this.pool.getOrLoad(settings.serverConfigId);
    const list = await client.execute(settings.virtualServerId, 'clientlist', { '-away': '' });
    if (epoch !== this.startEpoch) return;
    const bots = this.musicBotIdentity();
    const current: AwayClient[] = mapAwayClients(list, watchedChannel)
      .filter((c) => !isMusicBotClient(c.clid, c.nickname, bots));

    const { changes, next } = diffAwayState(this.clientAwayState, current);
    this.clientAwayState = next;
    for (const change of changes) {
      await this.notifyAwayChange(change.nickname, change.cid, change.isAway);
    }
  }

  private async notifyAwayChange(nickname: string, channelId: string, isAway: boolean): Promise<void> {
    const channel = await this.resolveChannelName(channelId);
    const totalMembers = await this.countChannelMembers(channelId);
    const template = isAway
      ? (this.settings?.notifyAwayTemplate || DEFAULT_AWAY_TEMPLATE)
      : (this.settings?.notifyBackTemplate || DEFAULT_BACK_TEMPLATE);
    const action = isAway ? '💤' : '✅';
    const message = renderTemplate(template, { user: nickname, channel, totalMembers, action });
    const payload = this.settings?.notifyEmbed
      ? { embeds: [awayStatusEmbed(message, isAway)] }
      : { content: message };
    console.log(`[Discord] notify away=${isAway} → channel=${this.settings?.notificationsChannelId} msg="${message}"`);
    await this.postToChannel(this.settings?.notificationsChannelId, payload);
  }

  // ─── Member-count nickname ──────────────────────────────────

  /** Start the periodic member-count nickname refresh (watched channel, or
   *  whole server when no channel is configured). */
  private startNicknameUpdater(): void {
    const epoch = this.startEpoch;
    const tick = () => {
      if (epoch !== this.startEpoch) return;
      this.refreshMemberCountNickname().catch((err) => {
        console.error(`[Discord] Nickname refresh failed: ${err.message}`);
      });
    };
    this.nicknameTimer = setInterval(tick, NICKNAME_REFRESH_INTERVAL_MS);
    tick();
  }

  /** Rename the bot to "Base (N)", N = members of the watched channel — or of
   *  the whole server when no channel is configured (music bots excluded). */
  private async refreshMemberCountNickname(): Promise<void> {
    const settings = this.settings;
    if (!settings) return;
    const me = this.guild()?.members?.me; // guild() already guards a not-yet-ready client
    if (!me) return;

    if (this.baseNickname === null) this.baseNickname = stripCountSuffix(me.displayName);
    const count = await this.countChannelMembers(settings.notifyChannelId ?? null);
    const desired = formatCountNickname(this.baseNickname, count);
    if (desired === this.lastAppliedNickname) return;

    try {
      await me.setNickname(desired);
      this.lastAppliedNickname = desired;
    } catch (err: any) {
      if (!this.nicknameWarned) {
        this.nicknameWarned = true;
        const warning = `Cannot update bot nickname: ${err.message} (missing "Change Nickname" permission?)`;
        this.warnings.push(warning);
        console.warn(`[Discord] ${warning}`);
      }
    }
  }

  private async onTsEvent(eventName: string, data: Record<string, string>): Promise<void> {
    const watchedChannel = this.settings?.notifyChannelId;
    // The event subscription may be alive solely for the nickname counter;
    // only post to Discord when connect/disconnect notifications are enabled.
    const notify = !!(this.settings?.notifyConnections && this.settings?.notificationsChannelId);

    if (eventName === 'notifycliententerview') {
      // Real clients only (query clients are type 1)
      if (String(data.client_type) !== '0') return;
      const clid = String(data.clid);
      const nickname = data.client_nickname || `Client #${clid}`;
      const channelId = String(data.ctid || '');
      if (isMusicBotClient(clid, nickname, this.musicBotIdentity())) return; // never track or announce music bots
      this.clientNicknames.set(clid, nickname);
      this.clientChannels.set(clid, channelId);

      if (watchedChannel) {
        // Connected directly into the watched channel → join
        if (notify && channelId === watchedChannel) await this.notifyChannel('join', nickname, channelId);
      } else if (notify && String(data.reasonid || '0') === '0') {
        // Server-connect mode (legacy): fresh connections only
        await this.postToChannel(this.settings?.notificationsChannelId, { embeds: [clientConnectedEmbed(nickname)] });
      }
      return;
    }

    if (eventName === 'notifyclientmoved' && watchedChannel) {
      const clid = String(data.clid);
      if (this.musicBotIdentity().clids.has(clid)) return; // music bots move silently
      const toChannel = String(data.ctid || '');
      const fromChannel = this.clientChannels.get(clid) ?? String(data.cfid || '');
      this.clientChannels.set(clid, toChannel);
      if (!notify) return; // map updated — nothing to announce
      const nickname = await this.resolveNickname(clid);

      if (toChannel === watchedChannel && fromChannel !== watchedChannel) {
        await this.notifyChannel('join', nickname, toChannel);
      } else if (fromChannel === watchedChannel && toChannel !== watchedChannel) {
        await this.notifyChannel('leave', nickname, fromChannel);
      }
      return;
    }

    if (eventName === 'notifyclientleftview') {
      const clid = String(data.clid);
      const nickname = this.clientNicknames.get(clid);
      const lastChannel = this.clientChannels.get(clid);
      this.clientNicknames.delete(clid);
      this.clientChannels.delete(clid);
      if (!nickname) return; // unknown clid (connected before us, or a query client)

      if (watchedChannel) {
        // Disconnected while inside the watched channel → leave
        if (notify && lastChannel === watchedChannel) await this.notifyChannel('leave', nickname, watchedChannel);
      } else if (notify) {
        await this.postToChannel(this.settings?.notificationsChannelId, { embeds: [clientDisconnectedEmbed(nickname)] });
      }
    }
  }

  private async notifyChannel(kind: 'join' | 'leave', user: string, channelId: string): Promise<void> {
    const channel = await this.resolveChannelName(channelId);
    const totalMembers = await this.countChannelMembers(channelId);
    const template = kind === 'join'
      ? (this.settings?.notifyJoinTemplate || DEFAULT_JOIN_TEMPLATE)
      : (this.settings?.notifyLeaveTemplate || DEFAULT_LEAVE_TEMPLATE);
    const message = renderTemplate(template, { user, channel, totalMembers, action: actionEmoji(kind) });
    const payload = this.settings?.notifyEmbed
      ? { embeds: [channelPresenceEmbed(message, kind)] }
      : { content: message };
    console.log(`[Discord] notify ${kind} → channel=${this.settings?.notificationsChannelId} embed=${!!this.settings?.notifyEmbed} msg="${message}"`);
    await this.postToChannel(this.settings?.notificationsChannelId, payload);
  }

  /** Identity (clids + configured nicknames) of the currently running music bots.
   *  The nickname fallback only covers the connect window of a starting bot (clid
   *  not yet known), so it must not apply to stopped/errored bots — a human whose
   *  nickname collides with an inactive bot's name would be wrongly excluded. */
  private musicBotIdentity(): MusicBotIdentity {
    const clids = new Set<string>();
    const nicknames = new Set<string>();
    for (const { bot } of this.voiceBotManager.getAllBots()) {
      // clids are per-virtual-server integers — a bot's clid on another server
      // must not exclude a human with the same clid on the watched server.
      if (bot.currentConfig.serverConfigId !== this.settings?.serverConfigId) continue;
      if (bot.ts3ClientId > 0) clids.add(String(bot.ts3ClientId));
      const active = bot.status !== 'stopped' && bot.status !== 'error';
      if (active && bot.currentConfig.nickname) nicknames.add(bot.currentConfig.nickname);
    }
    return { clids, nicknames };
  }

  /** Number of real clients currently in the given TS channel — or on the
   *  whole server when channelId is null (music bots excluded). */
  private async countChannelMembers(channelId: string | null): Promise<number> {
    const settings = this.settings;
    if (!settings?.serverConfigId) return 0;
    try {
      const client = await this.pool.getOrLoad(settings.serverConfigId);
      const list = await client.execute(settings.virtualServerId, 'clientlist');
      return countChannelClients(list, channelId, this.musicBotIdentity());
    } catch {
      return 0;
    }
  }

  /** Nickname from the in-memory map, falling back to a WebQuery clientlist lookup. */
  private async resolveNickname(clid: string): Promise<string> {
    const cached = this.clientNicknames.get(clid);
    if (cached) return cached;
    const settings = this.settings;
    if (settings?.serverConfigId) {
      try {
        const client = await this.pool.getOrLoad(settings.serverConfigId);
        const list = await client.execute(settings.virtualServerId, 'clientlist');
        for (const c of Array.isArray(list) ? list : []) {
          const id = String(c.clid);
          this.clientNicknames.set(id, c.client_nickname);
          if (c.cid !== undefined) this.clientChannels.set(id, String(c.cid));
        }
        const found = this.clientNicknames.get(clid);
        if (found) return found;
      } catch { /* fall through */ }
    }
    return `Client #${clid}`;
  }

  /** Watched channel name, cached briefly to avoid per-event WebQuery calls. */
  private async resolveChannelName(channelId: string): Promise<string> {
    const now = Date.now();
    if (this.channelNameCache && now - this.channelNameCache.at < 60_000) {
      return this.channelNameCache.names.get(channelId) || `#${channelId}`;
    }
    const settings = this.settings;
    if (!settings?.serverConfigId) return `#${channelId}`;
    try {
      const client = await this.pool.getOrLoad(settings.serverConfigId);
      const list = await client.execute(settings.virtualServerId, 'channellist');
      const names = new Map<string, string>();
      for (const c of Array.isArray(list) ? list : []) {
        names.set(String(c.cid), c.channel_name || `#${c.cid}`);
      }
      this.channelNameCache = { at: now, names };
      return names.get(channelId) || `#${channelId}`;
    } catch {
      return `#${channelId}`;
    }
  }

  /** TS channels of the configured server, for the settings UI dropdown. */
  async listTsChannels(): Promise<Array<{ id: string; name: string }>> {
    const settings = this.settings;
    if (!settings?.serverConfigId) return [];
    try {
      const client = await this.pool.getOrLoad(settings.serverConfigId);
      const list = await client.execute(settings.virtualServerId, 'channellist');
      return (Array.isArray(list) ? list : [])
        .map((c: any) => ({ id: String(c.cid), name: c.channel_name || `#${c.cid}` }));
    } catch {
      return [];
    }
  }

  // ─── Now playing ────────────────────────────────────────────

  private attachNowPlaying(botId: number, bot: VoiceBot): void {
    if (this.nowPlayingListeners.has(botId)) return;
    const listener = (item: QueueItem) => {
      if (!this.settings?.notifyNowPlaying) return; // now-playing notifications disabled
      this.postToChannel(this.settings?.notificationsChannelId, {
        embeds: [nowPlayingEmbed(bot.currentConfig.name, item)],
      }).catch(() => { });
    };
    bot.on('nowPlaying', listener);
    this.nowPlayingListeners.set(botId, listener);
  }

  private attachNowPlayingToAllBots(): void {
    for (const { botId, bot } of this.voiceBotManager.getAllBots()) {
      this.attachNowPlaying(botId, bot);
    }
  }

  private detachNowPlayingFromAllBots(): void {
    for (const [botId, listener] of this.nowPlayingListeners) {
      this.voiceBotManager.getBot(botId)?.removeListener('nowPlaying', listener);
    }
    this.nowPlayingListeners.clear();
  }

  // ─── Live stats panel ───────────────────────────────────────

  private startStatsPanel(): void {
    if (!this.settings?.statsLiveEnabled || !this.settings.statsChannelId) return;
    const tick = () => {
      this.updateStatsPanel().catch((err) => {
        console.error(`[Discord] Stats panel update failed: ${err.message}`);
      });
    };
    this.statsTimer = setInterval(tick, STATS_PANEL_INTERVAL_MS);
    tick();
  }

  private async updateStatsPanel(): Promise<void> {
    const settings = this.settings;
    if (!settings?.statsChannelId || !this.client?.isReady()) return;

    const embed = statsEmbed(await this.fetchStats());
    const channel = await this.client.channels.fetch(settings.statsChannelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    const textChannel = channel as TextChannel;

    if (settings.statsMessageId) {
      const existing = await textChannel.messages.fetch(settings.statsMessageId).catch(() => null);
      if (existing) {
        await existing.edit({ embeds: [embed] });
        return;
      }
    }

    const message = await textChannel.send({ embeds: [embed] });
    settings.statsMessageId = message.id;
    await this.prisma.discordSettings.update({
      where: { id: settings.id },
      data: { statsMessageId: message.id },
    });
  }

  private async postToChannel(channelId: string | null | undefined, payload: any): Promise<void> {
    if (!channelId) { console.warn('[Discord] postToChannel skipped: no channel configured'); return; }
    if (!this.client?.isReady()) { console.warn('[Discord] postToChannel skipped: client not ready'); return; }
    const channel = await this.client.channels.fetch(channelId).catch((err) => {
      console.warn(`[Discord] postToChannel: cannot fetch channel ${channelId}: ${err.message}`);
      return null;
    });
    if (!channel) return;
    if (!channel.isSendable()) { console.warn(`[Discord] postToChannel: channel ${channelId} is not sendable (permissions?)`); return; }
    const sent = await channel.send(payload);
    this.scheduleAutoDelete(() => sent.delete());
  }

  /** If auto-delete is enabled, remove the message after the configured delay. */
  private scheduleAutoDelete(remove: () => Promise<unknown>): void {
    const secs = this.settings?.notifAutoDeleteSeconds || 0;
    if (secs <= 0) return;
    setTimeout(() => { remove().catch(() => { /* already gone */ }); }, secs * 1000);
  }
}
