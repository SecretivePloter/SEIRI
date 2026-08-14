// Badge & chip: StatusBadge (aktif/planning/tidak_aktif),
// JenisBadge (pastel kategori kelas), LokasiBadge (📍/🏢/🏠).

import type { JenisKelas, StatusSlot, TipeLokasi } from '@/lib/types/domain';

const statusStyles: Record<StatusSlot, string> = {
  aktif: 'bg-cat-bimbel text-cat-bimbel-text',
  planning: 'bg-surface-container text-on-surface-variant border border-outline-variant',
  tidak_aktif: 'bg-error-container text-on-error-container',
};

const statusLabels: Record<StatusSlot, string> = {
  aktif: 'Aktif',
  planning: 'Planning',
  tidak_aktif: 'Tidak Aktif',
};

export function StatusBadge({ status }: { status: StatusSlot }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

/** Warna kategori kelas — dipakai konsisten di timeline, lobby, dashboard,
 * tabel, chip. Kelas harus statis supaya Tailwind men-generate CSS-nya. */
export const jenisStyles: Record<JenisKelas, { bg: string; accent: string; text: string; border: string }> = {
  CLT: { bg: 'bg-cat-clt', accent: 'bg-cat-clt-accent', text: 'text-cat-clt-text', border: 'border-cat-clt-accent' },
  Bimbel: { bg: 'bg-cat-bimbel', accent: 'bg-cat-bimbel-accent', text: 'text-cat-bimbel-text', border: 'border-cat-bimbel-accent' },
  SSW: { bg: 'bg-cat-ssw', accent: 'bg-cat-ssw-accent', text: 'text-cat-ssw-text', border: 'border-cat-ssw-accent' },
  Private: { bg: 'bg-cat-private', accent: 'bg-cat-private-accent', text: 'text-cat-private-text', border: 'border-cat-private-accent' },
  TG: { bg: 'bg-cat-tg', accent: 'bg-cat-tg-accent', text: 'text-cat-tg-text', border: 'border-cat-tg-accent' },
  'Benkyou Houdai': { bg: 'bg-cat-benkyou', accent: 'bg-cat-benkyou-accent', text: 'text-cat-benkyou-text', border: 'border-cat-benkyou-accent' },
  'Semi Private': { bg: 'bg-cat-semi', accent: 'bg-cat-semi-accent', text: 'text-cat-semi-text', border: 'border-cat-semi-accent' },
  'Grup Kecil': { bg: 'bg-cat-grup', accent: 'bg-cat-grup-accent', text: 'text-cat-grup-text', border: 'border-cat-grup-accent' },
  Regular: { bg: 'bg-cat-regular', accent: 'bg-cat-regular-accent', text: 'text-cat-regular-text', border: 'border-cat-regular-accent' },
};

export function JenisBadge({ jenis }: { jenis: JenisKelas }) {
  const s = jenisStyles[jenis];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.accent}`} />
      {jenis}
    </span>
  );
}

const lokasiInfo: Record<TipeLokasi, { emoji: string; label: string }> = {
  ruangan: { emoji: '📍', label: 'Ruangan' },
  kelas_perusahaan: { emoji: '🏢', label: 'Kelas Perusahaan' },
  kelas_rumah: { emoji: '🏠', label: 'Kelas Rumah' },
};

export function LokasiBadge({ tipe, nama }: { tipe: TipeLokasi; nama?: string | null }) {
  const info = lokasiInfo[tipe];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
      <span aria-hidden>{info.emoji}</span> {nama ?? info.label}
    </span>
  );
}
