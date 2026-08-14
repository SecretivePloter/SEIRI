# KONTEKS — Jadwal Sensei (PT Ichikara)

> **File ini adalah handoff document.** Tujuannya: model AI lain yang melanjutkan
> proyek ini bisa memahami seluruh konteks tanpa perlu membaca riwayat percakapan.
> Baca file ini DULU sebelum mengubah apapun. Terakhir diperbarui: 2026-08-14 (v2).

---

## 1. Apa Proyek Ini

**Jadwal Sensei** = aplikasi web produksi pengganti sistem jadwal manual Excel
(3 sheet: master sensei, jadwal bimbel, timeline manual) di lembaga kursus
bahasa Jepang PT Ichikara.

**Masalah yang diselesaikan:**
1. Jadwal sering bentrok — bentrok sensei (1 sensei dijadwalkan 2 kelas di jam
   sama) dan bentrok ruangan (2 kelas di ruangan sama di jam sama).
2. Admin tidak punya cara cepat mengecek ketersediaan sensei.
3. Timeline harian digambar manual; total jam mengajar dihitung manual.

**Solusi:** jadwal = single source of truth. Admin input sekali → sistem otomatis
menampilkan timeline visual, memvalidasi bentrok (sensei + ruangan) di server,
menghitung ketersediaan & jam mengajar real-time.

**Lokasi mengajar (3 tipe):**
- `ruangan` — ruangan internal: Besar, Haru, Aki, Natsu, Fuyu 1, Fuyu 2.
- `kelas_perusahaan` — kantor klien.
- `kelas_rumah` — rumah murid.

---

## 2. KEPUTUSAN TERKUNCI (jangan diubah tanpa konfirmasi ke user)

| # | Keputusan | Detail |
|---|-----------|--------|
| 1 | Deployment standalone | Aplikasi terpisah dengan Supabase project sendiri (bukan modul app.ichikara.co.id). |
| 2 | Tidak ada "force delete" master | Sensei/ruangan/kelas dengan jadwal aktif TIDAK dihapus permanen. Opsi: (a) nonaktifkan `is_aktif=false`, atau (b) nonaktifkan + tandai semua jadwal mendatang jadi `tidak_aktif` via checkbox di ConfirmDialog. Riwayat masa lalu selalu dipertahankan. |
| 3 | Jam mengajar hanya dari slot `status='aktif'` | `planning` tidak dihitung tapi tampil di timeline dengan warna pudar. |
| 4 | Tidak ada kelas lintas tengah malam | Constraint DB: `jam_selesai > jam_mulai` (hari sama). Shift malam lintas hari = out of scope v1. |
| 5 | Auth v1 | Hanya `admin` (email+password Supabase) yang menulis; role `viewer` read-only ada di skema tapi UI login sensei belum dibangun. |
| 6 | Timezone | SEMUA perhitungan jam berbasis WIB (Asia/Jakarta). DB menyimpan wall-clock WIB. |
| 7 | Semantik ketersediaan tanpa jendela jam | Jika `jam_mulai`/`jam_selesai` kosong, hari dianggap **tidak tersedia** bila ada jadwal apa pun hari itu ("hari kosong penuh"). Semua tanggal dalam rentang TETAP muncul di hasil (via `generate_series`), termasuk hari libur/tanggal merah tanpa jadwal — tetap `tersedia=true`. |
| 8 | Bootstrap admin pertama | Role default = `viewer`; admin pertama di-set MANUAL via SQL Editor Supabase (`update public.profiles set role='admin' where email='...'`). Self-promotion diblokir trigger — by design. |

---

## 3. Tech Stack

| Layer | Teknologi | Versi | Catatan |
|-------|-----------|-------|---------|
| UI | React | ^18.3.1 | |
| Build | Vite | ^5.4.8 | `npm run dev` / `build` / `typecheck` (`tsc -b --noEmit`) |
| Styling | Tailwind CSS | ^3.4.13 | Konfigurasi di `tailwind.config.ts`. ⚠️ Class dinamis TIDAK digenerate — gunakan object lookup statis (contoh: `jenisStyles` di `Badge.tsx`). |
| State | Zustand | ^4.5.5 | 3 store: `authStore`, `timelineStore`, `toastStore`. |
| Routing | React Router v6 | ^6.26.2 | Data router (`createBrowserRouter`) terpusat di `src/app/Router.tsx`. |
| Backend | Supabase | — | PostgreSQL + Auth + RLS + Realtime + RPC functions. |
| DB client | @supabase/supabase-js | **2.45.4 (pinned)** | ⚠️ JANGAN di-bump — Node v20.12.2 compat. |
| Chart | Recharts | ^2.12.7 | Dashboard jam mengajar. |
| Validasi | Zod | ^3.23.8 | Validasi form client-side. |
| Bahasa | TypeScript | ^5.5.4 | Strict, path alias `@/` → `src/`. |

**Env vars** (jangan pernah hardcode): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
di `.env.local` (salin dari `.env.example` jika ada). Ketidakadaan env = app
throw saat startup dengan pesan jelas (`src/lib/supabase/client.ts`).

---

## 4. Arsitektur — Aturan Wajib (NFR dari project brief)

1. **Semua query Supabase lewat satu service layer `src/lib/api/*.ts`.**
   Komponen TIDAK boleh memanggil `supabase` client langsung. Satu-satunya
   pengecualian: `src/stores/authStore.ts` (subscribe auth state) dan file
   `src/lib/api/*` itu sendiri.
2. **Semua TULIS jadwal lewat RPC `save_jadwal`** — tidak pernah insert/update
   langsung ke tabel `jadwal_slot`, supaya validasi bentrok konsisten saat
   concurrent. Baca rentang tanggal lewat RPC `resolve_jadwal`.
3. **Validasi ganda:** Zod di client (UX cepat) + RPC/constraint di server
   (sumber kebenaran).
4. **RLS aktif di semua tabel** sejak migration awal.
5. **WIB everywhere:** gunakan `todayWIB()`/`nowTimeWIB()` dari `src/lib/time`,
   dan `today_wib()` di SQL. Jangan pernah pakai `new Date()` lokal untuk
   "hari ini" atau `current_date` di SQL.
6. **Overlap = pertidaksamaan KETAT** (`a_mulai < b_selesai AND b_mulai < a_selesai`).
   Bersentuhan di batas (selesai 14:00, mulai 14:00) = VALID, bukan bentrok.
   ⚠️ Jangan pernah "memperbaiki" jadi `<=`.

---

## 5. Struktur Folder & Fungsi Tiap File

```
SEIRI/
├─ index.html                     # Entry HTML, mount #root
├─ package.json                   # deps + scripts (dev/build/preview/typecheck)
├─ vite.config.ts                 # alias @/ → src/
├─ tailwind.config.ts             # token warna (surface/on-surface/primary/dst)
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json  # TS strict config
├─ postcss.config.js              # tailwind + autoprefixer
├─ dist/                          # output build (abaikan)
├─ supabase/                      # SEMUA SQL terpisah dari kode aplikasi
│  ├─ migrations/
│  │  ├─ 0001_schema.sql          # Tipe enum + 7 tabel + CHECK constraints + index
│  │  ├─ 0002_rls.sql             # RLS semua tabel + helper is_admin/is_authenticated
│  │  │                           #   + trigger handle_new_user + publikasi realtime
│  │  ├─ 0003_functions.sql       # 15 function (lihat §6) + trigger anti-bypass
│  │  ├─ 0004_seed.sql            # Data contoh (ruangan, sensei, klien, kelas, jadwal)
│  │  ├─ 0005_v2_jenis_kelas.sql  # v2: enum jenis_kelas + 5 kategori (TG, Benkyou
│  │  │                           #   Houdai, Semi Private, Grup Kecil, Regular)
│  │  │                           #   ⚠️ file TERPISAH (ADD VALUE tidak boleh di txn
│  │  │                           #   yang sama dengan pengguna enum)
│  │  └─ 0006_v2.sql              # v2: kategori_sesi, soft delete kelas/klien,
│  │                              #   jadwal_slot.tanggal_mulai, rekreasi RPC
│  │                              #   (tanggal_mulai-aware), arsipkan_*,
│  │                              #   upsert_kategori_sesi (lihat §6 + §14)
│  └─ tests/
│     └─ conflict_scenarios.sql   # Skenario uji bentrok manual (do-style asserts)
├─ cek_ketersediaan_sensei_jadwal_sensei/      # ⚠️ Sisa prototype UI (screenshot
├─ daftar_kelas_aktif_jadwal_sensei/           #    hasil desain AI Stitch). Referensi
├─ dashboard_jam_mengajar_jadwal_sensei/       #    visual saja — TIDAK dipakai build.
├─ form_input_jadwal_cerdas_jadwal_sensei/     #    Jangan diedit, jangan dihapus
├─ halaman_admin_manajemen_data/               #    sebelum user mengizinkan.
├─ profil_sensei_tanaka_sensei/
├─ sensei_scheduler/
├─ timeline_ruangan_jadwal_sensei/
├─ timeline_view_with_3_row_schedule_blocks_jadwal_sensei/
└─ src/
   ├─ main.tsx                    # Bootstrap React + RouterProvider + init auth
   ├─ index.css                   # Tailwind directives + token dasar
   ├─ vite-env.d.ts               # Typing ImportMetaEnv utk VITE_SUPABASE_*
   ├─ app/
   │  ├─ Router.tsx               # Semua route terpusat (lihat §7)
   │  ├─ LoginPage.tsx            # Login email+password (admin/viewer)
   │  ├─ RequireAuth.tsx          # Guard: redirect ke /login jika belum login
   │  └─ useAsyncData.ts          # Hook generik {data, loading, error, reload}
   │                              #   — dipakai semua halaman utk loading/error state
   ├─ components/
   │  ├─ layout/
   │  │  ├─ AppShell.tsx          # Sidebar + TopBar + konten + MobileDrawer (mobile)
   │  │  ├─ Sidebar.tsx           # Nav utama (reuse di semua halaman)
   │  │  ├─ MobileDrawer.tsx      # Drawer nav utk mobile (md:hidden, hamburger)
   │  │  ├─ TopBar.tsx            # Judul halaman + info user + ModeTabs/PeriodNav
   │  │  └─ RouteErrorBoundary.tsx# Error boundary per-route (crash lokal ≠ app mati)
   │  └─ ui/                      # Reusable primitives (jangan duplikasi di feature)
   │     ├─ Badge.tsx             # Badge jenis kelas/lokasi/status; ⚠️ static lookup
   │     │                        #   (jenisStyles kini 9 kategori)
   │     ├─ Button.tsx            # Varian primary/secondary/ghost/danger + loading
   │     ├─ ConfirmDialog.tsx     # Modal konfirmasi; mendukung checkbox ekstra
   │     │                        #   (dipakai utk "nonaktifkan + jadwal mendatang")
   │     ├─ DataTable.tsx         # Tabel generik + empty state
   │     ├─ Icon.tsx              # Ikon inline SVG
   │     ├─ Input.tsx             # Input/Select/TextArea/Field (label + error)
   │     ├─ Modal.tsx             # Modal generik
   │     ├─ MultiSelect.tsx       # v2: filter multi-select dropdown
   │     ├─ StatCard.tsx          # Kartu angka dashboard
   │     ├─ States.tsx            # LoadingSpinner / ErrorState / EmptyState (reuse)
   │     └─ Toast.tsx             # Renderer toast dari toastStore
   ├─ stores/
   │  ├─ authStore.ts             # Profile + role user login; hook `useIsAdmin()`
   │  ├─ timelineStore.ts         # Filter timeline: mode/anchorDate/jenis/search
   │  └─ toastStore.ts            # Queue toast + helper `toast.success/error/info`
   ├─ features/
   │  ├─ timeline/
   │  │  ├─ TimelinePage.tsx      # Grid sensei × jam (today/weekly/monthly) + filter
   │  │  ├─ TimelineRuanganPage.tsx# Grid ruangan × jam
   │  │  ├─ TimelineGrid.tsx      # Mesin grid generik (baris = sensei/ruangan)
   │  │  │                        #   kolom label sticky utk scroll horizontal mobile
   │  │  ├─ ScheduleBlock.tsx     # Blok jadwal berwarna (reuse di timeline,
   │  │  │                        #   profil sensei, modal detail)
   │  │  │                        #   ⚠️ font adaptif: ResizeObserver → data-size
   │  │  │                        #   (s/m/l) → CSS di index.css (v2 poin 8)
   │  │  ├─ JadwalDetailModal.tsx # Klik blok → detail + ubah status/hapus
   │  │  └─ useResolvedJadwal.ts  # Hook: fetch resolve_jadwal utk rentang aktif
   │  ├─ jadwal/
   │  │  ├─ JadwalListPage.tsx    # Daftar semua slot mentah + filter + aksi
   │  │  └─ FormInputJadwal.tsx   # Form input/edit; pre-check bentrok debounced
   │  │                           #   via check_jadwal_conflicts sebelum submit
   │  │                           #   (v2: field "Tanggal mulai" utk jadwal rutin)
   │  ├─ lobby/
   │  │  ├─ LobbyDisplayPage.tsx  # v2: signage TV lobby full-screen (read-only),
   │  │  │                        #   TANPA sidebar; header WIB + JP; sedang/selanjutnya
   │  │  └─ useLobbyData.ts       # v2: data hari ini + Realtime channel auto-refresh
   │  ├─ ketersediaan/
   │  │  └─ KetersediaanPage.tsx  # Cek ketersediaan sensei per rentang tanggal
   │  ├─ kelas/
   │  │  └─ KelasPage.tsx         # Daftar kelas aktif + jadwalnya
   │  ├─ sensei-profile/
   │  │  ├─ SenseiListPage.tsx    # Daftar sensei (kartu) → link ke profil
   │  │  └─ SenseiProfilePage.tsx # Profil + kalender mingguan + jam per kelas
   │  │                           #   (v2: tab Jadwal Detail harian/mingguan/bulanan
   │  │                           #   khusus sensei ini + sesi pengajian)
   │  ├─ dashboard/
   │  │  └─ DashboardPage.tsx     # Bar chart jam mengajar (mingguan/bulanan),
   │  │                           #   StatCards, badge Over/Optimal/Under target
   │  │                           #   (v2: dual bar jam + SESI; peringatan fallback)
   │  └─ admin/
   │     ├─ AdminPage.tsx         # Tab container CRUD master (+ tab "Aturan Sesi")
   │     ├─ AdminSenseiTab.tsx    # CRUD sensei + flow nonaktifkan (ConfirmDialog)
   │     ├─ AdminKlienTab.tsx     # CRUD klien/murid + arsip (v2 poin 3)
   │     ├─ AdminKelasTab.tsx     # CRUD kelas + arsip (v2 poin 3)
   │     ├─ AdminRuanganTab.tsx   # CRUD ruangan + flow nonaktifkan
   │     └─ AdminSesiTab.tsx      # v2: CRUD aturan sesi (kategori_sesi)
   └─ lib/
      ├─ supabase/client.ts       # SATU-SATUNYA createClient(); fail-fast tanpa env
      ├─ types/domain.ts          # Semua interface domain (mirror skema DB)
      ├─ time/index.ts            # Util WIB: todayWIB, jamOverlap (STRICT),
      │                           #   dateRange, startOfWeek, formatTanggal*, dll
      ├─ validation/
      │  ├─ jadwalSchema.ts       # Zod form jadwal + `toJadwalInput` + flattenZodErrors
      │  └─ masterSchema.ts       # Zod sensei/klien/kelas/ruangan
      └─ api/                     # Service layer (satu pintu ke Supabase)
         ├─ rpcError.ts           # RpcError {code, conflicts}, parseRpcError, unwrap;
         │                        #   format pesan server: "CODE|pesan manusia"
         ├─ auth.ts               # login/logout/getMyProfile
         ├─ sensei.ts             # list/get/create/update + countJadwalMendatang
         │                        #   + nonaktifkanSensei(RPC) + aktifkanSensei
         ├─ ruangan.ts            # list/create/update + countJadwalRuanganMendatang
         │                        #   + nonaktifkanRuangan(RPC) + aktifkanRuangan
         ├─ klien.ts              # list/create/update/delete
         ├─ kelas.ts              # list/create/update + nonaktifkan/aktifkan
         │                        #   + listJadwalKelas + arsipkan/batalkanArsip (v2)
         ├─ jadwal.ts             # resolveJadwal, checkJadwalConflicts, saveJadwal,
         │                        #   list/getJadwalSlot, setStatusSlot, deleteJadwalSlot
         │                        #   (v2: semua bawa p_tanggal_mulai)
         ├─ ketersediaan.ts       # checkKetersediaan (RPC check_ketersediaan_sensei)
         ├─ kategoriSesi.ts       # v2: listKategoriSesi + upsertKategoriSesi
         └─ analytics.ts          # hitungJamMengajar + hitungJamPerKelas (RPC)
```

---

## 6. Database — Skema & RPC

### Tabel (migration `0001_schema.sql`)
`cabang` (nullable di master utk ekspansi multi-cabang), `profiles` (role
admin/viewer), `sensei`, `klien`, `ruangan`, `kelas`, `jadwal_slot` (tabel inti).

**v2 (migration `0006_v2.sql`) tambahan kolom/tabel:**
- `kategori_sesi (jenis jenis_kelas PK, durasi_jam numeric, jumlah_sesi numeric, updated_at)`
  — konfigurasi konversi durasi → sesi utk pengajian. Seed 9 kategori:
  TG/CLT/SSW 2 jam = 1 sesi; Bimbel/Benkyou Houdai/Semi Private/Grup Kecil/
  Private/Regular 1,5 jam = 1 sesi. Diedit admin via tab "Aturan Sesi".
- `kelas.diarsipkan boolean default false`; `klien.is_aktif boolean default true`
  (soft delete, riwayat jadwal TIDAK pernah dihapus).
- `jadwal_slot.tanggal_mulai date` — batas bawah jadwal rutin. Constraints:
  hanya utk rutin (`slot_tanggal_mulai_rutin`), dan `tanggal_mulai <= berlaku_sampai`
  (`slot_tanggal_mulai_order`).

**CHECK constraints penting (penjaga struktural):**
- `slot_exactly_one_mode`: `tanggal` XOR `hari_rutin` (tepat satu terisi).
- `slot_time_order`: `jam_selesai > jam_mulai` (tidak lintas tengah malam).
- `slot_hari_rutin_valid`: hanya nama hari Indonesia valid.
- `slot_ruangan_consistency`: `ruangan_id` hanya boleh jika `tipe_lokasi='ruangan'`
  → secara struktural mustahil kelas perusahaan/rumah ikut validasi bentrok ruangan.
- FK `on delete restrict` di sensei_id/kelas_id/klien_id → hapus master yang
  masih punya relasi = ditolak DB.
- Index: `idx_jadwal_slot_sensei_tanggal`, `idx_jadwal_slot_ruangan_tanggal`,
  `idx_jadwal_slot_sensei`, `idx_jadwal_slot_status`, `idx_kelas_jenis`.

### RPC (migration `0003_functions.sql`) — semua `security definer`, revoke dari anon/public
| Function | Fungsi |
|----------|--------|
| `today_wib()` | "Hari ini" WIB di server — sumber kebenaran tanggal. |
| `hari_indo(date)` | Nama hari Indonesia (map isodow). |
| `jam_overlap(a_mulai,a_selesai,b_mulai,b_selesai)` | Overlap jam, pertidaksamaan KETAT (batas bersentuhan = valid). |
| `jadwal_dates_intersect(...)` | Irisan jadwal: 4 kombinasi one-off × rutin × berlaku_sampai. |
| `find_jadwal_conflicts(...)` | Inti deteksi bentrok: sensei selalu; ruangan hanya jika kedua sisi `tipe_lokasi='ruangan'`; hanya `status='aktif'`. |
| `save_jadwal(p_id, ...)` | SATU-SATUNYA jalur tulis jadwal. `LOCK TABLE jadwal_slot IN SHARE ROW EXCLUSIVE MODE` (aman race condition), cek master nonaktif (SENSEI_NONAKTIF/KELAS_NONAKTIF/RUANGAN_NONAKTIF), cek bentrok hanya jika `p_status='aktif'`, return id. |
| `check_jadwal_conflicts(...)` | Pre-check read-only utk form (UX real-time sebelum submit). |
| `resolve_jadwal(p_from,p_to,p_sensei_id?,p_ruangan_id?,p_status?)` | Ekspansi one-off + rutin jadi baris per tanggal. Default status `['aktif','planning']`. Dipakai timeline/ketersediaan/jam mengajar. |
| `check_ketersediaan_sensei(...)` | Per hari: `tersedia` bool + daftar jadwal (field: **`tersedia`**, bukan `terpenuhi`). |
| `hitung_jam_mengajar(p_from,p_to,p_sensei_id?)` | Total jam & sesi per sensei (hanya 'aktif'); return `sensei_id, nama_sensei, status_sensei, total_jam, jumlah_sesi, slot_tanpa_aturan_sesi, target_jam_minggu`. `total_jam` = jam mentah 1:1; `jumlah_sesi` PROPORSIONAL = (durasi kelas / durasi_jam aturan) × jumlah_sesi aturan (dibulatkan 2 desimal); fallback 1 slot = 1 sesi bila aturan jenis belum ada (dihitung di `slot_tanpa_aturan_sesi`). |
| `hitung_jam_per_kelas(p_sensei_id,p_from,p_to)` | Breakdown jam per kelas utk profil sensei (makna jam/sesi sama seperti hitung_jam_mengajar). |
| `arsipkan_kelas(p_kelas_id, p_nonaktifkan_jadwal_mendatang=false)` | v2 soft delete kelas: `diarsipkan=true, is_aktif=false`; opsional nonaktifkan jadwal mendatang. Guard admin. Riwayat tidak disentuh. |
| `arsipkan_klien(p_klien_id, p_nonaktifkan_jadwal_mendatang=false)` | v2 soft delete klien: `is_aktif=false`; opsional nonaktifkan jadwal mendatang semua kelas miliknya. Guard admin. |
| `upsert_kategori_sesi(p_jenis, p_durasi_jam, p_jumlah_sesi=1)` | v2 upsert aturan sesi (tab Aturan Sesi). Guard admin + validasi nilai > 0. |
| `count_jadwal_mendatang(p_sensei_id?,p_ruangan_id?)` | Hitung slot aktif mendatang (≥ today_wib) — guard sebelum nonaktifkan. |
| `nonaktifkan_sensei(id, p_nonaktifkan_jadwal_mendatang)` | Set is_aktif=false; opsional nonaktifkan jadwal mendatang. Guard is_admin. |
| `nonaktifkan_ruangan(id, p_nonaktifkan_jadwal_mendatang)` | Sama utk ruangan. |
| `tg_jadwal_slot_conflict_check()` | Trigger defense-in-depth pada insert/update langsung ke `jadwal_slot` (anti-bypass RPC). |

**Format error server:** `"CODE|pesan manusia"`. Client parse via
`parseRpcError` → `RpcError { code, conflicts }`. Kode dikenal:
`JADWAL_CONFLICT` (bawa `.conflicts: ConflictItem[]`), `SENSEI_NONAKTIF`,
`KELAS_NONAKTIF`, `RUANGAN_NONAKTIF`, `VALIDASI`.

### RLS (migration `0002_rls.sql`)
Semua tabel RLS aktif. Pola: `select` = authenticated; `insert/update/delete`
= `is_admin()`. `profiles_update_own` memblokir self-promote role. Trigger
`handle_new_user` membuat profile default `viewer` saat signup. Realtime
dipublikasikan utk jadwal_slot/sensei/ruangan/kelas.

---

## 7. Routing (semua di `src/app/Router.tsx`)

| Path | Halaman |
|------|---------|
| `/login` | Login |
| `/timeline` | Timeline sensei (default `/` redirect ke sini) |
| `/timeline/ruangan` | Timeline ruangan |
| `/jadwal` | Daftar jadwal slot |
| `/jadwal/new` & `/jadwal/:id/edit` | Form input/edit jadwal |
| `/kelas` | Daftar kelas |
| `/sensei` & `/sensei/:id` | Daftar & profil sensei |
| `/ketersediaan` | Cek ketersediaan sensei |
| `/dashboard` | Dashboard jam mengajar |
| `/admin` | CRUD master (sensei/klien/kelas/ruangan + tab Aturan Sesi) |
| `/lobby-display` | v2: signage TV lobby full-screen (tetap butuh login; tanpa sidebar) |

Setiap halaman dibungkus `RequireAuth` → `AppShell` → `RouteErrorBoundary`.
Kecuali `/lobby-display` memakai `barePage` (RequireAuth + boundary, TANPA AppShell).

---

## 8. Kontrak API Penting (TypeScript)

- `saveJadwal(input: JadwalInput, id?: string): Promise<string>` — throw
  `RpcError` dengan `.code` & `.conflicts`. Form menampilkan daftar bentrok
  dari `.conflicts`.
- `resolveJadwal(from, to, {senseiId?, ruanganId?, status?})` →
  `JadwalResolved[]` (baris konkret per tanggal).
- `setStatusSlot(id, 'aktif')` **menyimpan ulang via `saveJadwal`** supaya
  tidak menghidupkan slot yang kini bentrok.
- `checkKetersediaan(...)` → `KetersediaanHari[]` dengan field `tersedia`.
- `hitungJamMengajar(...)` → `JamMengajarSensei[]`.
- Dashboard: badge target = `(target_jam_minggu / 7) × jumlah hari rentang`.

---

## 9. Edge Cases — Status (diverifikasi saat audit)

| # | Kasus | Status | Mekanisme |
|---|-------|--------|-----------|
| 1 | Batas jam bersentuhan (14:00/14:00) valid | ✅ PASS | `jam_overlap` SQL & `jamOverlap` TS: pertidaksamaan ketat. |
| 2 | Rutin × one-off tumpang tindih di tanggal sama | ✅ PASS | `jadwal_dates_intersect` menangani 4 kombinasi + `berlaku_sampai` (+ `tanggal_mulai` v2). |
| 3 | Hapus sensei/ruangan berjadwal aktif | ✅ PASS | FK RESTRICT + RPC nonaktifkan + ConfirmDialog + guard `countJadwalMendatang`. |
| 4 | kelas_perusahaan/rumah tidak ikut bentrok ruangan | ✅ PASS | Constraint `slot_ruangan_consistency` + filter `find_jadwal_conflicts`. |
| 5 | Konsistensi WIB | ✅ PASS | `today_wib()` SQL / `todayWIB()` TS; tidak pernah waktu lokal. |
| 6 | Concurrent input 2 admin | ✅ PASS | `LOCK TABLE ... SHARE ROW EXCLUSIVE` di `save_jadwal` + trigger anti-bypass. |
| 7 | Rutin × rutin dengan jendela tanggal hanya beririsan sebagian | ✅ PASS (v2) | `jadwal_dates_intersect` cek overlap jendela tanggal kedua sisi (hanya bentrok bila benar-benar tumpang tindih). |
| 8 | `tanggal_mulai` jadwal rutin (mulai di masa depan) | ✅ PASS (v2) | `resolve_jadwal` & `jadwal_dates_intersect` keduanya menghormati `tanggal_mulai`; constraint order `tanggal_mulai <= berlaku_sampai`. |
| 9 | Arisip kelas/klien menjaga riwayat | ✅ PASS (v2) | `arsipkan_*` hanya set `diarsipkan/is_aktif`, tidak pernah DELETE; jam/sesi historis tetap terhitung. |

---

## 10. Jebakan & Aturan Teknis (Pitfalls)

1. **`@supabase/supabase-js` pinned 2.45.4** (kompat Node v20.12.2) — jangan bump.
2. **Overlap pakai `<` ketat** di SQL dan TS — jangan ubah ke `<=` (akan
   membuat kelas berurutan 14:00 dianggap bentrok).
3. **WIB selalu**: `todayWIB()` / `today_wib()`. Jangan `new Date()` lokal
   utk "hari ini", jangan `current_date` di SQL.
4. **Tailwind class dinamis tidak digenerate** — gunakan object lookup statis.
5. `flattenZodErrors` ada di `@/lib/validation/jadwalSchema`, bukan masterSchema.
6. Field ketersediaan adalah **`tersedia`** (bukan `terpenuhi`).
7. `read_file` kadang gagal membaca `0003_functions.sql` ("tool input not fully
   received") — gunakan `grep` dengan `include_pattern` sebagai alternatif.
8. Jangan panggil `supabase` langsung dari komponen; lewat `src/lib/api/*`.
9. Folder-folder prototype (`*_jadwal_sensei/`, `sensei_scheduler/`,
   `halaman_admin_manajemen_data/`) hanyalah referensi desain — bukan bagian build.
10. `tsc -b` butuh flag `--noEmit` utk typecheck tanpa emit; build produksi:
    `npm run build` (tsc -b && vite build).
11. **Array literal utk parameter bertipe enum[] wajib di-cast eksplisit** di
    SQL, mis. `array['aktif']::public.status_slot[]`. Tanpa cast, Postgres
    menolak: "argument of DEFAULT must be type status_slot[], not type text[]"
    (default value tidak mendapat implicit assignment cast). Sudah terjadi &
    diperbaiki di `resolve_jadwal` (DEFAULT p_status) + 3 pemanggilan internal.
12. **Parameter DEFAULT hanya boleh berurutan di EKOR signature** (42P13).
    `check_jadwal_conflicts` pernah punya default tersebar di tengah → error.
    Sudah diperbaiki: semua default dihapus (client TS selalu kirim semua
    argumen by-name via supabase.rpc, jadi tidak ada dampak fungsional).
    Aturan utk function baru: jika ada argumen opsional, letakkan di akhir
    atau jangan pakai default sama sekali.
13. **Mode one-off/rutin di form jadwal harus membersihkan nilai sisa** —
    `DEFAULT_FORM.tanggal = todayWIB()`; jika user pindah ke mode 'rutin'
    tanpa membersihkan `tanggal`, Zod menolak di path `tanggal` yang tidak
    ter-render (field merah tidak terlihat, toast membingungkan). Sudah
    diperbaiki: `switchMode()` di `FormInputJadwal.tsx` membersihkan
    `tanggal` (→rutin) atau `hari_rutin`/`berlaku_sampai` (→one-off), dan
    load mode edit juga mengisi `tanggal: null` utk slot rutin. Aturan: jika
    menambah field yang hanya valid di mode tertentu, pastikan nilainya
    dibersihkan saat pindah mode dan di-load mode edit.
14. **Jenis kelas kini 9 kategori** (v2) — SEMUA referensi harus lewat
    `JENIS_KELAS_LIST` dari `@/lib/types/domain` dan warna via `jenisStyles`
    dari `Badge.tsx` + palet `cat-*` di `tailwind.config.ts`. JANGAN hardcode
    literal 4 kategori lama di file baru. Urutan canonical:
    CLT, Bimbel, SSW, Private, TG, Benkyou Houdai, Semi Private, Grup Kecil, Regular.
15. **Sesi ≠ jam mengajar** — `total_jam` di RPC = jam mentah 1:1 (utk jam
    mengajar); `jumlah_sesi` = sesi proporsional utk pengajian. Jangan
    mencampur makna keduanya di UI (profil/dashboard menampilkan terpisah).
16. **Enum array param RPC wajib cast** — panggilan internal ke
    `resolve_jadwal(... array['aktif']::public.status_slot[])` wajib cast
    eksplisit (lihat no. 11).
17. **Signature RPC per-parameter** — setiap ubah parameter function =
    revoke + grant ulang signature TEPAT (0006 melakukannya utk semua
    function yang berubah). Jangan lupa grant utk function baru.

---

## 11. Status Proyek Saat Ini

### v2 (2026-08-14) — fitur & perbaikan
- ✅ Lobby Display (`/lobby-display`, `src/features/lobby/`): signage TV
  full-screen tanpa sidebar; header logo + tanggal Indonesia/Jepang + jam
  WIB real-time tiap detik; section "KELAS SEDANG BERLANGSUNG" (card +
  progress bar) & "KELAS SELANJUTNYA" (maks 6); auto-refresh Realtime
  (`useLobbyData`); tetap butuh login (viewer utk TV).
- ✅ Profil sensei: tab "Jadwal Detail" harian/mingguan/bulanan khusus
  sensei ini (reuse `ScheduleBlock` + `useResolvedJadwal` dgn `senseiId`).
- ✅ Jenis kelas 9 kategori (enum `0005`, warna `tailwind.config`,
  `jenisStyles`, `JENIS_KELAS_LIST`) — konsisten di timeline, filter,
  dashboard, lobby.
- ✅ Soft delete kelas (`diarsipkan`) & klien (`is_aktif`) + tombol hapus
  dgn modal konfirmasi di admin; riwayat tidak pernah hilang.
- ✅ Form jadwal rutin: field "Tanggal mulai" (validasi
  `tanggal_mulai <= berlaku_sampai` di Zod + RPC + constraint DB).
- ✅ Filter kombinable (jenis multi-select, sensei, status) + reset satu
  klik di Timeline, Daftar Jadwal, Daftar Kelas, Admin (kelas/klien).
- ✅ Perhitungan SESI utk pengajian: tabel `kategori_sesi` (bukan hardcode)
  + tab "Aturan Sesi" di Admin; sesi proporsional (2 jam = 1 sesi utk
  TG/CLT/SSW; 1,5 jam = 1 sesi utk sisanya; 3 jam = 1,5 sesi). Jam mengajar
  tetap 1:1 — ditampilkan TERPISAH di profil & dashboard (dual bar).
- ✅ Responsive mobile: hamburger + `MobileDrawer`; kolom label sticky di
  grid timeline; grid minggu/`DetailWeekly` scroll horizontal; TopBar
  padding kiri di mobile; tabel admin sudah `overflow-x-auto`.
- ✅ Font adaptif ScheduleBlock (ResizeObserver → `data-size` s/m/l → CSS
  container query; baris jam disembunyikan saat sempit, nama+lokasi
  diprioritaskan, jam tetap via tooltip/klik).
- ✅ Build & typecheck hijau.

### v1 (baseline, sudah di-deploy & ditest user)
- ✅ Implementasi selesai; `npm run typecheck` & `npm run build` hijau.
- ✅ Bug ditemukan & diperbaiki saat audit:
  1. `AdminSenseiTab.tsx` — `senseiSchema.parse` membuang `is_aktif`; kini
     digabung kembali via spread.
  2. `authStore.ts` — duplikasi `useIsAdmin()` dihapus.
  3. `tailwind.config.ts` — kunci duplikat `'on-surface'` dihapus.
  4. `src/vite-env.d.ts` dibuat (typing env).
  5. `TimelineRuanganPage.tsx` — import `startOfWeek` tak terpakai dihapus.
- ✅ Bug pasca-implementasi (fase deploy/polish):
  1. `FormInputJadwal.tsx` — "Form belum lengkap" tanpa field merah saat
     simpan jadwal rutin (stale `tanggal`). Fix: `switchMode()` + load
     mode edit + `set()` sekarang membersihkan error field saat berubah;
     toast submit menampilkan pesan error pertama yang spesifik.
  2. Branding: logo di `src/assets/logo.png` (dari `logo.png` root) tampil
     di LoginPage & Sidebar; judul sidebar → "Jadwal Sensei Ichikara";
     subtitle "School Admin" dihapus; semua em/en dash di string UI diganti
     (sisa hanya di komentar kode); title di `index.html` disesuaikan.
- ✅ Edge case §9 diverifikasi PASS (lihat bukti di laporan audit).
- 📋 Yang mungkin masih perlu dari user: buat Supabase project baru → isi
  `.env.local` → jalankan migrations 0001–0004 berurutan → buat user auth
  pertama lalu set `role='admin'` manual di tabel `profiles` (karena default
  viewer & self-promote diblokir policy).
- 🚀 Deployment: GitHub + Vercel + Supabase (lihat §13).

### Migration yang BELUM dijalankan user
- ⚠️ `0005_v2_jenis_kelas.sql` dan `0006_v2.sql` BELUM dijalankan di
  Supabase SQL Editor. Urutan wajib: `0005` DULU, baru `0006` (0005 menambah
  enum; 0006 memakai nilai baru itu di seed kategori_sesi). Setelah
  dijalankan, v1 frontend lama tetap jalan (additive); v2 frontend
  membutuhkan keduanya.

---

## 12. Cara Menjalankan

```bash
npm install
cp .env.example .env.local   # isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
npm run dev                  # dev server
npm run typecheck            # tsc -b --noEmit
npm run build                # produksi
```

Urutan apply migration di Supabase: `0001_schema.sql` → `0002_rls.sql` →
`0003_functions.sql` → `0004_seed.sql` (opsional, data contoh) →
`0005_v2_jenis_kelas.sql` → `0006_v2.sql`.

> ⚠️ v2: jalankan `0005` DULU sebelum `0006`. Jika sudah pernah menjalankan
> 0001-0004, cukup jalankan 0005 lalu 0006 (tidak perlu ulang dari awal).

---

## 13. Deployment (GitHub + Vercel + Supabase)

### Konfigurasi kunci
- `vercel.json` — rewrite semua path ke `/index.html` (WAJIB untuk SPA +
  React Router; tanpa ini refresh di `/timeline` dll = 404).
- Env vars Vercel (Settings → Environment Variables, untuk Production +
  Preview + Development): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (nilai sama dengan `.env.local`).
- ⚠️ Env Vite di-bake saat BUILD. Ganti env di Vercel = wajib redeploy
  (bukan cuma restart).
- Anon key aman dipublikasikan — keamanan = RLS, bukan kerahasiaan key.
  `service_role` key JANGAN PERNAH masuk repo/Vercel.

### Langkah deploy (sekali)
1. Supabase: buat project → SQL Editor → jalankan migration 0001→0002→
   0003 (→0004 opsional) berurutan → salin Project URL + anon key
   (Project Settings → API).
2. Supabase Auth: daftarkan user admin pertama (Authentication → Users →
   Add user). Konfirmasi email sesuai setting auth project.
3. Set role admin: SQL Editor →
   `update public.profiles set role = 'admin' where email = 'admin@...';`
4. GitHub: buat repo (private disarankan) → `git init` di folder SEIRI →
   commit → push. `.gitignore` sudah mengabaikan `node_modules/`, `dist/`,
   `.env*`. Folder prototype ikut ter-commit sbg referensi (keputusan user).
5. Vercel: New Project → import repo → Framework Preset: **Vite** →
   Build `npm run build`, Output `dist` → isi env vars → Deploy.
6. Test: login sebagai admin → cek semua halaman → coba input jadwal
   bentrok harus ditolak server.

> **v2:** setelah pull v2, jalankan migration 0005 & 0006 di Supabase dulu,
> lalu `npm run build` + push. Lobby display: login dengan akun (admin atau
> viewer) lalu buka `/lobby-display` di TV.

### Update selanjutnya
`git push` ke branch default → Vercel auto-deploy. Setelah ubah env var
di Vercel, lakukan redeploy manual (Deployments → ⋯ → Redeploy).

### Jika ganti project Supabase / pindah lingkungan
Ulangi migration dari awal (skema dibuat ulang), set ulang env var, redeploy.
Tidak ada state aplikasi di sisi Vercel — semua data di Supabase.
