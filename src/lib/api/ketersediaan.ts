// Service: cek ketersediaan sensei (RPC check_ketersediaan_sensei).

import { supabase } from '@/lib/supabase/client';
import type { KetersediaanHari } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export async function checkKetersediaan(
  senseiId: string,
  from: string,
  to: string,
  jamMulai?: string,
  jamSelesai?: string,
): Promise<KetersediaanHari[]> {
  const { data, error } = await supabase.rpc('check_ketersediaan_sensei', {
    p_sensei_id: senseiId,
    p_from: from,
    p_to: to,
    p_jam_mulai: jamMulai ?? null,
    p_jam_selesai: jamSelesai ?? null,
  });
  return unwrap(data, error) as KetersediaanHari[];
}
