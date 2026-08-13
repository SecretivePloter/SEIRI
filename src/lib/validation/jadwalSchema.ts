// Validasi client-side (Zod) utk form jadwal — mirror aturan di
// save_jadwal (Postgres) supaya UX cepat. SUMBER KEBENARAN tetap RPC;
// validasi ini hanya lapisan pertama.

import { z } from 'zod';
import { HARI_INDO, type HariIndo } from '@/lib/types/domain';
import { timeToMinutes } from '@/lib/time';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const hariSchema = z.enum(HARI_INDO as unknown as [string, ...string[]]);

export const jadwalFormSchema = z
  .object({
    sensei_id: z.string().min(1, 'Pilih sensei'),
    kelas_id: z.string().min(1, 'Pilih kelas'),
    mode: z.enum(['one_off', 'rutin']),
    tanggal: z.string().nullable(),
    hari_rutin: z.array(hariSchema).nullable(),
    berlaku_sampai: z.string().nullable(),
    jam_mulai: z.string().regex(timePattern, 'Format jam HH:MM'),
    jam_selesai: z.string().regex(timePattern, 'Format jam HH:MM'),
    tipe_lokasi: z.enum(['ruangan', 'kelas_perusahaan', 'kelas_rumah']),
    ruangan_id: z.string().nullable(),
    alamat_tujuan: z.string().nullable(),
    status: z.enum(['aktif', 'tidak_aktif', 'planning']).default('aktif'),
    keterangan: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    // Exactly one of tanggal / hari_rutin
    if (v.mode === 'one_off' && !v.tanggal) {
      ctx.addIssue({ code: 'custom', path: ['tanggal'], message: 'Tanggal wajib diisi untuk jadwal satu kali' });
    }
    if (v.mode === 'rutin' && (!v.hari_rutin || v.hari_rutin.length === 0)) {
      ctx.addIssue({ code: 'custom', path: ['hari_rutin'], message: 'Pilih minimal satu hari' });
    }
    if (v.mode === 'rutin' && v.tanggal) {
      ctx.addIssue({ code: 'custom', path: ['tanggal'], message: 'Jadwal rutin tidak memakai tanggal' });
    }
    if (v.mode === 'one_off' && v.berlaku_sampai) {
      ctx.addIssue({ code: 'custom', path: ['berlaku_sampai'], message: 'Berlaku sampai hanya untuk jadwal rutin' });
    }

    // Jam: selesai harus setelah mulai (kelas tidak lewat tengah malam — asumsi #4)
    if (timePattern.test(v.jam_mulai) && timePattern.test(v.jam_selesai)) {
      if (timeToMinutes(v.jam_selesai) <= timeToMinutes(v.jam_mulai)) {
        ctx.addIssue({ code: 'custom', path: ['jam_selesai'], message: 'Jam selesai harus setelah jam mulai' });
      }
    }

    // Konsistensi lokasi
    if (v.tipe_lokasi === 'ruangan' && !v.ruangan_id) {
      ctx.addIssue({ code: 'custom', path: ['ruangan_id'], message: 'Pilih ruangan' });
    }
    if (v.tipe_lokasi !== 'ruangan' && v.ruangan_id) {
      ctx.addIssue({ code: 'custom', path: ['ruangan_id'], message: 'Kelas luar tidak memakai ruangan internal' });
    }
    if (v.tipe_lokasi !== 'ruangan' && !v.alamat_tujuan?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['alamat_tujuan'],
        message: 'Alamat tujuan wajib diisi untuk kelas perusahaan/rumah',
      });
    }
  });

export type JadwalFormValues = z.infer<typeof jadwalFormSchema>;

/** Konversi nilai form -> payload RPC */
export function toJadwalInput(v: JadwalFormValues) {
  return {
    sensei_id: v.sensei_id,
    kelas_id: v.kelas_id,
    tanggal: v.mode === 'one_off' ? v.tanggal : null,
    hari_rutin: v.mode === 'rutin' ? (v.hari_rutin as HariIndo[] | null) : null,
    berlaku_sampai: v.mode === 'rutin' ? v.berlaku_sampai : null,
    jam_mulai: v.jam_mulai.length === 5 ? `${v.jam_mulai}:00` : v.jam_mulai,
    jam_selesai: v.jam_selesai.length === 5 ? `${v.jam_selesai}:00` : v.jam_selesai,
    tipe_lokasi: v.tipe_lokasi,
    ruangan_id: v.tipe_lokasi === 'ruangan' ? v.ruangan_id : null,
    alamat_tujuan: v.tipe_lokasi === 'ruangan' ? null : v.alamat_tujuan,
    status: v.status,
    keterangan: v.keterangan,
  };
}

export function flattenZodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
