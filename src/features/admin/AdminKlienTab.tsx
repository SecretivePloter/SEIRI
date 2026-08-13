// AdminKlienTab — CRUD klien/murid. Delete fisik hanya aman jika klien tidak
// punya kelas; jika masih punya kelas, Postgres FK RESTRICT menolak dan UI
// menampilkan pesan yang jelas.

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { listKlien, createKlien, updateKlien, deleteKlien, type KlienInput } from '@/lib/api/klien';
import { listKelas } from '@/lib/api/kelas';
import { useAsyncData } from '@/app/useAsyncData';
import { klienSchema } from '@/lib/validation/masterSchema';
import { flattenZodErrors } from '@/lib/validation/jadwalSchema';
import type { Klien } from '@/lib/types/domain';
import { toast } from '@/stores/toastStore';

const EMPTY: KlienInput = { nama: '', jenis: 'individu', kontak: null };

export function AdminKlienTab({ isAdmin }: { isAdmin: boolean }) {
  const q = useAsyncData(() => listKlien(), []);
  // Utk tahu klien mana yang masih punya kelas (guard sebelum delete)
  const kelasQ = useAsyncData(() => listKelas({ includeNonaktif: true }), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Klien | null>(null);
  const [form, setForm] = useState<KlienInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [targetHapus, setTargetHapus] = useState<Klien | null>(null);

  const jumlahKelas = (klienId: string) => (kelasQ.data ?? []).filter((k) => k.klien_id === klienId).length;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setFormOpen(true);
  };
  const openEdit = (k: Klien) => {
    setEditing(k);
    setForm({ nama: k.nama, jenis: k.jenis, kontak: k.kontak });
    setErrors({});
    setFormOpen(true);
  };

  const simpan = async () => {
    const parsed = klienSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateKlien(editing.id, parsed.data);
        toast.success('Klien diperbarui');
      } else {
        await createKlien(parsed.data);
        toast.success('Klien ditambahkan');
      }
      setFormOpen(false);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menyimpan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const eksekusiHapus = async () => {
    if (!targetHapus) return;
    setBusy(true);
    try {
      await deleteKlien(targetHapus.id);
      toast.success('Klien dihapus');
      setTargetHapus(null);
      void q.reload();
      void kelasQ.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.error(
        'Gagal menghapus klien',
        msg.includes('foreign key') || msg.includes('violates')
          ? 'Klien masih memiliki kelas. Nonaktifkan/hapus kelasnya dulu.'
          : msg || undefined,
      );
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Klien>[] = [
    { key: 'nama', header: 'Nama', render: (k) => <p className="font-body-md text-body-md text-on-surface">{k.nama}</p> },
    {
      key: 'jenis',
      header: 'Jenis',
      render: (k) => (
        <span className="inline-flex rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant capitalize">
          {k.jenis}
        </span>
      ),
    },
    { key: 'kontak', header: 'Kontak', render: (k) => <span className="font-body-md text-body-md text-on-surface">{k.kontak ?? '—'}</span> },
    {
      key: 'kelas',
      header: 'Kelas',
      render: (k) => <span className="font-body-md text-body-md text-on-surface">{jumlahKelas(k.id)} kelas</span>,
    },
    {
      key: 'aksi',
      header: '',
      render: (k) =>
        isAdmin ? (
          <div className="flex justify-end gap-1">
            <button onClick={() => openEdit(k)} className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-primary" aria-label="Edit klien">
              <Icon name="edit" size={18} />
            </button>
            <button
              onClick={() => setTargetHapus(k)}
              className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
              aria-label="Hapus klien"
            >
              <Icon name="delete" size={18} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-body-md text-body-md text-secondary">{q.data?.length ?? 0} klien / murid</p>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Icon name="add" size={16} /> Tambah Klien
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
        {q.loading ? (
          <LoadingState label="Memuat klien..." />
        ) : q.error ? (
          <ErrorState message={q.error} onRetry={() => void q.reload()} />
        ) : (
          <DataTable
            columns={columns}
            rows={q.data ?? []}
            rowKey={(k) => k.id}
            empty={<EmptyState icon="group" title="Belum ada klien" description="Tambahkan klien/murid pertama." />}
          />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title={editing ? 'Edit Klien' : 'Tambah Klien'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={() => void simpan()} disabled={busy}>
              {busy ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nama" required error={errors['nama']}>
            <Input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
          </Field>
          <Field label="Jenis" required>
            <Select value={form.jenis} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as KlienInput['jenis'] }))}>
              <option value="individu">Individu / Murid</option>
              <option value="perusahaan">Perusahaan</option>
            </Select>
          </Field>
          <Field label="Kontak">
            <Input value={form.kontak ?? ''} onChange={(e) => setForm((f) => ({ ...f, kontak: e.target.value || null }))} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={targetHapus !== null}
        onClose={() => !busy && setTargetHapus(null)}
        onConfirm={() => void eksekusiHapus()}
        title={`Hapus klien "${targetHapus?.nama ?? ''}"?`}
        description={
          targetHapus && jumlahKelas(targetHapus.id) > 0
            ? `Klien ini masih punya ${jumlahKelas(targetHapus.id)} kelas — penghapusan akan ditolak server. Kelola kelasnya terlebih dahulu.`
            : 'Klien akan dihapus permanen. Aksi ini tidak bisa dibatalkan.'
        }
        confirmLabel="Hapus"
        danger
        busy={busy}
      />
    </>
  );
}
