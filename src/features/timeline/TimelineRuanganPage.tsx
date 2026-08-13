// TimelineRuanganPage — grid ruangan × jam. Reuse TimelineGrid dengan
// baris = ruangan (bukan sensei). Struktur & filter bar meniru TimelinePage
// agar pola visual konsisten; logika berbeda hanya di sumbu baris.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, PeriodNav } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { TimelineGrid, type TimelineRow } from './TimelineGrid';
import { useResolvedJadwal } from './useResolvedJadwal';
import { JadwalDetailModal } from './JadwalDetailModal';
import { listRuangan } from '@/lib/api/ruangan';
import { useAsyncData } from '@/app/useAsyncData';
import type { JadwalResolved } from '@/lib/types/domain';
import { todayWIB, addDays, formatTanggalPendek } from '@/lib/time';

export function TimelineRuanganPage() {
  // Timeline ruangan fokus ke satu hari (hari dipilih via nav periode).
  const [anchorDate, setAnchorDate] = useState(todayWIB());
  const [selected, setSelected] = useState<JadwalResolved | null>(null);

  const ruanganQ = useAsyncData(() => listRuangan(), []);
  const { jadwal, loading, error, reload } = useResolvedJadwal(anchorDate, anchorDate);

  const rows: TimelineRow[] = useMemo(
    () =>
      (ruanganQ.data ?? []).map((r) => ({
        id: r.id,
        label: r.nama,
        sublabel: r.kapasitas ? `Kapasitas ${r.kapasitas}` : undefined,
      })),
    [ruanganQ.data],
  );

  // Hanya slot bertipe_lokasi='ruangan' yang relevan di timeline ruangan.
  const jadwalByRow = useMemo(() => {
    const map = new Map<string, JadwalResolved[]>();
    for (const j of jadwal) {
      if (j.tipe_lokasi !== 'ruangan' || !j.ruangan_id) continue;
      const arr = map.get(j.ruangan_id);
      if (arr) arr.push(j);
      else map.set(j.ruangan_id, [j]);
    }
    return map;
  }, [jadwal]);

  const label = formatTanggalPendek(anchorDate);

  return (
    <>
      <TopBar
        title="Timeline Ruangan"
        subtitle={label}
        nav={<PeriodNav label={label} onPrev={() => setAnchorDate(addDays(anchorDate, -1))} onNext={() => setAnchorDate(addDays(anchorDate, 1))} />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAnchorDate(todayWIB())}>
              Hari ini
            </Button>
            <Link to="/jadwal/new">
              <Button>
                <Icon name="add" size={16} /> New Schedule
              </Button>
            </Link>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
          {ruanganQ.loading || loading ? (
            <LoadingState label="Memuat timeline ruangan..." />
          ) : ruanganQ.error || error ? (
            <ErrorState
              message={ruanganQ.error ?? error ?? ''}
              onRetry={() => {
                void ruanganQ.reload();
                void reload();
              }}
            />
          ) : (
            <>
              <TimelineGrid rows={rows} jadwalByRow={jadwalByRow} onSelect={setSelected} />
              {jadwal.length === 0 && (
                <EmptyState
                  icon="event_busy"
                  title="Tidak ada jadwal ruangan di tanggal ini"
                  description="Pilih tanggal lain atau buat jadwal baru."
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
