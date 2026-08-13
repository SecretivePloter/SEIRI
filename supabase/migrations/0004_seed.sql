-- ============================================================
-- Jadwal Sensei — Migration 0004: Seed data awal
-- 6 ruangan internal wajib + master contoh.
-- ============================================================

insert into public.ruangan (nama, kapasitas) values
  ('Besar', 40),
  ('Haru', 20),
  ('Aki', 20),
  ('Natsu', 20),
  ('Fuyu 1', 15),
  ('Fuyu 2', 15);

-- Contoh sensei (ganti/sesuaikan via halaman Admin)
insert into public.sensei (nama, status, bahasa_ajar, jlpt_level, tanggal_bergabung, target_jam_minggu) values
  ('Tanaka', 'Sensei Utama', array['Jepang N5','Jepang N4','Jepang N3'], 'N1', '2021-03-15', 30),
  ('Suzuki', 'Sensei Utama', array['Jepang N5','Jepang N4'], 'N2', '2022-01-10', 28),
  ('Watanabe', 'Frelance', array['Jepang N5'], 'N2', '2023-06-01', 20);

-- Contoh klien
insert into public.klien (nama, jenis) values
  ('PT Toyota Indonesia', 'perusahaan'),
  ('Budi Santoso', 'individu');

-- Contoh kelas
insert into public.kelas (nama_kelas, jenis, klien_id) values
  ('GST #23', 'CLT', (select id from public.klien where nama = 'PT Toyota Indonesia')),
  ('Bimbel N3 Reguler', 'Bimbel', null),
  ('Private N4 - Budi', 'Private', (select id from public.klien where nama = 'Budi Santoso')),
  ('SSW Kaigo Batch 5', 'SSW', null);
