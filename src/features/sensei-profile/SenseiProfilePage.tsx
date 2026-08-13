// SenseiProfilePage — profil sensei: data diri, statistik jam,
// kalender mingguan personal (reuse ScheduleBlock + useResolvedJadwal),
// dan breakdown jam mengajar per kelas bulan berjalan.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopBar, PeriodNav } from '@/components/layout/TopBar';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { JenisBadge } from '@/components/ui/Badge';
import { ScheduleBlock } from '@/features/timeline/ScheduleBlock';
import { JadwalDetailModal } from '@/features/timeline/JadwalDetailModal';
import { useResolvedJadwal } from '@/features/timeline/useResolvedJadwal';
import { getSensei } from '@/lib/api/sensei';
import { hitungJamMengajar, hitungJamPerKelas } from '@/lib/api/analytics';
import { useAsyncData } from '@/app/useAsyncData';
import { HARI_INDO, type JadwalResolved } from '@/lib/types/domain';
import {
  addDays,
  endOfMonth,
  formatBulan,
  formatTanggalPanjang,
  formatTanggalPendek,
  startOfMonth,
  startOfWeek,
  todayWIB,
} from '@/lib/time';

export function SenseiProfilePage() {
  const { id = '' } = useParams<{ id: string }>();
  const sensei = useAsyncData(() => getSensei(id), [id]);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayWIB()));
  const weekEnd = addDays(weekStart, 6);

  const jadwal = useResolvedJadwal(weekStart, weekEnd, { senseiId: id });
  const jamMinggu = useAsyncData(() => hitungJamMengajar(weekStart, weekEnd, id), [weekStart, weekEnd, id]);

  const monthStart = startOfMonth(todayWIB());
  const monthEnd = endOfMonth(todayWIB());
  const jamPerKelas = useAsyncData(() => hitungJamPerKelas(id, monthStart, monthEnd), [id, monthStart]);

  const [selected, setSelected] = useState<JadwalResolved | null>(null);

  const byHari = useMemo(() => {
    const map = new Map<string, JadwalResolved[]>();
    for (const j of jadwal.jadwal) {
      const arr = map.get(j.hari) ?? [];
      arr.push(j);
      map.set(j.hari, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
    }
    return map;
  }, [jadwal.jadwal]);

  if (sensei.loading) return <LoadingState label="Memuat profil..." />;
  if (sensei.error || !sensei.data) {
    return <ErrorState message={sensei.error ?? 'Sensei tidak ditemukan'} onRetry={() => void sensei.reload()} />;
  }
  const s = sensei.data;
  const jam = jamMinggu.data?.[0];

  return (
    <>
      <TopBar
        title={s.nama}
        subtitle="Profil Sensei"
        actions={
          <Link to="/sensei">
            <Button variant="outline">
              <Icon name="arrow_back" size={16} /> Kembali
            </Button>
          </Link>
        }
      />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
          {/* Header profil */}
          <section className="flex flex-wrap items-center gap-5 rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-2xl font-bold text-on-primary-fixed">
              {s.nama.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{s.nama}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${
                    s.is_aktif ? 'bg-cat-bimbel text-cat-bimbel-text' : 'bg-error-container text-on-error-container'
                  }`}
                >
                  {s.is_aktif ? s.status : 'Nonaktif'}
                </span>
                {s.jlpt_level && (
                  <span className="rounded-full bg-primary-container/20 px-2.5 py-0.5 font-label-sm text-label-sm text-primary">
                    JLPT {s.jlpt_level}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(s.bahasa_ajar ?? []).map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Info cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCard icon="call" label="Kontak" value={s.kontak ?? '-'} />
            <InfoCard
              icon="calendar_month"
              label="Bergabung"
              value={s.tanggal_bergabung ? formatTanggalPanjang(s.tanggal_bergabung) : '-'}
            />
            <InfoCard
              icon="target"
              label="Target Mingguan"
              value={s.target_jam_minggu != null ? `${s.target_jam_minggu} jam` : 'Belum diset'}
            />
          </div>

          {/* Statistik minggu tampil */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5">
              <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Jam mengajar {formatTanggalPendek(weekStart)} - {formatTanggalPendek(weekEnd)}
              </p>
              <p className="mt-1 font-display-lg text-display-lg text-on-surface">
                {jamMinggu.loading ? '…' : `${jam?.total_jam ?? 0} jam`}
                <span className="ml-2 font-body-md text-body-md text-secondary">{jam?.jumlah_sesi ?? 0} sesi</span>
              </p>
              {s.target_jam_minggu != null && jam && (
                <p
                  className={`font-label-sm text-label-sm ${
                    jam.total_jam >= s.target_jam_minggu ? 'text-cat-bimbel-text' : 'text-secondary'
                  }`}
                >
                  {jam.total_jam >= s.target_jam_minggu
                    ? `Target mingguan tercapai (${s.target_jam_minggu} jam)`
                    : `Kurang ${s.target_jam_minggu - jam.total_jam} jam dari target`}
                </p>
              )}
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5">
              <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Jam mengajar {formatBulan(monthStart)}
              </p>
              <p className="mt-1 font-display-lg text-display-lg text-on-surface">
                {jamPerKelas.loading
                  ? '…'
                  : `${(jamPerKelas.data ?? []).reduce((acc, k) => acc + k.total_jam, 0)} jam`}
                <span className="ml-2 font-body-md text-body-md text-secondary">
                  {(jamPerKelas.data ?? []).reduce((acc, k) => acc + k.jumlah_sesi, 0)} sesi
                </span>
              </p>
            </div>
          </div>

          {/* Kalender mingguan */}
          <section className="rounded-card border border-outline-variant bg-surface-container-lowest">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant p-4">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Kalender Mingguan</h3>
              <PeriodNav
                label={`${formatTanggalPendek(weekStart)} - ${formatTanggalPendek(weekEnd)}`}
                onPrev={() => setWeekStart(addDays(weekStart, -7))}
                onNext={() => setWeekStart(addDays(weekStart, 7))}
              />
            </div>
            {jadwal.loading ? (
              <LoadingState label="Memuat kalender..." />
            ) : jadwal.error ? (
              <ErrorState message={jadwal.error} onRetry={() => void jadwal.reload()} />
            ) : (
              <div className="grid grid-cols-1 gap-px overflow-x-auto bg-outline-variant/40 sm:grid-cols-7">
                {HARI_INDO.map((hari, i) => {
                  const tanggal = addDays(weekStart, i);
                  const items = byHari.get(hari) ?? [];
                  return (
                    <div key={hari} className="min-h-[120px] bg-surface-container-lowest">
                      <div className="border-b border-outline-variant p-2 text-center">
                        <p className="font-label-md text-label-md text-on-surface">{hari}</p>
                        <p className="font-label-sm text-label-sm text-secondary">{tanggal.slice(8)}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 p-2">
                        {items.length === 0 ? (
                          <p className="py-2 text-center font-label-sm text-label-sm text-outline-variant">-</p>
                        ) : (
                          items.map((j) => (
                            <ScheduleBlock key={j.slot_id} jadwal={j} compact onClick={() => setSelected(j)} />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Breakdown per kelas (bulan berjalan) */}
          <section className="rounded-card border border-outline-variant bg-surface-container-lowest">
            <div className="border-b border-outline-variant p-4">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Jam Mengajar per Kelas: {formatBulan(monthStart)}
              </h3>
            </div>
            {jamPerKelas.loading ? (
              <LoadingState label="Memuat rincian..." />
            ) : jamPerKelas.error ? (
              <ErrorState message={jamPerKelas.error} onRetry={() => void jamPerKelas.reload()} />
            ) : (jamPerKelas.data ?? []).length === 0 ? (
              <EmptyState
                icon="bar_chart"
                title="Belum ada jam mengajar bulan ini"
                description="Jam dihitung dari jadwal berstatus aktif."
              />
            ) : (
              <ul className="divide-y divide-outline-variant">
                {(jamPerKelas.data ?? []).map((k) => (
                  <li key={k.kelas_id} className="flex items-center justify-between gap-3 p-4 hover:bg-hover-row">
                    <div className="flex min-w-0 items-center gap-3">
                      <JenisBadge jenis={k.kelas_jenis} />
                      <p className="truncate font-body-md text-body-md text-on-surface">{k.kelas_nama}</p>
                    </div>
                    <p className="shrink-0 font-label-md text-label-md text-on-surface">
                      {k.total_jam} jam
                      <span className="ml-2 font-label-sm text-label-sm text-secondary">{k.jumlah_sesi} sesi</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <JadwalDetailModal jadwal={selected} onClose={() => setSelected(null)} onChanged={() => void jadwal.reload()} />
    </>
  );
}

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant">
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{label}</p>
        <p className="truncate font-body-md text-body-md text-on-surface">{value}</p>
      </div>
    </div>
  );
}
