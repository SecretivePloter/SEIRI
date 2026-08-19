// ScheduleBlock — blok jadwal pastel dengan accent bar kiri (DESIGN.md).
// Dipakai ulang di: timeline sensei, timeline ruangan, kalender profil,
// lobby display (varian 'lobby').
// Font adaptif (v2 poin 8): ukuran blok dipantau ResizeObserver, hasilnya
// disimpan di atribut data-size (s/l/m). CSS container query di index.css
// menyesuaikan ukuran font; saat ruang sempit, baris jam disembunyikan dan
// yang diprioritaskan adalah nama kelas + lokasi (jam tetap bisa dilihat
// lewat tooltip/klik -> JadwalDetailModal).

import { useEffect, useRef, useState } from 'react';
import type { JadwalResolved } from '@/lib/types/domain';
import { jenisStyles } from '@/components/ui/Badge';
import { formatJam } from '@/lib/time';

const lokasiEmoji: Record<JadwalResolved['tipe_lokasi'], string> = {
  ruangan: '📍',
  kelas_perusahaan: '🏢',
  kelas_rumah: '🏠',
};

export function lokasiLabel(j: JadwalResolved): string {
  if (j.tipe_lokasi === 'ruangan') return j.ruangan_nama ?? 'Ruangan';
  return j.alamat_tujuan ?? (j.tipe_lokasi === 'kelas_perusahaan' ? 'Kantor klien' : 'Rumah murid');
}

type BlockSize = 's' | 'm' | 'l';

export function useBlockSize(): { ref: React.RefObject<HTMLDivElement>; size: BlockSize } {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<BlockSize>('m');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Klasifikasi ukuran blok: luas & proporsi menentukan font yang muat
      if (w < 72 || h < 34) setSize('s');
      else if (w < 120 || h < 52) setSize('m');
      else setSize('l');
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

export function ScheduleBlock({
  jadwal,
  compact = false,
  variant = 'default',
  onClick,
}: {
  jadwal: JadwalResolved;
  compact?: boolean;
  variant?: 'default' | 'lobby';
  onClick?: () => void;
}) {
  const { ref, size } = useBlockSize();
  const s = jenisStyles[jadwal.kelas_jenis];
  const dim = jadwal.status === 'planning' || !jadwal.dihitung ? 'opacity-50' : '';

  const timeLine =
    variant === 'lobby' ? (
      <p className={`block-time truncate font-label-md text-label-md ${s.text} opacity-90`}>
        {formatJam(jadwal.jam_mulai)}-{formatJam(jadwal.jam_selesai)} WIB
      </p>
    ) : compact ? null : (
      <p className={`block-time truncate font-label-sm text-label-sm ${s.text} opacity-80`}>
        {formatJam(jadwal.jam_mulai)}-{formatJam(jadwal.jam_selesai)}
      </p>
    );

  return (
    <div
      ref={ref}
      data-size={size}
      title={`${jadwal.kelas_nama} • ${formatJam(jadwal.jam_mulai)}-${formatJam(jadwal.jam_selesai)} • ${lokasiLabel(jadwal)}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`relative flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden rounded-card border-l-4 ${s.bg} ${s.border} ${dim} ${
        compact ? 'px-1.5 py-1 text-left' : 'px-2 py-1 text-left'
      } transition-opacity hover:opacity-80`}
    >
      <p className={`block-nama truncate font-bold ${s.text} ${variant === 'lobby' ? 'font-label-lg' : 'font-label-md text-label-md'}`}>
        {jadwal.kelas_nama}
      </p>
      {timeLine}
      <p className="block-lokasi truncate font-label-sm text-label-sm text-on-surface-variant">
        {lokasiEmoji[jadwal.tipe_lokasi]} {lokasiLabel(jadwal)}
      </p>
      {/* Exception per tanggal: redup + label utk dibatalkan / diganti sensei */}
      {jadwal.exception_tipe === 'dibatalkan' && (
        <p className="block-exc truncate font-label-sm text-label-sm font-bold text-error">
          DIBATALKAN{jadwal.exception_catatan ? ` • ${jadwal.exception_catatan}` : ''}
        </p>
      )}
      {jadwal.exception_tipe === 'ganti_sensei' && !jadwal.is_pengganti && (
        <p className="block-exc truncate font-label-sm text-label-sm font-bold text-error">
          Digantikan oleh {jadwal.sensei_pengganti_nama ?? 'sensei lain'}
        </p>
      )}
      {jadwal.exception_tipe === 'ganti_sensei' && jadwal.is_pengganti && (
        <p className="block-exc truncate font-label-sm text-label-sm font-bold text-cat-bimbel-accent">
          Pengganti
        </p>
      )}
    </div>
  );
}
