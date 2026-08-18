// LobbyDisplayPage — signage TV lobby (read-only, full-screen landscape).
// Layout v2: DENAH 2 LANTAI (Lantai 2 di atas, Lantai 1 di bawah, 4 kolom
// slot #1-#4). Setiap slot punya sub-kotak per ruangan (urutan_dalam_slot);
// saat kelas berlangsung sub-kotak diwarnai sesuai jenis kelas (jenisStyles)
// dan font menyesuaikan ukuran kotak (useBlockSize + container query CSS).
// "Online" & "Fuyu 2" sengaja tidak digambar (posisi null di DB).
// Header + "Kelas Selanjutnya" (termasuk perusahaan/rumah/Online) tetap.
// Auto-refresh: Realtime jadwal_slot + jam real-time tiap detik (WIB).

import { useEffect, useMemo, useState } from 'react';
import { useLobbyData } from './useLobbyData';
import { jenisStyles } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { listRuangan } from '@/lib/api/ruangan';
import { useAsyncData } from '@/app/useAsyncData';
import { useBlockSize } from '@/features/timeline/ScheduleBlock';
import type { JadwalResolved, Ruangan } from '@/lib/types/domain';
import { formatJam, timeToMinutes, todayWIB } from '@/lib/time';
import logoUrl from '@/assets/logo.png';

// ---- Helper tanggal & jam (WIB) ----
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

/** Menit sekarang dalam WIB (0-1439) */
function nowMinuteWIB(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
}

// ---- Utilitas lokasi (baris "Kelas Selanjutnya") ----
const lokasiEmoji: Record<JadwalResolved['tipe_lokasi'], string> = {
  ruangan: '📍',
  kelas_perusahaan: '🏢',
  kelas_rumah: '🏠',
};

function lokasiLabel(j: JadwalResolved): string {
  if (j.tipe_lokasi === 'ruangan') return j.ruangan_nama ?? 'Ruangan';
  return j.alamat_tujuan ?? (j.tipe_lokasi === 'kelas_perusahaan' ? 'Kantor klien' : 'Rumah murid');
}

/** Kelas yang sedang berlangsung di ruangan fisik ini (status aktif) */
function kelasAktifDiRuangan(ruanganId: string, jadwal: JadwalResolved[], nowMin: number): JadwalResolved[] {
  return jadwal.filter(
    (j) =>
      j.tipe_lokasi === 'ruangan' &&
      j.ruangan_id === ruanganId &&
      j.status === 'aktif' &&
      timeToMinutes(j.jam_mulai) <= nowMin &&
      nowMin < timeToMinutes(j.jam_selesai),
  );
}

function progressPct(j: JadwalResolved, nowMin: number): number {
  const start = timeToMinutes(j.jam_mulai);
  const end = timeToMinutes(j.jam_selesai);
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((nowMin - start) / (end - start)) * 100));
}

// ---- Sub-kotak denah (per ruangan dalam 1 slot) ----
// Baris 1: nama ruangan (paling menonjol). Baris 2: nama kelas + jam mulai-
// selesai (wajib utuh, wrap ke 2 baris bila perlu; tidak dipotong ellipsis).
// Progress bar hanya muncul saat ada kelas aktif.
function DenahSubKotak({
  ruangan,
  jadwal,
  nowMin,
}: {
  ruangan: Ruangan;
  jadwal: JadwalResolved[];
  nowMin: number;
}) {
  const { ref, size } = useBlockSize();
  const kelas = kelasAktifDiRuangan(ruangan.id, jadwal, nowMin);
  const utama = kelas[0];
  const punyaKelas = Boolean(utama);

  return (
    <div
      ref={ref}
      data-size={size}
      title={punyaKelas ? `${utama.kelas_nama} • ${formatJam(utama.jam_mulai)}-${formatJam(utama.jam_selesai)}` : undefined}
      className={`relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[4px] border px-1.5 py-1 text-left transition-colors ${
        punyaKelas ? jenisStyles[utama.kelas_jenis].bg : 'bg-white/10 border-white/20'
      }`}
      style={punyaKelas ? { borderColor: jenisStyles[utama.kelas_jenis].accent.replace('bg-', '') } : undefined}
    >
      <p
        className={`denah-ruangan font-extrabold ${punyaKelas ? jenisStyles[utama.kelas_jenis].text : 'text-white/85'}`}
        title={ruangan.nama}
      >
        {ruangan.nama}
      </p>
      <p className={`denah-kelas font-semibold ${punyaKelas ? jenisStyles[utama.kelas_jenis].text : 'text-white/50'}`}>
        {punyaKelas ? utama.kelas_nama : 'Kosong'}
      </p>
      {punyaKelas && (
        <>
          <p className={`denah-time font-bold tabular-nums ${jenisStyles[utama.kelas_jenis].text} opacity-90`}>
            {formatJam(utama.jam_mulai)}-{formatJam(utama.jam_selesai)} WIB
          </p>
          <div className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full bg-white/30">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${jenisStyles[utama.kelas_jenis].accent}`}
              style={{ width: `${progressPct(utama, nowMin)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Satu kolom denah (slot #N): baris sub-kotak per ruangan, urut urutan_dalam_slot */
function SlotDenah({
  slot,
  ruanganDiSlot,
  jadwal,
  nowMin,
}: {
  slot: number;
  ruanganDiSlot: Ruangan[];
  jadwal: JadwalResolved[];
  nowMin: number;
}) {
  const sub = ruanganDiSlot.length > 1;
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-white/5 p-1.5">
      <p className="mb-1 text-center font-label-sm text-label-sm font-semibold uppercase tracking-wider text-white/60">
        #{slot}
      </p>
      <div className={`flex min-h-0 flex-1 gap-1.5 ${sub ? 'flex-row' : 'flex-col'}`}>
        {ruanganDiSlot.map((r) => (
          <DenahSubKotak key={r.id} ruangan={r} jadwal={jadwal} nowMin={nowMin} />
        ))}
      </div>
    </div>
  );
}

/** Baris denah per lantai: header "Lantai N" + 4 kolom slot.
 * Urutan render kolom: #2, #1, #3, #4 (murni tampilan — nilai posisi_slot
 * di database tetap 1..4, hanya urutan render yang diubah). */
const URUTAN_SLOT_RENDER = [2, 1, 3, 4];

function DenahLantai({
  lantai,
  ruanganBySlot,
  jadwal,
  nowMin,
}: {
  lantai: number;
  ruanganBySlot: Map<number, Ruangan[]>;
  jadwal: JadwalResolved[];
  nowMin: number;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 font-label-sm text-label-sm font-bold uppercase tracking-wider text-[#b9c3ff]">
        <span className="text-sm">🏢</span> Lantai {lantai}
      </h2>
      <div className="grid h-full grid-cols-4 gap-2">
        {URUTAN_SLOT_RENDER.map((slot) => (
          <SlotDenah
            key={slot}
            slot={slot}
            ruanganDiSlot={ruanganBySlot.get(slot) ?? []}
            jadwal={jadwal}
            nowMin={nowMin}
          />
        ))}
      </div>
    </section>
  );
}

export function LobbyDisplayPage() {
  const { jadwal, loading, error } = useLobbyData();
  const now = useNowWIB();
  const today = todayWIB();

  // Daftar ruangan denah (fisik, punya posisi) — dipetakan per lantai & slot
  const ruanganQ = useAsyncData(() => listRuangan(), []);
  const ruanganDenah = useMemo(() => {
    const list = (ruanganQ.data ?? []).filter(
      (r) => r.tipe === 'fisik' && r.lantai != null && r.posisi_slot != null && r.is_aktif,
    );
    const byLantai = new Map<number, Map<number, Ruangan[]>>();
    for (const r of list) {
      const lantai = r.lantai as number;
      const slot = r.posisi_slot as number;
      if (!byLantai.has(lantai)) byLantai.set(lantai, new Map());
      const m = byLantai.get(lantai)!;
      if (!m.has(slot)) m.set(slot, []);
      m.get(slot)!.push(r);
    }
    // Urut sub-kotak sesuai urutan_dalam_slot
    for (const m of byLantai.values()) {
      for (const arr of m.values()) arr.sort((a, b) => (a.urutan_dalam_slot ?? 1) - (b.urutan_dalam_slot ?? 1));
    }
    return byLantai;
  }, [ruanganQ.data]);

  // Kelas sedang berlangsung & selanjutnya (urut jam mulai)
  const { sedang, selanjutnya } = useMemo(() => {
    const nowMin = nowMinuteWIB(now);
    const all = [...jadwal].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
    const sedang = all.filter(
      (j) => j.status === 'aktif' && timeToMinutes(j.jam_mulai) <= nowMin && nowMin < timeToMinutes(j.jam_selesai),
    );
    const selanjutnya = all
      .filter((j) => j.status === 'aktif' && timeToMinutes(j.jam_mulai) > nowMin)
      .slice(0, 6);
    return { sedang, selanjutnya };
  }, [jadwal, now]);

  const nowMin = nowMinuteWIB(now);
  const adaKelas = sedang.length > 0 || selanjutnya.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1c30] text-white">
      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between gap-4 px-10 py-5">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="Ichikara" className="h-14 w-14 object-contain" />
          <div>
            <p className="text-2xl font-bold tracking-tight">Ichikara</p>
            <p className="text-base text-white/70">Jadwal Sensei</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatTanggalIndonesia(today)}</p>
          <p className="text-lg text-white/70">{formatTanggalJepang(today)}</p>
          <p className="mt-1 font-mono text-4xl font-bold tabular-nums">{formatJamWIB(now)} WIB</p>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <main className="flex flex-1 flex-col gap-4 px-10 pb-6">
        {loading || ruanganQ.loading ? (
          <LoadingState label="Memuat jadwal..." />
        ) : error || ruanganQ.error ? (
          <ErrorState message={error ?? ruanganQ.error ?? ''} />
        ) : (
          <>
            <div className="flex min-h-0 flex-1 gap-5">
              {/* Denah lantai (2 atas, 1 bawah) — dibuat lebih lebar (2x panel) */}
              <div className="flex min-w-0 flex-[4] flex-col gap-4">
                <DenahLantai lantai={2} ruanganBySlot={ruanganDenah.get(2) ?? new Map()} jadwal={jadwal} nowMin={nowMin} />
                <DenahLantai lantai={1} ruanganBySlot={ruanganDenah.get(1) ?? new Map()} jadwal={jadwal} nowMin={nowMin} />
              </div>

              {/* KELAS SEDANG BERLANGSUNG (ringkasan) */}
              <section className="flex min-w-0 flex-[2] flex-col rounded-2xl bg-white/5 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-[#b9c3ff]">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                  Sedang Berlangsung
                </h2>
                {sedang.length === 0 ? (
                  <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 p-4 text-center">
                    <span className="text-3xl">🌤️</span>
                    <p className="mt-2 text-lg font-semibold text-white/70">Tidak ada kelas berlangsung</p>
                  </div>
                ) : (
                  <ul className="flex min-h-0 flex-col gap-2">
                    {sedang.map((j) => {
                      const s = jenisStyles[j.kelas_jenis];
                      return (
                        <li
                          key={`${j.slot_id}-${j.tanggal_efektif}`}
                          className="rounded-xl border-l-4 bg-white/5 p-3"
                          style={{ borderColor: s.accent.replace('bg-', '') }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-lg font-bold">{j.kelas_nama}</p>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-sm font-bold"
                              style={{ backgroundColor: s.bg.replace('bg-', ''), color: s.text.replace('text-', '') }}
                            >
                              {j.kelas_jenis}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-base text-white/70">
                            {formatJam(j.jam_mulai)} - {formatJam(j.jam_selesai)} WIB
                          </p>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-400 transition-all duration-1000"
                              style={{ width: `${progressPct(j, nowMin)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            {/* KELAS SELANJUTNYA (termasuk perusahaan/rumah/Online) */}
            <section className="shrink-0">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-[#b9c3ff]">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Kelas Selanjutnya
              </h2>
              {selanjutnya.length === 0 ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 p-3 text-center text-lg text-white/60">
                  🗓️ Tidak ada kelas selanjutnya hari ini
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {selanjutnya.map((j) => {
                    const s = jenisStyles[j.kelas_jenis];
                    return (
                      <div
                        key={`${j.slot_id}-${j.tanggal_efektif}`}
                        className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5"
                      >
                        <span className="min-w-[52px] text-base font-bold tabular-nums">{formatJam(j.jam_mulai)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold">{j.kelas_nama}</p>
                          <p className="truncate text-sm text-white/60">
                            {lokasiEmoji[j.tipe_lokasi]} {lokasiLabel(j)}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold"
                          style={{ backgroundColor: s.bg.replace('bg-', ''), color: s.text.replace('text-', '') }}
                        >
                          {j.kelas_jenis}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/10 px-10 py-2.5 text-center text-sm text-white/50">
        Jadwal Sensei Ichikara • Waktu tampil dalam WIB • Data otomatis diperbarui {adaKelas ? '' : '• Denah ruangan'}
      </footer>
    </div>
  );
}