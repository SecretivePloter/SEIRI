-- ============================================================
-- Jadwal Sensei — Migration 0005 (v2): Perluasan enum jenis_kelas
-- Menambah 5 kategori kelas baru: TG, Benkyou Houdai, Semi Private,
-- Grup Kecil, Regular (total 9 kategori).
--
-- PENTING: ALTER TYPE ... ADD VALUE harus berada di transaksi terpisah
-- dari statement yang MEMAKAI nilai baru tersebut, sehingga file ini
-- sengaja dipisah dari 0006 (yang memakai nilai baru utk seed
-- kategori_sesi). Jalankan 0005 dulu, baru 0006.
-- ============================================================

alter type public.jenis_kelas add value if not exists 'TG';
alter type public.jenis_kelas add value if not exists 'Benkyou Houdai';
alter type public.jenis_kelas add value if not exists 'Semi Private';
alter type public.jenis_kelas add value if not exists 'Grup Kecil';
alter type public.jenis_kelas add value if not exists 'Regular';
