// TimelineGrid — grid sumbu jam (mode 'today'): baris = entitas (sensei /
// ruangan), kolom = jam 07:00–21:00 dengan garis subdivisi. Blok diposisikan
// absolut berdasarkan jam mulai/durasi. Parameterized agar bisa dipakai
// timeline sensei maupun timeline ruangan tanpa duplikasi.

import { ScheduleBlock } from './ScheduleBlock';
import type { JadwalResolved } from '@/lib/types/domain';
import { timeToMinutes, minutesToTime } from '@/lib/time';

export const AXIS_START_HOUR = 7; // 07:00 WIB
export const AXIS_END_HOUR = 21; // 21:00 WIB

const AXIS_START = AXIS_START_HOUR * 60;
const AXIS_END = AXIS_END_HOUR * 60;
const AXIS_LEN = AXIS_END - AXIS_START;

export interface TimelineRow {
  id: string;
  label: string;
  sublabel?: string;
}

export function TimelineGrid({
  rows,
  jadwalByRow,
  onSelect,
}: {
  rows: TimelineRow[];
  /** map rowId -> jadwal (sudah difilter per tanggal) */
  jadwalByRow: Map<string, JadwalResolved[]>;
  onSelect?: (j: JadwalResolved) => void;
}) {
  const hours: number[] = [];
  for (let h = AXIS_START_HOUR; h <= AXIS_END_HOUR; h++) hours.push(h);

  return (
    <div className="overflow-x-auto rounded-card border border-outline-variant bg-surface-container-lowest">
      <div className="min-w-[900px]">
        {/* Header jam */}
        <div className="grid border-b border-outline-variant bg-thead" style={{ gridTemplateColumns: '180px 1fr' }}>
          <div className="border-r border-outline-variant p-3 font-label-sm text-label-sm text-secondary">WIB</div>
          <div className="relative">
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${hours.length - 1}, 1fr)` }}>
              {hours.slice(0, -1).map((h) => (
                <div key={h} className="border-r border-outline-variant/50 p-3 text-center font-label-sm text-label-sm text-secondary">
                  {minutesToTime(h * 60)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Baris */}
        {rows.map((row) => {
          const items = jadwalByRow.get(row.id) ?? [];
          return (
            <div
              key={row.id}
              className="grid border-b border-outline-variant last:border-b-0"
              style={{ gridTemplateColumns: '180px 1fr' }}
            >
              <div className="flex flex-col justify-center border-r border-outline-variant p-3">
                <p className="truncate font-label-md text-label-md text-on-surface">{row.label}</p>
                {row.sublabel && <p className="truncate font-label-sm text-label-sm text-secondary">{row.sublabel}</p>}
              </div>
              <div className="relative h-timeline-row-height">
                {/* garis jam vertikal */}
                {hours.slice(1, -1).map((h) => {
                  const pct = ((h * 60 - AXIS_START) / AXIS_LEN) * 100;
                  return (
                    <div
                      key={h}
                      className="absolute bottom-0 top-0 border-r border-outline-variant/30"
                      style={{ left: `${pct}%` }}
                    />
                  );
                })}
                {/* blok jadwal */}
                {items.map((j) => {
                  const start = timeToMinutes(j.jam_mulai);
                  const end = timeToMinutes(j.jam_selesai);
                  // clamp ke sumbu tampilan
                  const cs = Math.max(start, AXIS_START);
                  const ce = Math.min(end, AXIS_END);
                  if (ce <= cs) return null;
                  const left = ((cs - AXIS_START) / AXIS_LEN) * 100;
                  const width = ((ce - cs) / AXIS_LEN) * 100;
                  return (
                    <div
                      key={`${j.slot_id}-${j.tanggal_efektif}`}
                      className="absolute bottom-1.5 top-1.5"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <ScheduleBlock jadwal={j} onClick={onSelect ? () => onSelect(j) : undefined} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
