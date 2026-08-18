// AdminKelasTab — CRUD kelas. Kelas dengan jadwal aktif mendatang tidak
// dihapus, hanya dinonaktifkan (riwayat utuh); ConfirmDialog menampilkan
// daftar jadwal yang terdampak.

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { JenisBadge } from '@/components/ui/Badge';
import {
  listKelas,
  createKelas,
  updateKelas,
  nonaktifkanKelas,
  aktifkanKelas,
  arsipkanKelas,
  batalkanArsipKelas,
  listJadwalKelas,
  type KelasInput,
} from '@/lib/api/kelas';
import { listKlien } from '@/lib/api/klien';
import { useAsyncData } from '@/app/useAsyncData';
import { kelasSchema } from '@/lib/validation/masterSchema';
import { flattenZodErrors } from '@/lib/validation/jadwalSchema';
import type { Kelas, JadwalSlot, JenisKelas } from '@/lib/types/domain';
import { JENIS_KELAS_LIST } from '@/lib/types/domain';
import { toast } from '@/stores/toastStore';
import { formatJam, formatTanggalPendek } from '@/lib/time';
import { MultiSelect, ResetFiltersButton } from '@/components/ui/MultiSelect';
import { HapusMasterDialog } from '@/components/ui/HapusMasterDialog';
import { useMemo } from 'react';

const EMPTY: KelasInput = { nama_kelas: '', jenis: 'CLT', klien_id: null };

export function AdminKelasTab({ isAdmin }: { isAdmin: boolean }) {
  const q = useAsyncData(() => listKelas({ includeNonaktif: true }), []);
  const klienQ = useAsyncData(() => listKlien(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Kelas | null>(null);
  const [form, setForm] = useState<KelasInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [targetNonaktif, setTargetNonaktif] = useState<Kelas | null>(null);
  const [targetArsip, setTargetArsip] = useState<Kelas | null>(null);
  const [jadwalTerdampak, setJadwalTerdampak] = useState<JadwalSlot[]>([]);
  const [targetHapus, setTargetHapus] = useState<Kelas | null>(null);

  // Filter (v2 poin 5)
  const [jenisFilter, setJenisFilter] = useState<JenisKelas[]>([]);
  const [search, setSearch] = useState('');
  const filteredRows = useMemo(() => {
    const list = q.data ?? [];
    const s = search.toLowerCase();
    return list.filter((k) => {
      if (jenisFilter.length > 0 && !jenisFilter.includes(k.jenis)) return false;
      if (s && !`${k.nama_kelas} ${k.klien?.nama ?? ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [q.data, jenisFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setFormOpen(true);
  };
  const openEdit = (k: Kelas) => {
    setEditing(k);
    setForm({ nama_kelas: k.nama_kelas, jenis: k.jenis, klien_id: k.klien_id });
    setErrors({});
    setFormOpen(true);
  };

  const simpan = async () => {
    const parsed = kelasSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateKelas(editing.id, parsed.data);
        toast.success('Kelas diperbarui');
      } else {
        await createKelas(parsed.data);
        toast.success('Kelas ditambahkan');
      }
      setFormOpen(false);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menyimpan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const mintaNonaktifkan = async (k: Kelas) => {
    setBusy(true);
    try {
      const jadwal = await listJadwalKelas(k.id);
      setJadwalTerdampak(jadwal);
      setTargetNonaktif(k);
    } catch (e) {
      toast.error('Gagal memeriksa jadwal', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const eksekusiNonaktifkan = async () => {
    if (!targetNonaktif) return;
    setBusy(true);
    try {
      await nonaktifkanKelas(targetNonaktif.id);
      toast.success('Kelas dinonaktifkan', 'Jadwal yang ada tetap utuh sebagai riwayat.');
      setTargetNonaktif(null);
      void q.reload();
    } catch (e) {
      toast.error('Gagal menonaktifkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const aktifkan = async (k: Kelas) => {
    setBusy(true);
    try {
      await aktifkanKelas(k.id);
      toast.success('Kelas diaktifkan kembali');
      void q.reload();
    } catch (e) {
      toast.error('Gagal mengaktifkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const eksekusiArsip = async (jugaNonaktifkanJadwal: boolean) => {
    if (!targetArsip) return;
    setBusy(true);
    try {
      await arsipkanKelas(targetArsip.id, jugaNonaktifkanJadwal);
      toast.success('Kelas diarsipkan', 'Riwayat jam mengajar tetap utuh.');
      setTargetArsip(null);
      setJadwalTerdampak([]);
      void q.reload();
    } catch (e) {
      toast.error('Gagal mengarsipkan', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const mintaArsip = async (k: Kelas) => {
    setBusy(true);
    try {
      const jadwal = await listJadwalKelas(k.id);
      setJadwalTerdampak(jadwal);
      setTargetArsip(k);
    } catch (e) {
      toast.error('Gagal memeriksa jadwal', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const batalkanArsip = async (k: Kelas) => {
    setBusy(true);
    try {
      await batalkanArsipKelas(k.id);
      toast.success('Arsip dibatalkan', 'Kelas aktif kembali.');
      void q.reload();
    } catch (e) {
      toast.error('Gagal membatalkan arsip', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Kelas>[] = [
    { key: 'nama', header: 'Nama Kelas', render: (k) => <p className="font-body-md text-body-md text-on-surface">{k.nama_kelas}</p> },
    { key: 'jenis', header: 'Jenis', render: (k) => <JenisBadge jenis={k.jenis} /> },
    {
      key: 'klien',
      header: 'Klien / Murid',
      render: (k) => <span className="font-body-md text-body-md text-on-surface">{k.klien?.nama ?? '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (k) =>
        k.diarsipkan ? (
          <span className="inline-flex rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
            Diarsipkan
          </span>
        ) : k.is_aktif ? (
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
      render: (k) =>
        isAdmin ? (
          <div className="flex justify-end gap-1">
            <button onClick={() => openEdit(k)} className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-primary" aria-label="Edit kelas">
              <Icon name="edit" size={18} />
            </button>
            {k.diarsipkan ? (
              <button
                onClick={() => void batalkanArsip(k)}
                className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-cat-bimbel-accent"
                aria-label="Batalkan arsip kelas"
              >
                <Icon name="unarchive" size={18} />
              </button>
            ) : (
              <>
                {k.is_aktif ? (
                  <button
                    onClick={() => void mintaNonaktifkan(k)}
                    className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
                    aria-label="Nonaktifkan kelas"
                  >
                    <Icon name="event_busy" size={18} />
                  </button>
                ) : (
                  <button
                    onClick={() => void aktifkan(k)}
                    className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-cat-bimbel-accent"
                    aria-label="Aktifkan kelas"
                  >
                    <Icon name="event" size={18} />
                  </button>
                )}
                <button
                  onClick={() => void mintaArsip(k)}
                  className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
                  aria-label="Arsipkan kelas"
                  title="Arsipkan (soft delete)"
                >
                  <Icon name="archive" size={18} />
                </button>
                <button
                  onClick={() => setTargetHapus(k)}
                  className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
                  aria-label="Hapus kelas"
                  title="Hapus kelas (evaluasi otomatis soft/hard)"
                >
                  <Icon name="delete" size={18} />
                </button>
              </>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-body-md text-body-md text-secondary">{filteredRows.length} kelas</p>
          <MultiSelect<JenisKelas>
            label="Jenis kelas"
            className="w-44"
            options={JENIS_KELAS_LIST.map((j) => ({ value: j, label: j }))}
            selected={jenisFilter}
            onToggle={(j) =>
              setJenisFilter((cur) => (cur.includes(j) ? cur.filter((x) => x !== j) : [...cur, j]))
            }
          />
          <ResetFiltersButton
            onClick={() => {
              setJenisFilter([]);
              setSearch('');
            }}
            visible={jenisFilter.length > 0 || search !== ''}
          />
          <div className="relative ml-auto w-full sm:w-64">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              className="w-full rounded border border-border-input bg-surface-container-lowest py-2 pl-9 pr-3 font-body-md text-body-md text-on-surface placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              placeholder="Cari kelas/klien..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isAdmin && (
            <Button onClick={openCreate}>
              <Icon name="add" size={16} /> Tambah Kelas
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
        {q.loading ? (
          <LoadingState label="Memuat kelas..." />
        ) : q.error ? (
          <ErrorState message={q.error} onRetry={() => void q.reload()} />
        ) : (
          <DataTable
            columns={columns}
            rows={filteredRows}
            rowKey={(k) => k.id}
            empty={<EmptyState icon="school" title="Belum ada kelas" description="Tambahkan kelas pertama." />}
          />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title={editing ? 'Edit Kelas' : 'Tambah Kelas'}
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
          <Field label="Nama kelas" required error={errors['nama_kelas']}>
            <Input value={form.nama_kelas} onChange={(e) => setForm((f) => ({ ...f, nama_kelas: e.target.value }))} placeholder="ex: GST #23" />
          </Field>
          <Field label="Jenis" required>
            <Select value={form.jenis} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as JenisKelas }))}>
              {JENIS_KELAS_LIST.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Klien / murid" hint="Opsional, wajib utk kelas perusahaan/private">
            <Select value={form.klien_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, klien_id: e.target.value || null }))}>
              <option value="">Tanpa klien</option>
              {klienQ.data?.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} ({k.jenis})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={targetNonaktif !== null}
        onClose={() => !busy && setTargetNonaktif(null)}
        title={`Nonaktifkan kelas "${targetNonaktif?.nama_kelas ?? ''}"?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setTargetNonaktif(null)} disabled={busy}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void eksekusiNonaktifkan()} disabled={busy}>
              {busy ? 'Memproses...' : 'Nonaktifkan'}
            </Button>
          </>
        }
      >
        <p className="font-body-md text-body-md text-on-surface-variant">
          {jadwalTerdampak.length > 0
            ? `Kelas ini punya ${jadwalTerdampak.length} slot jadwal aktif. Kelas tidak akan muncul lagi di pilihan form jadwal baru, tetapi jadwal yang sudah ada TETAP berjalan. Nonaktifkan jadwalnya manual di halaman Jadwal jika perlu.`
            : 'Kelas akan ditandai nonaktif dan tidak muncul di pilihan form jadwal. Riwayat tetap utuh.'}
        </p>
        {jadwalTerdampak.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 rounded border border-border-soft bg-surface-container-low p-3">
            {jadwalTerdampak.slice(0, 6).map((j) => (
              <li key={j.id} className="font-body-md text-body-md text-on-surface">
                {j.sensei?.nama ?? '?'} •{' '}
                {j.tanggal
                  ? formatTanggalPendek(j.tanggal)
                  : (j.hari_rutin ?? []).join(', ')}{' '}
                • {formatJam(j.jam_mulai)}-{formatJam(j.jam_selesai)}
              </li>
            ))}
            {jadwalTerdampak.length > 6 && (
              <li className="font-label-sm text-label-sm text-secondary">+{jadwalTerdampak.length - 6} lainnya</li>
            )}
          </ul>
        )}
      </Modal>
      <ConfirmDialog
        open={targetArsip !== null}
        onClose={() => !busy && setTargetArsip(null)}
        onConfirm={(checked) => void eksekusiArsip(checked)}
        title={`Arsipkan kelas "${targetArsip?.nama_kelas ?? ''}"?`}
        description={
          jadwalTerdampak.length > 0
            ? `Kelas ini punya ${jadwalTerdampak.length} slot jadwal aktif. Arsip adalah soft delete: kelas tidak bisa dipakai utk jadwal baru, tetapi riwayat jam mengajar TETAP utuh di laporan & dashboard.`
            : 'Kelas akan diarsipkan (soft delete). Riwayat jam mengajar tetap utuh dan kelas bisa diaktifkan kembali lewat tombol batalkan arsip.'
        }
        confirmLabel="Arsipkan"
        danger
        busy={busy}
        checkboxLabel={
          jadwalTerdampak.length > 0
            ? `Juga nonaktifkan ${jadwalTerdampak.length} jadwal mendatang milik kelas ini`
            : undefined
        }
      />

      <HapusMasterDialog
        open={targetHapus !== null}
        tipe="kelas"
        id={targetHapus?.id ?? ''}
        nama={targetHapus?.nama_kelas ?? ''}
        onClose={() => setTargetHapus(null)}
        onDone={() => void q.reload()}
      />
    </>
  );
}
