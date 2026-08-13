// Service: jadwal slot — inti aplikasi.
// Semua tulis lewat RPC save_jadwal (validasi bentrok server-side,
// lock tabel utk konsistensi concurrent). Semua baca utk rentang tanggal
// lewat RPC resolve_jadwal (ekspansi one-off + rutin dalam 1 query).

import { supabase } from '@/lib/supabase/client';
import type {
  ConflictItem,
  JadwalInput,
  JadwalResolved,
  JadwalSlot,
  StatusSlot,
} from '@/lib/types/domain';
import { RpcError, parseRpcError, unwrap } from './rpcError';

/**
 * Jadwal konkret per tanggal dalam rentang [from, to].
 * Menyatukan one-off + rutin; dipakai timeline, ketersediaan, jam mengajar.
 */
export async function resolveJadwal(
  from: string,
  to: string,
  opts?: { senseiId?: string; ruanganId?: string; status?: StatusSlot[] },
): Promise<JadwalResolved[]> {
  const { data, error } = await supabase.rpc('resolve_jadwal', {
    p_from: from,
    p_to: to,
    p_sensei_id: opts?.senseiId ?? null,
    p_ruangan_id: opts?.ruanganId ?? null,
    p_status: opts?.status ?? ['aktif', 'planning'],
  });
  return unwrap(data, error) as JadwalResolved[];
}

/** Pre-check bentrok (read-only) utk feedback real-time di form. */
export async function checkJadwalConflicts(input: JadwalInput, slotId?: string): Promise<ConflictItem[]> {
  const { data, error } = await supabase.rpc('check_jadwal_conflicts', {
    p_slot_id: slotId ?? null,
    p_sensei_id: input.sensei_id,
    p_tanggal: input.tanggal,
    p_hari_rutin: input.hari_rutin,
    p_berlaku_sampai: input.berlaku_sampai,
    p_jam_mulai: input.jam_mulai,
    p_jam_selesai: input.jam_selesai,
    p_tipe_lokasi: input.tipe_lokasi,
    p_ruangan_id: input.ruangan_id,
  });
  return unwrap(data, error) as ConflictItem[];
}

/**
 * Simpan jadwal (insert jika id kosong, update jika ada).
 * Sumber kebenaran validasi bentrok — selalu lewat RPC save_jadwal,
 * tidak pernah insert/update langsung, agar konsisten walau concurrent.
 */
export async function saveJadwal(input: JadwalInput, id?: string): Promise<string> {
  const { data, error } = await supabase.rpc('save_jadwal', {
    p_id: id ?? null,
    p_sensei_id: input.sensei_id,
    p_kelas_id: input.kelas_id,
    p_tanggal: input.tanggal,
    p_hari_rutin: input.hari_rutin,
    p_berlaku_sampai: input.berlaku_sampai,
    p_jam_mulai: input.jam_mulai,
    p_jam_selesai: input.jam_selesai,
    p_tipe_lokasi: input.tipe_lokasi,
    p_ruangan_id: input.ruangan_id,
    p_alamat_tujuan: input.alamat_tujuan,
    p_status: input.status,
    p_keterangan: input.keterangan,
  });
  try {
    return unwrap(data, error) as string;
  } catch (e) {
    throw e instanceof RpcError ? e : new RpcError(parseRpcError(e));
  }
}

/** Detail slot mentah (dengan join) utk form edit / daftar jadwal. */
export async function listJadwalSlot(opts?: { status?: StatusSlot }): Promise<JadwalSlot[]> {
  let q = supabase
    .from('jadwal_slot')
    .select('*, sensei:sensei_id(id, nama), kelas:kelas_id(id, nama_kelas, jenis), ruangan:ruangan_id(id, nama)')
    .order('created_at', { ascending: false });
  if (opts?.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  return unwrap(data, error) as JadwalSlot[];
}

export async function getJadwalSlot(id: string): Promise<JadwalSlot> {
  const { data, error } = await supabase
    .from('jadwal_slot')
    .select('*, sensei:sensei_id(id, nama), kelas:kelas_id(id, nama_kelas, jenis), ruangan:ruangan_id(id, nama)')
    .eq('id', id)
    .single();
  return unwrap(data, error) as JadwalSlot;
}

/**
 * Ubah status slot ('aktif'/'tidak_aktif'/'planning') — tanpa mengubah
 * jadwalnya. Slot yang jadi 'aktif' tetap melewati validasi bentrok via
 * save_jadwal (klien memanggil updateStatusSlot yang membaca dulu lalu
 * menyimpan ulang via RPC).
 */
export async function setStatusSlot(id: string, status: StatusSlot): Promise<void> {
  if (status === 'aktif') {
    // Revalidasi lewat save_jadwal agar tidak menghidupkan slot yang kini bentrok
    const slot = await getJadwalSlot(id);
    await saveJadwal(
      {
        sensei_id: slot.sensei_id,
        kelas_id: slot.kelas_id,
        tanggal: slot.tanggal,
        hari_rutin: slot.hari_rutin,
        berlaku_sampai: slot.berlaku_sampai,
        jam_mulai: slot.jam_mulai,
        jam_selesai: slot.jam_selesai,
        tipe_lokasi: slot.tipe_lokasi,
        ruangan_id: slot.ruangan_id,
        alamat_tujuan: slot.alamat_tujuan,
        status: 'aktif',
        keterangan: slot.keterangan,
      },
      id,
    );
    return;
  }
  const { error } = await supabase.from('jadwal_slot').update({ status }).eq('id', id);
  unwrap(null, error);
}

/**
 * Hapus slot permanen. UI wajib ConfirmDialog; hanya admin (RLS).
 */
export async function deleteJadwalSlot(id: string): Promise<void> {
  const { error } = await supabase.from('jadwal_slot').delete().eq('id', id);
  unwrap(null, error);
}
