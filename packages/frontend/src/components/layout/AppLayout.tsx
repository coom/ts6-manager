import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/api/auth.api';
import { Toaster } from 'sonner';

export function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const setUser = useAuthStore((s) => s.setUser);

  // The persisted `user` is written only by setAuth, i.e. only on a real login:
  // setTokens leaves it alone on every refresh. So a role change never reaches
  // the navigation (Sidebar gates on isAdmin()) until the user logs out and
  // back in, and a session that lost its user — tokens present, user null —
  // stays that way for as long as the refresh token keeps rotating.
  // Re-reading the identity on mount corrects both on the next page load.
  // Shares the ['me'] key with Settings, so it costs nothing extra there.
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  useEffect(() => {
    // /auth/me answers { user: {...} }, matching how Settings reads this key.
    if (me?.user) setUser(me.user);
  }, [me, setUser]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto grid-bg">
          <div className="p-5 fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-popover text-popover-foreground border-border',
        }}
      />
    </div>
  );
}
