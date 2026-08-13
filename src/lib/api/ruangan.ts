// Service: master ruangan.

import { supabase } from '@/lib/supabase/client';
import type { Ruangan } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export type RuanganInput = Pick<Ruangan, 'nama' | 'kapasitas'> & { is_aktif?: boolean };

export async function listRuangan(opts?: { includeNonaktif?: boolean }): Promise<Ruangan[]> {
  let q = supabase.from('ruangan').select('*').order('nama');
  if (!opts?.includeNonaktif) q = q.eq('is_aktif', true);
  const { data, error } = await q;
  return unwrap(data, error) as Ruangan[];
}

export async function createRuangan(input: RuanganInput): Promise<Ruangan> {
  const { data, error } = await supabase.from('ruangan').insert(input).select().single();
  return unwrap(data, error) as Ruangan;
}

export async function updateRuangan(id: string, input: Partial<RuanganInput>): Promise<Ruangan> {
  const { data, error } = await supabase.from('ruangan').update(input).eq('id', id).select().single();
  return unwrap(data, error) as Ruangan;
}

/** Hitung jadwal aktif mendatang yang memakai ruangan ini */
export async function countJadwalRuanganMendatang(ruanganId: string): Promise<number> {
  const { data, error } = await supabase.rpc('count_jadwal_mendatang', {
    p_sensei_id: null,
    p_ruangan_id: ruanganId,
  });
  return unwrap(data, error) as number;
}

/**
 * Nonaktifkan ruangan (pengganti delete yang aman).
 * Dengan nonaktifkanJadwalMendatang=true jadwal mendatang ditandai
 * 'tidak_aktif'; riwayat tetap utuh.
 */
export async function nonaktifkanRuangan(ruanganId: string, nonaktifkanJadwalMendatang: boolean): Promise<void> {
  const { error } = await supabase.rpc('nonaktifkan_ruangan', {
    p_ruangan_id: ruanganId,
    p_nonaktifkan_jadwal_mendatang: nonaktifkanJadwalMendatang,
  });
  unwrap(null, error);
}

export async function aktifkanRuangan(id: string): Promise<Ruangan> {
  return updateRuangan(id, { is_aktif: true });
}
