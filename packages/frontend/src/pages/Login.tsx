import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router';
import { useNavigate, useLocation } from 'react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { authApi } from '@/api/auth.api';
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { applyUserLanguage } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { Loader2, AlertCircle, ShieldCheck, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

type Step = 'password' | 'setup' | 'code' | 'changePassword' | 'trusted';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('password');
  const [mfaToken, setMfaToken] = useState('');
  const [changeToken, setChangeToken] = useState('');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [trustedName, setTrustedName] = useState('');
  const [samlEnabled, setSamlEnabled] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const finish = (data: any) => {
    setAuth(data.accessToken, data.refreshToken, data.user);
    applyUserLanguage(data.user);
    navigate('/dashboard');
  };

  // Route any auth response to the right step: forced password change first,
  // then MFA (enrollment or code), otherwise a full session.
  const routeAuth = async (res: any) => {
    if (res.mustChangePassword) { setChangeToken(res.changeToken); setCurPw(password); setNewPw(''); setConfirmPw(''); setStep('changePassword'); return; }
    if (res.accessToken) { finish(res); return; }
    setMfaToken(res.mfaToken);
    if (res.mfaSetupRequired) {
      const setup = await authApi.mfaSetup(res.mfaToken);
      setQr(setup.qrDataUrl);
      setStep('setup');
    } else {
      setStep('code'); // mfaRequired
    }
  };

  useEffect(() => {
    if (isAuthenticated) return; // already signed in — no need to peek
    authApi.trustedPeek()
      .then((res) => {
        if (res.trusted) { setTrustedName(res.displayName || res.username); setStep('trusted'); }
      })
      .catch(() => { /* no trusted device */ });
  }, [isAuthenticated]);

  useEffect(() => {
    authApi.samlStatus().then((s) => setSamlEnabled(s.enabled)).catch(() => {});
  }, []);

  // SSO handoff: SsoCallback navigates here with { state: { mfa } } when the SAML
  // exchange resolved to an MFA challenge (never a full session — SsoCallback
  // handles those). mfaState is therefore always { mfaRequired } or
  // { mfaSetupRequired }. Enter the right step with pure setState during render
  // (StrictMode-safe); the enrollment QR fetch (a network call) runs in the
  // ref-guarded effect below, and a second effect clears the navigation state.
  const mfaState = (location.state as { mfa?: any } | null)?.mfa;
  const [mfaConsumed, setMfaConsumed] = useState(false);
  const ssoSetupFetchedRef = useRef(false);
  if (mfaState && !mfaConsumed) {
    setMfaConsumed(true);
    setMfaToken(mfaState.mfaToken);
    setStep(mfaState.mfaSetupRequired ? 'setup' : 'code');
  }
  useEffect(() => {
    // SSO enrollment: fetch the TOTP QR once (password flow already sets `qr`
    // before showing 'setup', so `!qr` targets only the SSO path).
    if (step === 'setup' && mfaToken && !qr && !ssoSetupFetchedRef.current) {
      ssoSetupFetchedRef.current = true;
      authApi.mfaSetup(mfaToken)
        .then((s) => setQr(s.qrDataUrl))
        .catch(() => setError(t('login.ssoError.generic')));
    }
  }, [step, mfaToken, qr, t]);
  useEffect(() => {
    if (mfaState) navigate(location.pathname, { replace: true, state: null });
  }, [mfaState, navigate, location.pathname]);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  // Absolute backend URL for the SSO redirect (same origin/base as the axios instance).
  const ssoLoginUrl = `${api.defaults.baseURL?.replace(/\/$/, '')}/auth/saml/login`;

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await routeAuth(await authApi.login(username, password, trustDevice));
    } catch {
      setError(t('login.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPw !== confirmPw) { setError(t('login.passwordsDoNotMatch')); return; }
    setBusy(true);
    try {
      await routeAuth(await authApi.loginChangePassword(changeToken, curPw, newPw, trustDevice));
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.changeFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Forced enrollment at login: confirm the first code, then show recovery codes.
  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await authApi.mfaEnable(code, mfaToken);
      setRecoveryCodes(res.recoveryCodes);
      setCode('');
      setStep('code');
    } catch {
      setError(t('login.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      finish(await authApi.loginMfa(mfaToken, code, trustDevice));
    } catch {
      setError(t('login.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const handleTrustedContinue = async () => {
    setError('');
    setBusy(true);
    try {
      finish(await authApi.trustedSession());
    } catch {
      setError(t('login.invalidCredentials'));
      setStep('password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-bg">
      <div className="fixed top-3 right-3 z-10"><LanguageSwitcher /></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm mx-4 relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <span className="text-primary font-bold text-xl font-mono-data text-glow">TS</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">TeamSpeak 6 Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('login.appSubtitle')}</p>
        </div>

        <Card className="border-border/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <h2 className="text-sm font-medium text-center text-muted-foreground">
              {step === 'trusted' || step === 'password' ? t('login.signInToContinue')
                : step === 'setup' ? t('login.twoFactorSetupTitle')
                : step === 'changePassword' ? t('login.changePasswordTitle')
                : t('login.twoFactorTitle')}
            </h2>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-md px-3 py-2 mb-4">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 'password' && (
              <>
                <form onSubmit={handlePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-xs">{t('login.username')}</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoComplete="username" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs">{t('login.password')}</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={trustDevice} onCheckedChange={(v) => setTrustDevice(v === true)} />
                      <span className="text-xs text-muted-foreground">{t('login.trustDevice')}</span>
                    </label>
                    {trustDevice && (
                      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{t('login.trustDeviceInfo')}</span>
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={busy || !username || !password}>
                    {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('login.signingIn')}</> : t('login.signIn')}
                  </Button>
                </form>
                {samlEnabled && (
                  <>
                    <div className="my-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-px flex-1 bg-border" /> {t('login.or')} <div className="h-px flex-1 bg-border" />
                    </div>
                    <a href={ssoLoginUrl} className="block">
                      <Button type="button" variant="outline" className="w-full">{t('login.sso')}</Button>
                    </a>
                  </>
                )}
              </>
            )}

            {step === 'setup' && (
              <form onSubmit={handleEnroll} className="space-y-4">
                <p className="text-xs text-muted-foreground">{t('login.setupPrompt')}</p>
                {qr && <img src={qr} alt="TOTP QR code" className="mx-auto h-44 w-44 rounded bg-white p-2" />}
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" autoFocus className="text-center tracking-widest" />
                <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('login.verifyAndContinue')}
                </Button>
              </form>
            )}

            {step === 'code' && (
              <form onSubmit={handleCode} className="space-y-4">
                {recoveryCodes && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-500 text-xs font-medium"><ShieldCheck className="h-3.5 w-3.5" /> {t('login.saveRecoveryCodes')}</div>
                    <p className="text-[10px] text-muted-foreground">{t('login.recoveryCodesHint')}</p>
                    <div className="grid grid-cols-2 gap-1 font-mono-data text-[11px]">
                      {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{recoveryCodes ? t('login.enterCodeToFinish') : t('login.enterCode')}</p>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456 / recovery code" inputMode="numeric" autoComplete="one-time-code" autoFocus className="text-center tracking-widest" />
                <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('login.verifying')}</> : t('login.verify')}
                </Button>
              </form>
            )}

            {step === 'changePassword' && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <p className="text-xs text-muted-foreground">{t('login.changePasswordPrompt')}</p>
                <div className="space-y-2">
                  <Label className="text-xs">{t('login.currentPassword')}</Label>
                  <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" autoFocus />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">{t('login.newPassword')}</Label>
                  <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">{t('login.confirmPassword')}</Label>
                  <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full" disabled={busy || !curPw || !newPw || !confirmPw}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('login.changingPassword')}</> : t('login.changeAndContinue')}
                </Button>
              </form>
            )}

            {step === 'trusted' && (
              <div className="space-y-4">
                <Button onClick={handleTrustedContinue} className="w-full" disabled={busy}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('login.signingIn')}</> : t('login.continueAs', { name: trustedName })}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('login.useAnotherAccount')}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-6 font-mono-data">TS6 WEBUI v1.0.0</p>
      </div>
    </div>
  );
}
