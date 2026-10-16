import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { applyUserLanguage } from '@/hooks/use-auth';

export default function SsoCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  // Any error visible in the URL (or a missing code) is known synchronously
  // during render — compute it up front so the effect only ever performs the
  // async network call, never a synchronous setState.
  const initialError = params.get('error') || (!params.get('code') ? 'missing_code' : null);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    const code = params.get('code');
    if (initialError || !code) return;
    authApi.samlExchange(code)
      .then((res) => {
        if (res.accessToken) {
          setAuth(res.accessToken, res.refreshToken, res.user);
          applyUserLanguage(res.user);
          navigate('/dashboard', { replace: true });
        } else {
          // MFA required: hand off to the login page's MFA step via router state.
          navigate('/login', { replace: true, state: { mfa: res } });
        }
      })
      .catch(() => setError('exchange_failed'));
  }, [params, initialError, navigate, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-sm">
      {error
        ? <div className="space-y-2 text-center">
            <p className="text-destructive">{t(`login.ssoError.${error}`, t('login.ssoError.generic'))}</p>
            <a className="text-primary underline" href="/login">{t('login.backToLogin')}</a>
          </div>
        : <p className="text-muted-foreground">{t('login.ssoProcessing')}</p>}
    </div>
  );
}
