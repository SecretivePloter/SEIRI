// AdminPage — kelola master data: Sensei, Klien/Murid, Kelas, Ruangan.
// Semua aksi tulis hanya utk role admin; viewer melihat read-only.
// Flow "hapus" sensei/ruangan diganti nonaktifkan (asumsi #2) — ada guard
// jumlah jadwal mendatang + ConfirmDialog eksplisit.

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useIsAdmin } from '@/stores/authStore';
import { AdminSenseiTab } from './AdminSenseiTab';
import { AdminKlienTab } from './AdminKlienTab';
import { AdminKelasTab } from './AdminKelasTab';
import { AdminRuanganTab } from './AdminRuanganTab';
import { AdminSesiTab } from './AdminSesiTab';

type Tab = 'sensei' | 'klien' | 'kelas' | 'ruangan' | 'sesi';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'sensei', label: 'Sensei' },
  { id: 'klien', label: 'Klien / Murid' },
  { id: 'kelas', label: 'Kelas' },
  { id: 'ruangan', label: 'Ruangan' },
  { id: 'sesi', label: 'Aturan Sesi' },
];

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('sensei');
  const isAdmin = useIsAdmin();

  return (
    <>
      <TopBar title="Admin: Manajemen Data" subtitle="Kelola master data sistem" />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
          {!isAdmin && (
            <p className="rounded border border-outline-variant bg-surface-container-low px-4 py-2 font-body-md text-body-md text-secondary">
              Mode viewer: hanya melihat data. Aksi tulis membutuhkan role admin.
            </p>
          )}

          <div className="flex gap-1 border-b border-outline-variant">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-4 py-2.5 font-label-md text-label-md transition-colors ${
                  tab === t.id ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'sensei' && <AdminSenseiTab isAdmin={isAdmin} />}
          {tab === 'klien' && <AdminKlienTab isAdmin={isAdmin} />}
          {tab === 'kelas' && <AdminKelasTab isAdmin={isAdmin} />}
          {tab === 'ruangan' && <AdminRuanganTab isAdmin={isAdmin} />}
          {tab === 'sesi' && <AdminSesiTab isAdmin={isAdmin} />}
        </div>
      </main>
    </>
  );
}
