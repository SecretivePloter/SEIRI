// DashboardPage — dashboard jam mengajar: stat cards, bar chart (Recharts),
// dan daftar status sensei (Over/Optimal/Under target). Periode bisa
// mingguan atau bulanan dengan navigasi periode.

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TopBar, ModeTabs, PeriodNav } from '@/components/layout/TopBar';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { hitungJamMengajar } from '@/lib/api/analytics';
import { useAsyncData } from '@/app/useAsyncData';
import type { JamMengajarSensei } from '@/lib/types/domain';
import {
  addDays,
  endOfMonth,
  formatBulan,
  formatTanggalPendek,
  startOfMonth,
  startOfWeek,
  todayWIB,
} from '@/lib/time';

type Mode = 'minggu' | 'bulan';

/** Kategori beban sensei relatif terhadap target periode. */
function kategoriBeban(row: JamMengajarSensei, targetPeriode: number | null): {
  label: string;
  className: string;
} {
  if (targetPeriode == null) {
    return { label: 'Tanpa Target', className: 'bg-surface-container text-on-surface-variant' };
  }
  if (row.total_jam > targetPeriode) {
    return { label: 'Over Target', className: 'bg-error-container text-on-error-container' };
  }
  if (row.total_jam >= targetPeriode * 0.8) {
    return { label: 'Optimal', className: 'bg-cat-bimbel text-cat-bimbel-text' };
  }
  return { label: 'Under Target', className: 'bg-primary-container/30 text-primary' };
}

export function DashboardPage() {
  const [mode, setMode] = useState<Mode>('minggu');
  const [anchor, setAnchor] = useState(() => todayWIB());

  const from = mode === 'minggu' ? startOfWeek(anchor) : startOfMonth(anchor);
  const to = mode === 'minggu' ? addDays(from, 6) : endOfMonth(anchor);
  const daysInRange = mode === 'minggu' ? 7 : Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1,
  );

  const q = useAsyncData(() => hitungJamMengajar(from, to), [from, to]);

  const rows = useMemo(() => {
    const list = q.data ?? [];
    return [...list].sort((a, b) => b.total_jam - a.total_jam);
  }, [q.data]);

  const totalJam = rows.reduce((acc, r) => acc + r.total_jam, 0);
  const totalSesi = rows.reduce((acc, r) => acc + r.jumlah_sesi, 0);
  const avg = rows.length > 0 ? totalJam / rows.length : 0;
  const overTarget = rows.filter((r) => r.target_jam_minggu != null && r.total_jam > (r.target_jam_minggu / 7) * daysInRange).length;

  const periodLabel = mode === 'minggu' ? `${formatTanggalPendek(from)} - ${formatTanggalPendek(to)}` : formatBulan(from);

  return (
    <>
      <TopBar
        title="Dashboard Jam Mengajar"
        subtitle={periodLabel}
        nav={
          <ModeTabs
            options={[
              { value: 'minggu' as Mode, label: 'Mingguan' },
              { value: 'bulan' as Mode, label: 'Bulanan' },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setAnchor(todayWIB());
            }}
          />
        }
        actions={
          <PeriodNav
            label={periodLabel}
            onPrev={() => setAnchor(mode === 'minggu' ? addDays(from, -7) : addDays(startOfMonth(from), -1))}
            onNext={() => setAnchor(mode === 'minggu' ? addDays(from, 7) : addDays(endOfMonth(from), 1))}
          />
        }
      />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
          {/* Stat cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              icon="schedule"
              label="Total Jam Mengajar"
              value={q.loading ? '…' : totalJam}
              suffix="jam"
              sub={`${totalSesi} sesi`}
              tone="accent"
            />
            <StatCard icon="group" label="Rata-rata / Sensei" value={q.loading ? '…' : avg.toFixed(1)} suffix="jam" />
            <StatCard
              icon="warning"
              label="Sensei Over Target"
              value={q.loading ? '…' : overTarget}
              tone={overTarget > 0 ? 'warn' : 'default'}
              sub="dari target mingguan"
            />
          </div>

          {q.loading ? (
            <LoadingState label="Menghitung jam mengajar..." />
          ) : q.error ? (
            <ErrorState message={q.error} onRetry={() => void q.reload()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon="bar_chart"
              title="Belum ada jam mengajar di periode ini"
              description="Jam dihitung dari jadwal berstatus aktif."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Bar chart */}
              <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 lg:col-span-2">
                <h3 className="mb-4 font-headline-sm text-headline-sm text-on-surface">Distribusi Jam Mengajar</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.08)" />
                      <XAxis
                        dataKey="nama_sensei"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={rows.length > 6 ? -20 : 0}
                        textAnchor={rows.length > 6 ? 'end' : 'middle'}
                        height={48}
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        formatter={(value) => [`${value} jam`, 'Total']}
                        cursor={{ fill: 'rgba(16,43,140,0.06)' }}
                      />
                      <Bar dataKey="total_jam" fill="#102b8c" radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daftar status sensei */}
              <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
                <div className="border-b border-outline-variant bg-thead p-4">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Status Sensei</h3>
                </div>
                <ul className="max-h-[400px] divide-y divide-outline-variant overflow-y-auto">
                  {rows.map((r) => {
                    const targetPeriode =
                      r.target_jam_minggu != null ? (r.target_jam_minggu / 7) * daysInRange : null;
                    const badge = kategoriBeban(r, targetPeriode);
                    return (
                      <li key={r.sensei_id} className="flex items-center justify-between gap-3 p-4 hover:bg-hover-row">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed font-bold text-label-md text-on-primary-fixed">
                            {r.nama_sensei.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-body-md text-body-md text-on-surface">{r.nama_sensei}</p>
                            <p className="font-label-sm text-label-sm text-secondary">
                              {r.total_jam} jam / {r.jumlah_sesi} sesi
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 font-label-sm text-label-sm ${badge.className}`}>
                          {badge.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          <p className="font-label-sm text-label-sm text-secondary">
            Hanya jadwal berstatus <span className="font-medium">aktif</span> yang dihitung. Status{' '}
            <span className="font-medium">planning</span> tidak ikut dihitung.
          </p>
        </div>
      </main>
    </>
  );
}
