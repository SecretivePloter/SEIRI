// Service: aturan sesi per jenis kelas (tabel kategori_sesi).
// Sumber konfigurasi logika pengajian; admin bisa mengubah via tab
// "Aturan Sesi" di halaman Admin tanpa perlu ubah kode.

import { supabase } from '@/lib/supabase/client';
import type { KategoriSesi, JenisKelas } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export async function listKategoriSesi(): Promise<KategoriSesi[]> {
  const { data, error } = await supabase
    .from('kategori_sesi')
    .select('*')
    .order('jenis');
  return unwrap(data, error) as KategoriSesi[];
}

/**
 * Upsert aturan sesi utk satu jenis kelas. Lewat RPC (is_admin guard di
 * server + RLS policy di tabel). durasi_jam = berapa jam per jumlah_sesi.
 */
export async function upsertKategoriSesi(
  jenis: JenisKelas,
  durasiJam: number,
  jumlahSesi: number,
): Promise<void> {
  const { data, error } = await supabase.rpc('upsert_kategori_sesi', {
    p_jenis: jenis,
    p_durasi_jam: durasiJam,
    p_jumlah_sesi: jumlahSesi,
  });
  unwrap(data, error);
}
