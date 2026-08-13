// AdminSenseiTab — CRUD sensei + flow nonaktifkan aman (asumsi #2):
// jika sensei punya jadwal aktif mendatang, wajib ConfirmDialog eksplisit
// dengan opsi "juga nonaktifkan jadwal mendatang". Tidak ada silent delete.

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  listSensei,
  createSensei,
  updateSensei,
  countJadwalMendatang,
  nonaktifkanSensei,
  aktifkanSensei,
  type SenseiInput,
} from '@/lib/api/sensei';
import { useAsyncData } from '@/app/useAsyncData';
import { senseiSchema } from '@/lib/validation/masterSchema';
import { flattenZodErrors } from '@/lib/validation/jadwalSchema';
import type { Sensei, JlptLevel } from '@/lib/types/domain';
import { toast } from '@/stores/toastStore';

const EMPTY_FORM: SenseiInput = {
  nama: '',
  status: 'Sensei Utama',
  bahasa_ajar: [],
  jlpt_level: null,
  kontak: null,
  foto_url: null,
  tanggal_bergabung: null,
  target_jam_minggu: null,
  is_aktif: true,
};

export function AdminSenseiTab({ isAdmin }: { isAdmin: boolean }) {
  const q = useAsyncData(() => listSensei({ includeNonaktif: true }), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sensei | null>(null);
  const [form, setForm] = useState<SenseiInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [targetNonaktif, setTargetNonaktif] = useState<Sensei | null>(null);
  const [jumlahMendatang, setJumlahMendatang] = useState<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (s: Sensei) => {
    setEditing(s);
    setForm({
      nama: s.nama,
      status: s.status,
      bahasa_ajar: s.bahasa_ajar ?? [],
      jlpt_level: s.jlpt_level,
      kontak: s.kontak,
      foto_url: s.foto_url,
      tanggal_bergabung: s.tanggal_bergabung,
      target_jam_minggu: s.target_jam_minggu,
      is_aktif: s.is_aktif,
    });
    setErrors({});
    setFormOpen(true);
  };

  const simpan = async () => {
    const parsed = senseiSchema.safeParse({ ...form });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateSensei(editing.id, { ...parsed.data, is_aktif: form.is_aktif });
        toast.success('Sensei diperbarui');
      } else {
        await createSensei({ ...parsed.data, is_aktif: form.is_aktif });
        toast.success('Sensei ditambahkan');
      }
      setFormOpen(false);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menyimpan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const mintaNonaktifkan = async (s: Sensei) => {
    setBusy(true);
    try {
      const n = await countJadwalMendatang(s.id);
      setJumlahMendatang(n);
      setTargetNonaktif(s);
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
      await nonaktifkanSensei(targetNonaktif.id, jugaNonaktifkanJadwal);
      toast.success('Sensei dinonaktifkan', jugaNonaktifkanJadwal ? 'Jadwal mendatang ditandai tidak aktif' : undefined);
      setTargetNonaktif(null);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menonaktifkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const aktifkan = async (s: Sensei) => {
    setBusy(true);
    try {
      await aktifkanSensei(s.id);
      toast.success('Sensei diaktifkan kembali');
      void q.reload();
    } catch (e) {
      toast.error('Gagal mengaktifkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Sensei>[] = [
    {
      key: 'nama',
      header: 'Nama',
      render: (s) => (
        <div>
          <p className="font-body-md text-body-md text-on-surface">{s.nama}</p>
          <p className="font-label-sm text-label-sm text-secondary">{s.status}</p>
        </div>
      ),
    },
    {
      key: 'jlpt',
      header: 'JLPT',
      render: (s) => <span className="font-body-md text-body-md text-on-surface">{s.jlpt_level ?? '—'}</span>,
    },
    {
      key: 'bahasa',
      header: 'Bahasa Ajar',
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {(s.bahasa_ajar ?? []).slice(0, 3).map((b) => (
            <span key={b} className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
              {b}
            </span>
          ))}
          {(s.bahasa_ajar ?? []).length > 3 && (
            <span className="font-label-sm text-label-sm text-secondary">+{(s.bahasa_ajar ?? []).length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Target Jam/Minggu',
      render: (s) => <span className="font-body-md text-body-md text-on-surface">{s.target_jam_minggu ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) =>
        s.is_aktif ? (
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
      render: (s) =>
        isAdmin ? (
          <div className="flex justify-end gap-1">
            <button
              onClick={() => openEdit(s)}
              className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-primary"
              aria-label="Edit sensei"
            >
              <Icon name="edit" size={18} />
            </button>
            {s.is_aktif ? (
              <button
                onClick={() => void mintaNonaktifkan(s)}
                className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
                aria-label="Nonaktifkan sensei"
              >
                <Icon name="person_off" size={18} />
              </button>
            ) : (
              <button
                onClick={() => void aktifkan(s)}
                className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-cat-bimbel-accent"
                aria-label="Aktifkan sensei"
              >
                <Icon name="person" size={18} />
              </button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-body-md text-body-md text-secondary">{q.data?.length ?? 0} sensei</p>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Icon name="add" size={16} /> Tambah Sensei
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
        {q.loading ? (
          <LoadingState label="Memuat sensei..." />
        ) : q.error ? (
          <ErrorState message={q.error} onRetry={() => void q.reload()} />
        ) : (
          <DataTable
            columns={columns}
            rows={q.data ?? []}
            rowKey={(s) => s.id}
            empty={<EmptyState icon="person_search" title="Belum ada sensei" description="Tambahkan sensei pertama." />}
          />
        )}
      </div>

      {/* Form create/edit */}
      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title={editing ? 'Edit Sensei' : 'Tambah Sensei'}
        wide
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama" required error={errors['nama']}>
            <Input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SenseiInput['status'] }))}>
              <option value="Sensei Utama">Sensei Utama</option>
              <option value="Frelance">Frelance</option>
            </Select>
          </Field>
          <Field label="Level JLPT" error={errors['jlpt_level']}>
            <Select
              value={form.jlpt_level ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, jlpt_level: (e.target.value || null) as JlptLevel | null }))}
            >
              <option value="">Belum ada</option>
              {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tanggal bergabung">
            <Input
              type="date"
              value={form.tanggal_bergabung ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, tanggal_bergabung: e.target.value || null }))}
            />
          </Field>
          <Field label="Kontak">
            <Input value={form.kontak ?? ''} onChange={(e) => setForm((f) => ({ ...f, kontak: e.target.value || null }))} />
          </Field>
          <Field label="Target jam / minggu" hint="Opsional — utk badge over/under target di dashboard">
            <Input
              type="number"
              min={1}
              value={form.target_jam_minggu ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, target_jam_minggu: e.target.value ? Number(e.target.value) : null }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Bahasa ajar" hint="Pisahkan dengan koma, ex: Jepang N5, Jepang N4, Inggris">
              <Input
                value={(form.bahasa_ajar ?? []).join(', ')}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bahasa_ajar: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Konfirmasi nonaktifkan — dengan guard jumlah jadwal mendatang */}
      <ConfirmDialog
        open={targetNonaktif !== null}
        onClose={() => !busy && setTargetNonaktif(null)}
        onConfirm={(checked) => void eksekusiNonaktifkan(checked)}
        title={`Nonaktifkan ${targetNonaktif?.nama ?? ''}?`}
        description={
          jumlahMendatang && jumlahMendatang > 0
            ? `Sensei ini masih punya ${jumlahMendatang} jadwal aktif mendatang. Nonaktifkan sensei TIDAK menghapus data & riwayat — tetapi pilih apakah jadwal mendatang ikut dinonaktifkan.`
            : 'Sensei akan ditandai nonaktif. Data & riwayat jam mengajar tetap utuh dan bisa diaktifkan kembali kapan saja.'
        }
        confirmLabel="Nonaktifkan"
        danger
        busy={busy}
        checkboxLabel={
          jumlahMendatang && jumlahMendatang > 0
            ? `Juga nonaktifkan ${jumlahMendatang} jadwal mendatang milik sensei ini`
            : undefined
        }
      />
    </>
  );
}
