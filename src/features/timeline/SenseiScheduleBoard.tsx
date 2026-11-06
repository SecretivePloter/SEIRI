import { useEffect, useState, type CSSProperties } from 'react';
import type { JadwalResolved, KategoriSesi } from '@/lib/types/domain';
import { formatTanggalPanjang, minutesToTime, nowTimeWIB, timeToMinutes, todayWIB } from '@/lib/time';
import type { TimelineRow } from './TimelineGrid';
import { BOARD_START, BOARD_END, BOARD_TICKS, ROOM_PALETTE, intervalSessions, placeSchedules, scheduleColor, scheduleSessions } from './scheduleBoardModel';

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const totalFormat = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const axisLength = BOARD_END - BOARD_START;

export function SenseiScheduleBoard({ rows, schedules, date, rules, onSelect }: {
  rows: TimelineRow[];
  schedules: JadwalResolved[];
  date: string;
  /** null means the session configuration is unavailable, including public signage. */
  rules: KategoriSesi[] | null;
  onSelect?: (item: JadwalResolved) => void;
}) {
  const [clock, setClock] = useState(nowTimeWIB);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(nowTimeWIB()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const now = timeToMinutes(clock);
  const showNow = date === todayWIB() && now >= BOARD_START && now < BOARD_END;
  const currentTick = Math.floor((now - BOARD_START) / 30);
  const layout = rows.map((row) => ({ row, ...placeSchedules(schedules.filter((item) => item.sensei_id === row.id)) }));
  const visibleIds = new Set(rows.map((row) => row.id));
  const visibleSchedules = schedules.filter((item) => visibleIds.has(item.sensei_id));
  const total = rules ? visibleSchedules.reduce((sum, item) => sum + scheduleSessions(item, rules), 0) : null;
  const outsideAxis = visibleSchedules.some((item) => timeToMinutes(item.jam_mulai) < BOARD_START || timeToMinutes(item.jam_selesai) > BOARD_END);
  const totalLanes = layout.reduce((sum, entry) => sum + entry.lanes, 0);
  const markerStyle = { left: `${currentTick / BOARD_TICKS.length * 100}%`, width: `${100 / BOARD_TICKS.length}%` };

  return (
    <section className="sensei-sheet" aria-label="Visualisasi Progres Kelas" style={{ '--sheet-lanes': Math.max(1, totalLanes) } as CSSProperties}>
      <div className="sensei-sheet-heading">
        <h3>Visualisasi Progres Kelas</h3>
        <div className="sheet-period-controls">
          <span className="sheet-date">{formatTanggalPanjang(date)}</span>
        </div>
      </div>
      <div className="sensei-sheet-scroll" tabIndex={0} role="region" aria-label="Tabel jadwal, geser untuk melihat seluruh kolom">
        <div className="sensei-sheet-table">
          <div className="sheet-axis sheet-columns">
            <div className="sheet-sticky sheet-axis-name"><span>No.</span><strong>Sensei</strong></div>
            <div className="sheet-time-axis">
              <div className="sheet-ticks">
                {BOARD_TICKS.map((tick) => <div key={tick}><span>{minutesToTime(tick).replace(':', '.')}</span><span>{minutesToTime(tick + 30).replace(':', '.')}</span></div>)}
              </div>
              {showNow && <div className="sheet-current-window sheet-current-header" style={markerStyle}><span className="sheet-now-arrow" title={`Sekarang ${clock} WIB`}>▼</span></div>}
            </div>
            <div className="sheet-session-heading"><strong>Sesi</strong><div><span>Plan</span><span>Actual</span></div></div>
          </div>
          {layout.map(({ row, placed, lanes }, index) => {
            const items = schedules.filter((item) => item.sensei_id === row.id);
            const sessions = rules ? items.reduce((sum, item) => sum + scheduleSessions(item, rules), 0) : null;
            return (
              <div className="sheet-row sheet-columns" key={row.id} style={{ flexGrow: lanes, minHeight: lanes * 30 }}>
                <div className="sheet-sticky sheet-row-name"><span>{index + 1}</span><strong title={row.label}>{row.label}</strong></div>
                <div className="sheet-row-track">
                  <div className="sheet-grid-lines">{BOARD_TICKS.map((tick) => <span key={tick} />)}</div>
                  {placed.map(({ item, lane }) => {
                    const start = Math.max(BOARD_START, timeToMinutes(item.jam_mulai));
                    const end = Math.min(BOARD_END, timeToMinutes(item.jam_selesai));
                    if (end <= start) return null;
                    const color = scheduleColor(item);
                    const title = `${item.kelas_nama} · ${item.jam_mulai.slice(0, 5)}-${item.jam_selesai.slice(0, 5)} · ${color.name}${!item.dihitung ? ' · Dibatalkan / digantikan' : ''}`;
                    return (
                      <button key={`${item.slot_id}-${item.is_pengganti}`} type="button" className={`sheet-class ${!item.dihitung ? 'sheet-class-cancelled' : ''} ${item.status !== 'aktif' ? 'sheet-class-planning' : ''}`}
                        onClick={onSelect ? () => onSelect(item) : undefined} title={title} aria-label={title}
                        style={{ left: `${(start - BOARD_START) / axisLength * 100}%`, width: `${(end - start) / axisLength * 100}%`, top: `${lane / lanes * 100}%`, height: `${100 / lanes}%`, backgroundColor: color.color, color: color.text }}>
                        <span className="sheet-class-values">
                          {BOARD_TICKS.filter((tick) => tick < end && tick + 30 > start).map((tick) => {
                            const segmentStart = Math.max(tick, start);
                            const segmentEnd = Math.min(tick + 30, end);
                            return <span key={tick} style={{ width: `${(segmentEnd - segmentStart) / (end - start) * 100}%` }}>{rules && item.dihitung && item.status === 'aktif' ? numberFormat.format(intervalSessions(item, tick, rules)) : ''}</span>;
                          })}
                        </span>
                        <span className="sheet-class-label">{!item.dihitung ? '✕ ' : ''}{item.kelas_nama}{item.is_pengganti ? ' · Pengganti' : ''}</span>
                      </button>
                    );
                  })}
                  {showNow && <div className="sheet-current-window" style={markerStyle} />}
                </div>
                <div className="sheet-session-values"><span>{sessions === null ? '—' : totalFormat.format(sessions)}</span><span title="Data realisasi mengajar belum tersedia">—</span></div>
              </div>
            );
          })}
          <div className="sheet-total sheet-columns">
            <strong className="sheet-sticky">Total sesi</strong>
            <div className="sheet-ticks">{BOARD_TICKS.map((tick) => <span key={tick}>{rules ? numberFormat.format(visibleSchedules.reduce((sum, item) => sum + intervalSessions(item, tick, rules), 0)) : '—'}</span>)}</div>
            <div className="sheet-session-values"><strong>{total === null ? '—' : totalFormat.format(total)}</strong><span>—</span></div>
          </div>
        </div>
      </div>
      <footer className="sheet-legend">
        <strong>Keterangan ruangan</strong>
        <div className="sheet-room-key">{ROOM_PALETTE.map((room, index) => <span key={room.name}><i style={{ backgroundColor: room.color, color: room.text }}>{index < 12 ? index + 1 : ''}</i>{room.name}</span>)}<span><i style={{ backgroundColor: '#e2e8f0' }} />Lokasi lainnya</span></div>
        <p><span className="sheet-cancel-key">✕</span> Dibatalkan / digantikan · Blok pudar: planning / nonaktif · Bingkai merah: setengah jam saat ini (WIB).</p>
        <p>{rules ? 'Sesi mengikuti Aturan Sesi; planning dan pembatalan tidak dihitung. Actual belum tersedia.' : 'Rincian ruangan dan sesi tidak tersedia pada feed publik.'}{outsideAxis ? ' Ada jadwal di luar 07.30–21.30; Plan tetap menghitung durasi lengkap.' : ''}</p>
      </footer>
    </section>
  );
}
