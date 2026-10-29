-- Delete/archive sensei safely while preserving past schedules.
-- Future one-off slots are disabled, future routine slots are closed at
-- today (so their past occurrences still resolve), and future replacement
-- exceptions are removed. Past slots and exceptions are never changed.
create or replace function public.evaluasi_hapus_master(
  p_tipe text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jumlah_mendatang int := 0;
  v_jumlah_historis int := 0;
  v_exception_mendatang int := 0;
  v_ada_ref bool := false;
  v_pesan text;
  v_aksi text;
  v_hari_ini date;
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat menghapus data master';
  end if;

  if p_tipe not in ('sensei', 'kelas', 'ruangan') then
    raise exception 'VALIDASI|Tipe data tidak dikenal';
  end if;

  if p_tipe = 'sensei' then
    -- Lock the parent row so a concurrent schedule insert cannot add a new
    -- foreign-key reference between the cleanup and the delete decision.
    perform 1 from public.sensei where id = p_id for update;
    if not found then
      raise exception 'VALIDASI|Data tidak ditemukan';
    end if;

    v_hari_ini := public.today_wib();

    select count(*) into v_jumlah_mendatang
    from public.jadwal_slot s
    where s.sensei_id = p_id
      and s.status in ('aktif', 'planning')
      and (
        (s.tanggal is not null and s.tanggal > v_hari_ini)
        or (s.hari_rutin is not null and (s.berlaku_sampai is null or s.berlaku_sampai > v_hari_ini))
      );

    select count(*) into v_exception_mendatang
    from public.jadwal_exception e
    where e.sensei_pengganti_id = p_id
      and e.tanggal > v_hari_ini;

    -- A future one-off has no past occurrence to preserve.
    update public.jadwal_slot
       set status = 'tidak_aktif'
     where sensei_id = p_id
       and status in ('aktif', 'planning')
       and tanggal > v_hari_ini;

    -- A future-starting routine has no historical occurrences. Disable it.
    update public.jadwal_slot
       set status = 'tidak_aktif'
     where sensei_id = p_id
       and status in ('aktif', 'planning')
       and hari_rutin is not null
       and tanggal_mulai > v_hari_ini
       and (berlaku_sampai is null or berlaku_sampai >= tanggal_mulai);

    -- Close an established routine after today instead of changing its
    -- status; resolve_jadwal can then still show its past occurrences.
    update public.jadwal_slot
       set berlaku_sampai = v_hari_ini
     where sensei_id = p_id
       and status in ('aktif', 'planning')
       and hari_rutin is not null
       and (tanggal_mulai is null or tanggal_mulai <= v_hari_ini)
       and (berlaku_sampai is null or berlaku_sampai > v_hari_ini);

    -- A future replacement returns to the original teacher. Preserve all
    -- exceptions dated today or earlier as historical records.
    delete from public.jadwal_exception
     where sensei_pengganti_id = p_id
       and tanggal > v_hari_ini;

    select
      (select count(*) from public.jadwal_slot s
        where s.sensei_id = p_id
          and ((s.tanggal is not null and s.tanggal < v_hari_ini)
            or (s.hari_rutin is not null and (s.tanggal_mulai is null or s.tanggal_mulai < v_hari_ini))))
      +
      (select count(*) from public.jadwal_exception e
        where e.sensei_pengganti_id = p_id and e.tanggal < v_hari_ini)
    into v_jumlah_historis;

    select exists(select 1 from public.jadwal_slot where sensei_id = p_id)
        or exists(select 1 from public.jadwal_exception where sensei_pengganti_id = p_id)
      into v_ada_ref;

    v_jumlah_mendatang := v_jumlah_mendatang + v_exception_mendatang;

    if v_ada_ref then
      update public.sensei set is_aktif = false where id = p_id;
      v_aksi := 'soft';
      v_pesan := format(
        'Sensei dipindahkan ke nonaktif. %s jadwal mendatang dihentikan; jadwal yang sudah berlalu tetap tersimpan untuk pemeriksaan historis.',
        v_jumlah_mendatang
      );
    else
      delete from public.sensei where id = p_id;
      v_aksi := 'hard';
      v_pesan := 'Sensei belum memiliki riwayat jadwal dan telah dihapus permanen.';
    end if;

    return jsonb_build_object(
      'aksi', v_aksi,
      'jumlah_mendatang', v_jumlah_mendatang,
      'jumlah_historis', v_jumlah_historis,
      'pesan', v_pesan
    );
  end if;

  -- Existing kelas and ruangan behavior remains unchanged.
  if p_tipe = 'kelas' then
    select count(*) into v_jumlah_historis from public.jadwal_slot where kelas_id = p_id;
    select count(*) into v_jumlah_mendatang
      from public.jadwal_slot
     where kelas_id = p_id and status = 'aktif'
       and (hari_rutin is not null or (tanggal is not null and tanggal >= public.today_wib()));
    select exists(select 1 from public.kelas where id = p_id) into v_ada_ref;
  else
    select count(*) into v_jumlah_historis from public.jadwal_slot where ruangan_id = p_id;
    select count(*) into v_jumlah_mendatang
      from public.jadwal_slot
     where ruangan_id = p_id and status = 'aktif'
       and (hari_rutin is not null or (tanggal is not null and tanggal >= public.today_wib()));
    select exists(select 1 from public.ruangan where id = p_id) into v_ada_ref;
  end if;

  if not v_ada_ref then
    raise exception 'VALIDASI|Data tidak ditemukan';
  end if;

  if v_jumlah_mendatang > 0 then
    v_aksi := 'block';
    v_pesan := format(
      'Masih dipakai di %s jadwal aktif mendatang. Nonaktifkan atau pindahkan jadwal terkait terlebih dahulu.',
      v_jumlah_mendatang
    );
  elsif v_jumlah_historis > 0 then
    v_aksi := 'soft';
    v_pesan := format(
      'Punya riwayat %s jadwal lama. Data diarsipkan supaya catatan historis tetap utuh.',
      v_jumlah_historis
    );
    if p_tipe = 'kelas' then
      update public.kelas set is_aktif = false, diarsipkan = true where id = p_id;
    else
      update public.ruangan set is_aktif = false where id = p_id;
    end if;
  else
    v_aksi := 'hard';
    v_pesan := 'Belum pernah dipakai di jadwal manapun. Akan dihapus permanen.';
    if p_tipe = 'kelas' then
      delete from public.kelas where id = p_id;
    else
      delete from public.ruangan where id = p_id;
    end if;
  end if;

  return jsonb_build_object(
    'aksi', v_aksi,
    'jumlah_mendatang', v_jumlah_mendatang,
    'jumlah_historis', v_jumlah_historis,
    'pesan', v_pesan
  );
end;
$$;

revoke all on function public.evaluasi_hapus_master(text, uuid) from public, anon;
grant execute on function public.evaluasi_hapus_master(text, uuid) to authenticated;
