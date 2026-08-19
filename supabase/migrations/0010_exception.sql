-- ============================================================
-- Jadwal Sensei — Migration 0010 (v2.2): EXCEPTION PER TANGGAL
--
-- Fitur: override jadwal RUTIN utk satu tanggal spesifik, TERPISAH dari
-- status aktif/nonaktif level jadwal_slot:
--   * 'dibatalkan'   -> kelas batal utk tanggal itu (tidak dihitung siapa pun)
--   * 'ganti_sensei' -> sensei pengganti mengajar utk tanggal itu saja
--
-- ARSITEKTUR: resolve_jadwal adalah SATU-SATUNYA sumber data (timeline,
-- timeline ruangan, profil sensei, lobby, dashboard & payroll). Semua logic
-- exception di-resolve DI SANA, sehingga setiap halaman otomatis konsisten:
--   - 'dibatalkan'  -> tetap muncul (redup + label) di baris sensei asli,
--                       tapi `dihitung=false` -> TIDAK masuk jam/sesi.
--   - 'ganti_sensei'-> 2 baris: baris asli (redup + "Digantikan oleh X",
--                       `is_pengganti=false`, `dihitung=false`) + baris
--                       pengganti (normal + badge, `is_pengganti=true`,
--                       `dihitung=true` -> jam/sesi masuk ke SENSEI PENGGANTI
--                       utk tanggal itu saja).
-- PRINSIP: ADITIF. Tidak menghapus data; hanya menambah tabel, RPC & grants.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel jadwal_exception
-- ------------------------------------------------------------
create table if not exists public.jadwal_exception (
  id uuid primary key default gen_random_uuid(),
  jadwal_slot_id uuid not null references public.jadwal_slot (id) on delete cascade,
  tanggal date not null,
  tipe text not null check (tipe in ('dibatalkan','ganti_sensei')),
  sensei_pengganti_id uuid references public.sensei (id),
  catatan text,
  dibuat_oleh uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (jadwal_slot_id, tanggal)
);

create index if not exists idx_jadwal_exception_slot on public.jadwal_exception (jadwal_slot_id);
create index if not exists idx_jadwal_exception_tanggal on public.jadwal_exception (tanggal);

-- Konsistensi: tipe ganti_sensei wajib punya pengganti; dibatalkan tidak boleh.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jadwal_exception_pengganti_valid') then
    alter table public.jadwal_exception
      add constraint jadwal_exception_pengganti_valid check (
        (tipe = 'ganti_sensei' and sensei_pengganti_id is not null)
        or (tipe = 'dibatalkan' and sensei_pengganti_id is null)
      );
  end if;
end $$;

-- RLS: semua authenticated boleh baca; tulis hanya admin. (idempoten)
alter table public.jadwal_exception enable row level security;
drop policy if exists "jadwal_exception_select" on public.jadwal_exception;
drop policy if exists "jadwal_exception_insert_admin" on public.jadwal_exception;
drop policy if exists "jadwal_exception_update_admin" on public.jadwal_exception;
drop policy if exists "jadwal_exception_delete_admin" on public.jadwal_exception;
create policy "jadwal_exception_select" on public.jadwal_exception
  for select using (public.is_authenticated());
create policy "jadwal_exception_insert_admin" on public.jadwal_exception
  for insert with check (public.is_admin());
create policy "jadwal_exception_update_admin" on public.jadwal_exception
  for update using (public.is_admin());
create policy "jadwal_exception_delete_admin" on public.jadwal_exception
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 2. rewrite resolve_jadwal (single source of truth + exception)
--    RETURN TYPE BERUBAH (kolom output diperluas) -> `create or replace`
--    TIDAK bisa (42P13). Wajib DROP signature lama DULU baru create.
-- ------------------------------------------------------------
drop function if exists public.resolve_jadwal(date, date, uuid, uuid, public.status_slot[]);

create or replace function public.resolve_jadwal(
  p_from date,
  p_to date,
  p_sensei_id uuid default null,
  p_ruangan_id uuid default null,
  p_status public.status_slot[] default array['aktif','planning']::public.status_slot[]
)
returns table (
  slot_id uuid,
  tanggal_efektif date,
  hari text,
  jam_mulai time,
  jam_selesai time,
  sensei_id uuid,
  sensei_efektif_id uuid,
  sensei_pengganti_id uuid,
  sensei_efektif_nama text,
  sensei_pengganti_nama text,
  kelas_id uuid,
  kelas_nama text,
  kelas_jenis public.jenis_kelas,
  tipe_lokasi public.tipe_lokasi_slot,
  ruangan_id uuid,
  ruangan_nama text,
  alamat_tujuan text,
  status public.status_slot,
  keterangan text,
  is_rutin boolean,
  exception_id uuid,
  exception_tipe text,
  exception_catatan text,
  is_pengganti boolean,
  dihitung boolean
)
language sql stable
security definer set search_path = public
as $$
  with dates as (
    select d::date as dt
    from generate_series(p_from, p_to, interval '1 day') as d
  ),
  base as (
    select s.id slot_id, d.dt tanggal_efektif, public.hari_indo(d.dt) as hari,
           s.jam_mulai, s.jam_selesai,
           s.sensei_id, s.kelas_id, k.nama_kelas, k.jenis kelas_jenis,
           s.tipe_lokasi, s.ruangan_id, r.nama ruangan_nama, s.alamat_tujuan,
           s.status, s.keterangan,
           (s.hari_rutin is not null) as is_rutin,
           e.id exception_id, e.tipe exception_tipe, e.catatan exception_catatan,
           e.sensei_pengganti_id, sp.nama sensei_pengganti_nama
    from public.jadwal_slot s
    join public.kelas k on k.id = s.kelas_id
    left join public.ruangan r on r.id = s.ruangan_id
    join dates d on
         (s.tanggal is not null and s.tanggal = d.dt)
      or (s.hari_rutin is not null
          and public.hari_indo(d.dt) = any(s.hari_rutin)
          and (s.tanggal_mulai is null or d.dt >= s.tanggal_mulai)
          and (s.berlaku_sampai is null or d.dt <= s.berlaku_sampai))
    left join public.jadwal_exception e
           on e.jadwal_slot_id = s.id and e.tanggal = d.dt
    left join public.sensei sp on sp.id = e.sensei_pengganti_id
    where p_from <= p_to
      and s.status = any(p_status)
      and (p_ruangan_id is null or s.ruangan_id = p_ruangan_id)
  )
  -- Baris dasar: normal / dibatalkan / marker asli utk ganti_sensei.
  -- dihitung = true HANYA untuk jadwal normal (tanpa exception).
  select * from (
   select b.slot_id, b.tanggal_efektif, b.hari,
         b.jam_mulai, b.jam_selesai,
         b.sensei_id,
         case when b.exception_tipe = 'ganti_sensei'
              then b.sensei_pengganti_id else b.sensei_id end as sensei_efektif_id,
         b.sensei_pengganti_id,
         case when b.exception_tipe = 'ganti_sensei'
              then b.sensei_pengganti_nama else s0.nama end as sensei_efektif_nama,
         b.sensei_pengganti_nama,
         b.kelas_id, b.nama_kelas, b.kelas_jenis, b.tipe_lokasi,
         b.ruangan_id, b.ruangan_nama, b.alamat_tujuan,
         b.status, b.keterangan, b.is_rutin,
         b.exception_id, b.exception_tipe, b.exception_catatan,
         false as is_pengganti,
         (b.exception_tipe is null) as dihitung
  from base b
  left join public.sensei s0 on s0.id = b.sensei_id
  union all
  -- Baris tambahan utk ganti_sensei: ditampilkan di baris SENSEI PENGGANTI,
  -- is_pengganti=true & dihitung=true -> jam/sesi masuk ke pengganti.
  select b.slot_id, b.tanggal_efektif, b.hari,
         b.jam_mulai, b.jam_selesai,
         b.sensei_pengganti_id as sensei_id,
         b.sensei_pengganti_id as sensei_efektif_id,
         b.sensei_pengganti_id,
         b.sensei_pengganti_nama as sensei_efektif_nama,
         b.sensei_pengganti_nama,
         b.kelas_id, b.nama_kelas, b.kelas_jenis, b.tipe_lokasi,
         b.ruangan_id, b.ruangan_nama, b.alamat_tujuan,
         b.status, b.keterangan, b.is_rutin,
         b.exception_id, b.exception_tipe, b.exception_catatan,
         true as is_pengganti,
         true as dihitung
  from base b
  where b.exception_tipe = 'ganti_sensei'
    and b.sensei_pengganti_id is not null
  ) allrows
  where p_sensei_id is null
     or allrows.sensei_id = p_sensei_id
     or allrows.sensei_efektif_id = p_sensei_id
  order by tanggal_efektif, jam_mulai;
$$;

-- ------------------------------------------------------------
-- 3. RPC CRUD jadwal_exception
-- ------------------------------------------------------------
create or replace function public.simpan_exception_jadwal(
  p_jadwal_slot_id uuid,
  p_tanggal date,
  p_tipe text,
  p_sensei_pengganti_id uuid default null,
  p_catatan text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_jam_mulai time;
  v_jam_selesai time;
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat mengatur exception jadwal';
  end if;
  if p_tipe not in ('dibatalkan','ganti_sensei') then
    raise exception 'VALIDASI|Tipe exception tidak dikenal';
  end if;
  if p_tipe = 'dibatalkan' and p_sensei_pengganti_id is not null then
    raise exception 'VALIDASI|Exception dibatalkan tidak boleh memakai sensei pengganti';
  end if;

  -- Hanya utk jadwal rutin
  select jam_mulai, jam_selesai into v_jam_mulai, v_jam_selesai
  from public.jadwal_slot where id = p_jadwal_slot_id and hari_rutin is not null;
  if not found then
    raise exception 'VALIDASI|Exception hanya bisa dibuat utk jadwal rutin (mingguan)';
  end if;

  if p_tipe = 'ganti_sensei' then
    if p_sensei_pengganti_id is null then
      raise exception 'VALIDASI|Sensei pengganti wajib dipilih utk tipe ganti_sensei';
    end if;
    -- Tidak boleh mengganti dgn sensei asli slot ini
    if (select sensei_id from public.jadwal_slot where id = p_jadwal_slot_id) = p_sensei_pengganti_id then
      raise exception 'VALIDASI|Sensei pengganti tidak boleh sama dengan sensei asli';
    end if;

    -- Cek bentrok sensei pengganti di tanggal+jam itu (jangan timpa kelas lain)
    if exists (
      select 1
      from public.resolve_jadwal(p_tanggal, p_tanggal, null, null, array['aktif']::public.status_slot[]) r
      where r.sensei_efektif_id = p_sensei_pengganti_id
        and r.dihitung
        and r.jam_mulai < v_jam_selesai
        and r.jam_selesai > v_jam_mulai
        and r.slot_id is distinct from p_jadwal_slot_id
    ) then
      raise exception 'BENTROK|Sensei pengganti sudah mengajar di jam yang sama (kecuali yg sedang diganti)';
    end if;
  end if;

  insert into public.jadwal_exception
    (jadwal_slot_id, tanggal, tipe, sensei_pengganti_id, catatan, dibuat_oleh)
  values
    (p_jadwal_slot_id, p_tanggal, p_tipe, p_sensei_pengganti_id, p_catatan, auth.uid())
  on conflict (jadwal_slot_id, tanggal) do update set
    tipe = excluded.tipe,
    sensei_pengganti_id = excluded.sensei_pengganti_id,
    catatan = excluded.catatan,
    dibuat_oleh = auth.uid()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.hapus_exception_jadwal(
  p_jadwal_slot_id uuid,
  p_tanggal date
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat menghapus exception jadwal';
  end if;
  delete from public.jadwal_exception
   where jadwal_slot_id = p_jadwal_slot_id and tanggal = p_tanggal;
end;
$$;

-- Daftar sensei yg TERSEDIA mengganti di jam tersebut (utk dropdown).
-- Tersedia = aktif, bukan sensei asli slot, dan tidak bentrok dgn kelas
-- aktif/pengganti lain di tanggal+jam yang sama.
create or replace function public.list_sensei_pengganti_tersedia(
  p_jadwal_slot_id uuid,
  p_tanggal date
)
returns table (sensei_id uuid, nama text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_asal uuid;
  v_mulai time;
  v_selesai time;
  v_pengganti_sekarang uuid;
begin
  select sensei_id, jam_mulai, jam_selesai into v_asal, v_mulai, v_selesai
    from public.jadwal_slot where id = p_jadwal_slot_id;

  select sensei_pengganti_id into v_pengganti_sekarang
    from public.jadwal_exception
   where jadwal_slot_id = p_jadwal_slot_id and tanggal = p_tanggal;

  return query
    select s.id, s.nama
    from public.sensei s
    where s.is_aktif
      and s.id is distinct from v_asal
      and s.id is distinct from v_pengganti_sekarang
      and not exists (
        select 1
        from public.resolve_jadwal(
               p_tanggal, p_tanggal, null, null,
               array['aktif']::public.status_slot[]) r
        where r.sensei_efektif_id = s.id
          and r.dihitung
          and r.tanggal_efektif = p_tanggal
          and r.jam_mulai < v_selesai
          and r.jam_selesai > v_mulai
          and r.slot_id is distinct from p_jadwal_slot_id
      )
    order by s.nama;
end;
$$;

-- ------------------------------------------------------------
-- 4. rewrite agregat jam/sesi (payroll) utk exception
--    Hanya memakai baris dihitung=true (normal + pengganti), sehingga:
--      * dibatalkan -> tidak dihitung siapa pun
--      * ganti_sensei -> dihitung ke sensei_efektif_id (= pengganti)
-- ------------------------------------------------------------
create or replace function public.hitung_jam_mengajar(
  p_from date,
  p_to date,
  p_sensei_id uuid default null
)
returns table (
  sensei_id uuid,
  nama_sensei text,
  status_sensei public.sensei_status,
  total_jam numeric,
  jumlah_sesi numeric,
  slot_tanpa_aturan_sesi int,
  target_jam_minggu numeric
)
language sql stable
security definer set search_path = public
as $$
  with slot_stats as (
    select r.sensei_efektif_id as s_id,
           extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0 as jam,
           case
             when ks.jenis is not null
             then (extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0)
                  * ks.jumlah_sesi / ks.durasi_jam
             else null
           end as sesi
    from public.resolve_jadwal(p_from, p_to, null, null, array['aktif']::public.status_slot[]) r
    left join public.kategori_sesi ks on ks.jenis = r.kelas_jenis
    where r.dihitung
  )
  select s.id,
         s.nama,
         s.status,
         coalesce(round(sum(t.jam), 2), 0) as total_jam,
         coalesce(round(sum(coalesce(t.sesi, 1)), 2), 0) as jumlah_sesi,
         count(case when t.sesi is null then 1 end)::int as slot_tanpa_aturan_sesi,
         s.target_jam_minggu
  from public.sensei s
  left join slot_stats t on t.s_id = s.id
  where s.is_aktif
    and (p_sensei_id is null or s.id = p_sensei_id)
  group by s.id, s.nama, s.status, s.target_jam_minggu
  order by total_jam desc;
$$;

create or replace function public.hitung_jam_per_kelas(
  p_sensei_id uuid,
  p_from date,
  p_to date
)
returns table (
  kelas_id uuid,
  kelas_nama text,
  kelas_jenis public.jenis_kelas,
  total_jam numeric,
  jumlah_sesi numeric,
  slot_tanpa_aturan_sesi int
)
language sql stable
security definer set search_path = public
as $$
  with slot_stats as (
    select r.kelas_id, r.kelas_nama, r.kelas_jenis,
           extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0 as jam,
           case
             when ks.jenis is not null
             then (extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0)
                  * ks.jumlah_sesi / ks.durasi_jam
             else null
           end as sesi
    from public.resolve_jadwal(p_from, p_to, p_sensei_id, null, array['aktif']::public.status_slot[]) r
    left join public.kategori_sesi ks on ks.jenis = r.kelas_jenis
    where r.dihitung
  )
  select t.kelas_id, t.kelas_nama, t.kelas_jenis,
         round(sum(t.jam), 2) as total_jam,
         round(sum(coalesce(t.sesi, 1)), 2) as jumlah_sesi,
         count(case when t.sesi is null then 1 end)::int as slot_tanpa_aturan_sesi
  from slot_stats t
  group by t.kelas_id, t.kelas_nama, t.kelas_jenis
  order by total_jam desc;
$$;

-- ------------------------------------------------------------
-- 5. Grants (hilangkan akses publik, hanya authenticated via RPC)
-- ------------------------------------------------------------
revoke all on function public.simpan_exception_jadwal(uuid, date, text, uuid, text) from public, anon;
revoke all on function public.hapus_exception_jadwal(uuid, date) from public, anon;
revoke all on function public.list_sensei_pengganti_tersedia(uuid, date) from public, anon;
grant execute on function public.simpan_exception_jadwal(uuid, date, text, uuid, text) to authenticated;
grant execute on function public.hapus_exception_jadwal(uuid, date) to authenticated;
grant execute on function public.list_sensei_pengganti_tersedia(uuid, date) to authenticated;
grant execute on function public.resolve_jadwal(date, date, uuid, uuid, public.status_slot[]) to authenticated;
grant execute on function public.hitung_jam_mengajar(date, date, uuid) to authenticated;
grant execute on function public.hitung_jam_per_kelas(uuid, date, date) to authenticated;