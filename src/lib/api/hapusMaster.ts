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

export async function hapusMasterData(tipe: TipeMasterHapus, id: string): Promise<HasilEvaluasiHapus> {
  const { data, error } = await supabase.rpc('evaluasi_hapus_master', {
    p_tipe: tipe,
    p_id: id,
  });
  return unwrap(data, error) as HasilEvaluasiHapus;
}
