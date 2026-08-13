// Service: master klien/murid.

import { supabase } from '@/lib/supabase/client';
import type { Klien } from '@/lib/types/domain';
import { unwrap } from './rpcError';

export type KlienInput = Pick<Klien, 'nama' | 'jenis' | 'kontak'>;

export async function listKlien(): Promise<Klien[]> {
  const { data, error } = await supabase.from('klien').select('*').order('nama');
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
 * Hapus klien. Gagal di server (FK RESTRICT) jika masih punya kelas.
 * UI wajib menampilkan ConfirmDialog sebelum memanggil ini.
 */
export async function deleteKlien(id: string): Promise<void> {
  const { error } = await supabase.from('klien').delete().eq('id', id);
  unwrap(null, error);
}
