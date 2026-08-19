// Service: exception per tanggal utk jadwal rutin.
// Ke depan "dibatalkan"/"ganti_sensei" utk tanggal tertentu, TERPISAH dari
// status aktif/nonaktif level jadwal_slot. Semua tulis lewat RPC agar
// validasi & auth server-side konsisten; data dibaca via resolve_jadwal.

import { supabase } from '@/lib/supabase/client';
import { unwrap, RpcError, parseRpcError } from './rpcError';
import type { ExceptionTipe } from '@/lib/types/domain';

/** Simpan (insert/upsert) exception utk (slot, tanggal). Return id. */
export async function simpanExceptionJadwal(input: {
  jadwal_slot_id: string;
  tanggal: string;
  tipe: ExceptionTipe;
  sensei_pengganti_id?: string | null;
  catatan?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('simpan_exception_jadwal', {
    p_jadwal_slot_id: input.jadwal_slot_id,
    p_tanggal: input.tanggal,
    p_tipe: input.tipe,
    p_sensei_pengganti_id: input.sensei_pengganti_id ?? null,
    p_catatan: input.catatan ?? null,
  });
  try {
    return unwrap(data, error) as string;
  } catch (e) {
    throw e instanceof RpcError ? e : new RpcError(parseRpcError(e));
  }
}

/** Hapus exception (undo) utk (slot, tanggal) — kembalikan ke jadwal normal. */
export async function hapusExceptionJadwal(jadwalSlotId: string, tanggal: string): Promise<void> {
  const { error } = await supabase.rpc('hapus_exception_jadwal', {
    p_jadwal_slot_id: jadwalSlotId,
    p_tanggal: tanggal,
  });
  unwrap(null, error);
}

/** Daftar sensei pengganti yg TERSEDIA di jam tsb (utk dropdown ganti_sensei). */
export async function listSenseiPenggantiTersedia(
  jadwalSlotId: string,
  tanggal: string,
): Promise<Array<{ sensei_id: string; nama: string }>> {
  const { data, error } = await supabase.rpc('list_sensei_pengganti_tersedia', {
    p_jadwal_slot_id: jadwalSlotId,
    p_tanggal: tanggal,
  });
  return unwrap(data, error) as Array<{ sensei_id: string; nama: string }>;
}