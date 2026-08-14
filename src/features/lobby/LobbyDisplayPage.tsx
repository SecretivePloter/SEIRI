// LobbyDisplayPage — halaman signage utk TV lobby kantor (read-only).
// TIDAK memakai layout sidebar admin: full-screen landscape, font besar &
// bold, tanpa navigasi. Auto-refresh via Realtime + jam real-time tiap detik
// (WIB). Section otomatis bergeser: "KELAS SEDANG BERLANGSUNG" (progress bar)
// dan "KELAS SELANJUTNYA" (maks 6, urut jam mulai).

import { useEffect, useMemo, useState } from 'react';
import { useLobbyData } from './useLobbyData';
import { jenisStyles } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { listSensei } from '@/lib/api/sensei';
import { useAsyncData } from '@/app/useAsyncData';
import type { JadwalResolved } from '@/lib/types/domain';
import { formatJam, timeToMinutes, todayWIB } from '@/lib/time';
import logoUrl from '@/assets/logo.png';

// ---- Helper tanggal (WIB) ----
function useNowWIB() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatTanggalIndonesia(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function formatTanggalJepang(iso: string): string {
  const [y, m, dd] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  const dow = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(d);
  const map: Record<string, string> = {
    Sunday: '日曜日',
    Monday: '月曜日',
    Tuesday: '火曜日',
    Wednesday: '水曜日',
    Thursday: '木曜日',
    Friday: '金曜日',
    Saturday: '土曜日',
  };
  return `${y}年${m}月${dd}日 ${map[dow] ?? ''}`;
}

function formatJamWIB(now: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
}

// ---- Utilitas lokasi ----
const lokasiEmoji: Record<JadwalResolved['tipe_lokasi'], string> = {
  ruangan: '📍',
  kelas_perusahaan: '🏢',
  kelas_rumah: '🏠',
};

function lokasiLabel(j: JadwalResolved): string {
  if (j.tipe_lokasi === 'ruangan') return j.ruangan_nama ?? 'Ruangan';
  return j.alamat_tujuan ?? (j.tipe_lokasi === 'kelas_perusahaan' ? 'Kantor klien' : 'Rumah murid');
}

/** Persentase progress kelas berdasarkan jam sekarang WIB */
function progressClass(j: JadwalResolved, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const nowMin = h * 60 + m;
  const start = timeToMinutes(j.jam_mulai);
  const end = timeToMinutes(j.jam_selesai);
  if (end <= start) return 0;
  const pct = ((nowMin - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function LobbyDisplayPage() {
  const { jadwal, loading, error } = useLobbyData();
  const now = useNowWIB();
  const today = todayWIB();

  // Nama sensei utk ditampilkan (JadwalResolved hanya membawa sensei_id)
  const senseiQ = useAsyncData(() => listSensei(), []);
  const senseiNama = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of senseiQ.data ?? []) m.set(s.id, s.nama);
    return m;
  }, [senseiQ.data]);

  // Kelas sedang berlangsung: jam sekarang di antara jam_mulai-jam_selesai
  const { sedang, selanjutnya } = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const nowMin =
      Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 +
      Number(parts.find((p) => p.type === 'minute')?.value ?? 0);

    const all = [...jadwal].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
    const sedang = all.filter(
      (j) => j.status === 'aktif' && timeToMinutes(j.jam_mulai) <= nowMin && nowMin < timeToMinutes(j.jam_selesai),
    );
    const selanjutnya = all
      .filter((j) => j.status === 'aktif' && timeToMinutes(j.jam_mulai) > nowMin)
      .slice(0, 6);
    return { sedang, selanjutnya };
  }, [jadwal, now]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1c30] text-white">
      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between gap-4 px-10 py-6">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="Ichikara" className="h-16 w-16 object-contain" />
          <div>
            <p className="text-3xl font-bold tracking-tight">Ichikara</p>
            <p className="text-lg text-white/70">Jadwal Sensei</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">{formatTanggalIndonesia(today)}</p>
          <p className="text-2xl text-white/70">{formatTanggalJepang(today)}</p>
          <p className="mt-1 font-mono text-5xl font-bold tabular-nums">{formatJamWIB(now)} WIB</p>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <main className="flex-1 px-10 pb-10">
        {loading ? (
          <LoadingState label="Memuat jadwal..." />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
            {/* KELAS SEDANG BERLANGSUNG */}
            <section className="xl:col-span-3">
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold uppercase tracking-wider text-[#b9c3ff]">
                <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
                Kelas Sedang Berlangsung
              </h2>
              {sedang.length === 0 ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 p-8 text-center">
                  <span className="text-5xl">🌤️</span>
                  <p className="mt-4 text-2xl font-semibold text-white/70">Tidak ada kelas berlangsung saat ini</p>
                  <p className="mt-1 text-lg text-white/50">Jadwal berikutnya akan muncul di bawah.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {sedang.map((j) => {
                    const s = jenisStyles[j.kelas_jenis];
                    const pct = progressClass(j, now);
                    return (
                      <div
                        key={`${j.slot_id}-${j.tanggal_efektif}`}
                        className="rounded-2xl border-l-8 bg-white/5 p-6 shadow-lg backdrop-blur"
                        style={{ borderColor: s.accent.replace('bg-', '') }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-2xl font-bold">{j.kelas_nama}</p>
                            <p className="mt-1 text-lg text-white/70">Sensei: {senseiNama.get(j.sensei_id) ?? '-'}</p>
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-lg font-bold"
                            style={{ backgroundColor: s.bg.replace('bg-', ''), color: s.text.replace('text-', '') }}
                          >
                            {j.kelas_jenis}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <p className="text-xl font-semibold">
                            {formatJam(j.jam_mulai)} - {formatJam(j.jam_selesai)} WIB
                          </p>
                          <p className="text-lg text-white/70">
                            {lokasiEmoji[j.tipe_lokasi]} {lokasiLabel(j)}
                          </p>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-emerald-400 transition-all duration-1000" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-right text-lg font-semibold text-emerald-300">{Math.round(pct)}%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* KELAS SELANJUTNYA */}
            <section className="xl:col-span-2">
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold uppercase tracking-wider text-[#b9c3ff]">
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                Kelas Selanjutnya
              </h2>
              {selanjutnya.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 p-6 text-center">
                  <span className="text-4xl">🗓️</span>
                  <p className="mt-3 text-xl font-semibold text-white/60">Tidak ada kelas selanjutnya hari ini</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {selanjutnya.map((j) => {
                    const s = jenisStyles[j.kelas_jenis];
                    return (
                      <li
                        key={`${j.slot_id}-${j.tanggal_efektif}`}
                        className="flex items-center gap-4 rounded-xl bg-white/5 p-4"
                      >
                        <span className="min-w-[96px] text-xl font-bold tabular-nums">{formatJam(j.jam_mulai)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-bold">{j.kelas_nama}</p>
                          <p className="truncate text-base text-white/60">
                            {lokasiEmoji[j.tipe_lokasi]} {lokasiLabel(j)} • {senseiNama.get(j.sensei_id) ?? '-'}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-base font-semibold"
                          style={{ backgroundColor: s.bg.replace('bg-', ''), color: s.text.replace('text-', '') }}
                        >
                          {j.kelas_jenis}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/10 px-10 py-4 text-center text-base text-white/50">
        Jadwal Sensei Ichikara • Waktu tampil dalam WIB • Data otomatis diperbarui
      </footer>
    </div>
  );
}
