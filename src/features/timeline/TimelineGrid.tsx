// TimelineGrid — papan kendali harian berbasis TPS.
// Seluruh baris berbagi tinggi layar; jadwal bentrok memakai lajur terpisah. Garis merah adalah andon
// waktu nyata: sekali lihat, admin tahu posisi waktu dan kelas yang berjalan.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { jenisStyles } from '@/components/ui/Badge';
import type { JadwalResolved } from '@/lib/types/domain';
import { nowTimeWIB, timeToMinutes, minutesToTime } from '@/lib/time';

export const AXIS_START_HOUR = 7;
export const AXIS_END_HOUR = 22;

const AXIS_START = AXIS_START_HOUR * 60;
const AXIS_END = AXIS_END_HOUR * 60;
const AXIS_LEN = AXIS_END - AXIS_START;
const HALF_HOURS = Array.from({ length: AXIS_LEN / 30 }, (_, i) => AXIS_START + i * 30);

export interface TimelineRow {
  id: string;
  label: string;
  sublabel?: string;
}

function useNowMinuteWIB(): number {
  const [minute, setMinute] = useState(() => timeToMinutes(nowTimeWIB()));

  useEffect(() => {
    const update = () => setMinute(timeToMinutes(nowTimeWIB()));
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return minute;
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
  const nowMinute = useNowMinuteWIB();
  const nowInBoard = nowMinute >= AXIS_START && nowMinute <= AXIS_END;
  const nowLeft = ((nowMinute - AXIS_START) / AXIS_LEN) * 100;
  const activeCount = useMemo(
    () =>
      [...jadwalByRow.values()].flat().filter(
        (j) => j.dihitung && j.status === 'aktif' && timeToMinutes(j.jam_mulai) <= nowMinute && nowMinute < timeToMinutes(j.jam_selesai),
      ).length,
    [jadwalByRow, nowMinute],
  );
const layout = rows.map((row) => {
          const items = [...(jadwalByRow.get(row.id) ?? [])].sort((a, b) => timeToMinutes(a.jam_mulai) - timeToMinutes(b.jam_mulai));
          const laneEnds: number[] = [];
          const placed = items.map((j) => {
            const start = timeToMinutes(j.jam_mulai);
            let lane = laneEnds.findIndex((end) => end <= start);
            if (lane < 0) lane = laneEnds.length;
            laneEnds[lane] = timeToMinutes(j.jam_selesai);
            return { j, lane };
          });
          return { row, placed, laneCount: Math.max(1, laneEnds.length) };
        });
  const totalLanes = layout.reduce((sum, row) => sum + row.laneCount, 0) || 1;
  const boardStyle = { '--tps-row-count': String(totalLanes) } as CSSProperties;

  return (
    <section className="tps-timeline-board" style={boardStyle} aria-label="Papan kendali jadwal sensei hari ini">
      <div className="tps-timeline-canvas">
        <div className="tps-axis z-30 grid h-10 shrink-0 border-b border-outline-variant bg-thead" style={{ gridTemplateColumns: 'var(--tps-name-width) minmax(0, 1fr)' }}>
          <div className="sticky left-0 z-20 flex items-center border-r border-outline-variant bg-thead px-3 font-label-sm text-label-sm text-secondary">
            SENSEI · WIB
          </div>
          <div className="relative">
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${HALF_HOURS.length}, minmax(0, 1fr))` }}>
              {HALF_HOURS.map((minute) => (
                <div
                  key={minute}
                  className={`flex items-center justify-center border-r border-outline-variant/50 font-label-sm text-[9px] tabular-nums ${
                    minute % 60 === 0 ? 'bg-surface-container-low text-on-surface' : 'text-secondary'
                  }`}
                >
                  <span className="text-center leading-tight">{minutesToTime(minute)}<br /><span className="text-secondary">{minutesToTime(minute + 30)}</span></span>
                </div>
              ))}
            </div>
            {nowInBoard && <NowMarker left={nowLeft} label={nowTimeWIB()} />}
          </div>
        </div>

        {layout.map(({ row, placed, laneCount }) => {
          return (
            <div key={row.id} className="tps-timeline-row grid border-b border-outline-variant last:border-b-0" style={{ gridTemplateColumns: 'var(--tps-name-width) minmax(0, 1fr)', flex: `${laneCount} 1 0%`, minHeight: 0 }}>
              <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r border-outline-variant bg-surface-container-lowest px-3">
                <p className="truncate font-label-md text-label-md font-semibold text-on-surface">{row.label}</p>
                {row.sublabel && <p className="tps-row-sublabel truncate font-label-sm text-label-sm text-secondary">{row.sublabel}</p>}
              </div>
              <div className="relative min-w-0">
                {HALF_HOURS.slice(1).map((minute) => {
                  const pct = ((minute - AXIS_START) / AXIS_LEN) * 100;
                  return <div key={minute} className="absolute bottom-0 top-0 border-r border-outline-variant/30" style={{ left: `${pct}%` }} />;
                })}
                {nowInBoard && <NowMarker left={nowLeft} />}
                {placed.map(({ j, lane }) => {
                  const start = timeToMinutes(j.jam_mulai);
                  const end = timeToMinutes(j.jam_selesai);
                  const clampedStart = Math.max(start, AXIS_START);
                  const clampedEnd = Math.min(end, AXIS_END);
                  if (clampedEnd <= clampedStart) return null;
                  const left = ((clampedStart - AXIS_START) / AXIS_LEN) * 100;
                  const width = ((clampedEnd - AXIS_START) / AXIS_LEN) * 100 - left;
                  return (
                    <div
                      key={`${j.slot_id}-${j.tanggal_efektif}-${j.is_pengganti ? 'pengganti' : 'asal'}`}
                      className="absolute z-[1]"
                      style={{ left: `${left}%`, width: `${width}%`, top: `calc(${lane * 100 / laneCount}% + 1px)`, height: `calc(${100 / laneCount}% - 2px)` }}
                    >
                      <button
                        type="button"
                        onClick={onSelect ? () => onSelect(j) : undefined}
                        title={`${j.kelas_nama} · ${j.jam_mulai}–${j.jam_selesai}${!j.dihitung ? ' · Dibatalkan/digantikan' : ''}`}
                        className={`tps-fit-block ${jenisStyles[j.kelas_jenis].bg} ${jenisStyles[j.kelas_jenis].text} ${jenisStyles[j.kelas_jenis].border} ${j.status === 'planning' ? 'opacity-60' : ''}`}
                      >
                        <span className={!j.dihitung ? 'line-through' : ''}>{!j.dihitung ? '× ' : ''}{j.kelas_nama}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="tps-andon-strip" aria-live="polite">
        <span className="inline-flex h-2 w-2 rounded-full bg-error" />
        <strong>ANDON SEKARANG {nowTimeWIB()} WIB</strong>
        <span>{activeCount > 0 ? `${activeCount} kelas sedang berlangsung` : 'Tidak ada kelas sedang berlangsung'}</span>
      </div>
    </section>
  );
}

function NowMarker({ left, label }: { left: number; label?: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-0 top-0 z-10 w-0 border-l-2 border-error"
      style={{ left: `${left}%` }}
      aria-hidden="true"
    >
      {label && <span className="absolute left-[-1px] top-0 -translate-x-1/2 whitespace-nowrap rounded bg-error px-1.5 py-0.5 font-label-sm text-[9px] font-bold text-on-error shadow-sm">{label}</span>}
    </div>
  );
}
