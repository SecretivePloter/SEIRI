// ScheduleBlock — blok jadwal pastel dengan accent bar kiri (DESIGN.md).
// Dipakai ulang di: timeline sensei, timeline ruangan, kalender profil.
// Varian 'full' utk grid jam (hari ini), 'compact' utk kolom hari mingguan.

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

export function ScheduleBlock({
  jadwal,
  compact = false,
  onClick,
}: {
  jadwal: JadwalResolved;
  compact?: boolean;
  onClick?: () => void;
}) {
  const s = jenisStyles[jadwal.kelas_jenis];
  const dim = jadwal.status === 'planning' ? 'opacity-50' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${jadwal.kelas_nama} • ${formatJam(jadwal.jam_mulai)}-${formatJam(jadwal.jam_selesai)} • ${lokasiLabel(jadwal)}`}
      className={`relative flex h-full w-full flex-col justify-center overflow-hidden rounded-card border-l-4 ${s.bg} ${s.border} ${dim} ${
        compact ? 'px-2 py-1 text-left' : 'px-2.5 py-1.5 text-left'
      } transition-opacity hover:opacity-80`}
    >
      <p className={`truncate font-bold ${s.text} ${compact ? 'font-label-sm text-label-sm' : 'font-label-md text-label-md'}`}>
        {jadwal.kelas_nama}
      </p>
      {!compact && (
        <p className={`truncate font-label-sm text-label-sm ${s.text} opacity-80`}>
          {formatJam(jadwal.jam_mulai)}-{formatJam(jadwal.jam_selesai)}
        </p>
      )}
      <p className="truncate font-label-sm text-label-sm text-on-surface-variant">
        {lokasiEmoji[jadwal.tipe_lokasi]} {lokasiLabel(jadwal)}
      </p>
    </button>
  );
}
