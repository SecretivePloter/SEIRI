// AppShell — layout root: sidebar + area konten + toast viewport.
// Mobile: sidebar disembunyikan, ganti drawer (hamburger di TopBar).

import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { ToastViewport } from '@/components/ui/Toast';

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-on-surface">
      <Sidebar />
      <div className="flex h-full flex-1 flex-col overflow-hidden md:ml-sidebar-width">
        {/* Mobile: tombol hamburger + drawer */}
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="contents">
          {children}
        </div>
        {/* Tombol hamburger utk mobile: overlay di kiri atas (di atas TopBar) */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed left-3 top-4 z-40 rounded-lg bg-surface p-2 shadow-sm md:hidden"
          aria-label="Buka menu navigasi"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
      <ToastViewport />
    </div>
  );
}
