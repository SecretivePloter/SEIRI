// Sidebar — 260px fixed, light bg, active item = border kiri indigo + tint
// (DESIGN.md). Menu konsisten di semua halaman prototype.

import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { logout } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/authStore';
import logoUrl from '@/assets/logo.png';

const NAV_ITEMS = [
  { to: '/timeline', icon: 'calendar_view_day', label: 'Timeline' },
  { to: '/timeline/ruangan', icon: 'meeting_room', label: 'Timeline Ruangan' },
  { to: '/jadwal', icon: 'event_note', label: 'Jadwal' },
  { to: '/kelas', icon: 'school', label: 'Daftar Kelas' },
  { to: '/sensei', icon: 'person_search', label: 'Sensei' },
  { to: '/ketersediaan', icon: 'event_available', label: 'Ketersediaan' },
  { to: '/dashboard', icon: 'analytics', label: 'Dashboard' },
  { to: '/admin', icon: 'settings_applications', label: 'Admin' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);

  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-sidebar-width flex-col border-r border-outline-variant bg-surface-container-lowest py-base md:flex">
      <div className="mb-6 flex flex-col items-center px-gutter pt-4">
        <img src={logoUrl} alt="Logo Ichikara" className="h-14 w-14 object-contain" />
        <h1 className="mt-2 text-center font-headline-md text-headline-md font-bold text-primary">
          Jadwal Sensei Ichikara
        </h1>
        <button
          onClick={() => navigate('/jadwal/new')}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
        >
          New Schedule
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/timeline'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 font-label-md text-label-md transition-colors ${
                isActive
                  ? 'border-l-4 border-primary bg-primary-container text-on-primary-container'
                  : 'text-secondary hover:bg-surface-container-low'
              }`
            }
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {profile && (
        <div className="border-t border-outline-variant px-4 py-3">
          <p className="truncate font-label-md text-label-md text-on-surface">{profile.nama ?? profile.email}</p>
          <button
            onClick={() => void logout()}
            className="mt-1 flex items-center gap-1 font-label-sm text-label-sm text-secondary hover:text-primary"
          >
            <Icon name="logout" size={14} /> Keluar
          </button>
        </div>
      )}
    </aside>
  );
}
