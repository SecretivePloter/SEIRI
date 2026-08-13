// Service: master sensei. Semua query lewat layer ini (NFR brief).

import { supabase } from '@/lib/supabase/client';
import type { Sensei } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export type SenseiInput = Omit<Sensei, 'id' | 'created_at' | 'updated_at' | 'cabang_id'>;

export async function listSensei(opts?: { includeNonaktif?: boolean }): Promise<Sensei[]> {
  let q = supabase.from('sensei').select('*').order('nama', { ascending: true });
  if (!opts?.includeNonaktif) q = q.eq('is_aktif', true);
  const { data, error } = await q;
  return unwrap(data, error) as Sensei[];
}

export async function getSensei(id: string): Promise<Sensei> {
  const { data, error } = await supabase.from('sensei').select('*').eq('id', id).single();
  return unwrap(data, error) as Sensei;
}

export async function createSensei(input: SenseiInput): Promise<Sensei> {
  const { data, error } = await supabase.from('sensei').insert(input).select().single();
  return unwrap(data, error) as Sensei;
}

export async function updateSensei(id: string, input: Partial<SenseiInput>): Promise<Sensei> {
  const { data, error } = await supabase.from('sensei').update(input).eq('id', id).select().single();
  return unwrap(data, error) as Sensei;
}

/** Hitung jadwal aktif mendatang — utk guard sebelum nonaktifkan */
export async function countJadwalMendatang(senseiId: string): Promise<number> {
  const { data, error } = await supabase.rpc('count_jadwal_mendatang', {
    p_sensei_id: senseiId,
    p_ruangan_id: null,
  });
  return unwrap(data, error) as number;
}

/**
 * Nonaktifkan sensei (pengganti delete yang aman).
 * Dengan nonaktifkanJadwalMendatang=true, semua jadwal mendatang
 * (rutin + one-off mulai hari ini) ditandai 'tidak_aktif'.
 * Riwayat masa lalu tidak pernah disentuh.
 */
export async function nonaktifkanSensei(senseiId: string, nonaktifkanJadwalMendatang: boolean): Promise<void> {
  const { error } = await supabase.rpc('nonaktifkan_sensei', {
    p_sensei_id: senseiId,
    p_nonaktifkan_jadwal_mendatang: nonaktifkanJadwalMendatang,
  });
  unwrap(null, error);
}

/** Aktifkan kembali */
export async function aktifkanSensei(id: string): Promise<Sensei> {
  return updateSensei(id, { is_aktif: true });
}
