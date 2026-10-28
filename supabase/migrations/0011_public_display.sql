-- Public read-only feed for the lobby/meeting-room display.
-- Deliberately expose only the educator name, date and time; never return
-- class, client, room, address, contact or internal note fields.
create or replace function public.public_display_schedule(
  p_from date,
  p_to date
)
returns table (
  tanggal date,
  jam_mulai time,
  jam_selesai time,
  nama text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_to < p_from
     or p_from < date_trunc('week', now() at time zone 'Asia/Jakarta')::date
     or p_to > date_trunc('week', now() at time zone 'Asia/Jakarta')::date + 6 then
    raise exception 'Rentang display tidak valid';
  end if;

  return query
  select j.tanggal_efektif, j.jam_mulai, j.jam_selesai, j.sensei_efektif_nama
  from public.resolve_jadwal(
    p_from,
    p_to,
    null,
    null,
    array['aktif', 'planning']::public.status_slot[]
  ) as j
  where j.dihitung
    and j.sensei_efektif_nama is not null
  order by j.tanggal_efektif, j.jam_mulai, j.sensei_efektif_nama;
end;
$$;

revoke all on function public.public_display_schedule(date, date) from public;
grant execute on function public.public_display_schedule(date, date) to anon, authenticated;
