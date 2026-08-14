// AdminSesiTab — kelola aturan konversi durasi -> sesi per jenis kelas
// (tabel kategori_sesi). Dasar perhitungan pengajian: sesi = durasi kelas
// x (jumlah_sesi / durasi_jam). Admin bisa mengubah rate kapan saja tanpa
// ubah kode; perubahan langsung memengaruhi dashboard & profil sensei.

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { listKategoriSesi, upsertKategoriSesi } from '@/lib/api/kategoriSesi';
import { useAsyncData } from '@/app/useAsyncData';
import type { JenisKelas, KategoriSesi } from '@/lib/types/domain';
import { JENIS_KELAS_LIST } from '@/lib/types/domain';
import { jenisStyles } from '@/components/ui/Badge';
import { toast } from '@/stores/toastStore';

export function AdminSesiTab({ isAdmin }: { isAdmin: boolean }) {
  const q = useAsyncData(() => listKategoriSesi(), []);

  const [editing, setEditing] = useState<KategoriSesi | null>(null);
  const [form, setForm] = useState<{ durasi_jam: string; jumlah_sesi: string }>({ durasi_jam: '', jumlah_sesi: '1' });
  const [busy, setBusy] = useState(false);

  const openEdit = (k: KategoriSesi) => {
    setEditing(k);
    setForm({ durasi_jam: String(k.durasi_jam), jumlah_sesi: String(k.jumlah_sesi) });
  };

  const simpan = async () => {
    if (!editing) return;
    const durasi = Number(form.durasi_jam);
    const sesi = Number(form.jumlah_sesi);
    if (!Number.isFinite(durasi) || durasi <= 0) {
      toast.error('Durasi jam harus lebih dari 0');
      return;
    }
    if (!Number.isFinite(sesi) || sesi <= 0) {
      toast.error('Jumlah sesi harus lebih dari 0');
      return;
    }
    setBusy(true);
    try {
      await upsertKategoriSesi(editing.jenis as JenisKelas, durasi, sesi);
      toast.success(`Aturan ${editing.jenis} diperbarui`, 'Dashboard & profil sensei ikut terhitung ulang.');
      setEditing(null);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menyimpan aturan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<KategoriSesi>[] = [
    {
      key: 'jenis',
      header: 'Jenis Kelas',
      render: (k) => {
        const s = jenisStyles[k.jenis];
        return (
          <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${s.bg} ${s.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.accent}`} />
            {k.jenis}
          </span>
        );
      },
    },
    {
      key: 'durasi',
      header: 'Durasi Aturan',
      render: (k) => <span className="font-body-md text-body-md text-on-surface">{k.durasi_jam} jam</span>,
    },
    {
      key: 'sesi',
      header: 'Sesi',
      render: (k) => <span className="font-body-md text-body-md text-on-surface">{k.jumlah_sesi} sesi</span>,
    },
    {
      key: 'ket',
      header: 'Contoh',
      render: (k) => (
        <span className="font-body-md text-body-md text-secondary">
          kelas {k.durasi_jam} jam = {k.jumlah_sesi} sesi; 3 jam = {Math.round((3 * k.jumlah_sesi * 100) / k.durasi_jam) / 100} sesi
        </span>
      ),
    },
    {
      key: 'aksi',
      header: '',
      render: (k) =>
        isAdmin ? (
          <div className="flex justify-end">
            <button
              onClick={() => openEdit(k)}
              className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-primary"
              aria-label="Ubah aturan sesi"
            >
              <Icon name="edit" size={18} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-body-md text-body-md text-secondary">
          {q.data?.length ?? 0} dari {JENIS_KELAS_LIST.length} kategori memiliki aturan
        </p>
        {isAdmin && (
          <p className="font-label-sm text-label-sm text-secondary">
            Perubahan langsung dipakai dashboard & profil sensei. Tidak perlu ubah kode.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
        {q.loading ? (
          <LoadingState label="Memuat aturan sesi..." />
        ) : q.error ? (
          <ErrorState message={q.error} onRetry={() => void q.reload()} />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon="settings_applications"
            title="Belum ada aturan sesi"
            description="Aturan sesi menentukan berapa sesi untuk pengajian sensei."
          />
        ) : (
          <DataTable columns={columns} rows={q.data ?? []} rowKey={(k) => k.jenis} />
        )}
      </div>

      {JENIS_KELAS_LIST.filter((j) => !(q.data ?? []).some((k) => k.jenis === j)).length > 0 && (
        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-4">
          <p className="font-label-md text-label-md text-on-surface-variant">Kategori tanpa aturan (fallback: 1 slot = 1 sesi):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {JENIS_KELAS_LIST.filter((j) => !(q.data ?? []).some((k) => k.jenis === j)).map((j) => (
              <span key={j} className={`rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${jenisStyles[j].bg} ${jenisStyles[j].text}`}>
                {j}
              </span>
            ))}
          </div>
          {isAdmin && (
            <p className="mt-2 font-label-sm text-label-sm text-secondary">
              Semua 9 kategori sudah di-seed di migration 0006; jika ada kategori baru, tambahkan lewat SQL:
              insert into kategori_sesi (jenis, durasi_jam, jumlah_sesi) values (...);
            </p>
          )}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => !busy && setEditing(null)}
        title={`Aturan Sesi: ${editing?.jenis ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={() => void simpan()} disabled={busy}>
              {busy ? 'Menyimpan...' : 'Simpan aturan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Durasi aturan (jam)" required hint="Berapa jam kelas utk jumlah sesi di bawah">
            <Input
              type="number"
              step="0.1"
              min={0.1}
              value={form.durasi_jam}
              onChange={(e) => setForm((f) => ({ ...f, durasi_jam: e.target.value }))}
            />
          </Field>
          <Field label="Jumlah sesi" required hint="Dihasilkan dari durasi aturan di atas">
            <Input
              type="number"
              step="0.5"
              min={0.5}
              value={form.jumlah_sesi}
              onChange={(e) => setForm((f) => ({ ...f, jumlah_sesi: e.target.value }))}
            />
          </Field>
          <p className="font-label-sm text-label-sm text-secondary">
            Contoh: durasi aturan 2 jam = 1 sesi. Kelas 3 jam dihitung 1,5 sesi (proporsional).
          </p>
        </div>
      </Modal>
    </>
  );
}
