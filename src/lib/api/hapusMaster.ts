// Service: hapus data master (sensei/kelas/ruangan) dengan evaluasi otomatis
// soft/hard/block via RPC evaluasi_hapus_master (sumber kebenaran di server).

import { supabase } from '@/lib/supabase/client';
import { unwrap } from './rpcError';

export type TipeMasterHapus = 'sensei' | 'kelas' | 'ruangan';
export type AksiHapus = 'hard' | 'soft' | 'block';

export interface HasilEvaluasiHapus {
  aksi: AksiHapus;
  jumlah_mendatang: number;
  jumlah_historis: number;
  pesan: string;
}

async function pastikanSenseiTerhapus(id: string): Promise<void> {
  const { data: existing, error: checkError } = await supabase
    .from('sensei')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (checkError) throw new Error(checkError.message);
  if (!existing) return;

  // The RPC has already confirmed there are no schedule references. Retry via
  // the table DELETE policy, then verify because PostgREST can return zero rows
  // without an error when RLS filters a DELETE.
  const { error: deleteError } = await supabase.from('sensei').delete().eq('id', id);
  if (deleteError) throw new Error(deleteError.message);

  const { data: remaining, error: verifyError } = await supabase
    .from('sensei')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (verifyError) throw new Error(verifyError.message);
  if (remaining) {
    throw new Error('Sensei masih tersimpan. Periksa hak akses hapus pada database lalu coba lagi.');
  }
}

export async function hapusMasterData(tipe: TipeMasterHapus, id: string): Promise<HasilEvaluasiHapus> {
  const { data, error } = await supabase.rpc('evaluasi_hapus_master', {
    p_tipe: tipe,
    p_id: id,
  });
  const hasil = unwrap(data, error) as HasilEvaluasiHapus;

  // Never report a permanent sensei deletion as complete until the row is
  // actually absent. Historical sensei are returned as "soft" and are never
  // passed to this fallback.
  if (tipe === 'sensei' && hasil.aksi === 'hard') {
    await pastikanSenseiTerhapus(id);
  }

  return hasil;
}
