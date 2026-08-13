// Service: analytics jam mengajar (RPC agregasi — 1 query, tanpa N+1).

import { supabase } from '@/lib/supabase/client';
import type { JamMengajarSensei, JamPerKelas } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export async function hitungJamMengajar(from: string, to: string, senseiId?: string): Promise<JamMengajarSensei[]> {
  const { data, error } = await supabase.rpc('hitung_jam_mengajar', {
    p_from: from,
    p_to: to,
    p_sensei_id: senseiId ?? null,
  });
  return unwrap(data, error) as JamMengajarSensei[];
}

export async function hitungJamPerKelas(senseiId: string, from: string, to: string): Promise<JamPerKelas[]> {
  const { data, error } = await supabase.rpc('hitung_jam_per_kelas', {
    p_sensei_id: senseiId,
    p_from: from,
    p_to: to,
  });
  return unwrap(data, error) as JamPerKelas[];
}
