-- ============================================================
-- Jadwal Sensei — Migration 0001: Skema inti
-- Semua nilai time/date adalah wall-clock WIB (Asia/Jakarta).
-- timestamptz hanya dipakai untuk created_at/updated_at (audit).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Domain / enum
-- ------------------------------------------------------------
create type sensei_status as enum ('Sensei Utama', 'Frelance');
create type jenis_kelas as enum ('CLT', 'Bimbel', 'SSW', 'Private');
create type jenis_klien as enum ('individu', 'perusahaan');
create type tipe_lokasi_slot as enum ('ruangan', 'kelas_perusahaan', 'kelas_rumah');
create type status_slot as enum ('aktif', 'tidak_aktif', 'planning');
create type user_role as enum ('admin', 'viewer');

-- ------------------------------------------------------------
-- cabang (future-proof multi-cabang, NFR brief)
-- ------------------------------------------------------------
create table cabang (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz not null default now()
);

insert into cabang (nama) values ('Ichikara Pusat');

-- ------------------------------------------------------------
-- profiles: pemetaan auth.users -> role (sumber kebenaran RLS)
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nama text,
  role user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- sensei
-- ------------------------------------------------------------
create table sensei (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid references cabang (id),
  nama text not null,
  status sensei_status not null,
  bahasa_ajar text[] not null default '{}',
  jlpt_level text check (jlpt_level is null or jlpt_level in ('N5','N4','N3','N2','N1')),
  kontak text,
  foto_url text,
  tanggal_bergabung date,
  target_jam_minggu numeric(6,2),
  is_aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- klien
-- ------------------------------------------------------------
create table klien (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jenis jenis_klien not null,
  kontak text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ruangan
-- ------------------------------------------------------------
create table ruangan (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid references cabang (id),
  nama text not null unique,
  kapasitas int check (kapasitas is null or kapasitas > 0),
  is_aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- kelas
-- ------------------------------------------------------------
create table kelas (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid references cabang (id),
  nama_kelas text not null,
  jenis jenis_kelas not null,
  klien_id uuid references klien (id) on delete restrict,
  is_aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- jadwal_slot — tabel inti
-- Semantik ganda:
--   * one-off  -> tanggal terisi, hari_rutin NULL
--   * rutin    -> hari_rutin terisi (nama hari Indonesia), tanggal NULL,
--                 opsional berlaku_sampai untuk menutup jadwal per semester
-- ------------------------------------------------------------
create table jadwal_slot (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid references cabang (id),
  sensei_id uuid not null references sensei (id) on delete restrict,
  kelas_id uuid not null references kelas (id) on delete restrict,
  tanggal date,
  hari_rutin text[],
  berlaku_sampai date,
  jam_mulai time not null,
  jam_selesai time not null,
  tipe_lokasi tipe_lokasi_slot not null,
  ruangan_id uuid references ruangan (id) on delete restrict,
  alamat_tujuan text,
  status status_slot not null default 'aktif',
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Tepat satu dari tanggal / hari_rutin terisi (hindari data ambigu)
  constraint slot_exactly_one_mode check (
    (tanggal is null) <> (hari_rutin is null)
  ),
  -- Kelas tidak boleh nol/negatif; tidak melewati tengah malam (asumsi #4)
  constraint slot_time_order check (jam_selesai > jam_mulai),
  -- hari_rutin hanya boleh berisi nama hari Indonesia yang valid
  constraint slot_hari_rutin_valid check (
    hari_rutin is null
    or hari_rutin <@ array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']
  ),
  constraint slot_hari_rutin_nonempty check (
    hari_rutin is null or cardinality(hari_rutin) > 0
  ),
  -- ruangan_id wajib hanya untuk tipe_lokasi = 'ruangan';
  -- secara struktural membuat kelas perusahaan/rumah tidak mungkin
  -- ikut validasi bentrok ruangan (edge case lokasi)
  constraint slot_ruangan_consistency check (
    (tipe_lokasi = 'ruangan' and ruangan_id is not null)
    or (tipe_lokasi in ('kelas_perusahaan','kelas_rumah') and ruangan_id is null)
  ),
  -- berlaku_sampai hanya masuk akal untuk jadwal rutin
  constraint slot_berlaku_sampai_rutin check (
    berlaku_sampai is null or hari_rutin is not null
  )
);

-- updated_at otomatis
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_sensei_updated_at before update on sensei
  for each row execute function set_updated_at();
create trigger trg_jadwal_slot_updated_at before update on jadwal_slot
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Index (wajib brief + pendukung query timeline)
-- ------------------------------------------------------------
create index idx_jadwal_slot_sensei_tanggal on jadwal_slot (sensei_id, tanggal);
create index idx_jadwal_slot_ruangan_tanggal on jadwal_slot (ruangan_id, tanggal);
-- jadwal rutin tidak punya tanggal: index per sensei untuk ekspansi rutin
create index idx_jadwal_slot_sensei on jadwal_slot (sensei_id);
create index idx_jadwal_slot_status on jadwal_slot (status);
create index idx_kelas_jenis on kelas (jenis);
