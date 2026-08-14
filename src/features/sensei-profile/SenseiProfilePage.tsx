// SenseiProfilePage — profil sensei: data diri, statistik jam,
// kalender mingguan personal (reuse ScheduleBlock + useResolvedJadwal),
// jadwal detail (harian/mingguan/bulanan) khusus sensei ini,
// dan breakdown jam mengajar per kelas bulan berjalan.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopBar, PeriodNav, ModeTabs } from '@/components/layout/TopBar';
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
  formatJam,
  formatTanggalPanjang,
  formatTanggalPendek,
  startOfMonth,
  startOfWeek,
  todayWIB,
  dateRange,
} from '@/lib/time';

type JadwalView = 'harian' | 'mingguan' | 'bulanan';

export function SenseiProfilePage() {
  const { id = '' } = useParams<{ id: string }>();
  const sensei = useAsyncData(() => getSensei(id), [id]);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayWIB()));
  const weekEnd = addDays(weekStart, 6);

  // View jadwal detail: harian / mingguan / bulanan (v2 poin 1)
  const [jadwalView, setJadwalView] = useState<JadwalView>('mingguan');
  const [anchorDate, setAnchorDate] = useState(() => todayWIB());
  const detailFrom = useMemo(() => {
    if (jadwalView === 'harian') return anchorDate;
    if (jadwalView === 'mingguan') return startOfWeek(anchorDate);
    return startOfMonth(anchorDate);
  }, [jadwalView, anchorDate]);
  const detailTo = useMemo(() => {
    if (jadwalView === 'harian') return anchorDate;
    if (jadwalView === 'mingguan') return addDays(detailFrom, 6);
    return endOfMonth(anchorDate);
  }, [jadwalView, detailFrom, anchorDate]);
  const detailJadwal = useResolvedJadwal(detailFrom, detailTo, { senseiId: id });

  const detailLabel =
    jadwalView === 'harian'
      ? formatTanggalPendek(anchorDate)
      : jadwalView === 'mingguan'
        ? `${formatTanggalPendek(detailFrom)} - ${formatTanggalPendek(detailTo)}`
        : formatBulan(anchorDate);
  const navigateDetail = (dir: 1 | -1) => {
    if (jadwalView === 'harian') setAnchorDate(addDays(anchorDate, dir));
    else if (jadwalView === 'mingguan') setAnchorDate(addDays(anchorDate, dir * 7));
    else {
      const d = new Date(anchorDate + 'T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + dir);
      setAnchorDate(d.toISOString().slice(0, 10));
    }
  };

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

          {/* Statistik minggu & bulan: JAM (1:1) + SESI (pengajian) terpisah */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5">
              <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Jam mengajar {formatTanggalPendek(weekStart)} - {formatTanggalPendek(weekEnd)}
              </p>
              <p className="mt-1 font-display-lg text-display-lg text-on-surface">
                {jamMinggu.loading ? '...' : `${jam?.total_jam ?? 0} jam`}
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
              <p className="mt-2 font-label-sm text-label-sm text-secondary">
                Jam dihitung 1:1; sesi untuk pengajian (aturan di Admin &gt; Aturan Sesi).
              </p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5">
              <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Jam mengajar {formatBulan(monthStart)}
              </p>
              <p className="mt-1 font-display-lg text-display-lg text-on-surface">
                {jamPerKelas.loading
                  ? '...'
                  : `${(jamPerKelas.data ?? []).reduce((acc, k) => acc + k.total_jam, 0)} jam`}
                <span className="ml-2 font-body-md text-body-md text-secondary">
                  {(jamPerKelas.data ?? []).reduce((acc, k) => acc + k.jumlah_sesi, 0)} sesi
                </span>
              </p>
            </div>
          </div>

          {/* Kalender mingguan (existing) */}
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

          {/* Jadwal detail sensei ini saja: harian / mingguan / bulanan (v2 poin 1) */}
          <section className="rounded-card border border-outline-variant bg-surface-container-lowest">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant p-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Jadwal Detail</h3>
                <ModeTabs<JadwalView>
                  options={[
                    { value: 'harian', label: 'Harian' },
                    { value: 'mingguan', label: 'Mingguan' },
                    { value: 'bulanan', label: 'Bulanan' },
                  ]}
                  value={jadwalView}
                  onChange={(v) => {
                    setJadwalView(v);
                    setAnchorDate(todayWIB());
                  }}
                />
              </div>
              <PeriodNav label={detailLabel} onPrev={() => navigateDetail(-1)} onNext={() => navigateDetail(1)} />
            </div>
            {detailJadwal.loading ? (
              <LoadingState label="Memuat jadwal detail..." />
            ) : detailJadwal.error ? (
              <ErrorState message={detailJadwal.error} onRetry={() => void detailJadwal.reload()} />
            ) : detailJadwal.jadwal.length === 0 ? (
              <EmptyState
                icon="event_busy"
                title="Tidak ada jadwal di periode ini"
                description="Jadwal dihitung dari slot aktif (rutin dihitung per tanggalnya)."
              />
            ) : (
              <div className="p-4">
                {jadwalView === 'harian' && <DetailList items={detailJadwal.jadwal} onSelect={setSelected} />}
                {jadwalView === 'mingguan' && <DetailWeekly items={detailJadwal.jadwal} onSelect={setSelected} />}
                {jadwalView === 'bulanan' && (
                  <DetailMonthly
                    days={dateRange(detailFrom, detailTo)}
                    items={detailJadwal.jadwal}
                    onSelect={setSelected}
                  />
                )}
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

      <JadwalDetailModal jadwal={selected} onClose={() => setSelected(null)} onChanged={() => void detailJadwal.reload()} />
    </>
  );
}

/** Daftar kronologis jadwal per hari (harian) */
function DetailList({ items, onSelect }: { items: JadwalResolved[]; onSelect: (j: JadwalResolved) => void }) {
  const sorted = [...items].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
  return (
    <ul className="flex flex-col gap-1.5">
      {sorted.map((j) => (
        <li key={`${j.slot_id}-${j.tanggal_efektif}`}>
          <button
            type="button"
            onClick={() => onSelect(j)}
            className="flex w-full flex-wrap items-center gap-3 rounded border border-border-soft bg-surface-container-low px-3 py-2 text-left hover:bg-surface-container"
          >
            <span className="font-label-md text-label-md text-on-surface">
              {formatJam(j.jam_mulai)}-{formatJam(j.jam_selesai)} WIB
            </span>
            <JenisBadge jenis={j.kelas_jenis} />
            <span className="font-body-md text-body-md text-on-surface">{j.kelas_nama}</span>
            <span className="ml-auto font-label-sm text-label-sm text-secondary">
              {j.tipe_lokasi === 'ruangan'
                ? `📍 ${j.ruangan_nama ?? 'Ruangan'}`
                : j.tipe_lokasi === 'kelas_perusahaan'
                  ? '🏢 Kantor klien'
                  : '🏠 Rumah murid'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Grid 7 kolom Senin-Minggu utk view mingguan */
function DetailWeekly({ items, onSelect }: { items: JadwalResolved[]; onSelect: (j: JadwalResolved) => void }) {
  const byHari = new Map<string, JadwalResolved[]>();
  for (const j of items) {
    const arr = byHari.get(j.hari) ?? [];
    arr.push(j);
    byHari.set(j.hari, arr);
  }
  for (const arr of byHari.values()) arr.sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-7 gap-px bg-outline-variant/40">
        {HARI_INDO.map((hari) => (
          <div key={hari} className="min-h-[120px] bg-surface-container-lowest">
            <div className="border-b border-outline-variant p-2 text-center">
              <p className="font-label-md text-label-md text-on-surface">{hari}</p>
            </div>
            <div className="flex flex-col gap-1.5 p-2">
              {(byHari.get(hari) ?? []).length === 0 ? (
                <p className="py-2 text-center font-label-sm text-label-sm text-outline-variant">-</p>
              ) : (
                (byHari.get(hari) ?? []).map((j) => (
                  <ScheduleBlock key={`${j.slot_id}-${j.tanggal_efektif}`} jadwal={j} compact onClick={() => onSelect(j)} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kalender bulanan utk view bulanan (maks 4 blok per sel + counter) */
function DetailMonthly({
  days,
  items,
  onSelect,
}: {
  days: string[];
  items: JadwalResolved[];
  onSelect: (j: JadwalResolved) => void;
}) {
  const today = todayWIB();
  const byDay = new Map<string, JadwalResolved[]>();
  for (const j of items) {
    const arr = byDay.get(j.tanggal_efektif) ?? [];
    arr.push(j);
    byDay.set(j.tanggal_efektif, arr);
  }
  const firstDow = (new Date(days[0] + 'T00:00:00Z').getUTCDay() + 6) % 7; // 0=Senin
  const cells: Array<string | null> = [...Array.from({ length: firstDow }, () => null), ...days];
  return (
    <div className="rounded-card border border-outline-variant">
      <div className="grid grid-cols-7 border-b border-outline-variant bg-thead">
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((h) => (
          <div key={h} className="p-2 text-center font-label-sm text-label-sm text-secondary">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => (
          <div key={i} className="min-h-[96px] border-b border-r border-outline-variant/40 p-1.5 [&:nth-child(7n)]:border-r-0">
            {d && (
              <>
                <p className={`mb-1 font-label-sm text-label-sm ${d === today ? 'font-bold text-primary' : 'text-secondary'}`}>
                  {Number(d.slice(8, 10))}
                </p>
                <div className="flex flex-col gap-1">
                  {(byDay.get(d) ?? []).slice(0, 4).map((j) => (
                    <div key={`${j.slot_id}-${d}`} className="h-[24px]">
                      <ScheduleBlock jadwal={j} compact onClick={() => onSelect(j)} />
                    </div>
                  ))}
                  {(byDay.get(d)?.length ?? 0) > 4 && (
                    <p className="font-label-sm text-label-sm text-secondary">+{(byDay.get(d)?.length ?? 0) - 4} lainnya</p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
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
