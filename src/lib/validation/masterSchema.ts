// Validasi client-side utk master data (Zod).

import { z } from 'zod';
import { HARI_INDO } from '@/lib/types/domain';

export const senseiSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi').max(120),
  status: z.enum(['Sensei Utama', 'Frelance']),
  bahasa_ajar: z.array(z.string()).default([]),
  jlpt_level: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']).nullable(),
  kontak: z.string().nullable(),
  foto_url: z.string().nullable(),
  tanggal_bergabung: z.string().nullable(),
  target_jam_minggu: z.number().positive('Target harus > 0').nullable(),
});
export type SenseiFormValues = z.infer<typeof senseiSchema>;

export const klienSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi').max(120),
  jenis: z.enum(['individu', 'perusahaan']),
  kontak: z.string().nullable(),
});
export type KlienFormValues = z.infer<typeof klienSchema>;

export const kelasSchema = z.object({
  nama_kelas: z.string().min(1, 'Nama kelas wajib diisi').max(120),
  jenis: z.enum(['CLT', 'Bimbel', 'SSW', 'Private']),
  klien_id: z.string().nullable(),
});
export type KelasFormValues = z.infer<typeof kelasSchema>;

export const ruanganSchema = z.object({
  nama: z.string().min(1, 'Nama ruangan wajib diisi').max(60),
  kapasitas: z.number().int().positive().nullable(),
});
export type RuanganFormValues = z.infer<typeof ruanganSchema>;

// Re-export utk kemudahan import
export { HARI_INDO };
