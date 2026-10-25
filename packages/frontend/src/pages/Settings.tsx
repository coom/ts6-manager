import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/bots.api';
import { authApi } from '@/api/auth.api';
import { serversApi } from '@/api/servers.api';
import { settingsApi, proxyApi, limitsApi } from '@/api/settings.api';
import { discordApi, type DiscordSettings } from '@/api/discord.api';
import { spotifyApi } from '@/api/spotify.api';
import { musicCommandSettingsApi } from '@/api/music-command-settings.api';
import { samlApi, type SamlSettings } from '@/api/saml.api';
import { useServerGroups } from '@/hooks/use-groups';
import { journalApi } from '@/api/journal.api';
import { musicBotsApi } from '@/api/music.api';
import { useAuthStore } from '@/stores/auth.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Users, Server, Plus, Trash2, Pencil, TestTube, Check, Lock, KeyRound, Youtube, Upload, FileText, MessagesSquare, Music, Bot, ShieldCheck, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '@/i18n';
import { Flag } from '@/components/shared/Flag';

export default function Settings() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

      <Tabs defaultValue="account">
        <TabsList>
          {isAdmin && <TabsTrigger value="connections"><Server className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.connections')}</TabsTrigger>}
          <TabsTrigger value="account"><Lock className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.account')}</TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.users')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="youtube"><Youtube className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.youtube')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="discord"><MessagesSquare className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.discord')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="saml"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.saml')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="spotify"><Music className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.spotify')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="musicCommands"><Bot className="h-3.5 w-3.5 mr-1" /> {t('settings.tabs.musicCommands')}</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="connections" className="mt-4">
            <ConnectionsTab />
          </TabsContent>
        )}

        <TabsContent value="account" className="mt-4">
          <AccountTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="youtube" className="mt-4">
            <YouTubeTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="discord" className="mt-4">
            <DiscordTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="saml" className="mt-4">
            <SamlTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="spotify" className="mt-4">
            <SpotifyTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="musicCommands" className="mt-4">
            <MusicCommandsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AccountTab() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
  });

  const handleSubmit = () => {
    if (newPassword.length < 6) {
      toast.error(t('settings.account.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.account.passwordsDoNotMatch'));
      return;
    }
    changePassword.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('settings.account.passwordChanged'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || 'Failed to change password';
        toast.error(msg);
      },
    });
  };

  return (
    <div className="max-w-md space-y-4">
      <LanguageCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('settings.account.changePassword')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{t('settings.account.currentPassword')}</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t('settings.account.newPassword')}</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t('settings.account.confirmPassword')}</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
            className="w-full mt-1"
          >
            {changePassword.isPending ? t('settings.account.changing') : t('settings.account.changePassword')}
          </Button>
        </CardContent>
      </Card>

      <MfaCard />
      <TrustedDevicesCard />
    </div>
  );
}

function TrustedDevicesCard() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['trusted-devices'], queryFn: () => authApi.trustedList() });
  const devices: any[] = data?.devices ?? [];

  const fmt = (d: string) => new Date(d).toLocaleDateString(i18n.resolvedLanguage);

  const revoke = useMutation({
    mutationFn: (id: number) => authApi.trustedRevoke(id),
    onSuccess: () => { toast.success(t('settings.account.trustedDevices.revoked')); qc.invalidateQueries({ queryKey: ['trusted-devices'] }); },
    onError: () => toast.error(t('settings.account.trustedDevices.revokeError')),
  });
  const revokeAll = useMutation({
    mutationFn: () => authApi.trustedRevokeAll(),
    onSuccess: () => { toast.success(t('settings.account.trustedDevices.revokedAll')); qc.invalidateQueries({ queryKey: ['trusted-devices'] }); },
    onError: () => toast.error(t('settings.account.trustedDevices.revokeError')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{t('settings.account.trustedDevices.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('settings.account.trustedDevices.description')}</p>
        {devices.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('settings.account.trustedDevices.empty')}</p>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">
                    {d.userAgent || '—'}{d.current && <span className="ml-2 text-[10px] text-primary">({t('settings.account.trustedDevices.thisDevice')})</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {t('settings.account.trustedDevices.added')}: {fmt(d.createdAt)} · {t('settings.account.trustedDevices.expires')}: {fmt(d.expiresAt)}
                    {d.ipAddress ? ` · ${d.ipAddress}` : ''}
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(d.id)}>
                  {t('settings.account.trustedDevices.revoke')}
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" disabled={revokeAll.isPending} onClick={() => revokeAll.mutate()}>
              {t('settings.account.trustedDevices.revokeAll')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LanguageCard() {
  const { t, i18n } = useTranslation();
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const current = LANGUAGES.find((l) => i18n.resolvedLanguage === l.code)?.code ?? 'en';

  const choose = (code: string) => {
    setLanguage(code);
    if (accessToken) {
      authApi.setLanguage(code).then(() => {
        if (user) setAuth(accessToken, refreshToken!, { ...user, language: code });
        toast.success(t('common.save'));
      }).catch(() => { /* ignore */ });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{t('settings.account.language')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={current} onValueChange={choose}>
          <SelectTrigger className="h-8 text-xs w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}><Flag code={l.country} className="mr-2" />{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">{t('settings.account.languageHint')}</p>
      </CardContent>
    </Card>
  );
}

function MfaCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const enabled = !!me?.user?.mfaEnabled;
  const required = !!me?.user?.mfaRequired;

  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePw, setDisablePw] = useState('');

  const setup = useMutation({
    mutationFn: () => authApi.mfaSetup(),
    onSuccess: (d) => setQr(d.qrDataUrl),
    onError: () => toast.error(t('settings.account.mfa.setupFailed')),
  });
  const enable = useMutation({
    mutationFn: () => authApi.mfaEnable(code),
    onSuccess: (d) => { setRecoveryCodes(d.recoveryCodes); setQr(null); setCode(''); qc.invalidateQueries({ queryKey: ['me'] }); toast.success(t('settings.account.mfa.enabledToast')); },
    onError: () => toast.error(t('settings.account.mfa.invalidCode')),
  });
  const disable = useMutation({
    mutationFn: () => authApi.mfaDisable(disablePw),
    onSuccess: () => { setDisablePw(''); setRecoveryCodes(null); qc.invalidateQueries({ queryKey: ['me'] }); toast.success(t('settings.account.mfa.disabledToast')); },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.account.mfa.disableFailed')),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{t('settings.account.mfa.title')}</CardTitle>
        <Badge variant={enabled ? 'default' : 'outline'} className={enabled ? 'bg-emerald-600' : ''}>{enabled ? t('settings.account.mfa.on') : t('settings.account.mfa.off')}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {recoveryCodes && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-500 text-xs font-medium"><KeyRound className="h-3.5 w-3.5" /> {t('settings.account.mfa.recoveryTitle')}</div>
            <p className="text-[10px] text-muted-foreground">{t('settings.account.mfa.recoveryHint')}</p>
            <div className="grid grid-cols-2 gap-1 font-mono-data text-[11px]">{recoveryCodes.map((c) => <span key={c}>{c}</span>)}</div>
          </div>
        )}

        {!enabled && !qr && (
          <>
            <p className="text-xs text-muted-foreground">{t('settings.account.mfa.intro')}</p>
            <Button size="sm" onClick={() => setup.mutate()} disabled={setup.isPending}>{setup.isPending ? t('settings.account.mfa.starting') : t('settings.account.mfa.enable')}</Button>
          </>
        )}

        {!enabled && qr && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('settings.account.mfa.scanPrompt')}</p>
            <img src={qr} alt="TOTP QR code" className="h-44 w-44 rounded bg-white p-2" />
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" className="h-8 text-xs w-40 text-center tracking-widest" />
            <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending || code.length < 6}>{enable.isPending ? t('settings.account.mfa.verifying') : t('settings.account.mfa.verifyEnable')}</Button>
          </div>
        )}

        {enabled && (
          <div className="space-y-2">
            {required
              ? <p className="text-xs text-muted-foreground">{t('settings.account.mfa.requiredNote')}</p>
              : <>
                  <p className="text-xs text-muted-foreground">{t('settings.account.mfa.disablePrompt')}</p>
                  <div className="flex items-center gap-2">
                    <Input type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder={t('settings.account.mfa.passwordPlaceholder')} className="h-8 text-xs w-48" />
                    <Button size="sm" variant="destructive" onClick={() => disable.mutate()} disabled={disable.isPending || !disablePw}>{t('settings.account.mfa.disable')}</Button>
                  </div>
                </>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: servers, isLoading } = useQuery({ queryKey: ['servers'], queryFn: serversApi.list });
  const createServer = useMutation({ mutationFn: (data: any) => serversApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const updateServer = useMutation({ mutationFn: ({ id, data }: any) => serversApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const deleteServer = useMutation({ mutationFn: (id: number) => serversApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const testServer = useMutation({ mutationFn: (id: number) => serversApi.test(id) });

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', host: '', webqueryPort: '10080', apiKey: '', useHttps: false, sshPort: '10022', sshUsername: '', sshPassword: '' });

  const serverList = useMemo(() => (Array.isArray(servers) ? servers : []), [servers]);

  if (isLoading) return <PageLoader />;

  const resetForm = () => setForm({ name: '', host: '', webqueryPort: '10080', apiKey: '', useHttps: false, sshPort: '10022', sshUsername: '', sshPassword: '' });

  const handleSave = () => {
    const payload = { ...form, webqueryPort: parseInt(form.webqueryPort), sshPort: parseInt(form.sshPort) };
    if (editId) {
      updateServer.mutate({ id: editId, data: payload }, {
        onSuccess: () => { toast.success(t('settings.connections.toastUpdated')); setEditId(null); setShowAdd(false); resetForm(); },
        onError: () => toast.error(t('settings.connections.toastUpdateFailed')),
      });
    } else {
      createServer.mutate(payload, {
        onSuccess: () => { toast.success(t('settings.connections.toastAdded')); setShowAdd(false); resetForm(); },
        onError: () => toast.error(t('settings.connections.toastCreateFailed')),
      });
    }
  };

  const openEdit = (server: any) => {
    setForm({
      name: server.name || '',
      host: server.host || '',
      webqueryPort: String(server.webqueryPort || 10080),
      apiKey: server.apiKey || '',
      useHttps: server.useHttps || false,
      sshPort: String(server.sshPort || 10022),
      sshUsername: server.sshUsername || '',
      sshPassword: server.sshPassword || '',
    });
    setEditId(server.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('settings.connections.subtitle')}</p>
        <Button size="sm" onClick={() => { resetForm(); setEditId(null); setShowAdd(true); }}><Plus className="h-4 w-4 mr-1" /> {t('settings.connections.add')}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {serverList.map((server: any) => (
          <Card key={server.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{server.name}</CardTitle>
                <Badge variant={server.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {server.enabled ? t('settings.connections.enabled') : t('settings.connections.disabled')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">{t('settings.connections.host')}</span>
                <span className="font-mono-data">{server.host}:{server.webqueryPort}</span>
                <span className="text-muted-foreground">{t('settings.connections.protocol')}</span>
                <span>{server.useHttps ? 'HTTPS' : 'HTTP'}</span>
                <span className="text-muted-foreground">SSH</span>
                <span className="font-mono-data">{server.sshPort || '-'}</span>
              </div>
              <div className="flex items-center gap-1 pt-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => testServer.mutate(server.id, {
                  onSuccess: () => toast.success(t('settings.connections.toastTestSuccess')),
                  onError: () => toast.error(t('settings.connections.toastTestFailed')),
                })}>
                  <TestTube className="h-3 w-3 mr-1" /> {t('settings.connections.test')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(server)}>
                  <Pencil className="h-3 w-3 mr-1" /> {t('settings.connections.edit')}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(server.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { if (!v) { setShowAdd(false); setEditId(null); resetForm(); } else setShowAdd(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? t('settings.connections.dialogEditTitle') : t('settings.connections.dialogAddTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('settings.connections.name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('settings.connections.namePlaceholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t('settings.connections.host')}</Label><Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="127.0.0.1" /></div>
              <div><Label className="text-xs">{t('settings.connections.webqueryPort')}</Label><Input type="number" value={form.webqueryPort} onChange={(e) => setForm({ ...form, webqueryPort: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs">{t('settings.connections.apiKey')}</Label>
              <Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={editId ? t('settings.connections.apiKeyPlaceholderEdit') : t('settings.connections.apiKeyPlaceholder')} type="password" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.useHttps} onCheckedChange={(v) => setForm({ ...form, useHttps: v })} />
              <Label className="text-xs">{t('settings.connections.useHttps')}</Label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">{t('settings.connections.sshPort')}</Label><Input type="number" value={form.sshPort} onChange={(e) => setForm({ ...form, sshPort: e.target.value })} /></div>
              <div><Label className="text-xs">{t('settings.connections.sshUser')}</Label><Input value={form.sshUsername} onChange={(e) => setForm({ ...form, sshUsername: e.target.value })} placeholder={editId ? t('settings.connections.unchanged') : 'serveradmin'} /></div>
              <div><Label className="text-xs">{t('settings.connections.sshPassword')}</Label><Input type="password" value={form.sshPassword} onChange={(e) => setForm({ ...form, sshPassword: e.target.value })} placeholder={editId ? t('settings.connections.unchanged') : ''} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditId(null); resetForm(); }}>{t('settings.connections.cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.host || (!editId && !form.apiKey)}>{editId ? t('settings.connections.update') : t('settings.connections.addShort')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title={t('settings.connections.deleteTitle')}
        description={t('settings.connections.deleteDescription')}
        onConfirm={() => { if (deleteId) deleteServer.mutate(deleteId, { onSuccess: () => { toast.success(t('settings.connections.toastDeleted')); setDeleteId(null); } }); }}
        destructive
      />
    </div>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const createUser = useMutation({ mutationFn: (data: any) => usersApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const updateUser = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const deleteUser = useMutation({ mutationFn: (id: number) => usersApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });

  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [resetPwUserId, setResetPwUserId] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwMustChange, setResetPwMustChange] = useState(false);
  const emptyForm = { username: '', password: '', displayName: '', role: 'viewer', mfaRequired: false, mustChangePassword: false };
  const [form, setForm] = useState(emptyForm);

  const userList = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  if (isLoading) return <PageLoader />;

  const handleCreate = () => {
    createUser.mutate(form, {
      onSuccess: () => { toast.success(t('settings.users.toastCreated')); setShowAdd(false); setForm(emptyForm); },
      onError: () => toast.error(t('settings.users.toastCreateFailed')),
    });
  };

  const handleRoleChange = (userId: number, role: string) => {
    updateUser.mutate({ id: userId, data: { role } }, {
      onSuccess: () => toast.success(t('settings.users.toastRoleUpdated')),
      onError: () => toast.error(t('settings.users.toastRoleFailed')),
    });
  };

  const handleToggleEnabled = (userId: number, enabled: boolean) => {
    updateUser.mutate({ id: userId, data: { enabled } }, {
      onSuccess: () => toast.success(enabled ? t('settings.users.toastEnabled') : t('settings.users.toastDisabled')),
      onError: () => toast.error(t('settings.users.toastStatusFailed')),
    });
  };

  const handleRequireMfa = (userId: number, mfaRequired: boolean) => {
    updateUser.mutate({ id: userId, data: { mfaRequired } }, {
      onSuccess: () => toast.success(mfaRequired ? t('settings.users.toastMfaRequired') : t('settings.users.toastMfaNotRequired')),
      onError: () => toast.error(t('settings.users.toastMfaRequireFailed')),
    });
  };

  const handleResetMfa = (userId: number) => {
    updateUser.mutate({ id: userId, data: { resetMfa: true } }, {
      onSuccess: () => toast.success(t('settings.users.toastMfaReset')),
      onError: () => toast.error(t('settings.users.toastMfaResetFailed')),
    });
  };

  const handleResetPassword = () => {
    if (!resetPwUserId || resetPwValue.length < 6) {
      toast.error(t('settings.users.passwordMinError'));
      return;
    }
    updateUser.mutate({ id: resetPwUserId, data: { password: resetPwValue, mustChangePassword: resetPwMustChange } }, {
      onSuccess: () => { toast.success(t('settings.users.toastPasswordReset')); setResetPwUserId(null); setResetPwValue(''); setResetPwMustChange(false); },
      onError: () => toast.error(t('settings.users.toastPasswordResetFailed')),
    });
  };

  return (
    <div className="space-y-4">
      <PasswordPolicyCard />
      <ReverseProxyCard />
      <JournalRetentionCard />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('settings.users.subtitle')}</p>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> {t('settings.users.add')}</Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings.users.colUsername')}</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings.users.colDisplayName')}</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings.users.colRole')}</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings.users.colStatus')}</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings.users.col2fa')}</th>
              <th className="h-10 px-3 text-right font-medium text-muted-foreground">{t('settings.users.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u: any) => {
              const isProtected = u.username === 'admin';
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono-data text-xs">{u.username}</td>
                  <td className="px-3 py-2.5">{u.displayName}</td>
                  <td className="px-3 py-2.5">
                    {isProtected ? (
                      <Badge variant="default" className="text-[10px] capitalize">{u.role}</Badge>
                    ) : (
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t('settings.users.roleAdmin')}</SelectItem>
                          <SelectItem value="viewer">{t('settings.users.roleViewer')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isProtected ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="h-3 w-3" /> {t('settings.users.active')}
                      </span>
                    ) : (
                      <Switch
                        checked={u.enabled}
                        onCheckedChange={(v) => handleToggleEnabled(u.id, v)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span title={t('settings.users.require2faTitle')} className="inline-flex items-center gap-1">
                        <Switch checked={!!u.mfaRequired} onCheckedChange={(v) => handleRequireMfa(u.id, v)} />
                        <span className="text-[10px] text-muted-foreground">{u.mfaEnabled ? t('settings.users.mfaOn') : (u.mfaRequired ? t('settings.users.mfaPending') : t('settings.users.mfaOff'))}</span>
                      </span>
                      {u.mfaEnabled && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" title={t('settings.users.resetLostDeviceTitle')} onClick={() => handleResetMfa(u.id)}>
                          {t('settings.users.reset')}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t('settings.users.resetPasswordTitle')} onClick={() => { setResetPwUserId(u.id); setResetPwValue(''); }}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)} disabled={isProtected}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('settings.users.addDialogTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('settings.users.username')}</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="johndoe" /></div>
            <div><Label className="text-xs">{t('settings.users.displayName')}</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="John Doe" /></div>
            <div><Label className="text-xs">{t('settings.users.password')}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="********" /></div>
            <div>
              <Label className="text-xs">{t('settings.users.role')}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('settings.users.roleAdmin')}</SelectItem>
                  <SelectItem value="viewer">{t('settings.users.roleViewer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.mfaRequired} onCheckedChange={(v) => setForm({ ...form, mfaRequired: v })} />
              <Label className="text-xs font-normal">{t('settings.users.requireMfa')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.mustChangePassword} onCheckedChange={(v) => setForm({ ...form, mustChangePassword: v })} />
              <Label className="text-xs font-normal">{t('settings.users.mustChangePassword')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('settings.users.cancel')}</Button>
            <Button onClick={handleCreate} disabled={!form.username || !form.password}>{t('settings.users.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwUserId !== null} onOpenChange={(v) => { if (!v) { setResetPwUserId(null); setResetPwValue(''); setResetPwMustChange(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('settings.users.resetPasswordDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('settings.users.setNewPasswordFor')} <span className="font-medium text-foreground">{userList.find((u: any) => u.id === resetPwUserId)?.username}</span>
            </p>
            <div>
              <Label className="text-xs">{t('settings.users.newPassword')}</Label>
              <Input type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder={t('settings.users.minCharsPlaceholder')} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={resetPwMustChange} onCheckedChange={setResetPwMustChange} />
              <Label className="text-xs font-normal">{t('settings.users.mustChangePassword')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPwUserId(null); setResetPwValue(''); }}>{t('settings.users.cancel')}</Button>
            <Button onClick={handleResetPassword} disabled={resetPwValue.length < 6 || updateUser.isPending}>
              {updateUser.isPending ? t('settings.users.resetting') : t('settings.users.resetPassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title={t('settings.users.deleteTitle')}
        description={t('settings.users.deleteDescription')}
        onConfirm={() => { if (deleteId) deleteUser.mutate(deleteId, { onSuccess: () => { toast.success(t('settings.users.toastDeleted')); setDeleteId(null); } }); }}
        destructive
      />
    </div>
  );
}

function YouTubeTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pasteMode, setPasteMode] = useState(false);
  const [cookieText, setCookieText] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['yt-cookie-status'],
    queryFn: settingsApi.getYtCookieStatus,
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => settingsApi.uploadYtCookieFile(file),
    onSuccess: () => {
      toast.success(t('settings.youtube.toastFileUploaded'));
      qc.invalidateQueries({ queryKey: ['yt-cookie-status'] });
    },
    onError: () => toast.error(t('settings.youtube.toastUploadFailed')),
  });

  const uploadText = useMutation({
    mutationFn: (text: string) => settingsApi.uploadYtCookieText(text),
    onSuccess: () => {
      toast.success(t('settings.youtube.toastCookiesSaved'));
      setCookieText('');
      setPasteMode(false);
      qc.invalidateQueries({ queryKey: ['yt-cookie-status'] });
    },
    onError: () => toast.error(t('settings.youtube.toastSaveFailed')),
  });

  const deleteCookies = useMutation({
    mutationFn: () => settingsApi.deleteYtCookies(),
    onSuccess: () => {
      toast.success(t('settings.youtube.toastCookiesRemoved'));
      qc.invalidateQueries({ queryKey: ['yt-cookie-status'] });
    },
    onError: () => toast.error(t('settings.youtube.toastRemoveFailed')),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile.mutate(file);
    e.target.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('settings.youtube.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('settings.youtube.description')}
            {' '}<span className="font-medium">Get cookies.txt LOCALLY</span> {t('settings.youtube.descriptionBrowsers')}
          </p>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status?.active ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span className="text-sm">
              {isLoading ? t('settings.youtube.loading') : status?.active
                ? t('settings.youtube.cookiesActive', { size: formatSize(status.size) })
                : t('settings.youtube.noCookies')}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".txt,.cookies"
              className="hidden"
              id="cookie-file-input"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('cookie-file-input')?.click()}
              disabled={uploadFile.isPending}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {uploadFile.isPending ? t('settings.youtube.uploading') : t('settings.youtube.uploadFile')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasteMode(!pasteMode)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {t('settings.youtube.pasteCookies')}
            </Button>
            {status?.active && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteCookies.mutate()}
                disabled={deleteCookies.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('settings.youtube.remove')}
              </Button>
            )}
          </div>

          {/* Paste mode */}
          {pasteMode && (
            <div className="space-y-2">
              <textarea
                className="w-full h-32 rounded-md border border-border bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;0&#9;COOKIE_NAME&#9;COOKIE_VALUE"
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => uploadText.mutate(cookieText)}
                  disabled={!cookieText.trim() || uploadText.isPending}
                >
                  {uploadText.isPending ? t('settings.youtube.saving') : t('settings.youtube.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPasteMode(false); setCookieText(''); }}>
                  {t('settings.youtube.cancel')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PlaylistImportLimitCard />
    </div>
  );
}

// ─── Playlist Import Limit Card ──────────────────────────────

function PlaylistImportLimitCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings-limits'], queryFn: limitsApi.get });
  const [max, setMax] = useState(50);

  const [seededData, setSeededData] = useState<typeof data>(undefined);
  if (data && data !== seededData) {
    setSeededData(data);
    setMax(data.maxPlaylistImport);
  }

  const save = useMutation({
    mutationFn: () => limitsApi.update(max),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-limits'] });
      toast.success(t('settings.youtube.playlistLimit.toastSaved'));
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.youtube.playlistLimit.toastSaveFailed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{t('settings.youtube.playlistLimit.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('settings.youtube.playlistLimit.description')}</p>
        <div className="flex items-center gap-3">
          <Label className="text-xs w-40">{t('settings.youtube.playlistLimit.maxTracks')}</Label>
          <Input className="h-8 text-xs w-24" type="number" min={0} max={1000} value={max}
            onChange={(e) => setMax(parseInt(e.target.value) || 0)} />
        </div>
        <p className="text-[10px] text-muted-foreground">{t('settings.youtube.playlistLimit.hint')}</p>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('settings.youtube.playlistLimit.saving') : t('settings.youtube.playlistLimit.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Discord Tab ─────────────────────────────────────────────

function DiscordTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ['discord-settings'], queryFn: discordApi.settings });
  const { data: status } = useQuery({
    queryKey: ['discord-status'],
    queryFn: discordApi.status,
    // Poll fast while the bridge is connecting so the badge reacts promptly
    refetchInterval: (q) => (q.state.data?.running ? 15000 : 3000),
  });
  const { data: channels } = useQuery({
    queryKey: ['discord-channels'],
    queryFn: discordApi.channels,
    enabled: !!status?.running,
  });
  const { data: guilds = [] } = useQuery({
    queryKey: ['discord-guilds'],
    queryFn: discordApi.guilds,
    enabled: !!status?.running,
  });
  const { data: roles = [] } = useQuery({
    queryKey: ['discord-roles'],
    queryFn: discordApi.roles,
    enabled: !!status?.running,
  });
  const { data: bots } = useQuery({ queryKey: ['music-bots'], queryFn: musicBotsApi.list });
  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: serversApi.list });
  const { data: tsChannels = [] } = useQuery({
    queryKey: ['discord-ts-channels'],
    queryFn: discordApi.tsChannels,
    enabled: !!status?.running,
  });

  const [form, setForm] = useState<Partial<DiscordSettings> & { botToken?: string }>({});

  const [seededSettings, setSeededSettings] = useState<typeof settings>(undefined);
  if (settings && settings !== seededSettings) {
    setSeededSettings(settings);
    setForm({ ...settings, botToken: '' });
  }

  const save = useMutation({
    mutationFn: () => discordApi.updateSettings({ ...form, botToken: form.botToken || undefined }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['discord-settings'] });
      qc.invalidateQueries({ queryKey: ['discord-status'] });
      qc.invalidateQueries({ queryKey: ['discord-channels'] });
      qc.invalidateQueries({ queryKey: ['discord-roles'] });
      if (result?.status?.error) toast.error(t('settings.discord.toastSavedButError', { error: result.status.error }));
      else toast.success(t('settings.discord.toastSaved'));
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.discord.toastSaveFailed')),
  });

  if (isLoading || !settings) return <PageLoader />;

  const botList = Array.isArray(bots) ? bots : [];
  const serverList = Array.isArray(servers) ? servers : [];
  const textChannels = channels?.text ?? [];
  const voiceChannels = channels?.voice ?? [];

  const channelField = (label: string, key: 'notificationsChannelId' | 'statsChannelId' | 'voiceChannelId', hint: string, channelOptions: Array<{ id: string; name: string }>) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {channelOptions.length > 0 ? (
        <Select value={form[key] || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, [key]: v === 'none' ? null : v }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('settings.discord.none')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('settings.discord.disabledOption')}</SelectItem>
            {channelOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input className="h-8 text-xs" placeholder={t('settings.discord.channelIdPlaceholder')}
          value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value || null }))} />
      )}
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );

  const toggleRole = (id: string) =>
    setForm((f) => {
      const cur = f.commandRoleIds ?? [];
      return { ...f, commandRoleIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{t('settings.discord.title')}</CardTitle>
        <div className="flex items-center gap-2">
          {status?.running
            ? <Badge className="bg-emerald-600">{status.guildName ? t('settings.discord.connectedTo', { guild: status.guildName }) : t('settings.discord.connected')}</Badge>
            : status?.enabled
              ? <Badge variant="destructive">{status?.error ? t('settings.discord.error') : t('settings.discord.connecting')}</Badge>
              : <Badge variant="outline">{t('settings.discord.disabled')}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        {status?.error && <p className="text-xs text-destructive">{status.error}</p>}
        {(status?.warnings ?? []).map((w) => <p key={w} className="text-xs text-amber-500">⚠ {w}</p>)}

        <div className="flex items-center gap-2">
          <Switch checked={!!form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          <Label className="text-xs">{t('settings.discord.enableBot')}</Label>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.discord.botToken')}</Label>
          <Input className="h-8 text-xs" type="password"
            placeholder={settings.hasToken ? t('settings.discord.botTokenPlaceholderSet') : t('settings.discord.botTokenPlaceholder')}
            value={form.botToken || ''} onChange={(e) => setForm((f) => ({ ...f, botToken: e.target.value }))} />
          <p className="text-[10px] text-muted-foreground">
            {t('settings.discord.botTokenHint')}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.discord.server')}</Label>
          {guilds.length > 0 ? (
            <Select value={form.guildId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, guildId: v === 'none' ? null : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('settings.discord.selectServer')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('settings.discord.noneOption')}</SelectItem>
                {guilds.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input className="h-8 text-xs" placeholder={t('settings.discord.guildIdPlaceholder')}
              value={form.guildId || ''} onChange={(e) => setForm((f) => ({ ...f, guildId: e.target.value || null }))} />
          )}
          <p className="text-[10px] text-muted-foreground">{t('settings.discord.serverHint')}</p>
        </div>

        {channelField(t('settings.discord.notificationsChannel'), 'notificationsChannelId', t('settings.discord.notificationsChannelHint'), textChannels)}
        {channelField(t('settings.discord.statsChannel'), 'statsChannelId', t('settings.discord.statsChannelHint'), textChannels)}
        {channelField(t('settings.discord.voiceChannel'), 'voiceChannelId', t('settings.discord.voiceChannelHint'), voiceChannels)}

        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-medium">{t('settings.discord.commandRoles')}</Label>
          <p className="text-[10px] text-muted-foreground">{t('settings.discord.commandRolesHint')}</p>
          {roles.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border border-border/50 p-2">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={(form.commandRoleIds ?? []).includes(r.id)}
                    onCheckedChange={() => toggleRole(r.id)}
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0 border border-border/50"
                    style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : 'transparent' }}
                  />
                  <span className="text-xs truncate">{r.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">{t('settings.discord.commandRolesOffline')}</p>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <Label className="text-xs font-medium">{t('settings.discord.notifications')}</Label>

          {/* Watched channel drives notifications AND the member-count nickname — always visible */}
          <div className="space-y-1.5">
            <Label className="text-[11px]">{t('settings.discord.watchChannel')}</Label>
            {tsChannels.length > 0 ? (
              <Select value={form.notifyChannelId || 'server'} onValueChange={(v) => setForm((f) => ({ ...f, notifyChannelId: v === 'server' ? null : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">{t('settings.discord.wholeServer')}</SelectItem>
                  {tsChannels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input className="h-8 text-xs" placeholder={t('settings.discord.watchChannelPlaceholder')}
                value={form.notifyChannelId || ''} onChange={(e) => setForm((f) => ({ ...f, notifyChannelId: e.target.value || null }))} />
            )}
            <p className="text-[10px] text-muted-foreground">
              {t('settings.discord.watchChannelHint')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={!!form.notifyConnections} onCheckedChange={(v) => setForm((f) => ({ ...f, notifyConnections: v }))} />
            <Label className="text-xs font-normal">{t('settings.discord.tsPresence')}</Label>
          </div>

          {form.notifyConnections && (
            <div className="ml-9 space-y-2 border-l border-border pl-3">
              {form.notifyChannelId && (
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!form.notifyEmbed} onCheckedChange={(v) => setForm((f) => ({ ...f, notifyEmbed: v }))} />
                    <Label className="text-xs font-normal">{t('settings.discord.embedStyle')}</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">{t('settings.discord.joinMessage')}</Label>
                    <Input className="h-8 text-xs" placeholder="{action} {user} a rejoint le canal {channel} du TeamSpeak ({TotalMembersOfChannel} connectés)"
                      value={form.notifyJoinTemplate || ''} onChange={(e) => setForm((f) => ({ ...f, notifyJoinTemplate: e.target.value || null }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">{t('settings.discord.leaveMessage')}</Label>
                    <Input className="h-8 text-xs" placeholder="{action} {user} a quitté le canal {channel} du TeamSpeak ({TotalMembersOfChannel} connectés)"
                      value={form.notifyLeaveTemplate || ''} onChange={(e) => setForm((f) => ({ ...f, notifyLeaveTemplate: e.target.value || null }))} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t('settings.discord.templateVariables')} <span className="font-mono">{'{action}'}</span>, <span className="font-mono">{'{user}'}</span>, <span className="font-mono">{'{channel}'}</span> {t('settings.discord.and')} <span className="font-mono">{'{TotalMembersOfChannel}'}</span>.</p>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={!!form.notifyNowPlaying} onCheckedChange={(v) => setForm((f) => ({ ...f, notifyNowPlaying: v }))} />
            <Label className="text-xs font-normal">{t('settings.discord.nowPlaying')}</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={!!form.notifyAway}
              onCheckedChange={(v) => setForm((f) => ({ ...f, notifyAway: v }))}
            />
            <Label className="text-xs font-normal">{t('settings.discord.awayStatus')}</Label>
          </div>

          {form.notifyAway && (
            <div className="ml-9 space-y-2 border-l border-border pl-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">{t('settings.discord.awayTemplate')}</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="💤 {user} est passé AFK"
                  value={form.notifyAwayTemplate || ''}
                  onChange={(e) => setForm((f) => ({ ...f, notifyAwayTemplate: e.target.value || null }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">{t('settings.discord.backTemplate')}</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="✅ {user} est de retour"
                  value={form.notifyBackTemplate || ''}
                  onChange={(e) => setForm((f) => ({ ...f, notifyBackTemplate: e.target.value || null }))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{t('settings.discord.awayHint')}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={!!form.statsLiveEnabled} onCheckedChange={(v) => setForm((f) => ({ ...f, statsLiveEnabled: v }))} />
            <Label className="text-xs font-normal">{t('settings.discord.liveStatsPanel')}</Label>
          </div>
          <p className="text-[10px] text-muted-foreground">{t('settings.discord.statsCommandHint')}</p>
          <div className="flex items-center gap-3 pt-1">
            <Label className="text-xs font-normal w-56">{t('settings.discord.autoDelete')}</Label>
            <Input className="h-8 text-xs w-24" type="number" min={0} max={86400}
              value={form.notifAutoDeleteSeconds ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, notifAutoDeleteSeconds: parseInt(e.target.value) || 0 }))} />
          </div>
          <p className="text-[10px] text-muted-foreground">{t('settings.discord.autoDeleteHint')}</p>
        </div>

        <div className="space-y-2 pt-1">
          <Label className="text-xs font-medium">{t('settings.discord.botFlows')}</Label>
          <div className="flex items-center gap-2">
            <Switch checked={!!form.flowMessageTrigger} onCheckedChange={(v) => setForm((f) => ({ ...f, flowMessageTrigger: v }))} />
            <Label className="text-xs font-normal">{t('settings.discord.enableFlowTriggers')}</Label>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t('settings.discord.flowTriggersHintPre')}
            <span className="font-mono"> Message Content </span> {t('settings.discord.flowTriggersHintPost')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.discord.tsServer')}</Label>
            <Select value={form.serverConfigId ? String(form.serverConfigId) : 'none'}
              onValueChange={(v) => setForm((f) => ({ ...f, serverConfigId: v === 'none' ? null : parseInt(v) }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('settings.discord.noneOption')}</SelectItem>
                {serverList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.discord.defaultMusicBot')}</Label>
            <Select value={form.defaultMusicBotId ? String(form.defaultMusicBotId) : 'none'}
              onValueChange={(v) => setForm((f) => ({ ...f, defaultMusicBotId: v === 'none' ? null : parseInt(v) }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('settings.discord.noneOption')}</SelectItem>
                {botList.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('settings.discord.savingReconnecting') : t('settings.discord.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── SAML / SSO Tab ──────────────────────────────────────────

function SamlTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ['saml-settings'], queryFn: samlApi.settings });
  const [form, setForm] = useState<Partial<SamlSettings> & { idpCertificate?: string }>({});

  const [seededSettings, setSeededSettings] = useState<typeof settings>(undefined);
  if (settings && settings !== seededSettings) {
    setSeededSettings(settings);
    setForm({ ...settings, idpCertificate: '' });
  }

  const save = useMutation({
    mutationFn: () => samlApi.updateSettings({ ...form, idpCertificate: form.idpCertificate || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saml-settings'] });
      toast.success(t('settings.saml.saved'));
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || t('settings.saml.saveError')),
  });

  if (isLoading || !settings) return <PageLoader />;

  const copy = (value?: string | null) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success(t('tokens.copied'));
  };

  const readOnlyField = (label: string, value: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input className="h-8 text-xs font-mono-data" value={value} readOnly onFocus={(e) => e.target.select()} />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(value)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('settings.tabs.saml')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="flex items-center gap-2">
          <Switch checked={!!form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          <Label className="text-xs">{t('settings.saml.enable')}</Label>
        </div>

        <div className="space-y-2 rounded-md border border-border/50 p-3">
          <p className="text-[10px] text-muted-foreground">{t('settings.saml.spInfo')}</p>
          {readOnlyField(t('settings.saml.spMetadataUrl'), settings.spMetadataUrl)}
          {readOnlyField(t('settings.saml.acsUrl'), settings.acsUrl)}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.saml.idpEntityId')}</Label>
          <Input className="h-8 text-xs" value={form.idpEntityId || ''}
            onChange={(e) => setForm((f) => ({ ...f, idpEntityId: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.saml.idpSsoUrl')}</Label>
          <Input className="h-8 text-xs" value={form.idpSsoUrl || ''}
            onChange={(e) => setForm((f) => ({ ...f, idpSsoUrl: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.saml.idpCertificate')}</Label>
          <textarea
            className="w-full h-24 rounded-md border border-border bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={settings.hasIdpCertificate ? '••••••••••••••••' : '-----BEGIN CERTIFICATE-----'}
            value={form.idpCertificate || ''}
            onChange={(e) => setForm((f) => ({ ...f, idpCertificate: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.saml.attrUsername')}</Label>
            <Input className="h-8 text-xs" value={form.attrUsername || ''}
              onChange={(e) => setForm((f) => ({ ...f, attrUsername: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.saml.attrEmail')}</Label>
            <Input className="h-8 text-xs" value={form.attrEmail || ''}
              onChange={(e) => setForm((f) => ({ ...f, attrEmail: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.saml.attrDisplayName')}</Label>
            <Input className="h-8 text-xs" value={form.attrDisplayName || ''}
              onChange={(e) => setForm((f) => ({ ...f, attrDisplayName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.saml.attrRole')}</Label>
            <Input className="h-8 text-xs" value={form.attrRole || ''}
              onChange={(e) => setForm((f) => ({ ...f, attrRole: e.target.value || null }))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.saml.roleAdminValue')}</Label>
          <Input className="h-8 text-xs" value={form.roleAdminValue || ''}
            onChange={(e) => setForm((f) => ({ ...f, roleAdminValue: e.target.value || null }))} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Switch checked={!!form.autoProvision} onCheckedChange={(v) => setForm((f) => ({ ...f, autoProvision: v }))} />
          <Label className="text-xs">{t('settings.saml.autoProvision')}</Label>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.saml.defaultRole')}</Label>
          <Select value={form.defaultRole || 'viewer'} onValueChange={(v) => setForm((f) => ({ ...f, defaultRole: v as 'admin' | 'viewer' }))}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{t('settings.users.roleAdmin')}</SelectItem>
              <SelectItem value="viewer">{t('settings.users.roleViewer')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('common.loading') : t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Spotify Tab ─────────────────────────────────────────────

function SpotifyTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ['spotify-settings'], queryFn: spotifyApi.settings });
  const [form, setForm] = useState<{ enabled: boolean; clientId: string; clientSecret: string; maxAlbumTracks: number }>({
    enabled: false, clientId: '', clientSecret: '', maxAlbumTracks: 50,
  });

  const [seededSettings, setSeededSettings] = useState<typeof settings>(undefined);
  if (settings && settings !== seededSettings) {
    setSeededSettings(settings);
    setForm({
      enabled: settings.enabled,
      clientId: settings.clientId || '',
      clientSecret: '',
      maxAlbumTracks: settings.maxAlbumTracks,
    });
  }

  const save = useMutation({
    mutationFn: () => spotifyApi.updateSettings({
      enabled: form.enabled,
      clientId: form.clientId,
      clientSecret: form.clientSecret || undefined,
      maxAlbumTracks: form.maxAlbumTracks,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spotify-settings'] });
      toast.success(t('settings.spotify.toastSaved'));
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.spotify.toastSaveFailed')),
  });

  if (isLoading || !settings) return <PageLoader />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('settings.spotify.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <p className="text-[11px] text-muted-foreground">
          {t('settings.spotify.descriptionPre')} <span className="font-mono">!play</span> /{' '}
          <span className="font-mono">/play</span> {t('settings.spotify.descriptionOr')} <span className="font-mono">!spotify</span>{t('settings.spotify.descriptionMid')}{' '}
          <a className="underline" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            {t('settings.spotify.dashboardLink')}
          </a>{' '}
          {t('settings.spotify.descriptionPost')}
        </p>

        <div className="flex items-center gap-2">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          <Label className="text-xs">{t('settings.spotify.enable')}</Label>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.spotify.clientId')}</Label>
          <Input className="h-8 text-xs" value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.spotify.clientSecret')}</Label>
          <Input className="h-8 text-xs" type="password"
            placeholder={settings.hasClientSecret ? t('settings.spotify.clientSecretPlaceholderSet') : t('settings.spotify.clientSecretPlaceholder')}
            value={form.clientSecret} onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.spotify.maxAlbumTracks')}</Label>
          <Input className="h-8 text-xs w-32" type="number" min={1} value={form.maxAlbumTracks}
            onChange={(e) => setForm((f) => ({ ...f, maxAlbumTracks: parseInt(e.target.value) || 50 }))} />
        </div>

        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('settings.spotify.saving') : t('settings.spotify.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Music Bot Commands Tab ──────────────────────────────────

const NO_GROUP = 'none';

function MusicCommandsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['music-command-settings'],
    queryFn: musicCommandSettingsApi.get,
  });
  const { data: groupsData } = useServerGroups();
  const groups = Array.isArray(groupsData) ? groupsData : [];

  const [form, setForm] = useState<{ musicCommandSgid: string; adminCommandSgid: string; notifyNowPlaying: boolean }>({
    musicCommandSgid: NO_GROUP, adminCommandSgid: NO_GROUP, notifyNowPlaying: false,
  });

  const [seededSettings, setSeededSettings] = useState<typeof settings>(undefined);
  if (settings && settings !== seededSettings) {
    setSeededSettings(settings);
    setForm({
      musicCommandSgid: settings.musicCommandSgid ? String(settings.musicCommandSgid) : NO_GROUP,
      adminCommandSgid: settings.adminCommandSgid ? String(settings.adminCommandSgid) : NO_GROUP,
      notifyNowPlaying: settings.notifyNowPlaying,
    });
  }

  const save = useMutation({
    mutationFn: () => musicCommandSettingsApi.update({
      musicCommandSgid: form.musicCommandSgid === NO_GROUP ? null : parseInt(form.musicCommandSgid),
      adminCommandSgid: form.adminCommandSgid === NO_GROUP ? null : parseInt(form.adminCommandSgid),
      notifyNowPlaying: form.notifyNowPlaying,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['music-command-settings'] });
      toast.success(t('settings.musicCommands.toastSaved'));
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.musicCommands.toastSaveFailed')),
  });

  if (isLoading || !settings) return <PageLoader />;

  const groupSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_GROUP}>{t('settings.musicCommands.openToAll')}</SelectItem>
        {groups.map((g: any) => (
          <SelectItem key={g.sgid} value={String(g.sgid)}>{g.name} (#{g.sgid})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('settings.musicCommands.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <p className="text-[11px] text-muted-foreground">{t('settings.musicCommands.description')}</p>

        {groups.length === 0 && (
          <p className="text-[11px] text-amber-500">{t('settings.musicCommands.noServerHint')}</p>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.musicCommands.musicGroup')}</Label>
          {groupSelect(form.musicCommandSgid, (v) => setForm((f) => ({ ...f, musicCommandSgid: v }))) }
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.musicCommands.adminGroup')}</Label>
          {groupSelect(form.adminCommandSgid, (v) => setForm((f) => ({ ...f, adminCommandSgid: v }))) }
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={form.notifyNowPlaying} onCheckedChange={(v) => setForm((f) => ({ ...f, notifyNowPlaying: v }))} />
          <Label className="text-xs">{t('settings.musicCommands.notifyNowPlaying')}</Label>
        </div>

        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('settings.musicCommands.saving') : t('settings.musicCommands.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Password Policy Card ────────────────────────────────────

function PasswordPolicyCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: policy } = useQuery({ queryKey: ['password-policy'], queryFn: usersApi.passwordPolicy });
  const [minLength, setMinLength] = useState(12);
  const [requireComplexity, setRequireComplexity] = useState(true);

  const [seededPolicy, setSeededPolicy] = useState<typeof policy>(undefined);
  if (policy && policy !== seededPolicy) {
    setSeededPolicy(policy);
    setMinLength(policy.minLength);
    setRequireComplexity(policy.requireComplexity);
  }

  const save = useMutation({
    mutationFn: () => usersApi.updatePasswordPolicy({ minLength, requireComplexity }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['password-policy'] }); toast.success(t('settings.users.passwordPolicy.toastSaved')); },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.users.passwordPolicy.toastSaveFailed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('settings.users.passwordPolicy.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        <div className="flex items-center gap-3">
          <Label className="text-xs w-40">{t('settings.users.passwordPolicy.minLength')}</Label>
          <Input className="h-8 text-xs w-24" type="number" min={1} max={128} value={minLength}
            onChange={(e) => setMinLength(parseInt(e.target.value) || 1)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={requireComplexity} onCheckedChange={setRequireComplexity} />
          <Label className="text-xs font-normal">
            {t('settings.users.passwordPolicy.requireComplexity')}
            <span className="text-muted-foreground"> {t('settings.users.passwordPolicy.requireComplexityHint')}</span>
          </Label>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t('settings.users.passwordPolicy.appliedHint')}
        </p>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('settings.users.passwordPolicy.saving') : t('settings.users.passwordPolicy.savePolicy')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Journal Retention Card ──────────────────────────────────

function JournalRetentionCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['journal-retention'], queryFn: journalApi.retention });
  const [days, setDays] = useState(90);

  const [seededData, setSeededData] = useState<typeof data>(undefined);
  if (data && data !== seededData) {
    setSeededData(data);
    setDays(data.retentionDays);
  }

  const save = useMutation({
    mutationFn: () => journalApi.updateRetention(days),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journal-retention'] }); toast.success(t('settings.users.journalRetention.toastSaved')); },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.users.journalRetention.toastSaveFailed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('settings.users.journalRetention.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        <div className="flex items-center gap-3">
          <Label className="text-xs w-40">{t('settings.users.journalRetention.retentionDays')}</Label>
          <Input className="h-8 text-xs w-24" type="number" min={0} max={3650} value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 0)} />
        </div>
        <p className="text-[10px] text-muted-foreground">{t('settings.users.journalRetention.hint')}</p>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('settings.users.journalRetention.saving') : t('settings.users.journalRetention.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Reverse Proxy Card ──────────────────────────────────────

function ReverseProxyCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['proxy-settings'], queryFn: proxyApi.get });
  const [hops, setHops] = useState(1);

  const [seededData, setSeededData] = useState<typeof data>(undefined);
  if (data && data !== seededData) {
    setSeededData(data);
    setHops(data.trustHops);
  }

  const save = useMutation({
    mutationFn: () => proxyApi.update(hops),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proxy-settings'] }); toast.success(t('settings.users.reverseProxy.toastSaved')); },
    onError: (err: any) => toast.error(err.response?.data?.error || t('settings.users.reverseProxy.toastSaveFailed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('settings.users.reverseProxy.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        <p className="text-[11px] text-muted-foreground">
          {t('settings.users.reverseProxy.description')}
        </p>
        <div className="flex items-center gap-3">
          <Label className="text-xs w-40">{t('settings.users.reverseProxy.trustedHops')}</Label>
          <Input className="h-8 text-xs w-24" type="number" min={0} max={16} value={hops}
            onChange={(e) => setHops(parseInt(e.target.value) || 0)} />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t('settings.users.reverseProxy.detectedIpPre')} <span className="font-mono-data">{data?.detectedIp || '—'}</span>.
          {' '}{t('settings.users.reverseProxy.detectedIpPost')}
        </p>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('settings.users.reverseProxy.saving') : t('settings.users.reverseProxy.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
