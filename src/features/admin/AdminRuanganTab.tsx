// AdminRuanganTab — CRUD ruangan + flow nonaktifkan aman (asumsi #2):
// guard jumlah jadwal mendatang + ConfirmDialog eksplisit dengan opsi
// "juga nonaktifkan jadwal mendatang".

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HapusMasterDialog } from '@/components/ui/HapusMasterDialog';
import {
  listRuangan,
  createRuangan,
  updateRuangan,
  countJadwalRuanganMendatang,
  nonaktifkanRuangan,
  aktifkanRuangan,
  type RuanganInput,
} from '@/lib/api/ruangan';
import { useAsyncData } from '@/app/useAsyncData';
import { ruanganSchema } from '@/lib/validation/masterSchema';
import { flattenZodErrors } from '@/lib/validation/jadwalSchema';
import type { Ruangan } from '@/lib/types/domain';
import { toast } from '@/stores/toastStore';

const EMPTY: RuanganInput = { nama: '', kapasitas: null, lantai: null, posisi_slot: null, urutan_dalam_slot: null, tipe: 'fisik' };

export function AdminRuanganTab({ isAdmin }: { isAdmin: boolean }) {
  const q = useAsyncData(() => listRuangan({ includeNonaktif: true }), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ruangan | null>(null);
  const [form, setForm] = useState<RuanganInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [targetNonaktif, setTargetNonaktif] = useState<Ruangan | null>(null);
  const [jumlahMendatang, setJumlahMendatang] = useState<number | null>(null);
  const [targetHapus, setTargetHapus] = useState<Ruangan | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setFormOpen(true);
  };
  const openEdit = (r: Ruangan) => {
    setEditing(r);
    setForm({
      nama: r.nama,
      kapasitas: r.kapasitas,
      lantai: r.lantai,
      posisi_slot: r.posisi_slot,
      urutan_dalam_slot: r.urutan_dalam_slot,
      tipe: r.tipe,
    });
    setErrors({});
    setFormOpen(true);
  };

  const simpan = async () => {
    const parsed = ruanganSchema.safeParse({ nama: form.nama, kapasitas: form.kapasitas });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        nama: parsed.data.nama,
        kapasitas: parsed.data.kapasitas,
        lantai: form.tipe === 'fisik' ? form.lantai : null,
        posisi_slot: form.tipe === 'fisik' ? form.posisi_slot : null,
        urutan_dalam_slot: form.tipe === 'fisik' ? form.urutan_dalam_slot : null,
        tipe: form.tipe,
      };
      if (editing) {
        await updateRuangan(editing.id, payload);
        toast.success('Ruangan diperbarui');
      } else {
        await createRuangan(payload);
        toast.success('Ruangan ditambahkan');
      }
      setFormOpen(false);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menyimpan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const mintaNonaktifkan = async (r: Ruangan) => {
    setBusy(true);
    try {
      const n = await countJadwalRuanganMendatang(r.id);
      setJumlahMendatang(n);
      setTargetNonaktif(r);
    } catch (e) {
      toast.error('Gagal memeriksa jadwal', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const eksekusiNonaktifkan = async (jugaNonaktifkanJadwal: boolean) => {
    if (!targetNonaktif) return;
    setBusy(true);
    try {
      await nonaktifkanRuangan(targetNonaktif.id, jugaNonaktifkanJadwal);
      toast.success('Ruangan dinonaktifkan', jugaNonaktifkanJadwal ? 'Jadwal mendatang di ruangan ini ditandai tidak aktif' : undefined);
      setTargetNonaktif(null);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menonaktifkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const aktifkan = async (r: Ruangan) => {
    setBusy(true);
    try {
      await aktifkanRuangan(r.id);
      toast.success('Ruangan diaktifkan kembali');
      void q.reload();
    } catch (e) {
      toast.error('Gagal mengaktifkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Ruangan>[] = [
    { key: 'nama', header: 'Nama Ruangan', render: (r) => <p className="font-body-md text-body-md text-on-surface">{r.nama}</p> },
    {
      key: 'tipe',
      header: 'Tipe',
      render: (r) => (
        <span className="font-body-md text-body-md text-on-surface">
          {r.tipe === 'virtual' ? '🌐 Online' : r.lantai ? `Lt ${r.lantai} • Slot ${r.posisi_slot ?? '-'}` : 'Fisik'}
        </span>
      ),
    },
    {
      key: 'kapasitas',
      header: 'Kapasitas',
      render: (r) => <span className="font-body-md text-body-md text-on-surface">{r.kapasitas ? `${r.kapasitas} orang` : '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.is_aktif ? (
          <span className="inline-flex rounded-full bg-cat-bimbel px-2.5 py-0.5 font-label-sm text-label-sm text-cat-bimbel-text">Aktif</span>
        ) : (
          <span className="inline-flex rounded-full bg-error-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-error-container">
            Nonaktif
          </span>
        ),
    },
    {
      key: 'aksi',
      header: '',
      render: (r) =>
        isAdmin ? (
          <div className="flex justify-end gap-1">
            <button onClick={() => openEdit(r)} className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-primary" aria-label="Edit ruangan">
              <Icon name="edit" size={18} />
            </button>
            {r.is_aktif ? (
              <button
                onClick={() => void mintaNonaktifkan(r)}
                className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
                aria-label="Nonaktifkan ruangan"
              >
                <Icon name="meeting_room" size={18} />
              </button>
            ) : (
              <button
                onClick={() => void aktifkan(r)}
                className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-cat-bimbel-accent"
                aria-label="Aktifkan ruangan"
              >
                <Icon name="meeting_room" size={18} />
              </button>
            )}
            <button
              onClick={() => setTargetHapus(r)}
              className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
              aria-label="Hapus ruangan"
              title="Hapus ruangan (evaluasi otomatis soft/hard)"
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
        <p className="font-body-md text-body-md text-secondary">{q.data?.length ?? 0} ruangan</p>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Icon name="add" size={16} /> Tambah Ruangan
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
        {q.loading ? (
          <LoadingState label="Memuat ruangan..." />
        ) : q.error ? (
          <ErrorState message={q.error} onRetry={() => void q.reload()} />
        ) : (
          <DataTable
            columns={columns}
            rows={q.data ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState icon="meeting_room" title="Belum ada ruangan" description="Tambahkan ruangan pertama." />}
          />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title={editing ? 'Edit Ruangan' : 'Tambah Ruangan'}
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
          <Field label="Nama ruangan" required error={errors['nama']}>
            <Input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="ex: Haru" />
          </Field>
          <Field label="Tipe ruangan" hint="Virtual = Online (tidak digambar di denah)">
            <Select value={form.tipe} onChange={(e) => setForm((f) => ({ ...f, tipe: e.target.value as RuanganInput['tipe'] }))}>
              <option value="fisik">Fisik (di dalam gedung)</option>
              <option value="virtual">Virtual (Online)</option>
            </Select>
          </Field>
          {form.tipe === 'fisik' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Lantai" hint="1 atau 2">
                <Input
                  type="number"
                  min={1}
                  max={2}
                  value={form.lantai ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, lantai: e.target.value ? Number(e.target.value) : null }))}
                />
              </Field>
              <Field label="Posisi slot" hint="1-4 (kolom denah)">
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={form.posisi_slot ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, posisi_slot: e.target.value ? Number(e.target.value) : null }))}
                />
              </Field>
              <Field label="Urutan dalam slot" hint="1 = pertama, 2 = kedua (sub-kotak)">
                <Input
                  type="number"
                  min={1}
                  value={form.urutan_dalam_slot ?? 1}
                  onChange={(e) => setForm((f) => ({ ...f, urutan_dalam_slot: e.target.value ? Number(e.target.value) : null }))}
                />
              </Field>
            </div>
          ) : null}
          <Field label="Kapasitas" hint="Opsional">
            <Input
              type="number"
              min={1}
              value={form.kapasitas ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, kapasitas: e.target.value ? Number(e.target.value) : null }))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={targetNonaktif !== null}
        onClose={() => !busy && setTargetNonaktif(null)}
        onConfirm={(checked) => void eksekusiNonaktifkan(checked)}
        title={`Nonaktifkan ruangan "${targetNonaktif?.nama ?? ''}"?`}
        description={
          jumlahMendatang && jumlahMendatang > 0
            ? `Ruangan ini masih dipakai ${jumlahMendatang} jadwal aktif mendatang. Data & riwayat tetap utuh. Pilih apakah jadwal mendatang ikut dinonaktifkan.`
            : 'Ruangan akan ditandai nonaktif dan tidak muncul di pilihan form jadwal. Bisa diaktifkan kembali kapan saja.'
        }
        confirmLabel="Nonaktifkan"
        danger
        busy={busy}
        checkboxLabel={
          jumlahMendatang && jumlahMendatang > 0
            ? `Juga nonaktifkan ${jumlahMendatang} jadwal mendatang di ruangan ini`
            : undefined
        }
      />

      <HapusMasterDialog
        open={targetHapus !== null}
        tipe="ruangan"
        id={targetHapus?.id ?? ''}
        nama={targetHapus?.nama ?? ''}
        onClose={() => setTargetHapus(null)}
        onDone={() => void q.reload()}
      />
    </>
  );
}
