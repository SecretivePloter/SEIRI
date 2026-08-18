-- ============================================================
-- Jadwal Sensei — Migration 0007 (v2): Ketersediaan Sensei berbasis GAP
--
-- Tujuan: mengganti logika & tampilan "Ketersediaan Sensei" supaya
-- menampilkan SLOT KOSONG (gap) per hari, bukan sekadar flag tersedia/terisi.
--
-- Perubahan:
-- 1. Tabel `settings` (key/value) utk jam operasional & ambang gap minimum
--    (configurable di DB, bukan hardcode di banyak tempat di kode).
--    Default: 08:00-20:00, ambang 15 menit. Admin bisa ubah tanpa ubah kode.
-- 2. Helper `get_setting(_key)` -> fallback default bila baris belum ada.
-- 3. Helper konversi waktu (menit <-> "HH:MM").
-- 4. Tulis ulang RPC `check_ketersediaan_sensei`:
--    - per tanggal, ambil jadwal aktif sensei (via resolve_jadwal, WIB),
--      urut jam_mulai, hitung gap sebelum/antar/sesudah jadwal dalam
--      jendela operasional (yang sudah dipotong jendela jam opsional form).
--    - abaikan gap < ambang minimum.
--    - return per tanggal: status_ketersediaan 'kosong'|'parsial'|'penuh',
--      total_menit_kosong, dan daftar gap.
--
-- PRINSIP: ADITIF + tidak menghapus data. Migration terpisah dari kode app.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel settings
-- ------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

comment on table public.settings is
  'Konfigurasi aplikasi key/value. Dipakai jam operasional ketersediaan dll.';

-- RLS settings: baca utk semua authenticated, tulis hanya admin
alter table public.settings enable row level security;

create policy "settings_select_authenticated" on public.settings
  for select using (public.is_authenticated());

create policy "settings_insert_admin" on public.settings
  for insert with check (public.is_admin());

create policy "settings_update_admin" on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

create policy "settings_delete_admin" on public.settings
  for delete using (public.is_admin());

-- Nilai default (opsional; RPC punya fallback bila baris ini dihapus)
insert into public.settings (key, value) values
  ('jam_buka_operasional',  '08:00'),
  ('jam_tutup_operasional', '20:00'),
  ('min_gap_menit',         '15')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 2. Helper get_setting — baca settings dgn fallback default
-- ------------------------------------------------------------
create or replace function public.get_setting(p_key text)
returns text
language sql stable
security definer set search_path = public
as $$
  select coalesce(
    (select s.value from public.settings s where s.key = p_key),
    case p_key
      when 'jam_buka_operasional'  then '08:00'
      when 'jam_tutup_operasional' then '20:00'
      when 'min_gap_menit'         then '15'
      else null
    end
  );
$$;

-- ------------------------------------------------------------
-- 3. Helper konversi waktu: "HH:MM" <-> menit
-- ------------------------------------------------------------
create or replace function public.time_text_to_minutes(p_t text)
returns int
language sql immutable
as $$
  select split_part(p_t, ':', 1)::int * 60 + split_part(p_t, ':', 2)::int;
$$;

create or replace function public.minutes_to_time_text(p_m int)
returns text
language sql immutable
as $$
  select lpad((greatest(p_m,0) / 60)::text, 2, '0') || ':' || lpad((greatest(p_m,0) % 60)::text, 2, '0');
$$;

-- ============================================================
-- 4. RPC check_ketersediaan_sensei — versi GAP
--
-- ⚠️ Return type berbeda dari versi 0003 (OUT params). `create or replace`
-- tidak bisa mengubah return type (error 42P13), jadi DROP dulu signature
-- lama, lalu create ulang.
-- ============================================================
drop function if exists public.check_ketersediaan_sensei(uuid, date, date, time without time zone, time without time zone);

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
  status_ketersediaan text,     -- 'kosong' | 'parsial' | 'penuh'
  total_menit_kosong int,       -- total menit kosong (sum gap)
  gap jsonb                     -- array {mulai, selesai, menit}
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_buka  int := public.time_text_to_minutes(public.get_setting('jam_buka_operasional'));
  v_tutup int := public.time_text_to_minutes(public.get_setting('jam_tutup_operasional'));
  v_min_gap int := greatest(coalesce(nullif(public.get_setting('min_gap_menit'), '')::int, 15), 0);
  r record;                 -- satu hari dalam rentang
begin
  -- Klip jendela operasional dengan jendela jam opsional dari form.
  if p_jam_mulai is not null then
    v_buka := greatest(v_buka, public.time_text_to_minutes(to_char(p_jam_mulai, 'HH24:MI')));
  end if;
  if p_jam_selesai is not null then
    v_tutup := least(v_tutup, public.time_text_to_minutes(to_char(p_jam_selesai, 'HH24:MI')));
  end if;

  -- Jendela tak valid -> semua hari berstatus 'penuh' dgn gap kosong
  if v_tutup <= v_buka then
    for r in
      select g::date as dt from generate_series(p_from, p_to, interval '1 day') g
    loop
      tanggal := r.dt;
      hari := public.hari_indo(r.dt);
      status_ketersediaan := 'penuh';
      total_menit_kosong := 0;
      gap := '[]'::jsonb;
      return next;
    end loop;
    return;
  end if;

  for r in
    select g::date as dt from generate_series(p_from, p_to, interval '1 day') g
  loop
    declare
      cursor_m int := v_buka;   -- ujung jadwal yg sudah diproses (menit)
      v_gaps jsonb := '[]'::jsonb;
      v_any_slot boolean := false;
      j record;
    begin
      -- Iterasi jadwal aktif sensei di tanggal ini (rutin ter-ekspansi WIB)
      for j in
        select r2.jam_mulai, r2.jam_selesai
        from public.resolve_jadwal(r.dt, r.dt, p_sensei_id, null, array['aktif']::public.status_slot[]) r2
        order by r2.jam_mulai
      loop
        declare
          jm int := greatest(public.time_text_to_minutes(substr(j.jam_mulai::text, 1, 5)), v_buka);
          js int := least(public.time_text_to_minutes(substr(j.jam_selesai::text, 1, 5)), v_tutup);
          d int;
        begin
          if js <= jm then
            continue; -- di luar jendela operasional, tak berkontribusi
          end if;
          -- Jadwal yang sudah tercakup cursor_m (overlap/berimpit)
          -- tidak boleh menghasilkan gap negatif; potong mulai ke ujung kursori.
          jm := greatest(jm, cursor_m);
          if js <= jm then
            continue;
          end if;
          v_any_slot := true;
          d := jm - cursor_m;
          if d >= v_min_gap then
            v_gaps := v_gaps || jsonb_build_object(
              'mulai', public.minutes_to_time_text(cursor_m),
              'selesai', public.minutes_to_time_text(jm),
              'menit', d);
          end if;
          cursor_m := greatest(cursor_m, js);
        end;
      end loop;

      -- Gap setelah jadwal terakhir sampai jam tutup
      if v_tutup - cursor_m >= v_min_gap then
        v_gaps := v_gaps || jsonb_build_object(
          'mulai', public.minutes_to_time_text(cursor_m),
          'selesai', public.minutes_to_time_text(v_tutup),
          'menit', v_tutup - cursor_m);
      end if;

      tanggal := r.dt;
      hari := public.hari_indo(r.dt);

      if not v_any_slot then
        -- Tidak ada jadwal -> seluruh jendela kosong ("Tersedia sepanjang hari")
        status_ketersediaan := 'kosong';
        total_menit_kosong := v_tutup - v_buka;
        gap := jsonb_build_array(jsonb_build_object(
          'mulai', public.minutes_to_time_text(v_buka),
          'selesai', public.minutes_to_time_text(v_tutup),
          'menit', v_tutup - v_buka));
      elsif jsonb_array_length(v_gaps) = 0 then
        -- Ada jadwal, tak ada gap yang lolos ambang -> "Tidak tersedia"
        status_ketersediaan := 'penuh';
        total_menit_kosong := 0;
        gap := '[]'::jsonb;
      else
        status_ketersediaan := 'parsial';
        total_menit_kosong :=
          (select coalesce(sum((x->>'menit')::int), 0) from jsonb_array_elements(v_gaps) x);
        gap := v_gaps;
      end if;
      return next;
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Hak eksekusi (per-signature)
-- ------------------------------------------------------------
revoke all on function public.get_setting(text) from public, anon;
revoke all on function public.time_text_to_minutes(text) from public, anon;
revoke all on function public.minutes_to_time_text(int) from public, anon;
revoke all on function public.check_ketersediaan_sensei(uuid, date, date, time, time) from public, anon;

grant execute on function public.get_setting(text) to authenticated;
grant execute on function public.time_text_to_minutes(text) to authenticated;
grant execute on function public.minutes_to_time_text(int) to authenticated;
grant execute on function public.check_ketersediaan_sensei(uuid, date, date, time, time) to authenticated;