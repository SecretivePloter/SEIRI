// Modal detail jadwal — klik blok di timeline/daftar utk lihat detail +
// aksi (nonaktifkan / hapus utk admin) + exception per tanggal:
// "Batalkan Hari Ini", "Ganti Sensei Hari Ini" (dgn dropdown sensei
// tersedia), dan undo ("Batalkan Pembatalan" / "Batalkan Pergantian").

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusBadge, JenisBadge, LokasiBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { deleteJadwalSlot, setStatusSlot } from '@/lib/api/jadwal';
import { simpanExceptionJadwal, hapusExceptionJadwal, listSenseiPenggantiTersedia } from '@/lib/api/exception';
import type { JadwalResolved } from '@/lib/types/domain';
import { formatJam, formatTanggalPanjang } from '@/lib/time';
import { toast } from '@/stores/toastStore';
import { RpcError } from '@/lib/api/rpcError';

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

  // Exception UI state
  const [modeBatalkan, setModeBatalkan] = useState(false);
  const [modeGanti, setModeGanti] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [penggantiId, setPenggantiId] = useState<string>('');
  const [calonPengganti, setCalonPengganti] = useState<Array<{ sensei_id: string; nama: string }>>([]);

  const isRutin = !!jadwal?.is_rutin;
  // Exception yg sedang aktif utk tanggal ini (dibawa dari resolve_jadwal)
  const exception = jadwal?.exception_tipe ?? null;
  const punyaPenggantiSebelum = jadwal?.is_pengganti ?? false;

  // Saat jadwal berganti / exception berubah, reset panel form
  useEffect(() => {
    setModeBatalkan(false);
    setModeGanti(false);
    setCatatan('');
    setPenggantiId('');
    setCalonPengganti([]);
  }, [jadwal?.slot_id, jadwal?.tanggal_efektif, exception]);

  // Muat daftar sensei pengganti tersedia pas buka form ganti
  const bukaGanti = async () => {
    if (!jadwal) return;
    setBusy(true);
    setModeGanti(true);
    setModeBatalkan(false);
    setCatatan(jadwal.exception_catatan ?? '');
    try {
      const list = await listSenseiPenggantiTersedia(jadwal.slot_id, jadwal.tanggal_efektif);
      setCalonPengganti(list);
      if (jadwal.sensei_pengganti_id) setPenggantiId(jadwal.sensei_pengganti_id);
    } catch (e) {
      toast.error('Gagal memuat sensei pengganti', e instanceof Error ? e.message : undefined);
      setModeGanti(false);
    } finally {
      setBusy(false);
    }
  };

  const simpanBatalkan = async () => {
    if (!jadwal) return;
    setBusy(true);
    try {
      await simpanExceptionJadwal({
        jadwal_slot_id: jadwal.slot_id,
        tanggal: jadwal.tanggal_efektif,
        tipe: 'dibatalkan',
        catatan: catatan || null,
      });
      toast.success('Kelas dibatalkan untuk hari ini');
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error('Gagal membatalkan', e instanceof RpcError ? e.message : e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const simpanGanti = async () => {
    if (!jadwal) return;
    if (!penggantiId) {
      toast.error('Pilih sensei pengganti');
      return;
    }
    setBusy(true);
    try {
      await simpanExceptionJadwal({
        jadwal_slot_id: jadwal.slot_id,
        tanggal: jadwal.tanggal_efektif,
        tipe: 'ganti_sensei',
        sensei_pengganti_id: penggantiId,
        catatan: catatan || null,
      });
      toast.success('Sensei pengganti disimpan');
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error('Gagal mengganti', e instanceof RpcError ? e.message : e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const undoException = async () => {
    if (!jadwal) return;
    setBusy(true);
    try {
      await hapusExceptionJadwal(jadwal.slot_id, jadwal.tanggal_efektif);
      toast.success('Exception dihapus, kembali ke jadwal normal');
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error('Gagal membatalkan exception', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

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
              {!modeBatalkan && !modeGanti && (
                <>
                  {isRutin && (
                    <>
                      <Button variant="outline" onClick={() => { setModeBatalkan(true); setModeGanti(false); setCatatan(jadwal.exception_catatan ?? ''); }}>
                        <Icon name="event_busy" size={16} /> Batalkan Hari Ini
                      </Button>
                      <Button variant="outline" onClick={() => void bukaGanti()}>
                        <Icon name="swap_horiz" size={16} /> Ganti Sensei Hari Ini
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                    <Icon name="delete" size={16} /> Hapus
                  </Button>
                  <Button variant="danger" onClick={() => void nonaktifkan()} disabled={busy}>
                    {busy ? 'Memproses...' : 'Nonaktifkan Jadwal Rutin Ini'}
                  </Button>
                </>
              )}
              {modeBatalkan && (
                <>
                  <Button variant="outline" onClick={() => setModeBatalkan(false)} disabled={busy}>
                    Batal
                  </Button>
                  <Button variant="danger" onClick={() => void simpanBatalkan()} disabled={busy}>
                    {busy ? 'Menyimpan...' : 'Konfirmasi Pembatalan'}
                  </Button>
                </>
              )}
              {modeGanti && (
                <>
                  <Button variant="outline" onClick={() => setModeGanti(false)} disabled={busy}>
                    Batal
                  </Button>
                  <Button onClick={() => void simpanGanti()} disabled={busy || !penggantiId}>
                    {busy ? 'Menyimpan...' : 'Simpan Pengganti'}
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {jadwal && (
          <div className="flex flex-col gap-3">
            {/* Badge status exception aktif utk tanggal ini */}
            {exception === 'dibatalkan' && (
              <div className="flex items-center gap-2 rounded-lg border border-error bg-error-container px-3 py-2 font-label-sm text-label-sm text-on-error-container">
                <Icon name="event_busy" size={18} /> Dibatalkan hari ini
                {jadwal.exception_catatan ? ` • ${jadwal.exception_catatan}` : ''}
              </div>
            )}
            {exception === 'ganti_sensei' && (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-label-sm text-label-sm ${
                  punyaPenggantiSebelum
                    ? 'border-cat-bimbel-accent bg-cat-bimbel/30 text-on-surface'
                    : 'border-cat-benkyou-accent bg-cat-benkyou/30 text-on-surface'
                }`}
              >
                <Icon name="swap_horiz" size={18} />
                {punyaPenggantiSebelum
                  ? `Kelas ini adalah pengganti utk ${jadwal.sensei_efektif_nama ?? 'sensei asli'}`
                  : `Digantikan oleh ${jadwal.sensei_pengganti_nama ?? 'sensei lain'} hari ini`}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <JenisBadge jenis={jadwal.kelas_jenis} />
              <StatusBadge status={jadwal.status} />
            </div>
            <div>
              <p className="font-headline-sm text-headline-sm text-on-surface">{jadwal.kelas_nama}</p>
              <p className="font-body-md text-body-md text-secondary">
                Slot ID: <span className="font-mono text-label-md">{jadwal.slot_id.slice(0, 8)}...</span>
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

            {/* Form batalkan hari ini */}
            {modeBatalkan && (
              <div className="rounded-card border border-border-soft bg-surface-container-low p-3">
                <p className="font-label-md text-label-md font-semibold text-on-surface">Batalkan kelas untuk tanggal ini</p>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan alasan (opsional), mis. Libur nasional, Murid cuti"
                  className="mt-2 w-full rounded border border-border-input bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                  rows={2}
                />
                <p className="mt-1 font-label-sm text-label-sm text-secondary">
                  Quick: Libur nasional • Murid cuti
                </p>
              </div>
            )}

            {/* Form ganti sensei */}
            {modeGanti && (
              <div className="rounded-card border border-border-soft bg-surface-container-low p-3">
                <p className="font-label-md text-label-md font-semibold text-on-surface">Ganti sensei untuk tanggal ini</p>
                <select
                  value={penggantiId}
                  onChange={(e) => setPenggantiId(e.target.value)}
                  className="mt-2 w-full rounded border border-border-input bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Pilih sensei pengganti...</option>
                  {calonPengganti.map((s) => (
                    <option key={s.sensei_id} value={s.sensei_id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
                <p className="mt-1 font-label-sm text-label-sm text-secondary">
                  Hanya sensei tersedia di jam ini yang ditampilkan.
                </p>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan (opsional)"
                  className="mt-2 w-full rounded border border-border-input bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                  rows={2}
                />
              </div>
            )}

            {/* Undo utk exception yg sudah aktif */}
            {exception && !modeBatalkan && !modeGanti && (
              <div className="flex flex-col gap-2 rounded-card border border-outline-variant bg-surface-container-lowest p-3">
                <Button variant="outline" onClick={() => void undoException()} disabled={busy}>
                  {exception === 'dibatalkan' ? (
                    <>
                      <Icon name="undo" size={16} /> Batalkan Pembatalan
                    </>
                  ) : punyaPenggantiSebelum ? (
                    <>
                      <Icon name="undo" size={16} /> Hapus Pergantian (baris ini)
                    </>
                  ) : (
                    <>
                      <Icon name="undo" size={16} /> Batalkan Pergantian Sensei
                    </>
                  )}
                </Button>
              </div>
            )}

            <p className="font-label-sm text-label-sm text-secondary">
              Catatan: "Nonaktifkan Jadwal Rutin Ini" / "Hapus" memengaruhi seluruh slot ini (termasuk jadwal
              rutinnya). "Batalkan Hari Ini" / "Ganti Sensei Hari Ini" hanya berlaku utk tanggal yang sedang dilihat.
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