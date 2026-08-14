// Service: master klien/murid.

import { supabase } from '@/lib/supabase/client';
import type { Klien } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export type KlienInput = Pick<Klien, 'nama' | 'jenis' | 'kontak'>;

export async function listKlien(opts?: { includeNonaktif?: boolean }): Promise<Klien[]> {
  let q = supabase.from('klien').select('*').order('nama');
  if (!opts?.includeNonaktif) q = q.eq('is_aktif', true);
  const { data, error } = await q;
  return unwrap(data, error) as Klien[];
}

export async function createKlien(input: KlienInput): Promise<Klien> {
  const { data, error } = await supabase.from('klien').insert(input).select().single();
  return unwrap(data, error) as Klien;
}

export async function updateKlien(id: string, input: Partial<KlienInput>): Promise<Klien> {
  const { data, error } = await supabase.from('klien').update(input).eq('id', id).select().single();
  return unwrap(data, error) as Klien;
}

/**
 * Arsip klien (soft delete, v2 poin 3): nonaktifkan via RPC arsipkan_klien;
 * opsional ikut menonaktifkan jadwal mendatang dari kelas milik klien.
 * Riwayat TIDAK pernah disentuh. Klien tanpa kelas tetap bisa dihapus
 * permanen via deleteKlien jika memang salah input.
 */
export async function arsipkanKlien(id: string, nonaktifkanJadwalMendatang = false): Promise<void> {
  const { data, error } = await supabase.rpc('arsipkan_klien', {
    p_klien_id: id,
    p_nonaktifkan_jadwal_mendatang: nonaktifkanJadwalMendatang,
  });
  unwrap(data, error);
}

export async function aktifkanKlien(id: string): Promise<Klien> {
  const { data, error } = await supabase
    .from('klien')
    .update({ is_aktif: true })
    .eq('id', id)
    .select()
    .single();
  return unwrap(data, error) as Klien;
}

/**
 * Hapus klien. Gagal di server (FK RESTRICT) jika masih punya kelas.
 * UI wajib menampilkan ConfirmDialog sebelum memanggil ini.
 */
export async function deleteKlien(id: string): Promise<void> {
  const { error } = await supabase.from('klien').delete().eq('id', id);
  unwrap(null, error);
}
