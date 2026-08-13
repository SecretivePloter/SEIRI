// FormInputJadwal — form input jadwal inti aplikasi.
// - Validasi client-side (Zod) utk feedback cepat + RPC save_jadwal sebagai
//   SUMBER KEBENARAN (validasi bentrok server-side, lock utk concurrent).
// - Pre-check bentrok real-time (debounce) via check_jadwal_conflicts sebelum
//   submit, sehingga admin melihat bentrok SEBELUM menekan simpan.
// - Mode create (/jadwal/new) & edit (/jadwal/:id/edit).

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { JenisBadge, StatusBadge } from '@/components/ui/Badge';
import { listSensei } from '@/lib/api/sensei';
import { listKelas } from '@/lib/api/kelas';
import { listRuangan } from '@/lib/api/ruangan';
import { checkJadwalConflicts, getJadwalSlot, saveJadwal } from '@/lib/api/jadwal';
import { useAsyncData } from '@/app/useAsyncData';
import { jadwalFormSchema, toJadwalInput, flattenZodErrors, type JadwalFormValues } from '@/lib/validation/jadwalSchema';
import type { ConflictItem, HariIndo, StatusSlot } from '@/lib/types/domain';
import { HARI_INDO } from '@/lib/types/domain';
import { RpcError } from '@/lib/api/rpcError';
import { toast } from '@/stores/toastStore';
import { todayWIB } from '@/lib/time';

const DEFAULT_FORM: JadwalFormValues = {
  sensei_id: '',
  kelas_id: '',
  mode: 'one_off',
  tanggal: todayWIB(),
  hari_rutin: null,
  berlaku_sampai: null,
  jam_mulai: '09:00',
  jam_selesai: '10:30',
  tipe_lokasi: 'ruangan',
  ruangan_id: null,
  alamat_tujuan: null,
  status: 'aktif',
  keterangan: null,
};

export function FormInputJadwal() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const senseiQ = useAsyncData(() => listSensei(), []);
  const kelasQ = useAsyncData(() => listKelas(), []);
  const ruanganQ = useAsyncData(() => listRuangan(), []);

  const [form, setForm] = useState<JadwalFormValues>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Muat slot utk mode edit ---
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const slot = await getJadwalSlot(id);
        if (cancelled) return;
        setForm({
          sensei_id: slot.sensei_id,
          kelas_id: slot.kelas_id,
          mode: slot.hari_rutin ? 'rutin' : 'one_off',
          // Jadwal rutin tidak memakai tanggal — jangan tinggalkan nilai sisa
          // (kalau terisi, validasi Zod menolak: 'rutin tidak memakai tanggal').
          tanggal: slot.hari_rutin ? null : (slot.tanggal ?? todayWIB()),
          hari_rutin: slot.hari_rutin,
          berlaku_sampai: slot.berlaku_sampai,
          jam_mulai: slot.jam_mulai.slice(0, 5),
          jam_selesai: slot.jam_selesai.slice(0, 5),
          tipe_lokasi: slot.tipe_lokasi,
          ruangan_id: slot.ruangan_id,
          alamat_tujuan: slot.alamat_tujuan,
          status: slot.status,
          keterangan: slot.keterangan,
        });
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Gagal memuat jadwal');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const set = <K extends keyof JadwalFormValues>(key: K, value: JadwalFormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Bersihkan error field ini saat user mengubahnya, supaya pesan error
    // dari submit sebelumnya tidak menempel padahal nilainya sudah berubah.
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  // Ganti mode one-off <-> rutin sambil membuang nilai sisa dari mode
  // sebelumnya. Tanpa ini, tanggal default (todayWIB) yang tersisa saat
  // pindah ke 'rutin' membuat validasi gagal tanpa field merah yang terlihat.
  const switchMode = (mode: 'one_off' | 'rutin') => {
    if (mode === form.mode) return;
    if (mode === 'one_off') {
      setForm((f) => ({ ...f, mode, hari_rutin: null, berlaku_sampai: null, tanggal: f.tanggal ?? todayWIB() }));
    } else {
      setForm((f) => ({ ...f, mode, tanggal: null }));
    }
    setErrors((e) => {
      const next = { ...e };
      delete next['tanggal'];
      delete next['hari_rutin'];
      delete next['berlaku_sampai'];
      return next;
    });
  };

  // --- Pre-check bentrok real-time (debounce 400ms) ---
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!form.sensei_id) {
      setConflicts([]);
      return;
    }
    // Validasi cepat lokal dulu; jika form belum lengkap, skip RPC.
    const parsed = jadwalFormSchema.safeParse(form);
    if (!parsed.success) {
      setConflicts([]);
      return;
    }
    const input = toJadwalInput(parsed.data);
    setChecking(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkJadwalConflicts(input, id);
        setConflicts(result);
      } catch {
        // Pre-check gagal bukan fatal — sumber kebenaran tetap saat submit.
        setConflicts([]);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form, id]);

  const toggleHari = (h: HariIndo) => {
    const cur = form.hari_rutin ?? [];
    set('hari_rutin', cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]);
  };

  const kelasSelected = kelasQ.data?.find((k) => k.id === form.kelas_id);

  const submit = async () => {
    const parsed = jadwalFormSchema.safeParse(form);
    if (!parsed.success) {
      const flat = flattenZodErrors(parsed.error);
      setErrors(flat);
      const firstError = Object.values(flat)[0];
      toast.error('Form belum lengkap', firstError ?? 'Periksa field yang ditandai merah.');
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await saveJadwal(toJadwalInput(parsed.data), id);
      toast.success(isEdit ? 'Jadwal diperbarui' : 'Jadwal tersimpan');
      navigate('/jadwal');
    } catch (e) {
      if (e instanceof RpcError && e.code === 'JADWAL_CONFLICT') {
        setConflicts(e.conflicts);
        toast.error('Jadwal bentrok', e.message);
      } else {
        toast.error('Gagal menyimpan jadwal', e instanceof Error ? e.message : undefined);
      }
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <>
        <TopBar title="Edit Jadwal" />
        <main className="p-container-padding">
          <ErrorState message={loadError} onRetry={() => navigate('/jadwal')} />
        </main>
      </>
    );
  }

  const loading = senseiQ.loading || kelasQ.loading || ruanganQ.loading || (isEdit && form.sensei_id === '');
  if (loading) {
    return (
      <>
        <TopBar title={isEdit ? 'Edit Jadwal' : 'New Schedule'} />
        <main className="p-container-padding">
          <LoadingState label="Menyiapkan form..." />
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={isEdit ? 'Edit Jadwal' : 'New Schedule'} subtitle="Input jadwal mengajar sensei" />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto grid max-w-[1100px] gap-4 lg:grid-cols-[1fr_360px]">
          {/* ==== FORM ==== */}
          <div className="flex flex-col gap-5 rounded-card border border-outline-variant bg-surface-container-lowest p-6">
            {/* Sensei & Kelas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sensei" required error={errors['sensei_id']}>
                <Select value={form.sensei_id} onChange={(e) => set('sensei_id', e.target.value)}>
                  <option value="">Pilih sensei...</option>
                  {senseiQ.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.status})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kelas" required error={errors['kelas_id']}>
                <Select value={form.kelas_id} onChange={(e) => set('kelas_id', e.target.value)}>
                  <option value="">Pilih kelas...</option>
                  {kelasQ.data?.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas} • {k.jenis}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Mode: one-off vs rutin */}
            <div>
              <p className="mb-1.5 font-label-md text-label-md text-on-surface-variant">Tipe Jadwal *</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('one_off')}
                  className={`rounded px-4 py-2 font-label-md text-label-md transition-colors ${
                    form.mode === 'one_off'
                      ? 'bg-primary text-on-primary'
                      : 'border border-outline-variant text-secondary hover:bg-surface-container'
                  }`}
                >
                  Satu kali (one-off)
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('rutin')}
                  className={`rounded px-4 py-2 font-label-md text-label-md transition-colors ${
                    form.mode === 'rutin'
                      ? 'bg-primary text-on-primary'
                      : 'border border-outline-variant text-secondary hover:bg-surface-container'
                  }`}
                >
                  Rutin mingguan
                </button>
              </div>
            </div>

            {form.mode === 'one_off' ? (
              <Field label="Tanggal" required error={errors['tanggal']}>
                <Input type="date" value={form.tanggal ?? ''} onChange={(e) => set('tanggal', e.target.value || null)} />
              </Field>
            ) : (
              <div className="flex flex-col gap-3">
                <Field label="Hari" required error={errors['hari_rutin']} hint="Pilih satu atau beberapa hari">
                  <div className="flex flex-wrap gap-2">
                    {HARI_INDO.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => toggleHari(h)}
                        className={`rounded px-3 py-1.5 font-label-md text-label-md transition-colors ${
                          form.hari_rutin?.includes(h)
                            ? 'bg-primary text-on-primary'
                            : 'border border-outline-variant text-secondary hover:bg-surface-container'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field
                  label="Berlaku sampai (opsional)"
                  error={errors['berlaku_sampai']}
                  hint="Kosongkan jika rutin tanpa batas akhir"
                >
                  <Input
                    type="date"
                    value={form.berlaku_sampai ?? ''}
                    onChange={(e) => set('berlaku_sampai', e.target.value || null)}
                  />
                </Field>
              </div>
            )}

            {/* Jam */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jam mulai (WIB)" required error={errors['jam_mulai']}>
                <Input type="time" value={form.jam_mulai} onChange={(e) => set('jam_mulai', e.target.value)} />
              </Field>
              <Field label="Jam selesai (WIB)" required error={errors['jam_selesai']}>
                <Input type="time" value={form.jam_selesai} onChange={(e) => set('jam_selesai', e.target.value)} />
              </Field>
            </div>

            {/* Lokasi */}
            <Field label="Tipe lokasi" required>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { v: 'ruangan', label: '📍 Ruangan internal' },
                    { v: 'kelas_perusahaan', label: '🏢 Kelas perusahaan' },
                    { v: 'kelas_rumah', label: '🏠 Kelas rumah' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        tipe_lokasi: opt.v,
                        ruangan_id: opt.v === 'ruangan' ? f.ruangan_id : null,
                        alamat_tujuan: opt.v === 'ruangan' ? null : f.alamat_tujuan,
                      }));
                    }}
                    className={`rounded px-4 py-2 font-label-md text-label-md transition-colors ${
                      form.tipe_lokasi === opt.v
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant text-secondary hover:bg-surface-container'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            {form.tipe_lokasi === 'ruangan' ? (
              <Field label="Ruangan" required error={errors['ruangan_id']}>
                <Select value={form.ruangan_id ?? ''} onChange={(e) => set('ruangan_id', e.target.value || null)}>
                  <option value="">Pilih ruangan...</option>
                  {ruanganQ.data?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama}
                      {r.kapasitas ? ` (kap. ${r.kapasitas})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Alamat tujuan" required error={errors['alamat_tujuan']}>
                <Textarea
                  value={form.alamat_tujuan ?? ''}
                  onChange={(e) => set('alamat_tujuan', e.target.value || null)}
                  placeholder={form.tipe_lokasi === 'kelas_perusahaan' ? 'Alamat kantor klien...' : 'Alamat rumah murid...'}
                />
              </Field>
            )}

            {/* Status & keterangan */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onChange={(e) => set('status', e.target.value as StatusSlot)}>
                  <option value="aktif">Aktif</option>
                  <option value="planning">Planning</option>
                  <option value="tidak_aktif">Tidak aktif</option>
                </Select>
              </Field>
              <Field label="Keterangan">
                <Input value={form.keterangan ?? ''} onChange={(e) => set('keterangan', e.target.value || null)} placeholder="Opsional" />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border-soft pt-4">
              <Button variant="outline" onClick={() => navigate('/jadwal')} disabled={submitting}>
                Batal
              </Button>
              <Button onClick={() => void submit()} disabled={submitting || checking}>
                {submitting ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Simpan jadwal'}
              </Button>
            </div>
          </div>

          {/* ==== PANEL PRE-CHECK BENTROK ==== */}
          <aside className="flex h-fit flex-col gap-3 rounded-card border border-outline-variant bg-surface-container-lowest p-5 lg:sticky lg:top-20">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Cek Bentrok</h3>
            {kelasSelected && (
              <div className="flex items-center gap-2">
                <JenisBadge jenis={kelasSelected.jenis} />
                <StatusBadge status={form.status} />
              </div>
            )}
            {!form.sensei_id ? (
              <p className="font-body-md text-body-md text-secondary">Pilih sensei untuk mulai cek bentrok otomatis.</p>
            ) : checking ? (
              <p className="flex items-center gap-2 font-body-md text-body-md text-secondary">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
                Memeriksa bentrok...
              </p>
            ) : conflicts.length === 0 ? (
              <div className="flex items-start gap-2 rounded border border-cat-bimbel-accent bg-cat-bimbel px-3 py-2 text-cat-bimbel-text">
                <Icon name="check_circle" size={18} className="mt-0.5 shrink-0" />
                <p className="font-body-md text-body-md">Tidak ada bentrok. Jadwal aman disimpan.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2 rounded border border-error bg-error-container px-3 py-2 text-on-error-container">
                  <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
                  <p className="font-body-md text-body-md">
                    Bentrok dengan {conflicts.length} jadwal lain. Simpan akan ditolak server.
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {conflicts.map((c) => (
                    <li key={c.slot_id} className="rounded border border-border-soft bg-surface-container-low px-3 py-2">
                      <p className="font-label-md text-label-md text-on-surface">
                        {c.jenis_konflik === 'sensei' ? '👤 Bentrok sensei' : '📍 Bentrok ruangan'}
                      </p>
                      <p className="font-body-md text-body-md text-on-surface">{c.kelas_nama}</p>
                      <p className="font-label-sm text-label-sm text-secondary">
                        {c.jadwal} • {c.jam} WIB
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="font-label-sm text-label-sm text-secondary">
              Batas jam bersentuhan (selesai 14:00, mulai 14:00) dihitung valid, bukan bentrok.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}


