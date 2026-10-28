import { useEffect, useMemo, useState } from 'react';
import { addDays, dateRange, formatJam, formatTanggalPanjang, startOfWeek, todayWIB } from '@/lib/time';
import { fetchInterpreterDisplaySchedule, fetchSenseiDisplaySchedule, type DisplayScheduleItem } from './displayApi';

type DisplayView = 'interpreter' | 'sensei';
type DisplayMode = 'cycle' | 'single';

function readConfig(): { mode: DisplayMode; view: DisplayView; interval: number } {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'single' ? 'single' : 'cycle';
  const view = params.get('view') === 'sensei' ? 'sensei' : 'interpreter';
  const requestedInterval = Number(params.get('interval'));
  const interval = Number.isFinite(requestedInterval) && requestedInterval > 0
    ? Math.min(600, Math.max(10, requestedInterval))
    : 30;
  return { mode, view, interval };
}

function formatWeekday(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

function groupByDate(items: DisplayScheduleItem[]): Map<string, DisplayScheduleItem[]> {
  const grouped = new Map<string, DisplayScheduleItem[]>();
  for (const item of items) grouped.set(item.tanggal, [...(grouped.get(item.tanggal) ?? []), item]);
  for (const rows of grouped.values()) rows.sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
  return grouped;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <time className="text-2xl font-semibold tabular-nums tracking-wide text-white">{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)} WIB</time>;
}

function FeedError({ message }: { message: string }) {
  return <div className="grid flex-1 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/5 p-8 text-center text-xl text-amber-100">Data display belum tersedia: {message}</div>;
}

function WeekCalendar({ items, dates, error }: { items: DisplayScheduleItem[]; dates: string[]; error: string | null }) {
  const grouped = useMemo(() => groupByDate(items), [items]);
  return <section className="flex min-h-0 flex-1 flex-col gap-5">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-300">Operasional interpreter</p><h2 className="mt-2 text-4xl font-bold text-white">Kalender Mingguan</h2></div><p className="text-xl text-slate-300">{formatTanggalPanjang(dates[0])} – {formatDay(dates[6])}</p></div>
    {error ? <FeedError message={error} /> : <div className="grid min-h-0 flex-1 grid-cols-7 gap-3">
      {dates.map((date) => {
        const dayItems = grouped.get(date) ?? [];
        return <article key={date} className="min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <header className="mb-4 border-b border-white/10 pb-3"><p className="text-sm font-semibold uppercase tracking-widest text-slate-400">{formatWeekday(date)}</p><p className="mt-1 text-2xl font-bold text-white">{formatDay(date)}</p></header>
          <div className="space-y-3 overflow-hidden">
            {dayItems.slice(0, 7).map((item, i) => <div key={`${date}-${item.nama}-${item.jam_mulai}-${i}`} className="rounded-xl border-l-4 border-cyan-400 bg-slate-900/70 px-3 py-3"><p className="text-lg font-bold tabular-nums text-cyan-200">{formatJam(item.jam_mulai)}–{formatJam(item.jam_selesai)}</p><p className="mt-1 truncate text-lg font-semibold text-white">{item.nama}</p></div>)}
            {dayItems.length === 0 && <p className="pt-2 text-base text-slate-500">Tidak ada jadwal</p>}
            {dayItems.length > 7 && <p className="text-sm font-semibold text-slate-400">+{dayItems.length - 7} jadwal lainnya</p>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

function SenseiTimeline({ items, date, error }: { items: DisplayScheduleItem[]; date: string; error: string | null }) {
  const rows = useMemo(() => {
    const byName = new Map<string, DisplayScheduleItem[]>();
    for (const item of items) byName.set(item.nama, [...(byName.get(item.nama) ?? []), item]);
    return [...byName.entries()].sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [items]);

  return <section className="flex min-h-0 flex-1 flex-col gap-5">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">Operasional edukasi</p><h2 className="mt-2 text-4xl font-bold text-white">Timeline Sensei</h2></div><p className="text-xl text-slate-300">{formatTanggalPanjang(date)}</p></div>
    {error ? <FeedError message={error} /> : rows.length === 0 ? <div className="grid flex-1 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl text-slate-400">Tidak ada jadwal sensei</div> :
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(180px,20%)_1fr] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="border-r border-white/10" />
        <div className="grid h-12 border-b border-white/10" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
          {Array.from({ length: 16 }, (_, hour) => <div key={hour} className="-ml-3 flex items-center text-sm tabular-nums text-slate-400">{String(hour + 7).padStart(2, '0')}:00</div>)}
        </div>
        <div className="col-span-2 grid min-h-0" style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))` }}>
          {rows.map(([name, schedule]) => <div key={name} className="grid min-h-0 grid-cols-[minmax(180px,20%)_1fr] border-b border-white/10 last:border-0">
            <div className="flex min-w-0 items-center border-r border-white/10 bg-white/[0.03] px-5"><p className="truncate text-xl font-semibold text-white">{name}</p></div>
            <div className="relative min-w-0 overflow-hidden">
              {Array.from({ length: 16 }, (_, hour) => <div key={hour} className="absolute bottom-0 top-0 border-l border-white/[0.06]" style={{ left: `${(hour / 15) * 100}%` }} />)}
              {[...schedule].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai)).map((item, i) => {
                const start = Math.max(420, Number(item.jam_mulai.slice(0, 2)) * 60 + Number(item.jam_mulai.slice(3, 5)));
                const end = Math.min(1320, Number(item.jam_selesai.slice(0, 2)) * 60 + Number(item.jam_selesai.slice(3, 5)));
                if (end <= start) return null;
                return <div key={`${item.jam_mulai}-${i}`} className="absolute bottom-2 top-2 z-[1] flex min-w-0 flex-col justify-center overflow-hidden rounded-lg border border-violet-300/30 bg-violet-400/20 px-3" style={{ left: `${((start - 420) / 900) * 100}%`, width: `${((end - start) / 900) * 100}%` }}><span className="truncate text-sm font-bold tabular-nums text-violet-100">{formatJam(item.jam_mulai)}–{formatJam(item.jam_selesai)}</span><span className="truncate text-xs text-violet-200">Mengajar</span></div>;
              })}
            </div>
          </div>)}
        </div>
      </div>}
  </section>;
}

export function DisplayPage() {
  const config = useMemo(readConfig, []);
  const [today, setToday] = useState(todayWIB);
  const weekStart = startOfWeek(today);
  const weekDates = dateRange(weekStart, addDays(weekStart, 6));
  const [interpreterItems, setInterpreterItems] = useState<DisplayScheduleItem[]>([]);
  const [senseiItems, setSenseiItems] = useState<DisplayScheduleItem[]>([]);
  const [interpreterError, setInterpreterError] = useState<string | null>(null);
  const [senseiError, setSenseiError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DisplayView>(config.view);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayWIB()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const results = await Promise.allSettled([
        fetchInterpreterDisplaySchedule(weekDates[0], weekDates[6]),
        fetchSenseiDisplaySchedule(today, today),
      ]);
      if (!alive) return;
      const [interpreterResult, senseiResult] = results;
      setInterpreterError(interpreterResult.status === 'rejected' ? 'Kalender interpreter tidak dapat dimuat.' : null);
      setSenseiError(senseiResult.status === 'rejected' ? 'Timeline sensei tidak dapat dimuat.' : null);
      if (interpreterResult.status === 'fulfilled') setInterpreterItems(interpreterResult.value);
      if (senseiResult.status === 'fulfilled') setSenseiItems(senseiResult.value);
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [today, weekDates[0], weekDates[6]]);

  useEffect(() => {
    if (config.mode !== 'cycle') return;
    const timer = window.setInterval(() => setActiveView((view) => view === 'interpreter' ? 'sensei' : 'interpreter'), config.interval * 1000);
    return () => window.clearInterval(timer);
  }, [config.mode, config.interval]);

  const view = config.mode === 'single' ? config.view : activeView;
  return <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#080d1b] p-6 sm:p-8 lg:p-10">
    <header className="mb-6 flex shrink-0 items-center justify-between border-b border-white/10 pb-4">
      <div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15 text-xl font-black text-cyan-200">I</div><div><p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">ICHIKARA · INFORMASI JADWAL</p><p className="mt-1 text-sm text-slate-500">{config.mode === 'cycle' ? `Tampilan bergantian · ${config.interval} detik` : 'Tampilan tetap'}</p></div></div><Clock />
    </header>
    <div className="flex min-h-0 flex-1 flex-col">{view === 'interpreter' ? <WeekCalendar items={interpreterItems} dates={weekDates} error={interpreterError} /> : <SenseiTimeline items={senseiItems} date={today} error={senseiError} />}</div>
    <footer className="mt-4 flex shrink-0 items-center justify-between text-sm text-slate-500"><span>Jadwal diperbarui otomatis setiap menit</span><span>{view === 'interpreter' ? 'KALENDER INTERPRETER' : 'TIMELINE SENSEI'}</span></footer>
  </main>;
}
