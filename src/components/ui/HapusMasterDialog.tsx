// HapusMasterDialog — modal konfirmasi hapus data master (sensei/kelas/ruangan).
// Menggunakan RPC evaluasi_hapus_master yang menentukan otomatis:
//   hard  -> hapus permanen (belum pernah dipakai jadwal)
//   soft  -> arsip/nonaktifkan (punya riwayat historis)
//   block -> tolak (masih dipakai jadwal aktif mendatang)
// Alur: klik "Hapus" -> server mengevaluasi & langsung mengeksekusi (hard/soft),
// atau mengembalikan block. Pesan konfirmasi berbeda per kondisi.

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { hapusMasterData, type TipeMasterHapus, type HasilEvaluasiHapus } from '@/lib/api/hapusMaster';
import { toast } from '@/stores/toastStore';

export function HapusMasterDialog({
  open,
  tipe,
  id,
  nama,
  onClose,
  onDone,
}: {
  open: boolean;
  tipe: TipeMasterHapus;
  id: string;
  nama: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState<HasilEvaluasiHapus | null>(null);

  const eksekusi = async () => {
    setBusy(true);
    setHasil(null);
    try {
      const h = await hapusMasterData(tipe, id);
      setHasil(h);
      if (h.aksi === 'block') {
        toast.error('Tidak bisa dihapus', h.pesan);
      } else if (h.aksi === 'soft') {
        toast.success('Data diarsipkan', h.pesan);
      } else {
        toast.success('Data dihapus permanen', h.pesan);
      }
      if (h.aksi !== 'block') onDone();
    } catch (e) {
      toast.error('Gagal menghapus', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={`Hapus data "${nama}"?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Tutup
          </Button>
          {!hasil && (
            <Button variant="danger" onClick={() => void eksekusi()} disabled={busy}>
              {busy ? 'Memeriksa...' : 'Hapus'}
            </Button>
          )}
        </>
      }
    >
      {!hasil ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Sistem akan memeriksa apakah data ini masih dipakai jadwal. Penghapusan
          permanen hanya terjadi jika belum pernah dipakai; data berriwayat akan
          diarsipkan (soft delete) supaya laporan lama tetap utuh.
        </p>
      ) : (
        <div
          className={`rounded border p-3 font-body-md text-body-md ${
            hasil.aksi === 'block'
              ? 'border-error bg-error-container text-on-error-container'
              : 'border-cat-benkyou-accent bg-cat-benkyou/30 text-on-surface'
          }`}
        >
          <div className="flex items-start gap-2">
            <Icon
              name={hasil.aksi === 'block' ? 'warning' : 'info'}
              size={18}
              className="mt-0.5 shrink-0"
            />
            <div>
              <p>{hasil.pesan}</p>
              {hasil.aksi === 'block' && (
                <p className="mt-1 font-label-sm text-label-sm opacity-90">
                  Nonaktifkan data ini atau selesaikan {hasil.jumlah_mendatang} jadwal terkait dulu.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
