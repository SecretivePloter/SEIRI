// Router — semua route terpusat di sini (React Router v6 data router).
// Setiap halaman dibungkus RequireAuth (session) + RouteErrorBoundary
// (crash tidak mematikan seluruh app).

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary';
import { RequireAuth } from './RequireAuth';
import { LoginPage } from './LoginPage';
import { TimelinePage } from '@/features/timeline/TimelinePage';
import { TimelineRuanganPage } from '@/features/timeline/TimelineRuanganPage';
import { KanbanPage } from '@/features/kanban/KanbanPage';
import { JadwalListPage } from '@/features/jadwal/JadwalListPage';
import { FormInputJadwal } from '@/features/jadwal/FormInputJadwal';
import { KelasPage } from '@/features/kelas/KelasPage';
import { SenseiListPage } from '@/features/sensei-profile/SenseiListPage';
import { SenseiProfilePage } from '@/features/sensei-profile/SenseiProfilePage';
import { KetersediaanPage } from '@/features/ketersediaan/KetersediaanPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { LobbyDisplayPage } from '@/features/lobby/LobbyDisplayPage';

function page(children: React.ReactNode) {
  return (
    <RequireAuth>
      <AppShell>
        <RouteErrorBoundary>{children}</RouteErrorBoundary>
      </AppShell>
    </RequireAuth>
  );
}

/** Halaman full-screen tanpa sidebar (lobby TV signage). Tetap butuh login. */
function barePage(children: React.ReactNode) {
  return (
    <RequireAuth>
      <RouteErrorBoundary>{children}</RouteErrorBoundary>
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/timeline', element: page(<TimelinePage />) },
  { path: '/timeline/ruangan', element: page(<TimelineRuanganPage />) },
  { path: '/kanban', element: page(<KanbanPage />) },
  { path: '/jadwal', element: page(<JadwalListPage />) },
  { path: '/jadwal/new', element: page(<FormInputJadwal />) },
  { path: '/jadwal/:id/edit', element: page(<FormInputJadwal />) },
  { path: '/kelas', element: page(<KelasPage />) },
  { path: '/sensei', element: page(<SenseiListPage />) },
  { path: '/sensei/:id', element: page(<SenseiProfilePage />) },
  { path: '/ketersediaan', element: page(<KetersediaanPage />) },
  { path: '/dashboard', element: page(<DashboardPage />) },
  { path: '/admin', element: page(<AdminPage />) },
  { path: '/lobby-display', element: barePage(<LobbyDisplayPage />) },
  { path: '/', element: <Navigate to="/timeline" replace /> },
  { path: '*', element: <Navigate to="/timeline" replace /> },
]);
