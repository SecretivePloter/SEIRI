// SenseiListPage — daftar sensei sebagai kartu/grid utk masuk ke profil.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Input } from '@/components/ui/Input';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { listSensei } from '@/lib/api/sensei';
import { useAsyncData } from '@/app/useAsyncData';

export function SenseiListPage() {
  const [search, setSearch] = useState('');
  const q = useAsyncData(() => listSensei(), []);

  const rows = useMemo(() => {
    const list = q.data ?? [];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((x) => x.nama.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <>
      <TopBar title="Sensei" subtitle={`${q.data?.length ?? 0} sensei aktif`} />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <Input className="pl-9" placeholder="Cari sensei..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {q.loading ? (
            <LoadingState label="Memuat sensei..." />
          ) : q.error ? (
            <ErrorState message={q.error} onRetry={() => void q.reload()} />
          ) : rows.length === 0 ? (
            <EmptyState icon="person_search" title="Tidak ada sensei ditemukan" description="Tambahkan sensei lewat halaman Admin." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((s) => (
                <Link
                  key={s.id}
                  to={`/sensei/${s.id}`}
                  className="group flex items-center gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4 transition-colors hover:border-primary/40 hover:shadow-floating"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed font-bold">
                    {s.nama.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-label-md text-label-md text-on-surface group-hover:text-primary">{s.nama}</p>
                    <p className="truncate font-label-sm text-label-sm text-secondary">
                      {s.status}
                      {s.jlpt_level ? ` • JLPT ${s.jlpt_level}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(s.bahasa_ajar ?? []).slice(0, 2).map((b) => (
                        <span key={b} className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Icon name="chevron_right" size={18} className="shrink-0 text-outline-variant group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
