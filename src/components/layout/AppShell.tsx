// AppShell — layout root: sidebar + area konten + toast viewport.

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ToastViewport } from '@/components/ui/Toast';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-on-surface">
      <Sidebar />
      <div className="flex h-full flex-1 flex-col overflow-hidden md:ml-sidebar-width">
        {children}
      </div>
      <ToastViewport />
    </div>
  );
}
