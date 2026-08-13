-- ============================================================
-- Jadwal Sensei — Migration 0002: Row Level Security
-- RLS aktif di SEMUA tabel sejak awal (NFR brief).
-- Model: admin = read+write, viewer = read-only.
-- ============================================================

-- Helper: cek apakah user login punya role admin
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: cek user login adalah authenticated (admin atau viewer)
create or replace function public.is_authenticated()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null;
$$;

-- Trigger otomatis membuat profile saat user baru daftar (role default viewer;
-- admin pertama di-promote manual via SQL: update profiles set role='admin' ...)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nama, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nama', split_part(new.email, '@', 1)), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- profiles
-- ============================================================
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (public.is_authenticated() and (id = auth.uid() or public.is_admin()));

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = 'viewer'); -- user tidak bisa self-promote

-- ============================================================
-- cabang
-- ============================================================
alter table public.cabang enable row level security;

create policy "cabang_select_authenticated" on public.cabang
  for select using (public.is_authenticated());

create policy "cabang_write_admin" on public.cabang
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- sensei
-- ============================================================
alter table public.sensei enable row level security;

create policy "sensei_select_authenticated" on public.sensei
  for select using (public.is_authenticated());

create policy "sensei_insert_admin" on public.sensei
  for insert with check (public.is_admin());

create policy "sensei_update_admin" on public.sensei
  for update using (public.is_admin()) with check (public.is_admin());

create policy "sensei_delete_admin" on public.sensei
  for delete using (public.is_admin());

-- ============================================================
-- klien
-- ============================================================
alter table public.klien enable row level security;

create policy "klien_select_authenticated" on public.klien
  for select using (public.is_authenticated());

create policy "klien_insert_admin" on public.klien
  for insert with check (public.is_admin());

create policy "klien_update_admin" on public.klien
  for update using (public.is_admin()) with check (public.is_admin());

create policy "klien_delete_admin" on public.klien
  for delete using (public.is_admin());

-- ============================================================
-- ruangan
-- ============================================================
alter table public.ruangan enable row level security;

create policy "ruangan_select_authenticated" on public.ruangan
  for select using (public.is_authenticated());

create policy "ruangan_insert_admin" on public.ruangan
  for insert with check (public.is_admin());

create policy "ruangan_update_admin" on public.ruangan
  for update using (public.is_admin()) with check (public.is_admin());

create policy "ruangan_delete_admin" on public.ruangan
  for delete using (public.is_admin());

-- ============================================================
-- kelas
-- ============================================================
alter table public.kelas enable row level security;

create policy "kelas_select_authenticated" on public.kelas
  for select using (public.is_authenticated());

create policy "kelas_insert_admin" on public.kelas
  for insert with check (public.is_admin());

create policy "kelas_update_admin" on public.kelas
  for update using (public.is_admin()) with check (public.is_admin());

create policy "kelas_delete_admin" on public.kelas
  for delete using (public.is_admin());

-- ============================================================
-- jadwal_slot
-- ============================================================
alter table public.jadwal_slot enable row level security;

create policy "jadwal_select_authenticated" on public.jadwal_slot
  for select using (public.is_authenticated());

create policy "jadwal_insert_admin" on public.jadwal_slot
  for insert with check (public.is_admin());

create policy "jadwal_update_admin" on public.jadwal_slot
  for update using (public.is_admin()) with check (public.is_admin());

create policy "jadwal_delete_admin" on public.jadwal_slot
  for delete using (public.is_admin());

-- ============================================================
-- Realtime (untuk auto-refresh timeline)
-- ============================================================
alter publication supabase_realtime add table public.jadwal_slot;
alter publication supabase_realtime add table public.sensei;
alter publication supabase_realtime add table public.ruangan;
alter publication supabase_realtime add table public.kelas;
