-- Read-only, narrowly scoped schedule feed for the public display page.
-- It preserves the timeline's visible labels and colors while omitting
-- addresses, exact rooms, private notes, and exception notes.
create or replace function public.public_display_sensei()
returns table (
  id uuid,
  nama text,
  status public.sensei_status,
  is_aktif boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.nama, s.status, s.is_aktif
  from public.sensei s
  order by s.nama;
$$;

create or replace function public.public_display_timeline(p_from date, p_to date)
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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_from is null or p_to is null or p_to < p_from
     or p_to - p_from > 31
     or p_from < (now() at time zone 'Asia/Jakarta')::date - 366
     or p_to > (now() at time zone 'Asia/Jakarta')::date + 366 then
    raise exception 'Rentang timeline display tidak valid';
  end if;

  return query
  select r.slot_id, r.tanggal_efektif, r.hari, r.jam_mulai, r.jam_selesai,
         r.sensei_id, r.sensei_efektif_id, r.sensei_pengganti_id,
         r.sensei_efektif_nama, r.sensei_pengganti_nama,
         r.kelas_id, r.kelas_nama, r.kelas_jenis, r.tipe_lokasi,
         null::uuid, null::text, null::text,
         r.status, null::text, r.is_rutin,
         null::uuid, null::text, null::text,
         r.is_pengganti, r.dihitung
  from public.resolve_jadwal(
    p_from,
    p_to,
    null,
    null,
    array['aktif', 'planning']::public.status_slot[]
  ) r
  where r.dihitung
    and r.sensei_efektif_nama is not null
  order by r.tanggal_efektif, r.jam_mulai, r.sensei_efektif_nama;
end;
$$;

revoke all on function public.public_display_sensei() from public;
revoke all on function public.public_display_timeline(date, date) from public;
grant execute on function public.public_display_sensei() to anon, authenticated;
grant execute on function public.public_display_timeline(date, date) to anon, authenticated;
