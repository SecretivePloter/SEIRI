import type { JadwalResolved, KategoriSesi } from '@/lib/types/domain';
import { timeToMinutes } from '@/lib/time';

export const BOARD_START = 7 * 60 + 30;
export const BOARD_END = 21 * 60 + 30;
export const BOARD_INTERVAL = 30;
export const BOARD_TICKS = Array.from({ length: (BOARD_END - BOARD_START) / BOARD_INTERVAL }, (_, i) => BOARD_START + i * BOARD_INTERVAL);

// Colors transcribed from the room legend in the supplied workbook.
export const ROOM_PALETTE = [
  { name: 'Haru 1', color: '#ffc6c6', text: '#171717' },
  { name: 'Aki 1', color: '#ffc000', text: '#171717' },
  { name: 'Fuyu 1', color: '#a3dbff', text: '#171717' },
  { name: 'Natsu 1', color: '#c6e0b4', text: '#171717' },
  { name: 'Haru 2', color: '#0070c0', text: '#ffffff' },
  { name: 'Aki 2', color: '#002060', text: '#ffffff' },
  { name: 'Natsu 2', color: '#00b050', text: '#071b10' },
  { name: 'Haru 3', color: '#ffff00', text: '#171717' },
  { name: 'Aki 3', color: '#c65911', text: '#ffffff' },
  { name: 'Fuyu 3', color: '#ffffcc', text: '#171717' },
  { name: 'Haru 4', color: '#993366', text: '#ffffff' },
  { name: 'Aki 4', color: '#33cccc', text: '#122121' },
  { name: 'PT', color: '#c189f7', text: '#171717' },
  { name: 'Online', color: '#806000', text: '#ffffff' },
];

export function scheduleColor(item: JadwalResolved) {
  const name = item.tipe_lokasi === 'kelas_perusahaan' ? 'PT' : item.ruangan_nama;
  return ROOM_PALETTE.find((room) => room.name.toLowerCase() === name?.trim().toLowerCase())
    ?? { name: name || (item.tipe_lokasi === 'kelas_rumah' ? 'Rumah murid' : 'Lokasi lainnya'), color: '#e2e8f0', text: '#171717' };
}

/** Match the database's proportional session rule, including its one-slot fallback. */
export function scheduleSessions(item: JadwalResolved, rules: KategoriSesi[]): number {
  if (!item.dihitung || item.status !== 'aktif') return 0;
  const rule = rules.find((entry) => entry.jenis === item.kelas_jenis);
  if (!rule || rule.durasi_jam <= 0) return 1;
  const hours = (timeToMinutes(item.jam_selesai) - timeToMinutes(item.jam_mulai)) / 60;
  return hours / rule.durasi_jam * rule.jumlah_sesi;
}

/** Allocate exact sessions by overlap; round only when displaying numbers. */
export function intervalSessions(item: JadwalResolved, minute: number, rules: KategoriSesi[]): number {
  const start = timeToMinutes(item.jam_mulai);
  const end = timeToMinutes(item.jam_selesai);
  const overlap = Math.max(0, Math.min(end, minute + BOARD_INTERVAL) - Math.max(start, minute));
  return end > start ? scheduleSessions(item, rules) * overlap / (end - start) : 0;
}

export function placeSchedules(items: JadwalResolved[]) {
  const ends: number[] = [];
  const placed = [...items].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai) || a.slot_id.localeCompare(b.slot_id)).map((item) => {
    const start = timeToMinutes(item.jam_mulai);
    let lane = ends.findIndex((end) => end <= start);
    if (lane < 0) lane = ends.length;
    ends[lane] = timeToMinutes(item.jam_selesai);
    return { item, lane };
  });
  return { placed, lanes: Math.max(1, ends.length) };
}
