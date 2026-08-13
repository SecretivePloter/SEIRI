// Util waktu — SEMUA perhitungan jadwal berbasis WIB (Asia/Jakarta).
// Postgres menyimpan time/date sebagai wall-clock WIB; helper di sini
// memastikan klien menghitung "hari ini" / "jam sekarang" juga di WIB,
// bukan timezone lokal browser.

import type { HariIndo } from '@/lib/types/domain';

/** Nama hari Indonesia utk Date object (map isodow Postgres) */
const HARI_INDO_INDEXED: HariIndo[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const WIB_TZ = 'Asia/Jakarta';

/** "Hari ini" dalam WIB sebagai yyyy-mm-dd */
export function todayWIB(): string {
  return dateToISO(new Date(), WIB_TZ);
}

/** Jam sekarang WIB sebagai "HH:MM" */
export function nowTimeWIB(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h}:${m}`;
}

/** Date -> ISO yyyy-mm-dd di timezone tertentu (default WIB) */
export function dateToISO(d: Date, tz: string = WIB_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Parse "yyyy-mm-dd" -> Date (midnight WIB sebagai instans UTC) */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Nama hari Indonesia utk tanggal ISO */
export function hariIndo(iso: string): HariIndo {
  const dow = parseISODate(iso).getUTCDay(); // 0=Minggu
  return HARI_INDO_INDEXED[(dow + 6) % 7];
}

/** Tambah hari (bisa negatif) dari tanggal ISO */
export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToISO(d, 'UTC');
}

/** Senin dari minggu yang memuat tanggal iso (ISO week: Senin = awal minggu) */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const dow = d.getUTCDay(); // 0=Minggu
  const diff = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return dateToISO(d, 'UTC');
}

/** Awal bulan (tanggal 1) */
export function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

/** Akhir bulan */
export function endOfMonth(iso: string): string {
  const d = parseISODate(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return dateToISO(d, 'UTC');
}

/** Daftar tanggal ISO antara from..to (inklusif) */
export function dateRange(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  let cur = fromISO;
  while (cur <= toISO) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** "HH:MM" (atau "HH:MM:SS") -> menit sejak tengah malam */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Menit -> "HH:MM" */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format "HH:MM:SS"/"HH:MM" -> "HH:MM" utk display */
export function formatJam(t: string): string {
  return t.slice(0, 5);
}

/** Durasi dalam jam (desimal) antara dua jam */
export function durationHours(mulai: string, selesai: string): number {
  return (timeToMinutes(selesai) - timeToMinutes(mulai)) / 60;
}

/**
 * Overlap dua rentang jam — pertidaksamaan KETAT, identik dengan
 * public.jam_overlap di Postgres: bersentuhan di batas (selesai 14:00,
 * mulai 14:00) = TIDAK overlap.
 */
export function jamOverlap(aMulai: string, aSelesai: string, bMulai: string, bSelesai: string): boolean {
  return (
    timeToMinutes(aMulai) < timeToMinutes(bSelesai) &&
    timeToMinutes(bMulai) < timeToMinutes(aSelesai)
  );
}

/** Format tanggal utk tampilan: "Sen, 12 Agu 2026" */
export function formatTanggalPendek(iso: string): string {
  const d = parseISODate(iso);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Format tanggal panjang: "Senin, 12 Agustus 2026" */
export function formatTanggalPanjang(iso: string): string {
  const d = parseISODate(iso);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Label bulan: "Agustus 2026" */
export function formatBulan(iso: string): string {
  const d = parseISODate(iso);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
