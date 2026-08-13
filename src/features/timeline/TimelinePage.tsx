// TimelinePage — grid sensei × jam (Today), sensei × hari (Weekly),
// kalender bulanan (Monthly). Realtime auto-refresh via useResolvedJadwal.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, ModeTabs, PeriodNav } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { JenisBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { TimelineGrid, type TimelineRow } from './TimelineGrid';
import { ScheduleBlock } from './ScheduleBlock';
import { useResolvedJadwal } from './useResolvedJadwal';
import { JadwalDetailModal } from './JadwalDetailModal';
import { listSensei } from '@/lib/api/sensei';
import { useAsyncData } from '@/app/useAsyncData';
import { useTimelineFilterStore, type TimelineMode } from '@/stores/timelineStore';
import type { JadwalResolved, JenisKelas } from '@/lib/types/domain';
import {
  todayWIB,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  formatTanggalPendek,
  formatBulan,
  dateRange,
} from '@/lib/time';

const JENIS_OPTIONS: JenisKelas[] = ['CLT', 'Bimbel', 'SSW', 'Private'];

export function TimelinePage() {
  const { mode, setMode, anchorDate, setAnchorDate, jenisFilter, toggleJenis, search, setSearch } =
    useTimelineFilterStore();
  const [selected, setSelected] = useState<JadwalResolved | null>(null);

  // Rentang tanggal sesuai mode
  const [from, to] = useMemo<[string, string]>(() => {
    if (mode === 'today') return [anchorDate, anchorDate];
    if (mode === 'weekly') {
      const s = startOfWeek(anchorDate);
      return [s, addDays(s, 6)];
    }
    return [startOfMonth(anchorDate), endOfMonth(anchorDate)];
  }, [mode, anchorDate]);

  const senseiQ = useAsyncData(listSensei, []);
  const { jadwal, loading, error, reload } = useResolvedJadwal(from, to);

  const filtered = useMemo(() => {
    const senseiNama = new Map(senseiQ.data?.map((s) => [s.id, s.nama]) ?? []);
    return jadwal.filter((j) => {
      if (jenisFilter.length > 0 && !jenisFilter.includes(j.kelas_jenis)) return false;
      if (search) {
        const hay = `${j.kelas_nama} ${senseiNama.get(j.sensei_id) ?? ''} ${j.ruangan_nama ?? ''}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [jadwal, jenisFilter, search, senseiQ.data]);

  const navigate = (dir: 1 | -1) => {
    if (mode === 'today') setAnchorDate(addDays(anchorDate, dir));
    else if (mode === 'weekly') setAnchorDate(addDays(anchorDate, dir * 7));
    else {
      const d = new Date(anchorDate + 'T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + dir);
      setAnchorDate(d.toISOString().slice(0, 10));
    }
  };

  const periodLabel =
    mode === 'today'
      ? formatTanggalPendek(anchorDate)
      : mode === 'weekly'
        ? `${formatTanggalPendek(from)} — ${formatTanggalPendek(to)}`
        : formatBulan(anchorDate);

  const senseiRows: TimelineRow[] = useMemo(
    () =>
      (senseiQ.data ?? [])
        .filter((s) => (search ? s.nama.toLowerCase().includes(search.toLowerCase()) : true))
        .map((s) => ({ id: s.id, label: s.nama, sublabel: s.status })),
    [senseiQ.data, search],
  );

  return (
    <>
      <TopBar
        title="Timeline Sensei"
        subtitle={periodLabel}
        nav={
          <ModeTabs<TimelineMode>
            options={[
              { value: 'today', label: 'Today' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            value={mode}
            onChange={setMode}
          />
        }
        actions={
          <Link to="/jadwal/new">
            <Button>
              <Icon name="add" size={16} /> New Schedule
            </Button>
          </Link>
        }
      />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
          {/* Filter bar */}
          <div className="flex flex-col gap-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {JENIS_OPTIONS.map((j) => (
                <button key={j} onClick={() => toggleJenis(j)} aria-pressed={jenisFilter.includes(j)}>
                  <span className={jenisFilter.includes(j) ? 'inline-block rounded-full ring-2 ring-primary/30' : 'inline-block'}>
                    <JenisBadge jenis={j} />
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <PeriodNav label={periodLabel} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />
              <div className="relative w-56">
                <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <Input
                  className="pl-9"
                  placeholder="Cari sensei/kelas…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {mode !== 'today' && (
                <Button variant="outline" onClick={() => setAnchorDate(todayWIB())}>
                  Hari ini
                </Button>
              )}
            </div>
          </div>

          {/* Body */}
          {senseiQ.loading || loading ? (
            <LoadingState label="Memuat timeline…" />
          ) : senseiQ.error || error ? (
            <ErrorState
              message={senseiQ.error ?? error ?? ''}
              onRetry={() => {
                void senseiQ.reload();
                void reload();
              }}
            />
          ) : (
            <>
              {mode === 'today' && (
                <TimelineGrid rows={senseiRows} jadwalByRow={groupBy(filtered, (j) => j.sensei_id)} onSelect={setSelected} />
              )}
              {mode === 'weekly' && (
                <WeeklyGrid days={dateRange(from, to)} rows={senseiRows} jadwal={filtered} onSelect={setSelected} />
              )}
              {mode === 'monthly' && <MonthlyGrid from={from} to={to} jadwal={filtered} onSelect={setSelected} />}
              {filtered.length === 0 && (
                <EmptyState
                  icon="event_busy"
                  title="Tidak ada jadwal di rentang ini"
                  description="Coba ubah filter, atau buat jadwal baru."
                />
              )}
            </>
          )}
        </div>
      </main>

      <JadwalDetailModal jadwal={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Mode weekly: baris = sensei, kolom = 7 hari; blok compact per hari. */
function WeeklyGrid({
  days,
  rows,
  jadwal,
  onSelect,
}: {
  days: string[];
  rows: TimelineRow[];
  jadwal: JadwalResolved[];
  onSelect: (j: JadwalResolved) => void;
}) {
  const today = todayWIB();
  const byCell = new Map<string, JadwalResolved[]>();
  for (const j of jadwal) {
    const k = `${j.sensei_id}|${j.tanggal_efektif}`;
    const arr = byCell.get(k);
    if (arr) arr.push(j);
    else byCell.set(k, [j]);
  }

  return (
    <div className="overflow-x-auto rounded-card border border-outline-variant bg-surface-container-lowest">
      <div className="min-w-[900px]">
        <div className="grid border-b border-outline-variant bg-thead" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
          <div className="border-r border-outline-variant p-3 font-label-sm text-label-sm text-secondary">Sensei</div>
          {days.map((d) => (
            <div
              key={d}
              className={`border-r border-outline-variant/50 p-3 text-center font-label-sm text-label-sm last:border-r-0 ${
                d === today ? 'bg-primary-fixed/20 font-bold text-primary' : 'text-secondary'
              }`}
            >
              {formatTanggalPendek(d)}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid border-b border-outline-variant last:border-b-0" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
            <div className="flex flex-col justify-center border-r border-outline-variant p-3">
              <p className="truncate font-label-md text-label-md text-on-surface">{row.label}</p>
              {row.sublabel && <p className="truncate font-label-sm text-label-sm text-secondary">{row.sublabel}</p>}
            </div>
            {days.map((d) => {
              const items = byCell.get(`${row.id}|${d}`) ?? [];
              return (
                <div key={d} className="flex min-h-[72px] flex-col gap-1 border-r border-outline-variant/30 p-1.5 last:border-r-0">
                  {items.map((j) => (
                    <div key={`${j.slot_id}-${d}`} className="h-[56px] shrink-0">
                      <ScheduleBlock jadwal={j} compact onClick={() => onSelect(j)} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mode monthly: kalender bulanan; sel menampilkan blok compact (maks 4 + counter). */
function MonthlyGrid({
  from,
  to,
  jadwal,
  onSelect,
}: {
  from: string;
  to: string;
  jadwal: JadwalResolved[];
  onSelect: (j: JadwalResolved) => void;
}) {
  const today = todayWIB();
  const days = dateRange(from, to);
  const byDay = groupBy(jadwal, (j) => j.tanggal_efektif);

  // padding awal agar Senin selalu di kiri (ISO week)
  const firstDow = (new Date(from + 'T00:00:00Z').getUTCDay() + 6) % 7; // 0=Senin
  const cells: Array<string | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...days,
  ];

  return (
    <div className="rounded-card border border-outline-variant bg-surface-container-lowest">
      <div className="grid grid-cols-7 border-b border-outline-variant bg-thead">
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((h) => (
          <div key={h} className="p-2 text-center font-label-sm text-label-sm text-secondary">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => (
          <div key={i} className="min-h-[110px] border-b border-r border-outline-variant/40 p-1.5 [&:nth-child(7n)]:border-r-0">
            {d && (
              <>
                <p className={`mb-1 font-label-sm text-label-sm ${d === today ? 'font-bold text-primary' : 'text-secondary'}`}>
                  {Number(d.slice(8, 10))}
                </p>
                <div className="flex flex-col gap-1">
                  {(byDay.get(d) ?? []).slice(0, 4).map((j) => (
                    <div key={`${j.slot_id}-${d}`} className="h-[26px]">
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
