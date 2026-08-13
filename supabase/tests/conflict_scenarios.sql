-- ============================================================
-- Jadwal Sensei — Skenario uji edge cases
-- Jalankan SEQUENTIAL di Supabase SQL Editor SETELAH semua migration.
-- Setiap skenario menandai: ✅ (perintah berhasil) atau
-- ❌ DITOLAK (harus gagal dengan error yang diharapkan).
-- ============================================================

-- ----------------------------------------------------------
-- SETUP: sensei, ruangan, kelas uji
-- ----------------------------------------------------------
insert into public.sensei (nama, status) values ('Test Sensei A', 'Frelance'), ('Test Sensei B', 'Frelance');
insert into public.kelas (nama_kelas, jenis) values ('Kelas Uji 1', 'CLT'), ('Kelas Uji 2', 'Bimbel');

-- Ambil ID ke variabel via DO block tidak bisa lintas-statement di editor;
-- gunakan subselect nama di bawah.

-- ==========================================================
-- EDGE CASE 1: Batas jam persis — selesai 14:00, mulai 14:00 = VALID
-- ==========================================================
-- 1a. Slot pertama 10:00-14:00 (Senin) -> harus BERHASIL
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei A'),
  (select id from public.kelas where nama = 'Kelas Uji 1'),
  null, array['Senin'], null,
  '10:00', '14:00', 'ruangan',
  (select id from public.ruangan where nama = 'Besar'),
  null, 'aktif', 'edge-case-1a');

-- 1b. Slot kedua 14:00-16:00 sensei+ruangan SAMA -> harus BERHASIL (bukan bentrok)
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei A'),
  (select id from public.kelas where nama = 'Kelas Uji 1'),
  null, array['Senin'], null,
  '14:00', '16:00', 'ruangan',
  (select id from public.ruangan where nama = 'Besar'),
  null, 'aktif', 'edge-case-1b');

-- 1c. Slot 13:30-14:30 sensei sama -> harus DITOLAK JADWAL_CONFLICT
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei A'),
  (select id from public.kelas where nama = 'Kelas Uji 2'),
  null, array['Senin'], null,
  '13:30', '14:30', 'ruangan',
  (select id from public.ruangan where nama = 'Haru'),
  null, 'aktif', 'edge-case-1c (harus gagal)');

-- ==========================================================
-- EDGE CASE 2: Rutin vs one-off di tanggal sama
-- ==========================================================
-- 2a. Rutin tiap Selasa 09:00-11:00 -> BERHASIL
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei B'),
  (select id from public.kelas where nama = 'Kelas Uji 1'),
  null, array['Selasa'], null,
  '09:00', '11:00', 'ruangan',
  (select id from public.ruangan where nama = 'Aki'),
  null, 'aktif', 'edge-case-2a');

-- 2b. One-off di hari SELASA berikutnya jam 10:00-12:00, sensei sama
--     -> harus DITOLAK JADWAL_CONFLICT (ganti tanggal dengan Selasa terdekat)
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei B'),
  (select id from public.kelas where nama = 'Kelas Uji 2'),
  (select (current_date + ((2 - extract(isodow from current_date) + 7) % 7))::date), -- Selasa terdekat
  null, null,
  '10:00', '12:00', 'ruangan',
  (select id from public.ruangan where nama = 'Natsu'),
  null, 'aktif', 'edge-case-2b (harus gagal)');

-- ==========================================================
-- EDGE CASE 3: Rutin vs rutin dengan hari irisan
-- ==========================================================
-- 3a. Sensei B sudah punya Selasa 09-11. Tambah rutin [Selasa,Kamis] 10:30-12:00
--     -> harus DITOLAK (irisan hari Selasa, jam overlap)
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei B'),
  (select id from public.kelas where nama = 'Kelas Uji 2'),
  null, array['Selasa','Kamis'], null,
  '10:30', '12:00', 'ruangan',
  (select id from public.ruangan where nama = 'Fuyu 1'),
  null, 'aktif', 'edge-case-3a (harus gagal)');

-- ==========================================================
-- EDGE CASE 4: Kelas perusahaan/rumah TIDAK ikut bentrok ruangan
-- ==========================================================
-- 4a. Slot kelas_perusahaan sensei A di ruangan 'Besar'?? -> tidak bisa,
--     tipe kelas_perusahaan tidak boleh punya ruangan_id (CHECK constraint).
-- 4b. Dua kelas_rumah sensei berbeda, alamat sama, jam sama -> VALID
--     (bukan ruangan internal, tidak ada bentrok ruangan)
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei A'),
  (select id from public.kelas where nama = 'Kelas Uji 1'),
  '2026-09-01', null, null,
  '09:00', '11:00', 'kelas_rumah',
  null,
  'Jl. Sudirman 1', 'aktif', 'edge-case-4b senseiA');

select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei B'),
  (select id from public.kelas where nama = 'Kelas Uji 2'),
  '2026-09-01', null, null,
  '09:00', '11:00', 'kelas_rumah',
  null,
  'Jl. Sudirman 1', 'aktif', 'edge-case-4b senseiB (valid, beda sensei)');

-- 4c. Tapi kelas_rumah tetap ikut bentrok SENSEI: sensei A tambah rumah lain
--     jam sama tanggal sama -> harus DITOLAK
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei A'),
  (select id from public.kelas where nama = 'Kelas Uji 2'),
  '2026-09-01', null, null,
  '10:00', '12:00', 'kelas_rumah',
  null,
  'Jl. Gatot Subroto 5', 'aktif', 'edge-case-4c (harus gagal: bentrok sensei)');

-- ==========================================================
-- EDGE CASE 5: berlaku_sampai menutup jadwal rutin
-- ==========================================================
-- 5a. Rutin Rabu 13:00-14:00 berlaku_sampai 2026-08-31 -> BERHASIL
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei A'),
  (select id from public.kelas where nama = 'Kelas Uji 2'),
  null, array['Rabu'], '2026-08-31',
  '13:00', '14:00', 'ruangan',
  (select id from public.ruangan where nama = 'Fuyu 2'),
  null, 'aktif', 'edge-case-5a');

-- 5b. One-off Rabu 2026-09-10 jam 13:00-14:00 sensei A -> harus BERHASIL
--     (rutinnya sudah berakhir 31 Agustus)
select public.save_jadwal(
  null,
  (select id from public.sensei where nama = 'Test Sensei A'),
  (select id from public.kelas where nama = 'Kelas Uji 1'),
  '2026-09-10', null, null,
  '13:00', '14:00', 'ruangan',
  (select id from public.ruangan where nama = 'Haru'),
  null, 'aktif', 'edge-case-5b');

-- ==========================================================
-- EDGE CASE 6: Guard delete sensei dengan jadwal aktif
-- ==========================================================
-- 6a. Hitung jadwal mendatang Test Sensei A -> harus > 0
select public.count_jadwal_mendatang(
  (select id from public.sensei where nama = 'Test Sensei A'), null);

-- 6b. Hapus langsung -> harus DITOLAK (FK RESTRICT)
-- delete from public.sensei where nama = 'Test Sensei A';

-- 6c. Nonaktifkan + matikan jadwal mendatang -> BERHASIL, cek jadwal masa lalu utuh
select public.nonaktifkan_sensei(
  (select id from public.sensei where nama = 'Test Sensei A'), true);

select count(*) as jadwal_masih_aktif
from public.jadwal_slot
where sensei_id = (select id from public.sensei where nama = 'Test Sensei A')
  and status = 'aktif'; -- diharapkan 0

-- ==========================================================
-- CLEANUP (opsional)
-- ==========================================================
-- delete from public.jadwal_slot where keterangan like 'edge-case-%';
-- delete from public.kelas where nama_kelas like 'Kelas Uji%';
-- delete from public.sensei where nama like 'Test Sensei%';
