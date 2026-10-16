import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { useNavigate } from 'react-router';
import { setLanguage } from '../i18n';

/** Apply a user's saved language to the UI, if any. */
export function applyUserLanguage(user?: { language?: string | null } | null): void {
  if (user?.language) setLanguage(user.language);
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.refreshToken, data.user);
      applyUserLanguage(data.user);
      navigate('/dashboard');
    },
  });
}

export function useLogout() {
  const { refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  return () => {
    if (refreshToken) authApi.logout(refreshToken).catch(() => {});
    logout();
    navigate('/login');
  };
}
