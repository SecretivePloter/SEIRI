// Modal detail jadwal — klik blok di timeline/daftar utk lihat detail +
// aksi (nonaktifkan / hapus utk admin).

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusBadge, JenisBadge, LokasiBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { deleteJadwalSlot, setStatusSlot } from '@/lib/api/jadwal';
import type { JadwalResolved } from '@/lib/types/domain';
import { formatJam, formatTanggalPanjang } from '@/lib/time';
import { toast } from '@/stores/toastStore';
import { RpcError } from '@/lib/api/rpcError';
import { useState } from 'react';

export function JadwalDetailModal({
  jadwal,
  onClose,
  onChanged,
}: {
  jadwal: JadwalResolved | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const nonaktifkan = async () => {
    if (!jadwal) return;
    setBusy(true);
    try {
      await setStatusSlot(jadwal.slot_id, 'tidak_aktif');
      toast.success('Jadwal dinonaktifkan');
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error('Gagal menonaktifkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const hapus = async () => {
    if (!jadwal) return;
    setBusy(true);
    try {
      await deleteJadwalSlot(jadwal.slot_id);
      toast.success('Jadwal dihapus');
      setConfirmDelete(false);
      onChanged?.();
      onClose();
    } catch (e) {
      const msg = e instanceof RpcError ? e.message : e instanceof Error ? e.message : undefined;
      toast.error('Gagal menghapus jadwal', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={jadwal !== null}
        onClose={onClose}
        title="Detail Jadwal"
        footer={
          jadwal?.status === 'aktif' ? (
            <>
              <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Icon name="delete" size={16} /> Hapus
              </Button>
              <Button variant="danger" onClick={() => void nonaktifkan()} disabled={busy}>
                {busy ? 'Memproses…' : 'Nonaktifkan'}
              </Button>
            </>
          ) : undefined
        }
      >
        {jadwal && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <JenisBadge jenis={jadwal.kelas_jenis} />
              <StatusBadge status={jadwal.status} />
            </div>
            <div>
              <p className="font-headline-sm text-headline-sm text-on-surface">{jadwal.kelas_nama}</p>
              <p className="font-body-md text-body-md text-secondary">
                Slot ID: <span className="font-mono text-label-md">{jadwal.slot_id.slice(0, 8)}…</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-card border border-border-soft bg-surface-container-low p-3 font-body-md text-body-md">
              <div>
                <p className="font-label-sm text-label-sm text-secondary">Tanggal</p>
                <p className="text-on-surface">{formatTanggalPanjang(jadwal.tanggal_efektif)}</p>
              </div>
              <div>
                <p className="font-label-sm text-label-sm text-secondary">Jam</p>
                <p className="text-on-surface">
                  {formatJam(jadwal.jam_mulai)}-{formatJam(jadwal.jam_selesai)} WIB
                </p>
              </div>
              <div className="col-span-2">
                <p className="font-label-sm text-label-sm text-secondary">Lokasi</p>
                <LokasiBadge tipe={jadwal.tipe_lokasi} nama={jadwal.ruangan_nama} />
                {jadwal.alamat_tujuan && <p className="mt-1 text-on-surface">{jadwal.alamat_tujuan}</p>}
              </div>
              {jadwal.keterangan && (
                <div className="col-span-2">
                  <p className="font-label-sm text-label-sm text-secondary">Keterangan</p>
                  <p className="text-on-surface">{jadwal.keterangan}</p>
                </div>
              )}
            </div>
            <p className="font-label-sm text-label-sm text-secondary">
              Catatan: menonaktifkan/hapus memengaruhi seluruh slot ini (termasuk jadwal rutinnya).
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void hapus()}
        title="Hapus jadwal permanen?"
        description="Jadwal akan dihapus permanen termasuk jadwal rutinnya. Riwayat jam mengajar pada tanggal yang sudah lewat tetap terhitung dari data yang ada. Aksi ini tidak bisa dibatalkan."
        confirmLabel="Hapus permanen"
        danger
        busy={busy}
      />
    </>
  );
}
