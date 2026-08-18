-- ============================================================
-- Jadwal Sensei — Migration 0008 (v2): HAPUS DATA MASTER yang AMAN
--
-- Fitur: tombol hapus sensei/kelas/ruangan di halaman Admin dengan modal
-- konfirmasi. Sistem menentukan otomatis 3 kondisi:
--   (a) 'hard'  — belum pernah dipakai jadwal manapun (salah input murni)
--                 -> HARD DELETE baris (FK RESTRICT terpenuhi karena 0 ref).
--   (b) 'soft'  — punya riwayat jadwal (historis), TIDAK ada jadwal aktif
--                 mendatang -> SOFT DELETE (flag nonaktif/arsip), riwayat
--                 laporan jam mengajar & penggajian tetap utuh.
--   (c) 'block' — masih dipakai jadwal aktif MENDATANG (one-off >= hari ini
--                 atau rutin yang masih berlaku) -> TOLAK hapus, arahkan
--                 nonaktifkan/master jadwal dulu.
--
-- PRINSIP: ADITIF. Tidak menghapus data; hanya menambah fungsi & RPC.
-- ============================================================

-- ------------------------------------------------------------
-- 1. RPC evaluasi_hapus_master
--    Menghitung konteks hapus & MELAKUKAN hapus bila aman.
--    Return: { aksi, jumlah_mendatang, jumlah_historis, pesan }
-- ------------------------------------------------------------
create or replace function public.evaluasi_hapus_master(
  p_tipe text,          -- 'sensei' | 'kelas' | 'ruangan'
  p_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_jumlah_mendatang int := 0;
  v_jumlah_historis int := 0;
  v_ada_ref bool := false;
  v_pesan text;
  v_aksi text;
begin
  if not public.is_admin() then
    raise exception 'VALIDASI|Hanya admin yang dapat menghapus data master';
  end if;

  -- Validasi tipe
  if p_tipe not in ('sensei','kelas','ruangan') then
    raise exception 'VALIDASI|Tipe data tidak dikenal';
  end if;

  -- Hitung referensi jadwal
  if p_tipe = 'sensei' then
    select count(*) into v_jumlah_historis
      from public.jadwal_slot where sensei_id = p_id;
    select count(*) into v_jumlah_mendatang
      from public.jadwal_slot
     where sensei_id = p_id and status = 'aktif'
       and (hari_rutin is not null
            or (tanggal is not null and tanggal >= public.today_wib()));
    select exists(select 1 from public.sensei where id = p_id) into v_ada_ref;
  elsif p_tipe = 'kelas' then
    select count(*) into v_jumlah_historis
      from public.jadwal_slot where kelas_id = p_id;
    select count(*) into v_jumlah_mendatang
      from public.jadwal_slot
     where kelas_id = p_id and status = 'aktif'
       and (hari_rutin is not null
            or (tanggal is not null and tanggal >= public.today_wib()));
    select exists(select 1 from public.kelas where id = p_id) into v_ada_ref;
  else -- ruangan
    select count(*) into v_jumlah_historis
      from public.jadwal_slot where ruangan_id = p_id;
    select count(*) into v_jumlah_mendatang
      from public.jadwal_slot
     where ruangan_id = p_id and status = 'aktif'
       and (hari_rutin is not null
            or (tanggal is not null and tanggal >= public.today_wib()));
    select exists(select 1 from public.ruangan where id = p_id) into v_ada_ref;
  end if;

  if not v_ada_ref then
    raise exception 'VALIDASI|Data tidak ditemukan';
  end if;

  if v_jumlah_mendatang > 0 then
    -- Kondisi (c): masih dipakai ke depan -> blokir
    v_aksi := 'block';
    v_pesan := format(
      'Masih dipakai di %s jadwal aktif mendatang. Tidak bisa dihapus sebelum jadwal terkait diselesaikan. Nonaktifkan data ini atau pindahkan/hapus jadwalnya dulu.',
      v_jumlah_mendatang);
  elsif v_jumlah_historis > 0 then
    -- Kondisi (b): punya riwayat -> soft delete
    v_aksi := 'soft';
    v_pesan := format(
      'Punya riwayat %s jadwal lama. Akan diarsipkan (bukan dihapus permanen) supaya laporan jam mengajar & penggajian tetap utuh.',
      v_jumlah_historis);
    -- Eksekusi soft delete sesuai tipe
    if p_tipe = 'sensei' then
      update public.sensei set is_aktif = false where id = p_id;
    elsif p_tipe = 'kelas' then
      update public.kelas set is_aktif = false, diarsipkan = true where id = p_id;
    else
      update public.ruangan set is_aktif = false where id = p_id;
    end if;
  else
    -- Kondisi (a): belum pernah dipakai -> hard delete
    v_aksi := 'hard';
    v_pesan := 'Belum pernah dipakai di jadwal manapun. Akan dihapus permanen.';
    if p_tipe = 'sensei' then
      delete from public.sensei where id = p_id;
    elsif p_tipe = 'kelas' then
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

-- Hak eksekusi
revoke all on function public.evaluasi_hapus_master(text, uuid) from public, anon;
grant execute on function public.evaluasi_hapus_master(text, uuid) to authenticated;
