// KelasPage — daftar kelas aktif: summary cards per jenis + tabel kelas
// dengan info klien & jumlah slot aktifnya (2 query total, tanpa N+1).

import { useMemo, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Input } from '@/components/ui/Input';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { JenisBadge, jenisStyles } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { listKelas } from '@/lib/api/kelas';
import { listJadwalSlot } from '@/lib/api/jadwal';
import { useAsyncData } from '@/app/useAsyncData';
import type { JenisKelas, Kelas } from '@/lib/types/domain';
import { JENIS_KELAS_LIST } from '@/lib/types/domain';
import { MultiSelect } from '@/components/ui/MultiSelect';

export function KelasPage() {
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState<JenisKelas[]>([]);
  const kelasQ = useAsyncData(() => listKelas(), []);
  // Slot aktif utk menghitung jumlah sesi per kelas — 1 query, agregasi klien.
  const jadwalQ = useAsyncData(() => listJadwalSlot({ status: 'aktif' }), []);

  const sesiPerKelas = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of jadwalQ.data ?? []) {
      map.set(j.kelas_id, (map.get(j.kelas_id) ?? 0) + 1);
    }
    return map;
  }, [jadwalQ.data]);

  const rows = useMemo(() => {
    const list = kelasQ.data ?? [];
    const s = search.toLowerCase();
    return list.filter((k) => {
      if (jenisFilter.length > 0 && !jenisFilter.includes(k.jenis)) return false;
      if (s && !`${k.nama_kelas} ${k.klien?.nama ?? ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [kelasQ.data, search, jenisFilter]);

  const perJenis = useMemo(() => {
    const map = new Map<JenisKelas, number>();
    for (const k of kelasQ.data ?? []) map.set(k.jenis, (map.get(k.jenis) ?? 0) + 1);
    return map;
  }, [kelasQ.data]);

  const columns: Column<Kelas>[] = [
    {
      key: 'nama',
      header: 'Nama Kelas',
      render: (k) => <p className="font-body-md text-body-md text-on-surface">{k.nama_kelas}</p>,
    },
    { key: 'jenis', header: 'Jenis', render: (k) => <JenisBadge jenis={k.jenis} /> },
    {
      key: 'klien',
      header: 'Klien / Murid',
      render: (k) => (
        <div>
          <p className="font-body-md text-body-md text-on-surface">{k.klien?.nama ?? '-'}</p>
          {k.klien && <p className="font-label-sm text-label-sm text-secondary capitalize">{k.klien.jenis}</p>}
        </div>
      ),
    },
    {
      key: 'sesi',
      header: 'Slot Aktif',
      render: (k) => <span className="font-body-md text-body-md text-on-surface">{sesiPerKelas.get(k.id) ?? 0} slot</span>,
    },
  ];

  return (
    <>
      <TopBar title="Daftar Kelas" subtitle={`${kelasQ.data?.length ?? 0} kelas aktif`} />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
          {/* Summary per jenis (9 kategori, v2) */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {JENIS_KELAS_LIST.map((j) => (
              <div key={j} className={`rounded-card border-l-4 ${jenisStyles[j].bg} ${jenisStyles[j].border} p-4`}>
                <p className={`font-label-sm text-label-sm uppercase tracking-wider ${jenisStyles[j].text}`}>{j}</p>
                <p className={`mt-1 font-display-lg text-display-lg ${jenisStyles[j].text}`}>{perJenis.get(j) ?? 0}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">kelas aktif</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-label-md text-label-md text-secondary">{rows.length} kelas ditampilkan</p>
              <MultiSelect<JenisKelas>
                label="Jenis kelas"
                className="w-44"
                options={JENIS_KELAS_LIST.map((j) => ({ value: j, label: j }))}
                selected={jenisFilter}
                onToggle={(j) =>
                  setJenisFilter((cur) => (cur.includes(j) ? cur.filter((x) => x !== j) : [...cur, j]))
                }
              />
              {jenisFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => setJenisFilter([])}
                  className="font-label-md text-label-md text-error hover:underline"
                >
                  Reset filter
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-72">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <Input className="pl-9" placeholder="Cari kelas/klien..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
            {kelasQ.loading || jadwalQ.loading ? (
              <LoadingState label="Memuat kelas..." />
            ) : kelasQ.error ? (
              <ErrorState message={kelasQ.error} onRetry={() => void kelasQ.reload()} />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(k) => k.id}
                empty={<EmptyState icon="school" title="Belum ada kelas" description="Tambahkan kelas lewat halaman Admin." />}
              />
            )}
          </div>

          <p className="font-label-sm text-label-sm text-secondary">
            Kelas yang dinonaktifkan tidak muncul di sini tapi riwayat jadwalnya tetap utuh (kelola di halaman Admin).
          </p>
        </div>
      </main>
    </>
  );
}
