// Service: master kelas.

import { supabase } from '@/lib/supabase/client';
import type { Kelas, JadwalSlot } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export type KelasInput = Pick<Kelas, 'nama_kelas' | 'jenis' | 'klien_id'> & { is_aktif?: boolean; diarsipkan?: boolean };

export async function listKelas(opts?: { includeNonaktif?: boolean }): Promise<Kelas[]> {
  let q = supabase
    .from('kelas')
    .select('*, klien:klien_id(*)')
    .order('nama_kelas');
  if (!opts?.includeNonaktif) q = q.eq('is_aktif', true);
  const { data, error } = await q;
  return unwrap(data, error) as Kelas[];
}

export async function createKelas(input: KelasInput): Promise<Kelas> {
  const { data, error } = await supabase.from('kelas').insert(input).select().single();
  return unwrap(data, error) as Kelas;
}

export async function updateKelas(id: string, input: Partial<KelasInput>): Promise<Kelas> {
  const { data, error } = await supabase.from('kelas').update(input).eq('id', id).select().single();
  return unwrap(data, error) as Kelas;
}

/**
 * Nonaktifkan kelas (lebih aman dari delete; FK RESTRICT tetap menjaga).
 * Jadwal lama dibiarkan utuh utk riwayat.
 */
export async function nonaktifkanKelas(id: string): Promise<Kelas> {
  return updateKelas(id, { is_aktif: false });
}

export async function aktifkanKelas(id: string): Promise<Kelas> {
  return updateKelas(id, { is_aktif: true });
}

/**
 * Arsip kelas (soft delete, v2 poin 3): tandai diarsipkan + nonaktifkan
 * via RPC arsipkan_kelas; opsional ikut menonaktifkan jadwal mendatang.
 * Riwayat jam mengajar masa lalu TIDAK pernah disentuh.
 */
export async function arsipkanKelas(id: string, nonaktifkanJadwalMendatang = false): Promise<void> {
  const { data, error } = await supabase.rpc('arsipkan_kelas', {
    p_kelas_id: id,
    p_nonaktifkan_jadwal_mendatang: nonaktifkanJadwalMendatang,
  });
  unwrap(data, error);
}

/** Batalkan arsip kelas (aktifkan kembali). */
export async function batalkanArsipKelas(id: string): Promise<Kelas> {
  return updateKelas(id, { diarsipkan: false, is_aktif: true });
}

/** Daftar jadwal milik sebuah kelas (utk preview sebelum nonaktifkan) */
export async function listJadwalKelas(kelasId: string): Promise<JadwalSlot[]> {
  const { data, error } = await supabase
    .from('jadwal_slot')
    .select('*, sensei:sensei_id(id, nama), ruangan:ruangan_id(id, nama)')
    .eq('kelas_id', kelasId)
    .eq('status', 'aktif');
  return unwrap(data, error) as JadwalSlot[];
}
