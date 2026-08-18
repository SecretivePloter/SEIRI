// KetersediaanPage — cek ketersediaan sensei: pilih sensei + rentang tanggal
// (+ jendela jam opsional) -> kartu per hari menampilkan SLOT KOSONG (gap).
// Hitungan gap (jam operasional, ambang minimum) seluruhnya di server via
// RPC check_ketersediaan_sensei (WIB konsisten, configurable via tabel settings).

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
    if (jamMulai && jamSelesai && jamSelesai <= jamMulai) {
      setInputError('Jam selesai harus setelah jam mulai di jendela');
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
    const penuh = hasil.filter((h) => h.status_ketersediaan === 'kosong').length;
    const parsial = hasil.filter((h) => h.status_ketersediaan === 'parsial').length;
    const tidak = hasil.filter((h) => h.status_ketersediaan === 'penuh').length;
    return { total: hasil.length, penuh, parsial, tidak };
  }, [hasil]);

  const namaSensei = senseiQ.data?.find((s) => s.id === senseiId)?.nama;

  return (
    <>
      <TopBar title="Ketersediaan Sensei" subtitle="Lihat slot kosong sebelum menjadwalkan" />
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
          {busy && <LoadingState label="Memeriksa slot kosong..." />}
          {error && !busy && <ErrorState message={error} onRetry={() => void cek()} />}
          {!busy && !error && hasil && (
            <>
              {ringkasan && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-headline-sm text-headline-sm text-on-surface">
                    {namaSensei}: {ringkasan.penuh} hari tersedia penuh, {ringkasan.parsial} hari tersedia sebagian,{' '}
                    {ringkasan.tidak} hari tidak tersedia
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cat-bimbel px-3 py-1 font-label-md text-label-md text-cat-bimbel-text">
                    <Icon name="check_circle" size={16} /> {ringkasan.penuh} penuh
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cat-benkyou px-3 py-1 font-label-md text-label-md text-cat-benkyou-text">
                    <Icon name="schedule" size={16} /> {ringkasan.parsial} sebagian
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1 font-label-md text-label-md text-on-error-container">
                    <Icon name="event_busy" size={16} /> {ringkasan.tidak} tidak tersedia
                  </span>
                  {jamMulai && jamSelesai && (
                    <span className="rounded-full bg-surface-container px-3 py-1 font-label-md text-label-md text-on-surface-variant">
                      Jendela {jamMulai}-{jamSelesai}
                    </span>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hasil.map((h) => {
                  const isKosong = h.status_ketersediaan === 'kosong';
                  const isPenuh = h.status_ketersediaan === 'penuh';
                  return (
                    <div
                      key={h.tanggal}
                      className={`rounded-card border p-4 ${
                        isKosong
                          ? 'border-cat-bimbel-accent bg-cat-bimbel'
                          : isPenuh
                            ? 'border-border-soft bg-surface-container-lowest opacity-70'
                            : 'border-cat-benkyou-accent bg-cat-benkyou/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-label-md text-label-md text-on-surface">{formatTanggalPanjang(h.tanggal)}</p>
                        <Icon
                          name={isKosong ? 'check_circle' : isPenuh ? 'block' : 'schedule'}
                          size={18}
                          className={isKosong ? 'text-cat-bimbel-accent' : isPenuh ? 'text-error' : 'text-cat-benkyou-accent'}
                        />
                      </div>

                      {/* Badge status */}
                      {isKosong ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-cat-bimbel-accent px-2.5 py-0.5 font-label-md text-label-md text-white">
                          <Icon name="check_circle" size={14} /> Tersedia Sepanjang Hari
                        </span>
                      ) : isPenuh ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-error-container px-2.5 py-0.5 font-label-md text-label-md text-on-error-container">
                          <Icon name="block" size={14} /> Tidak Tersedia
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-cat-benkyou-accent px-2.5 py-0.5 font-label-md text-label-md text-white">
                          <Icon name="schedule" size={14} /> Tersedia Sebagian
                        </span>
                      )}

                      {/* Daftar slot kosong (gap) */}
                      {!isPenuh && (
                        <ul className="mt-3 flex flex-col gap-1.5">
                          {h.gap.map((g, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2 rounded border border-cat-bimbel-accent/40 bg-white/60 px-2.5 py-1.5 font-body-md text-body-md text-on-surface"
                            >
                              <span className="text-cat-bimbel-accent">🟢</span>
                              <span>
                                Kosong {g.mulai} - {g.selesai}
                              </span>
                              <span className="ml-auto font-label-sm text-label-sm text-on-surface-variant">{g.menit} menit</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {isPenuh && (
                        <p className="mt-3 font-label-sm text-label-sm text-secondary">
                          Slot kosong &lt; ambang minimum. Lihat detail jadwal di Timeline.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!busy && !error && !hasil && (
            <EmptyState
              icon="event_available"
              title="Pilih sensei & rentang tanggal"
              description="Sistem menghitung slot kosong sensei per hari (jam operasional dari pengaturan)."
            />
          )}
        </div>
      </main>
    </>
  );
}