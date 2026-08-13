-- ============================================================
-- Jadwal Sensei — Migration 0003: Fungsi inti & RPC
-- Prinsip:
--   * Semua perhitungan "hari ini" memakai WIB (Asia/Jakarta).
--   * Overlap jam memakai pertidaksamaan ketat:
--       a_mulai < b_selesai AND b_mulai < a_selesai
--     sehingga selesai 14:00 + mulai 14:00 = VALID (edge case batas jam).
--   * Bentrok dideteksi secara logika (tanpa horizon ekspansi) sehingga
--     rutin-vs-rutin dan rutin-vs-one-off tidak pernah lolos semestinya.
--   * Hanya slot status 'aktif' yang ikut validasi bentrok.
-- ============================================================

-- ------------------------------------------------------------
-- Helper waktu & hari
-- ------------------------------------------------------------

-- "Hari ini" dalam WIB — hindari current_date (session TZ = UTC di Supabase)
create or replace function public.today_wib()
returns date
language sql stable as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- Nama hari Indonesia untuk sebuah tanggal (isodow: Senin=1..Minggu=7)
create or replace function public.hari_indo(p_date date)
returns text
language sql immutable as $$
  select (array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'])
         [extract(isodow from p_date)::int];
$$;

-- Overlap dua rentang jam (ketat: bersentuhan di batas = tidak overlap)
create or replace function public.jam_overlap(
  a_mulai time, a_selesai time, b_mulai time, b_selesai time
)
returns boolean
language sql immutable as $$
  select a_mulai < b_selesai and b_mulai < a_selesai;
$$;

-- Apakah dua "modus tanggal" (one-off / rutin) beririsan.
-- Menangani 4 kombinasi:
--   one-off vs one-off   -> tanggal sama
--   one-off vs rutin     -> hari-tanggal ada di hari_rutin (+ berlaku_sampai)
--   rutin vs one-off     -> simetris
--   rutin vs rutin       -> irisan array hari
create or replace function public.jadwal_dates_intersect(
  a_tanggal date, a_hari_rutin text[], a_berlaku_sampai date,
  b_tanggal date, b_hari_rutin text[], b_berlaku_sampai date
)
returns boolean
language sql immutable as $$
  select case
    when a_tanggal is not null and b_tanggal is not null then
      a_tanggal = b_tanggal
    when a_tanggal is not null and b_hari_rutin is not null then
      public.hari_indo(a_tanggal) = any(b_hari_rutin)
      and (b_berlaku_sampai is null or a_tanggal <= b_berlaku_sampai)
    when a_hari_rutin is not null and b_tanggal is not null then
      public.hari_indo(b_tanggal) = any(a_hari_rutin)
      and (a_berlaku_sampai is null or b_tanggal <= a_berlaku_sampai)
    when a_hari_rutin is not null and b_hari_rutin is not null then
      a_hari_rutin && b_hari_rutin
    else false
  end;
$$;

-- ------------------------------------------------------------
-- find_jadwal_conflicts — deteksi bentrok untuk sebuah kandidat slot.
-- Dipakai oleh save_jadwal (server-side, sumber kebenaran), trigger
-- defense-in-depth, dan pre-check form (read-only).
-- ------------------------------------------------------------
create or replace function public.find_jadwal_conflicts(
  p_slot_id uuid,               -- id slot yg sedang di-update; NULL utk insert
  p_sensei_id uuid,
  p_tanggal date,
  p_hari_rutin text[],
  p_berlaku_sampai date,
  p_jam_mulai time,
  p_jam_selesai time,
  p_tipe_lokasi public.tipe_lokasi_slot,
  p_ruangan_id uuid
)
returns table (
  slot_id uuid,
  sensei_id uuid,
  kelas_id uuid,
  kelas_nama text,
  kelas_jenis public.jenis_kelas,
  tanggal date,
  hari_rutin text[],
  jam_mulai time,
  jam_selesai time,
  tipe_lokasi public.tipe_lokasi_slot,
  ruangan_id uuid,
  jenis_konflik text            -- 'sensei' | 'ruangan'
)
language sql stable
security definer set search_path = public
as $$
  -- Bentrok sensei
  select e.id, e.sensei_id, e.kelas_id, k.nama_kelas, k.jenis,
         e.tanggal, e.hari_rutin, e.jam_mulai, e.jam_selesai,
         e.tipe_lokasi, e.ruangan_id, 'sensei'::text
  from public.jadwal_slot e
  join public.kelas k on k.id = e.kelas_id
  where (p_slot_id is null or e.id <> p_slot_id)
    and e.status = 'aktif'
    and e.sensei_id = p_sensei_id
    and public.jam_overlap(e.jam_mulai, e.jam_selesai, p_jam_mulai, p_jam_selesai)
    and public.jadwal_dates_intersect(
          e.tanggal, e.hari_rutin, e.berlaku_sampai,
          p_tanggal, p_hari_rutin, p_berlaku_sampai)
  union all
  -- Bentrok ruangan — hanya jika kandidat DAN kandidat-lawan sama-sama
  -- bertipe lokasi 'ruangan' (edge case: kelas perusahaan/rumah tidak ikut)
  select e.id, e.sensei_id, e.kelas_id, k.nama_kelas, k.jenis,
         e.tanggal, e.hari_rutin, e.jam_mulai, e.jam_selesai,
         e.tipe_lokasi, e.ruangan_id, 'ruangan'::text
  from public.jadwal_slot e
  join public.kelas k on k.id = e.kelas_id
  where p_tipe_lokasi = 'ruangan'
    and p_ruangan_id is not null
    and (p_slot_id is null or e.id <> p_slot_id)
    and e.status = 'aktif'
    and e.tipe_lokasi = 'ruangan'
    and e.ruangan_id = p_ruangan_id
    and public.jam_overlap(e.jam_mulai, e.jam_selesai, p_jam_mulai, p_jam_selesai)
    and public.jadwal_dates_intersect(
          e.tanggal, e.hari_rutin, e.berlaku_sampai,
          p_tanggal, p_hari_rutin, p_berlaku_sampai);
$$;

-- ------------------------------------------------------------
-- resolve_jadwal — ekspansi slot one-off + rutin menjadi baris per tanggal
-- konkret dalam rentang [p_from, p_to]. Dipakai timeline, ketersediaan,
-- dan jam mengajar (satu query, tanpa N+1).
-- ------------------------------------------------------------
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
  kelas_id uuid,
  kelas_nama text,
  kelas_jenis public.jenis_kelas,
  tipe_lokasi public.tipe_lokasi_slot,
  ruangan_id uuid,
  ruangan_nama text,
  alamat_tujuan text,
  status public.status_slot,
  keterangan text
)
language sql stable
security definer set search_path = public
as $$
  with dates as (
    select d::date as dt
    from generate_series(p_from, p_to, interval '1 day') as d
  )
  select s.id, d.dt, public.hari_indo(d.dt), s.jam_mulai, s.jam_selesai,
         s.sensei_id, s.kelas_id, k.nama_kelas, k.jenis,
         s.tipe_lokasi, s.ruangan_id, r.nama, s.alamat_tujuan, s.status, s.keterangan
  from public.jadwal_slot s
  join public.kelas k on k.id = s.kelas_id
  left join public.ruangan r on r.id = s.ruangan_id
  join dates d on
       (s.tanggal is not null and s.tanggal = d.dt)
    or (s.hari_rutin is not null
        and public.hari_indo(d.dt) = any(s.hari_rutin)
        and (s.berlaku_sampai is null or d.dt <= s.berlaku_sampai))
  where p_from <= p_to
    and s.status = any(p_status)
    and (p_sensei_id is null or s.sensei_id = p_sensei_id)
    and (p_ruangan_id is null or s.ruangan_id = p_ruangan_id)
  order by d.dt, s.jam_mulai;
$$;

-- ------------------------------------------------------------
-- save_jadwal — sumber kebenaran insert/update jadwal.
-- * SECURITY DEFINER + LOCK TABLE: konsisten walau concurrent (race condition)
-- * Format error: 'KODE|detail' — KODE: JADWAL_CONFLICT (detail = JSON array),
--   SENSEI_NONAKTIF, RUANGAN_NONAKTIF, KELAS_NONAKTIF, VALIDASI
-- ------------------------------------------------------------
create or replace function public.save_jadwal(
  p_id uuid,                    -- NULL = insert
  p_sensei_id uuid,
  p_kelas_id uuid,
  p_tanggal date,
  p_hari_rutin text[],
  p_berlaku_sampai date,
  p_jam_mulai time,
  p_jam_selesai time,
  p_tipe_lokasi public.tipe_lokasi_slot,
  p_ruangan_id uuid,
  p_alamat_tujuan text default null,
  p_status public.status_slot default 'aktif',
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_conflicts jsonb;
  v_count int;
  v_result uuid;
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat menyimpan jadwal';
  end if;

  -- Serialisasi write utk menutup race condition dua admin concurrent
  lock table public.jadwal_slot in share row exclusive mode;

  -- Validasi dasar (mirror CHECK constraints, pesan lebih informatif)
  if p_jam_mulai is null or p_jam_selesai is null then
    raise exception 'VALIDASI|Jam mulai dan selesai wajib diisi';
  end if;
  if p_jam_selesai <= p_jam_mulai then
    raise exception 'VALIDASI|Jam selesai harus setelah jam mulai (kelas tidak melewati tengah malam)';
  end if;
  if (p_tanggal is null) = (p_hari_rutin is null) then
    raise exception 'VALIDASI|Pilih salah satu: tanggal (one-off) atau hari rutin (mingguan)';
  end if;
  if p_tipe_lokasi = 'ruangan' and p_ruangan_id is null then
    raise exception 'VALIDASI|Ruangan wajib dipilih untuk lokasi tipe ruangan';
  end if;
  if p_tipe_lokasi in ('kelas_perusahaan','kelas_rumah') and p_ruangan_id is not null then
    raise exception 'VALIDASI|Kelas perusahaan/rumah tidak memakai ruangan internal';
  end if;

  -- Master data harus aktif
  select count(*) into v_count from public.sensei
   where id = p_sensei_id and is_aktif;
  if v_count = 0 then
    raise exception 'SENSEI_NONAKTIF|Sensei tidak ditemukan atau sudah dinonaktifkan';
  end if;

  select count(*) into v_count from public.kelas
   where id = p_kelas_id and is_aktif;
  if v_count = 0 then
    raise exception 'KELAS_NONAKTIF|Kelas tidak ditemukan atau sudah dinonaktifkan';
  end if;

  if p_tipe_lokasi = 'ruangan' then
    select count(*) into v_count from public.ruangan
     where id = p_ruangan_id and is_aktif;
    if v_count = 0 then
      raise exception 'RUANGAN_NONAKTIF|Ruangan tidak ditemukan atau sudah dinonaktifkan';
    end if;
  end if;

  -- Validasi bentrok (hanya relevan untuk slot aktif)
  if p_status = 'aktif' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'slot_id', c.slot_id,
             'jenis_konflik', c.jenis_konflik,
             'kelas_nama', c.kelas_nama,
             'jam', to_char(c.jam_mulai,'HH24:MI') || '-' || to_char(c.jam_selesai,'HH24:MI'),
             'jadwal', coalesce(
               to_char(c.tanggal, 'DD Mon YYYY'),
               array_to_string(c.hari_rutin, ', ')
             )
           )), '[]'::jsonb)
      into v_conflicts
    from public.find_jadwal_conflicts(
           p_id, p_sensei_id, p_tanggal, p_hari_rutin, p_berlaku_sampai,
           p_jam_mulai, p_jam_selesai, p_tipe_lokasi, p_ruangan_id) c;

    if jsonb_array_length(v_conflicts) > 0 then
      raise exception 'JADWAL_CONFLICT|%', v_conflicts::text;
    end if;
  end if;

  if p_id is null then
    insert into public.jadwal_slot (
      sensei_id, kelas_id, tanggal, hari_rutin, berlaku_sampai,
      jam_mulai, jam_selesai, tipe_lokasi, ruangan_id,
      alamat_tujuan, status, keterangan
    ) values (
      p_sensei_id, p_kelas_id, p_tanggal, p_hari_rutin, p_berlaku_sampai,
      p_jam_mulai, p_jam_selesai, p_tipe_lokasi, p_ruangan_id,
      p_alamat_tujuan, p_status, p_keterangan
    ) returning id into v_result;
  else
    update public.jadwal_slot set
      sensei_id = p_sensei_id,
      kelas_id = p_kelas_id,
      tanggal = p_tanggal,
      hari_rutin = p_hari_rutin,
      berlaku_sampai = p_berlaku_sampai,
      jam_mulai = p_jam_mulai,
      jam_selesai = p_jam_selesai,
      tipe_lokasi = p_tipe_lokasi,
      ruangan_id = p_ruangan_id,
      alamat_tujuan = p_alamat_tujuan,
      status = p_status,
      keterangan = p_keterangan
    where id = p_id
    returning id into v_result;

    if v_result is null then
      raise exception 'VALIDASI|Jadwal tidak ditemukan';
    end if;
  end if;

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- check_jadwal_conflicts — pre-check read-only utk form (UX cepat)
-- ------------------------------------------------------------
create or replace function public.check_jadwal_conflicts(
  p_slot_id uuid,
  p_sensei_id uuid,
  p_tanggal date,
  p_hari_rutin text[],
  p_berlaku_sampai date,
  p_jam_mulai time,
  p_jam_selesai time,
  p_tipe_lokasi public.tipe_lokasi_slot,
  p_ruangan_id uuid
)
returns jsonb
language sql stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot_id', c.slot_id,
           'jenis_konflik', c.jenis_konflik,
           'kelas_nama', c.kelas_nama,
           'kelas_jenis', c.kelas_jenis,
           'jam', to_char(c.jam_mulai,'HH24:MI') || '-' || to_char(c.jam_selesai,'HH24:MI'),
           'jadwal', coalesce(
             to_char(c.tanggal, 'DD Mon YYYY'),
             array_to_string(c.hari_rutin, ', ')
           )
         )), '[]'::jsonb)
  from public.find_jadwal_conflicts(
         p_slot_id, p_sensei_id, p_tanggal, p_hari_rutin, p_berlaku_sampai,
         p_jam_mulai, p_jam_selesai, p_tipe_lokasi, p_ruangan_id) c;
$$;

-- ------------------------------------------------------------
-- check_ketersediaan_sensei — tersedia/tidak per tanggal dlm rentang
-- ------------------------------------------------------------
create or replace function public.check_ketersediaan_sensei(
  p_sensei_id uuid,
  p_from date,
  p_to date,
  p_jam_mulai time default null,
  p_jam_selesai time default null
)
returns table (
  tanggal date,
  hari text,
  tersedia boolean,
  jadwal jsonb
)
language sql stable
security definer set search_path = public
as $$
  with days as (
    select d::date as dt from generate_series(p_from, p_to, interval '1 day') d
  ),
  occupied as (
    select r.tanggal_efektif,
           jsonb_agg(jsonb_build_object(
             'kelas', r.kelas_nama,
             'jam', to_char(r.jam_mulai,'HH24:MI') || '-' || to_char(r.jam_selesai,'HH24:MI'),
             'lokasi', r.tipe_lokasi
           ) order by r.jam_mulai) as items,
           bool_or(
             p_jam_mulai is null or p_jam_selesai is null
             or public.jam_overlap(r.jam_mulai, r.jam_selesai, p_jam_mulai, p_jam_selesai)
           ) as blocks_window
    from public.resolve_jadwal(p_from, p_to, p_sensei_id, null, array['aktif']::public.status_slot[]) r
    group by r.tanggal_efektif
  )
  select days.dt,
         public.hari_indo(days.dt),
         coalesce(not o.blocks_window, true),
         coalesce(o.items, '[]'::jsonb)
  from days
  left join occupied o on o.tanggal_efektif = days.dt
  order by days.dt;
$$;

-- ------------------------------------------------------------
-- hitung_jam_mengajar — agregat jam per sensei dlm satu query (anti N+1)
-- Hanya slot 'aktif' yang dihitung (asumsi #3).
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
  jumlah_sesi int,
  target_jam_minggu numeric
)
language sql stable
security definer set search_path = public
as $$
  select s.id,
         s.nama,
         s.status,
         coalesce(round(sum(
           extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0
         ), 2), 0) as total_jam,
         count(r.slot_id)::int as jumlah_sesi,
         s.target_jam_minggu
  from public.sensei s
  left join public.resolve_jadwal(p_from, p_to, null, null, array['aktif']::public.status_slot[]) r
    on r.sensei_id = s.id
  where s.is_aktif
    and (p_sensei_id is null or s.id = p_sensei_id)
  group by s.id, s.nama, s.status, s.target_jam_minggu
  order by total_jam desc;
$$;

-- ------------------------------------------------------------
-- hitung_jam_per_kelas — breakdown jam per kelas utk profil sensei
-- ------------------------------------------------------------
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
  jumlah_sesi int
)
language sql stable
security definer set search_path = public
as $$
  select r.kelas_id, r.kelas_nama, r.kelas_jenis,
         round(sum(
           extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0
         ), 2) as total_jam,
         count(*)::int as jumlah_sesi
  from public.resolve_jadwal(p_from, p_to, p_sensei_id, null, array['aktif']::public.status_slot[]) r
  group by r.kelas_id, r.kelas_nama, r.kelas_jenis
  order by total_jam desc;
$$;

-- ------------------------------------------------------------
-- count_jadwal_mendatang — guard sebelum hapus/nonaktifkan master data
-- ------------------------------------------------------------
create or replace function public.count_jadwal_mendatang(
  p_sensei_id uuid default null,
  p_ruangan_id uuid default null
)
returns int
language sql stable
security definer set search_path = public
as $$
  select count(*)::int
  from public.jadwal_slot s
  where s.status = 'aktif'
    and (p_sensei_id is null or s.sensei_id = p_sensei_id)
    and (p_ruangan_id is null or s.ruangan_id = p_ruangan_id)
    and (
      s.hari_rutin is not null                        -- rutin = masih berjalan
      or (s.tanggal is not null and s.tanggal >= public.today_wib())
    );
$$;

-- ------------------------------------------------------------
-- nonaktifkan_sensei / nonaktifkan_ruangan — flow aman pengganti delete.
-- Opsi (b): ikut menandai jadwal mendatang jadi 'tidak_aktif'.
-- Riwayat masa lalu TIDAK pernah disentuh.
-- ------------------------------------------------------------
create or replace function public.nonaktifkan_sensei(
  p_sensei_id uuid,
  p_nonaktifkan_jadwal_mendatang boolean default false
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat menonaktifkan sensei';
  end if;

  update public.sensei set is_aktif = false where id = p_sensei_id;
  if not found then
    raise exception 'VALIDASI|Sensei tidak ditemukan';
  end if;

  if p_nonaktifkan_jadwal_mendatang then
    update public.jadwal_slot
       set status = 'tidak_aktif'
     where sensei_id = p_sensei_id
       and status = 'aktif'
       and (hari_rutin is not null or tanggal >= public.today_wib());
  end if;
end;
$$;

create or replace function public.nonaktifkan_ruangan(
  p_ruangan_id uuid,
  p_nonaktifkan_jadwal_mendatang boolean default false
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat menonaktifkan ruangan';
  end if;

  update public.ruangan set is_aktif = false where id = p_ruangan_id;
  if not found then
    raise exception 'VALIDASI|Ruangan tidak ditemukan';
  end if;

  if p_nonaktifkan_jadwal_mendatang then
    update public.jadwal_slot
       set status = 'tidak_aktif'
     where ruangan_id = p_ruangan_id
       and status = 'aktif'
       and (hari_rutin is not null or tanggal >= public.today_wib());
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Trigger defense-in-depth: tolak bentrok bahkan jika ada tulis
-- langsung ke tabel (bypass RPC).
-- ------------------------------------------------------------
create or replace function public.tg_jadwal_slot_conflict_check()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  if new.status <> 'aktif' then
    return new;
  end if;

  select count(*) into v_count
  from public.find_jadwal_conflicts(
         new.id, new.sensei_id, new.tanggal, new.hari_rutin, new.berlaku_sampai,
         new.jam_mulai, new.jam_selesai, new.tipe_lokasi, new.ruangan_id);

  if v_count > 0 then
    raise exception 'JADWAL_CONFLICT|Jadwal bentrok dengan jadwal lain yang sudah ada';
  end if;

  return new;
end;
$$;

create trigger trg_jadwal_slot_conflict
  before insert or update on public.jadwal_slot
  for each row execute function public.tg_jadwal_slot_conflict_check();

-- ------------------------------------------------------------
-- Batasi EXECUTE: hanya authenticated yg boleh memanggil RPC
-- ------------------------------------------------------------
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_authenticated() from public, anon;
revoke all on function public.find_jadwal_conflicts(uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid) from public, anon;
revoke all on function public.resolve_jadwal(date, date, uuid, uuid, public.status_slot[]) from public, anon;
revoke all on function public.save_jadwal(uuid, uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid, text, public.status_slot, text) from public, anon;
revoke all on function public.check_jadwal_conflicts(uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid) from public, anon;
revoke all on function public.check_ketersediaan_sensei(uuid, date, date, time, time) from public, anon;
revoke all on function public.hitung_jam_mengajar(date, date, uuid) from public, anon;
revoke all on function public.hitung_jam_per_kelas(uuid, date, date) from public, anon;
revoke all on function public.count_jadwal_mendatang(uuid, uuid) from public, anon;
revoke all on function public.nonaktifkan_sensei(uuid, boolean) from public, anon;
revoke all on function public.nonaktifkan_ruangan(uuid, boolean) from public, anon;

grant execute on function public.resolve_jadwal(date, date, uuid, uuid, public.status_slot[]) to authenticated;
grant execute on function public.check_jadwal_conflicts(uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid) to authenticated;
grant execute on function public.check_ketersediaan_sensei(uuid, date, date, time, time) to authenticated;
grant execute on function public.hitung_jam_mengajar(date, date, uuid) to authenticated;
grant execute on function public.hitung_jam_per_kelas(uuid, date, date) to authenticated;
grant execute on function public.count_jadwal_mendatang(uuid, uuid) to authenticated;
grant execute on function public.save_jadwal(uuid, uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid, text, public.status_slot, text) to authenticated;
grant execute on function public.nonaktifkan_sensei(uuid, boolean) to authenticated;
grant execute on function public.nonaktifkan_ruangan(uuid, boolean) to authenticated;
