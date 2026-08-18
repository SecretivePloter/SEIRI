-- ============================================================
-- Jadwal Sensei — Migration 0009 (v2): SKEMA DENAH RUANGAN
--
-- Menambah kolom posisi utk denah 2 lantai di /lobby-display:
--   lantai (1/2), posisi_slot (1-4 = kolom denah #1-#4),
--   urutan_dalam_slot (sub-kotak bila beberapa ruangan dalam 1 slot),
--   tipe ('fisik' | 'virtual').
--
-- Data denah (sesuai detail user):
--   LANTAI 2   #1: Natsu 1, Fuyu 1, Aki 1 (urut 1/2/3)
--              #2: Aki 2   #3: Aki 3   #4: Aki 4
--   LANTAI 1   #1: Haru 1  #2: Natsu 2, Haru 2  #3: Haru 3
--              #4: Natsu 4 (kap. 2 orang), Haru 4
--
-- "Online" (virtual) & "Fuyu 2" TIDAK di denah (posisi null) tapi TETAP
-- is_aktif = true supaya bisa dipilih di form jadwal.
--
-- PRINSIP: ADITIF + IDEMPOTEN. Rename korban lama -> nama bersubskrip,
-- lalu UPSERT by nama (on conflict) sehingga aman dijalankan berulang.
-- ============================================================

-- ---------- 1. Tambah kolom denah ----------
alter table public.ruangan
  add column if not exists lantai int,
  add column if not exists posisi_slot int,
  add column if not exists urutan_dalam_slot int not null default 1,
  add column if not exists tipe text not null default 'fisik';

-- Tipe hanya boleh fisik/virtual (hindari dobel jika migration dijalankan ulang)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ruangan_tipe_valid') then
    alter table public.ruangan
      add constraint ruangan_tipe_valid check (tipe in ('fisik','virtual'));
  end if;
end $$;

-- ---------- 2. Rename master lama -> nama bersubskrip denah ----------
-- (jadwal_slot referensi by id, bukan nama, jadi rename aman utk FK terpakai)
update public.ruangan set nama = 'Natsu 1' where nama = 'Natsu';
update public.ruangan set nama = 'Haru 1'  where nama = 'Haru';
update public.ruangan set nama = 'Aki 1'   where nama = 'Aki';

-- ---------- 3. Set posisi & sisipkan ruangan denah (UPSERT by nama) ----------
insert into public.ruangan (nama, lantai, posisi_slot, urutan_dalam_slot, kapasitas, tipe, is_aktif) values
  -- LANTAI 2
  ('Natsu 1', 2, 1, 1, 20, 'fisik', true),
  ('Fuyu 1',  2, 1, 2, 15, 'fisik', true),
  ('Aki 1',   2, 1, 3, 20, 'fisik', true),
  ('Aki 2',   2, 2, 1, 20, 'fisik', true),
  ('Aki 3',   2, 3, 1, 20, 'fisik', true),
  ('Aki 4',   2, 4, 1, 20, 'fisik', true),
  -- LANTAI 1
  ('Haru 1',  1, 1, 1, 20, 'fisik', true),
  ('Natsu 2', 1, 2, 1, 20, 'fisik', true),
  ('Haru 2',  1, 2, 2, 20, 'fisik', true),
  ('Haru 3',  1, 3, 1, 20, 'fisik', true),
  ('Natsu 4', 1, 4, 1, 2,  'fisik', true), -- kapasitas 2 orang (dikonfirmasi user)
  ('Haru 4',  1, 4, 2, 20, 'fisik', true),
  -- Tidak di denah tapi tetap bisa dipilih di form jadwal
  ('Online', null, null, 1, null, 'virtual', true),
  ('Fuyu 2', null, null, 1, 15, 'fisik', true)
on conflict (nama) do update set
  lantai            = excluded.lantai,
  posisi_slot       = excluded.posisi_slot,
  urutan_dalam_slot = excluded.urutan_dalam_slot,
  kapasitas         = coalesce(public.ruangan.kapasitas, excluded.kapasitas),
  tipe              = excluded.tipe,
  is_aktif          = excluded.is_aktif;

-- Catatan: "GST" (seed 0004) TIDAK dihapus di sini. Hapus lewat fitur
-- tombol hapus (Bagian 1) supaya evaluasi soft/hard auto dijalankan.