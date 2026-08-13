// Domain types — mirror skema supabase/migrations/0001_schema.sql.
// Jika Supabase project sudah terhubung, bisa regenerasi via
// `supabase gen types typescript --project-id <id> --schema public > src/lib/types/database.ts`

export type SenseiStatus = 'Sensei Utama' | 'Frelance';
export type JenisKelas = 'CLT' | 'Bimbel' | 'SSW' | 'Private';
export type JenisKlien = 'individu' | 'perusahaan';
export type TipeLokasi = 'ruangan' | 'kelas_perusahaan' | 'kelas_rumah';
export type StatusSlot = 'aktif' | 'tidak_aktif' | 'planning';
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

/** Nama hari Indonesia sesuai mapping isodow di Postgres (Senin=1..Minggu=7) */
export type HariIndo = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';

export const HARI_INDO: HariIndo[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export interface Profile {
  id: string;
  email: string | null;
  nama: string | null;
  role: 'admin' | 'viewer';
  created_at: string;
}

export interface Sensei {
  id: string;
  cabang_id: string | null;
  nama: string;
  status: SenseiStatus;
  bahasa_ajar: string[];
  jlpt_level: JlptLevel | null;
  kontak: string | null;
  foto_url: string | null;
  tanggal_bergabung: string | null; // date yyyy-mm-dd
  target_jam_minggu: number | null;
  is_aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Klien {
  id: string;
  nama: string;
  jenis: JenisKlien;
  kontak: string | null;
  created_at: string;
}

export interface Ruangan {
  id: string;
  cabang_id: string | null;
  nama: string;
  kapasitas: number | null;
  is_aktif: boolean;
  created_at: string;
}

export interface Kelas {
  id: string;
  cabang_id: string | null;
  nama_kelas: string;
  jenis: JenisKelas;
  klien_id: string | null;
  is_aktif: boolean;
  created_at: string;
  // join field (opsional, diisi via select)
  klien?: Klien | null;
}

export interface JadwalSlot {
  id: string;
  cabang_id: string | null;
  sensei_id: string;
  kelas_id: string;
  tanggal: string | null; // date yyyy-mm-dd (one-off)
  hari_rutin: HariIndo[] | null; // (rutin)
  berlaku_sampai: string | null; // date, hanya utk rutin
  jam_mulai: string; // "HH:MM:SS" dari Postgres time
  jam_selesai: string;
  tipe_lokasi: TipeLokasi;
  ruangan_id: string | null;
  alamat_tujuan: string | null;
  status: StatusSlot;
  keterangan: string | null;
  created_at: string;
  updated_at: string;
  // join fields (opsional)
  sensei?: Sensei | null;
  kelas?: Kelas | null;
  ruangan?: Ruangan | null;
}

/** Baris hasil resolve_jadwal — jadwal konkret per tanggal */
export interface JadwalResolved {
  slot_id: string;
  tanggal_efektif: string; // yyyy-mm-dd
  hari: HariIndo;
  jam_mulai: string;
  jam_selesai: string;
  sensei_id: string;
  kelas_id: string;
  kelas_nama: string;
  kelas_jenis: JenisKelas;
  tipe_lokasi: TipeLokasi;
  ruangan_id: string | null;
  ruangan_nama: string | null;
  alamat_tujuan: string | null;
  status: StatusSlot;
  keterangan: string | null;
}

/** Item bentrok dari check_jadwal_conflicts / save_jadwal */
export interface ConflictItem {
  slot_id: string;
  jenis_konflik: 'sensei' | 'ruangan';
  kelas_nama: string;
  kelas_jenis?: JenisKelas;
  jam: string; // "HH:MM-HH:MM"
  jadwal: string; // tanggal atau daftar hari rutin
}

export interface KetersediaanHari {
  tanggal: string;
  hari: HariIndo;
  tersedia: boolean;
  jadwal: Array<{ kelas: string; jam: string; lokasi: TipeLokasi }>;
}

export interface JamMengajarSensei {
  sensei_id: string;
  nama_sensei: string;
  status_sensei: SenseiStatus;
  total_jam: number;
  jumlah_sesi: number;
  target_jam_minggu: number | null;
}

export interface JamPerKelas {
  kelas_id: string;
  kelas_nama: string;
  kelas_jenis: JenisKelas;
  total_jam: number;
  jumlah_sesi: number;
}

/** Payload simpan jadwal (RPC save_jadwal) */
export interface JadwalInput {
  sensei_id: string;
  kelas_id: string;
  tanggal: string | null;
  hari_rutin: HariIndo[] | null;
  berlaku_sampai: string | null;
  jam_mulai: string;
  jam_selesai: string;
  tipe_lokasi: TipeLokasi;
  ruangan_id: string | null;
  alamat_tujuan: string | null;
  status: StatusSlot;
  keterangan: string | null;
}
