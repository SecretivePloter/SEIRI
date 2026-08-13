// KetersediaanPage — cek ketersediaan sensei: pilih sensei + rentang tanggal
// (+ jendela jam opsional) -> kartu per hari: tersedia / tidak + jadwalnya.
// Semua hitungan di server via RPC check_ketersediaan_sensei (WIB konsisten).

import { useMemo, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { listSensei } from '@/lib/api/sensei';
import { checkKetersediaan } from '@/lib/api/ketersediaan';
import { useAsyncData } from '@/app/useAsyncData';
import type { KetersediaanHari } from '@/lib/types/domain';
import { addDays, formatTanggalPanjang, todayWIB } from '@/lib/time';

const lokasiEmoji = { ruangan: '📍', kelas_perusahaan: '🏢', kelas_rumah: '🏠' } as const;

export function KetersediaanPage() {
  const senseiQ = useAsyncData(() => listSensei(), []);

  const [senseiId, setSenseiId] = useState('');
  const [from, setFrom] = useState(todayWIB());
  const [to, setTo] = useState(addDays(todayWIB(), 6));
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');

  const [hasil, setHasil] = useState<KetersediaanHari[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const cek = async () => {
    setInputError(null);
    if (!senseiId) {
      setInputError('Pilih sensei terlebih dahulu.');
      return;
    }
    if (!from || !to || to < from) {
      setInputError('Rentang tanggal tidak valid (tanggal akhir harus >= awal).');
      return;
    }
    if ((jamMulai && !jamSelesai) || (!jamMulai && jamSelesai)) {
      setInputError('Jendela jam harus diisi lengkap (mulai & selesai) atau dikosongkan keduanya.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await checkKetersediaan(
        senseiId,
        from,
        to,
        jamMulai ? `${jamMulai}:00` : undefined,
        jamSelesai ? `${jamSelesai}:00` : undefined,
      );
      setHasil(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengecek ketersediaan');
      setHasil(null);
    } finally {
      setBusy(false);
    }
  };

  const ringkasan = useMemo(() => {
    if (!hasil) return null;
    const tersedia = hasil.filter((h) => h.tersedia).length;
    return { total: hasil.length, tersedia, sibuk: hasil.length - tersedia };
  }, [hasil]);

  const namaSensei = senseiQ.data?.find((s) => s.id === senseiId)?.nama;

  return (
    <>
      <TopBar title="Ketersediaan Sensei" subtitle="Cek jadwal kosong sebelum menjadwalkan" />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
          {/* Form input */}
          <div className="grid gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-6 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Sensei" required className="lg:col-span-2">
              <Select value={senseiId} onChange={(e) => setSenseiId(e.target.value)} disabled={senseiQ.loading}>
                <option value="">Pilih sensei...</option>
                {senseiQ.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dari tanggal" required>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Sampai" required>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button onClick={() => void cek()} disabled={busy} className="w-full">
                {busy ? 'Mengecek...' : 'Cek'}
              </Button>
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Jendela jam mulai (opsional)" hint="Kosongkan utk cek seharian penuh">
                  <Input type="time" value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} />
                </Field>
                <Field label="Jendela jam selesai (opsional)">
                  <Input type="time" value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} />
                </Field>
              </div>
            </div>
            {inputError && <p className="font-body-md text-body-md text-error sm:col-span-2 lg:col-span-5">{inputError}</p>}
          </div>

          {/* Hasil */}
          {busy && <LoadingState label="Memeriksa jadwal..." />}
          {error && !busy && <ErrorState message={error} onRetry={() => void cek()} />}
          {!busy && !error && hasil && (
            <>
              {ringkasan && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-headline-sm text-headline-sm text-on-surface">
                    {namaSensei}: {ringkasan.tersedia} dari {ringkasan.total} hari{' '}
                    {jamMulai && jamSelesai ? `tersedia di ${jamMulai}–${jamSelesai}` : 'kosong'}
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cat-bimbel px-3 py-1 font-label-md text-label-md text-cat-bimbel-text">
                    <Icon name="check_circle" size={16} /> {ringkasan.tersedia} tersedia
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1 font-label-md text-label-md text-on-error-container">
                    <Icon name="event_busy" size={16} /> {ringkasan.sibuk} terisi
                  </span>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hasil.map((h) => (
                  <div
                    key={h.tanggal}
                    className={`rounded-card border p-4 ${
                      h.tersedia ? 'border-cat-bimbel-accent bg-cat-bimbel/40' : 'border-border-soft bg-surface-container-lowest'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-label-md text-label-md text-on-surface">{formatTanggalPanjang(h.tanggal)}</p>
                      <Icon
                        name={h.tersedia ? 'check_circle' : 'event_busy'}
                        size={18}
                        className={h.tersedia ? 'text-cat-bimbel-accent' : 'text-error'}
                      />
                    </div>
                    <p className={`mt-1 font-headline-sm text-headline-sm ${h.tersedia ? 'text-cat-bimbel-text' : 'text-on-surface-variant'}`}>
                      {h.tersedia ? 'Tersedia' : 'Ada jadwal'}
                    </p>
                    {h.jadwal.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 border-t border-border-soft pt-2">
                        {h.jadwal.map((j, i) => (
                          <li key={i} className="font-body-md text-body-md text-on-surface">
                            {j.jam} • {j.kelas} {lokasiEmoji[j.lokasi]}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {!busy && !error && !hasil && (
            <EmptyState
              icon="event_available"
              title="Pilih sensei & rentang tanggal"
              description="Sistem memeriksa jadwal aktif + planning sensei dan menampilkan hari yang benar-benar kosong."
            />
          )}
        </div>
      </main>
    </>
  );
}
