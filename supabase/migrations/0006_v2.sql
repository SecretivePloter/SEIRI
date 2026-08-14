-- ============================================================
-- Jadwal Sensei — Migration 0006 (v2): fitur inti v2
-- 1. kategori_sesi — konfigurasi konversi durasi -> sesi per jenis kelas
--    (tabel konfigurasi, bukan hardcode; admin bisa ubah via UI).
-- 2. kelas.diarsipkan + klien.is_aktif — soft delete kelas/klien
--    (riwayat jam mengajar TIDAK pernah dihapus).
-- 3. jadwal_slot.tanggal_mulai — batas bawah jadwal rutin,
--    berdampingan dengan berlaku_sampai (batas atas).
-- 4. Rekreasi RPC yang terdampak: jadwal_dates_intersect,
--    find_jadwal_conflicts, check_jadwal_conflicts, save_jadwal,
--    resolve_jadwal, hitung_jam_mengajar, hitung_jam_per_kelas,
--    trigger defense-in-depth.
-- 5. RPC baru: arsipkan_kelas, arsipkan_klien, upsert_kategori_sesi.
--
-- Prinsip: ADITIF — tidak ada data yang dihapus/diubah maknanya.
-- jumlah_sesi sekarang PROPORSIONAL: (durasi kelas / durasi aturan) x jumlah_sesi,
-- dibulatkan 2 desimal. Jika aturan jenis belum ada, fallback 1 slot = 1 sesi
-- dan dihitung di kolom slot_tanpa_aturan_sesi agar UI bisa menampilkan catatan.
-- ============================================================

-- ------------------------------------------------------------
-- 1. kategori_sesi
-- ------------------------------------------------------------
create table if not exists public.kategori_sesi (
  jenis public.jenis_kelas primary key,
  durasi_jam numeric(6,2) not null check (durasi_jam > 0),
  jumlah_sesi numeric(6,2) not null default 1 check (jumlah_sesi > 0),
  updated_at timestamptz not null default now()
);

create trigger trg_kategori_sesi_updated_at before update on public.kategori_sesi
  for each row execute function public.set_updated_at();

-- Seed aturan sesi utk seluruh 9 kategori (konfirmasi user):
--   TG, CLT, SSW                     -> 2 jam   = 1 sesi
--   Bimbel, Benkyou Houdai, Semi Private,
--   Grup Kecil, Private, Regular     -> 1,5 jam = 1 sesi
insert into public.kategori_sesi (jenis, durasi_jam, jumlah_sesi) values
  ('CLT', 2.0, 1),
  ('Bimbel', 1.5, 1),
  ('SSW', 2.0, 1),
  ('Private', 1.5, 1),
  ('TG', 2.0, 1),
  ('Benkyou Houdai', 1.5, 1),
  ('Semi Private', 1.5, 1),
  ('Grup Kecil', 1.5, 1),
  ('Regular', 1.5, 1)
on conflict (jenis) do nothing;

-- RLS kategori_sesi: baca utk semua authenticated, tulis hanya admin
alter table public.kategori_sesi enable row level security;

create policy "kategori_sesi_select_authenticated" on public.kategori_sesi
  for select using (public.is_authenticated());

create policy "kategori_sesi_insert_admin" on public.kategori_sesi
  for insert with check (public.is_admin());

create policy "kategori_sesi_update_admin" on public.kategori_sesi
  for update using (public.is_admin()) with check (public.is_admin());

create policy "kategori_sesi_delete_admin" on public.kategori_sesi
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 2. Soft delete: kelas.diarsipkan, klien.is_aktif
-- ------------------------------------------------------------
alter table public.kelas add column if not exists diarsipkan boolean not null default false;
alter table public.klien add column if not exists is_aktif boolean not null default true;

-- ------------------------------------------------------------
-- 3. jadwal_slot.tanggal_mulai (hanya utk jadwal rutin)
-- ------------------------------------------------------------
alter table public.jadwal_slot add column if not exists tanggal_mulai date;

alter table public.jadwal_slot
  add constraint slot_tanggal_mulai_rutin check (
    tanggal_mulai is null or hari_rutin is not null
  );

alter table public.jadwal_slot
  add constraint slot_tanggal_mulai_order check (
    tanggal_mulai is null or berlaku_sampai is null or tanggal_mulai <= berlaku_sampai
  );

-- ------------------------------------------------------------
-- 4. Rekreasi fungsi inti dengan dukungan tanggal_mulai
-- ------------------------------------------------------------
drop trigger if exists trg_jadwal_slot_conflict on public.jadwal_slot;

drop function if exists public.save_jadwal(uuid, uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid, text, public.status_slot, text);
drop function if exists public.check_jadwal_conflicts(uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid);
drop function if exists public.find_jadwal_conflicts(uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid);
drop function if exists public.jadwal_dates_intersect(date, text[], date, date, text[], date);
drop function if exists public.hitung_jam_mengajar(date, date, uuid);
drop function if exists public.hitung_jam_per_kelas(uuid, date, date);
drop function if exists public.tg_jadwal_slot_conflict_check();

-- Irisan dua "modus tanggal" — kini dengan tanggal_mulai di kedua sisi.
create or replace function public.jadwal_dates_intersect(
  a_tanggal date, a_hari_rutin text[], a_tanggal_mulai date, a_berlaku_sampai date,
  b_tanggal date, b_hari_rutin text[], b_tanggal_mulai date, b_berlaku_sampai date
)
returns boolean
language sql immutable as $$
  select case
    when a_tanggal is not null and b_tanggal is not null then
      a_tanggal = b_tanggal
    when a_tanggal is not null and b_hari_rutin is not null then
      public.hari_indo(a_tanggal) = any(b_hari_rutin)
      and (b_tanggal_mulai is null or a_tanggal >= b_tanggal_mulai)
      and (b_berlaku_sampai is null or a_tanggal <= b_berlaku_sampai)
    when a_hari_rutin is not null and b_tanggal is not null then
      public.hari_indo(b_tanggal) = any(a_hari_rutin)
      and (a_tanggal_mulai is null or b_tanggal >= a_tanggal_mulai)
      and (a_berlaku_sampai is null or b_tanggal <= a_berlaku_sampai)
    when a_hari_rutin is not null and b_hari_rutin is not null then
      a_hari_rutin && b_hari_rutin
      -- dua jendela rutin harus benar-benar beririsan di sumbu tanggal
      and (a_berlaku_sampai is null or b_tanggal_mulai is null or a_berlaku_sampai >= b_tanggal_mulai)
      and (b_berlaku_sampai is null or a_tanggal_mulai is null or b_berlaku_sampai >= a_tanggal_mulai)
    else false
  end;
$$;

-- Deteksi bentrok utk sebuah kandidat slot (dipakai save_jadwal,
-- trigger, dan pre-check form).
create or replace function public.find_jadwal_conflicts(
  p_slot_id uuid,               -- id slot yg sedang di-update; NULL utk insert
  p_sensei_id uuid,
  p_tanggal date,
  p_hari_rutin text[],
  p_tanggal_mulai date,
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
          e.tanggal, e.hari_rutin, e.tanggal_mulai, e.berlaku_sampai,
          p_tanggal, p_hari_rutin, p_tanggal_mulai, p_berlaku_sampai)
  union all
  -- Bentrok ruangan — hanya jika kandidat DAN lawan sama-sama 'ruangan'
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
          e.tanggal, e.hari_rutin, e.tanggal_mulai, e.berlaku_sampai,
          p_tanggal, p_hari_rutin, p_tanggal_mulai, p_berlaku_sampai);
$$;

-- Ekspansi slot one-off + rutin menjadi baris per tanggal konkret.
-- Jadwal rutin hanya muncul mulai tanggal_mulai (jika diisi).
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
        and (s.tanggal_mulai is null or d.dt >= s.tanggal_mulai)
        and (s.berlaku_sampai is null or d.dt <= s.berlaku_sampai))
  where p_from <= p_to
    and s.status = any(p_status)
    and (p_sensei_id is null or s.sensei_id = p_sensei_id)
    and (p_ruangan_id is null or s.ruangan_id = p_ruangan_id)
  order by d.dt, s.jam_mulai;
$$;

-- Sumber kebenaran insert/update jadwal (signature baru: + p_tanggal_mulai
-- di akhir, default null, supaya tetap kompatibel dgn aturan parameter
-- Postgres utk default berantai).
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
  p_keterangan text default null,
  p_tanggal_mulai date default null
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
  if p_tanggal_mulai is not null and p_hari_rutin is null then
    raise exception 'VALIDASI|Tanggal mulai hanya berlaku untuk jadwal rutin';
  end if;
  if p_tanggal_mulai is not null and p_berlaku_sampai is not null and p_tanggal_mulai > p_berlaku_sampai then
    raise exception 'VALIDASI|Tanggal mulai tidak boleh setelah tanggal berlaku sampai';
  end if;
  if p_tipe_lokasi = 'ruangan' and p_ruangan_id is null then
    raise exception 'VALIDASI|Ruangan wajib dipilih untuk lokasi tipe ruangan';
  end if;
  if p_tipe_lokasi in ('kelas_perusahaan','kelas_rumah') and p_ruangan_id is not null then
    raise exception 'VALIDASI|Kelas perusahaan/rumah tidak memakai ruangan internal';
  end if;

  -- Master data harus aktif (kelas diarsipkan juga ikut terblokir
  -- karena arsip men-set is_aktif = false)
  select count(*) into v_count from public.sensei
   where id = p_sensei_id and is_aktif;
  if v_count = 0 then
    raise exception 'SENSEI_NONAKTIF|Sensei tidak ditemukan atau sudah dinonaktifkan';
  end if;

  select count(*) into v_count from public.kelas
   where id = p_kelas_id and is_aktif;
  if v_count = 0 then
    raise exception 'KELAS_NONAKTIF|Kelas tidak ditemukan, sudah dinonaktifkan, atau sudah diarsipkan';
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
           p_id, p_sensei_id, p_tanggal, p_hari_rutin, p_tanggal_mulai, p_berlaku_sampai,
           p_jam_mulai, p_jam_selesai, p_tipe_lokasi, p_ruangan_id) c;

    if jsonb_array_length(v_conflicts) > 0 then
      raise exception 'JADWAL_CONFLICT|%', v_conflicts::text;
    end if;
  end if;

  if p_id is null then
    insert into public.jadwal_slot (
      sensei_id, kelas_id, tanggal, hari_rutin, tanggal_mulai, berlaku_sampai,
      jam_mulai, jam_selesai, tipe_lokasi, ruangan_id,
      alamat_tujuan, status, keterangan
    ) values (
      p_sensei_id, p_kelas_id, p_tanggal, p_hari_rutin, p_tanggal_mulai, p_berlaku_sampai,
      p_jam_mulai, p_jam_selesai, p_tipe_lokasi, p_ruangan_id,
      p_alamat_tujuan, p_status, p_keterangan
    ) returning id into v_result;
  else
    update public.jadwal_slot set
      sensei_id = p_sensei_id,
      kelas_id = p_kelas_id,
      tanggal = p_tanggal,
      hari_rutin = p_hari_rutin,
      tanggal_mulai = p_tanggal_mulai,
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

-- Pre-check bentrok read-only utk form (UX cepat)
create or replace function public.check_jadwal_conflicts(
  p_slot_id uuid,
  p_sensei_id uuid,
  p_tanggal date,
  p_hari_rutin text[],
  p_berlaku_sampai date,
  p_jam_mulai time,
  p_jam_selesai time,
  p_tipe_lokasi public.tipe_lokasi_slot,
  p_ruangan_id uuid,
  p_tanggal_mulai date default null
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
         p_slot_id, p_sensei_id, p_tanggal, p_hari_rutin, p_tanggal_mulai, p_berlaku_sampai,
         p_jam_mulai, p_jam_selesai, p_tipe_lokasi, p_ruangan_id) c;
$$;

-- Agregat jam + sesi per sensei.
-- total_jam  : jam mentah 1:1 (tidak berubah maknanya).
-- jumlah_sesi: PROPORSIONAL dari kategori_sesi:
--              (durasi kelas / durasi_jam aturan) x jumlah_sesi aturan.
--              Jika aturan jenis belum ada -> fallback 1 slot = 1 sesi.
-- slot_tanpa_aturan_sesi: jumlah slot yang memakai fallback (utk catatan UI).
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
    select r.sensei_id,
           extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0 as jam,
           case
             when ks.jenis is not null
             then (extract(epoch from (r.jam_selesai - r.jam_mulai)) / 3600.0)
                  * ks.jumlah_sesi / ks.durasi_jam
             else null
           end as sesi
    from public.resolve_jadwal(p_from, p_to, null, null, array['aktif']::public.status_slot[]) r
    left join public.kategori_sesi ks on ks.jenis = r.kelas_jenis
  )
  select s.id,
         s.nama,
         s.status,
         coalesce(round(sum(t.jam), 2), 0) as total_jam,
         coalesce(round(sum(coalesce(t.sesi, 1)), 2), 0) as jumlah_sesi,
         count(case when t.sesi is null then 1 end)::int as slot_tanpa_aturan_sesi,
         s.target_jam_minggu
  from public.sensei s
  left join slot_stats t on t.sensei_id = s.id
  where s.is_aktif
    and (p_sensei_id is null or s.id = p_sensei_id)
  group by s.id, s.nama, s.status, s.target_jam_minggu
  order by total_jam desc;
$$;

-- Breakdown jam + sesi per kelas utk profil sensei (makna sesi sama
-- seperti hitung_jam_mengajar).
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
-- 5. RPC baru v2
-- ------------------------------------------------------------

-- Arsip kelas (soft delete): tandai diarsipkan + nonaktifkan, opsional
-- ikut menonaktifkan jadwal mendatang. Riwayat TIDAK pernah disentuh.
create or replace function public.arsipkan_kelas(
  p_kelas_id uuid,
  p_nonaktifkan_jadwal_mendatang boolean default false
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat mengarsipkan kelas';
  end if;

  update public.kelas set diarsipkan = true, is_aktif = false
   where id = p_kelas_id;
  if not found then
    raise exception 'VALIDASI|Kelas tidak ditemukan';
  end if;

  if p_nonaktifkan_jadwal_mendatang then
    update public.jadwal_slot
       set status = 'tidak_aktif'
     where kelas_id = p_kelas_id
       and status = 'aktif'
       and (hari_rutin is not null or tanggal >= public.today_wib());
  end if;
end;
$$;

-- Arsip klien (soft delete): tandai nonaktif, opsional ikut
-- menonaktifkan jadwal mendatang dari semua kelas milik klien ini.
create or replace function public.arsipkan_klien(
  p_klien_id uuid,
  p_nonaktifkan_jadwal_mendatang boolean default false
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat mengarsipkan klien';
  end if;

  update public.klien set is_aktif = false where id = p_klien_id;
  if not found then
    raise exception 'VALIDASI|Klien tidak ditemukan';
  end if;

  if p_nonaktifkan_jadwal_mendatang then
    update public.jadwal_slot
       set status = 'tidak_aktif'
     where kelas_id in (select id from public.kelas where klien_id = p_klien_id)
       and status = 'aktif'
       and (hari_rutin is not null or tanggal >= public.today_wib());
  end if;
end;
$$;

-- Upsert aturan sesi per jenis kelas (dipakai tab "Aturan Sesi" di Admin).
create or replace function public.upsert_kategori_sesi(
  p_jenis public.jenis_kelas,
  p_durasi_jam numeric,
  p_jumlah_sesi numeric default 1
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat mengubah aturan sesi';
  end if;
  if p_durasi_jam is null or p_durasi_jam <= 0 then
    raise exception 'VALIDASI|Durasi jam harus lebih dari 0';
  end if;
  if p_jumlah_sesi is null or p_jumlah_sesi <= 0 then
    raise exception 'VALIDASI|Jumlah sesi harus lebih dari 0';
  end if;

  insert into public.kategori_sesi (jenis, durasi_jam, jumlah_sesi)
  values (p_jenis, p_durasi_jam, p_jumlah_sesi)
  on conflict (jenis) do update
    set durasi_jam = excluded.durasi_jam,
        jumlah_sesi = excluded.jumlah_sesi;
end;
$$;

-- ------------------------------------------------------------
-- Trigger defense-in-depth (versi baru, ikut membawa tanggal_mulai)
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
         new.id, new.sensei_id, new.tanggal, new.hari_rutin,
         new.tanggal_mulai, new.berlaku_sampai,
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
-- Hak eksekusi RPC (per-signature: signature berubah -> grant diulang)
-- ------------------------------------------------------------
revoke all on function public.jadwal_dates_intersect(date, text[], date, date, date, text[], date, date) from public, anon;
revoke all on function public.find_jadwal_conflicts(uuid, uuid, date, text[], date, date, time, time, public.tipe_lokasi_slot, uuid) from public, anon;
revoke all on function public.save_jadwal(uuid, uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid, text, public.status_slot, text, date) from public, anon;
revoke all on function public.check_jadwal_conflicts(uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid, date) from public, anon;
revoke all on function public.hitung_jam_mengajar(date, date, uuid) from public, anon;
revoke all on function public.hitung_jam_per_kelas(uuid, date, date) from public, anon;
revoke all on function public.arsipkan_kelas(uuid, boolean) from public, anon;
revoke all on function public.arsipkan_klien(uuid, boolean) from public, anon;
revoke all on function public.upsert_kategori_sesi(public.jenis_kelas, numeric, numeric) from public, anon;

grant execute on function public.check_jadwal_conflicts(uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid, date) to authenticated;
grant execute on function public.hitung_jam_mengajar(date, date, uuid) to authenticated;
grant execute on function public.hitung_jam_per_kelas(uuid, date, date) to authenticated;
grant execute on function public.save_jadwal(uuid, uuid, uuid, date, text[], date, time, time, public.tipe_lokasi_slot, uuid, text, public.status_slot, text, date) to authenticated;
grant execute on function public.arsipkan_kelas(uuid, boolean) to authenticated;
grant execute on function public.arsipkan_klien(uuid, boolean) to authenticated;
grant execute on function public.upsert_kategori_sesi(public.jenis_kelas, numeric, numeric) to authenticated;

-- Realtime utk kategori_sesi tidak perlu (tab aturan sesi reload manual).
