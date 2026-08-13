// RequireAuth — gate route: pastikan session ada & profile ter-load sebelum
// render halaman. Jika belum login -> redirect ke /login. Viewer (read-only)
// boleh masuk; hanya admin yang melihat tombol aksi tulis (via useIsAdmin).

import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingState } from '@/components/ui/States';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile, initialized, init } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!initialized) void init();
  }, [initialized, init]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState label="Memeriksa sesi..." />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
