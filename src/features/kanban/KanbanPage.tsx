// KanbanPage — papan "loading kelas" sekilas (fitur baru v2.2).
// 3 kolom berdasarkan status waktu HARI INI (WIB):
//   * Akan Dimulai    (jam_mulai > sekarang)
//   * Sedang Berlangsung (mulai <= sekarang < selesai)
//   * Selesai         (sekarang >= selesai)
// Card per kelas: nama kelas + sensei + lokasi + jam, filterable per jenis.
// Realtime: jadwal_slot + jadwal_exception + timer WIB tiap detik.
// Klik card membuka JadwalDetailModal (dgn exception per tanggal).

import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { JenisBadge } from '@/components/ui/Badge';
import { useLobbyData } from '@/features/lobby/useLobbyData';
import { JadwalDetailModal } from '@/features/timeline/JadwalDetailModal';
import { listSensei } from '@/lib/api/sensei';
import { useAsyncData } from '@/app/useAsyncData';
import type { JadwalResolved, JenisKelas } from '@/lib/types/domain';
import { JENIS_KELAS_LIST } from '@/lib/types/domain';
import { formatJam, nowTimeWIB, timeToMinutes } from '@/lib/time';

const COLUMN_DEFS: Array<{
  key: string;
  title: string;
  emoji: string;
  accent: string;
  match: (s: string, e: string, n: number) => boolean;
}> = [
  {
    key: 'belum',
    title: 'Akan Dimulai',
    emoji: '🕒',
    accent: 'border-t-cat-benkyou-accent',
    match: (s, _e, n) => timeToMinutes(s) > n,
  },
  {
    key: 'sedang',
    title: 'Sedang Berlangsung',
    emoji: '▶️',
    accent: 'border-t-emerald-500',
    match: (s, e, n) => timeToMinutes(s) <= n && n < timeToMinutes(e),
  },
  {
    key: 'selesai',
    title: 'Selesai',
    emoji: '✅',
    accent: 'border-t-outline-variant',
    match: (_s, e, n) => n >= timeToMinutes(e),
  },
];

export function KanbanPage() {
  // Reuse lobby data resolver utk hari ini + realtime (aktif+planning).
  const { jadwal, loading, error, reload } = useLobbyData();
  const senseiQ = useAsyncData(listSensei, []);
  const [jenisFilter, setJenisFilter] = useState<JenisKelas[]>([]);
  const [selected, setSelected] = useState<JadwalResolved | null>(null);

  // Timer WIB tiap detik utk kolom status.
  const [nowStr, setNowStr] = useState(() => nowTimeWIB());
  useEffect(() => {
    const t = setInterval(() => setNowStr(nowTimeWIB()), 1000);
    return () => clearInterval(t);
  }, []);

  const nowMin = timeToMinutes(nowStr);

  const senseiNama = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of senseiQ.data ?? []) m.set(s.id, s.nama);
    return m;
  }, [senseiQ.data]);

  const filtered = useMemo(
    () => jadwal.filter((j) => (jenisFilter.length === 0 ? true : jenisFilter.includes(j.kelas_jenis))),
    [jadwal, jenisFilter],
  );

  return (
    <>
      <TopBar
        title="Kanban Kelas Hari Ini"
        subtitle={`Update ${nowStr} WIB`}
        actions={
          <div className="w-72">
            <MultiSelect<JenisKelas>
              label="Jenis kelas"
              options={JENIS_KELAS_LIST.map((j) => ({ value: j, label: j }))}
              selected={jenisFilter}
              onToggle={(j) => setJenisFilter((cur) => (cur.includes(j) ? cur.filter((x) => x !== j) : [...cur, j]))}
            />
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
          {loading ? (
            <LoadingState label="Memuat kanban..." />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="event_busy"
              title="Tidak ada kelas hari ini"
              description="Tidak ada jadwal yang cocok dengan filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {COLUMN_DEFS.map((col) => {
                const items = filtered
                  .filter((j) => j.dihitung && col.match(j.jam_mulai, j.jam_selesai, nowMin))
                  .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
                return (
                  <section
                    key={col.key}
                    className="flex min-h-[200px] flex-col rounded-xl border border-outline-variant bg-surface-container-lowest"
                  >
                    <header className={`rounded-t-xl border-t-4 ${col.accent} bg-surface-container px-4 py-3`}>
                      <h2 className="flex items-center gap-2 font-label-md text-label-md font-bold uppercase tracking-wider text-on-surface">
                        <span className="text-lg">{col.emoji}</span> {col.title}
                        <span className="ml-auto rounded-full bg-surface-container-low px-2 py-0.5 font-label-sm text-label-sm text-secondary">
                          {items.length}
                        </span>
                      </h2>
                    </header>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      {items.length === 0 ? (
                        <p className="flex min-h-[80px] items-center justify-center text-center font-body-md text-body-md text-secondary">
                          Tidak ada kelas
                        </p>
                      ) : (
                        items.map((j) => (
                          <button key={`${j.slot_id}-${j.tanggal_efektif}`} onClick={() => setSelected(j)} className="text-left">
                            <CardKelas j={j} senseiNama={senseiNama} />
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <JadwalDetailModal jadwal={selected} onClose={() => setSelected(null)} onChanged={() => void reload()} />
    </>
  );
}

function CardKelas({ j, senseiNama }: { j: JadwalResolved; senseiNama: Map<string, string> }) {
  return (
    <div className="w-full rounded-card border border-border-soft bg-surface-container-lowest p-3 text-left shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-body-lg text-body-lg font-semibold text-on-surface">{j.kelas_nama}</p>
        <JenisBadge jenis={j.kelas_jenis} />
      </div>
      <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
        {formatJam(j.jam_mulai)}-{formatJam(j.jam_selesai)} WIB • {senseiNama.get(j.sensei_efektif_id ?? j.sensei_id) ?? '-'}
      </p>
      <p className="truncate font-label-sm text-label-sm text-secondary">
        {j.tipe_lokasi === 'ruangan' ? '📍' : j.tipe_lokasi === 'kelas_perusahaan' ? '🏢' : '🏠'}{' '}
        {j.ruangan_nama ?? j.alamat_tujuan ?? (j.tipe_lokasi === 'kelas_perusahaan' ? 'Kantor klien' : 'Rumah murid')}
      </p>
    </div>
  );
}