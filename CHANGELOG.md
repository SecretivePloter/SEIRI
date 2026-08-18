# Changelog

Semua perubahan penting pada **Jadwal Sensei (PT Ichikara)** dicatat di file
ini, mengikuti format [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/).
Versi mengikuti [Semantic Versioning](https://semver.org/).

## [Unreleased]

- (kosong)

---

## [2.0.0] - 2026-08-14

### Fitur Baru

- **Lobby Display** (`/lobby-display`): halaman signage full-screen untuk TV
  lobby kantor, read-only, tanpa sidebar admin.
  - Header: logo perusahaan, nama hari & tanggal Bahasa Indonesia (mis.
    "Senin, 14 Oktober 2024"), tanggal & hari Bahasa Jepang dengan kanji
    (mis. "2024年10月14日 月曜日"), dan jam real-time WIB yang update tiap detik.
  - Section "KELAS SEDANG BERLANGSUNG": card besar per kelas aktif dengan
    progress bar durasi; empty state saat tidak ada kelas.
  - Section "KELAS SELANJUTNYA": maksimal 6 kelas terdekat, urut jam mulai,
    format lebih ringkas.
  - Auto-refresh via Supabase Realtime subscription (tanpa reload manual);
    kelas otomatis pindah dari "selanjutnya" ke "sedang berlangsung".
  - Tetap melewati login (dipakai dengan akun viewer/admin).
- **Jenis kelas diperluas dari 4 menjadi 9 kategori**: SSW, CLT, Bimbel,
  Private, TG, Benkyou Houdai, Semi Private, Grup Kecil, Regular.
  - Enum baru via migration `0005_v2_jenis_kelas.sql` (file terpisah karena
    `ALTER TYPE ... ADD VALUE` tidak boleh satu transaksi dengan pemakaiannya).
  - Warna baru konsisten di semua tampilan (timeline, filter, dashboard,
    lobby display) via palet `cat-*` di `tailwind.config.ts` + `jenisStyles`.
- **Profil Sensei**: section baru "Jadwal Detail" khusus sensei tersebut
  dengan 3 tampilan (Harian / Mingguan / Bulanan), reuse komponen
  `ScheduleBlock`, termasuk detail jam per slot.
- **Perhitungan SESI untuk pengajian**:
  - Tabel konfigurasi baru `kategori_sesi` (bukan hardcode di kode) +
    tab "Aturan Sesi" di halaman Admin untuk mengubah rate tanpa ubah kode.
  - Aturan awal (semua kategori): TG/CLT/SSW 2 jam = 1 sesi; Bimbel,
    Benkyou Houdai, Semi Private, Grup Kecil, Private, Regular 1,5 jam = 1 sesi.
  - Sesi bersifat proporsional: kelas 3 jam dengan aturan 2 jam = 1 sesi
    dihitung 1,5 sesi. Jika aturan jenis belum ada, fallback 1 slot = 1 sesi
    (dicatat lewat `slot_tanpa_aturan_sesi`).
  - Jam mengajar tetap dihitung 1:1 dan **ditampilkan terpisah** dari sesi
    di profil sensei & dashboard (bar chart dual bar: jam + sesi).
- **Soft delete kelas & klien** di halaman Admin:
  - Kelas: tombol hapus dengan modal konfirmasi → `diarsipkan=true` +
    `is_aktif=false` (opsional ikut menonaktifkan jadwal mendatang).
  - Klien: tombol hapus → `is_aktif=false`.
  - Riwayat jam mengajar & sesi pembayaran yang sudah lewat tidak pernah
    dihapus.
- **Form jadwal rutin**: field baru "Tanggal mulai" (date picker) di samping
  "Berlaku sampai". Validasi `tanggal_mulai <= berlaku_sampai` di client
  (Zod), server (RPC `save_jadwal`), dan constraint DB
  (`slot_tanggal_mulai_order`).
- **Filter kombinable (AND)** di Timeline, Daftar Jadwal, Daftar Kelas, dan
  Admin (kelas/klien): jenis kelas (multi-select, 9 kategori), sensei
  (multi-select), status aktif/tidak aktif; tombol reset satu klik.
- **Responsive mobile**: hamburger menu + `MobileDrawer` (pengganti sidebar),
  kolom label sticky di grid timeline untuk scroll horizontal, grid mingguan
  bisa di-scroll, TopBar tidak tertutup tombol hamburger.
- **Font adaptif di ScheduleBlock**: ukuran blok dipantau ResizeObserver →
  atribut `data-size` (s/m/l) → CSS container query menyesuaikan ukuran font.
  Saat ruang sempit, baris jam disembunyikan; nama kelas & lokasi tetap
  terbaca (jam tetap bisa dilihat via tooltip/klik → modal detail).

### Perubahan

- RPC database diperbarui agar mendukung `tanggal_mulai`:
  - `jadwal_dates_intersect` (8 param), `find_jadwal_conflicts`,
    `check_jadwal_conflicts`, `save_jadwal` (signature 15 param),
    `resolve_jadwal`, trigger `tg_jadwal_slot_conflict_check`.
- `hitung_jam_mengajar` & `hitung_jam_per_kelas`: output baru `jumlah_sesi`
  (proporsional, 2 desimal) dan `slot_tanpa_aturan_sesi`.
- RPC baru: `arsipkan_kelas(uuid, boolean)`, `arsipkan_klien(uuid, boolean)`,
  `upsert_kategori_sesi(jenis_kelas, numeric, numeric)` — semua di-guard
  admin, tidak pernah menyentuh riwayat.
- Kolom baru di tabel: `kelas.diarsipkan`, `klien.is_aktif`,
  `jadwal_slot.tanggal_mulai` (dengan constraints
  `slot_tanggal_mulai_rutin` & `slot_tanggal_mulai_order`).
- `hitung_jam_mengajar` memakai `resolve_jadwal` (ekspansi rutin per tanggal)
  sehingga rutin dengan `tanggal_mulai` di masa depan tidak dihitung sebelum
  tanggal mulai.

### Perbaikan Bug

- `SenseiProfilePage.tsx` rusak (JSX tidak seimbang, `</div>` yatim) → ditulis
  ulang penuh dengan struktur benar; tidak ada fitur yang hilang.
- `masterSchema.ts`: enum jenis kelas tidak lagi `string` (type-safe 9
  kategori via `JENIS_KELAS_LIST`).
- `kelas.ts`: `KelasInput` menerima `diarsipkan` (dipakai
  `batalkanArsipKelas`).
- `LobbyDisplayPage.tsx`: hapus konstanta tak terpakai (`JP_WEEKDAY`).
- Build gagal karena `MobileDrawer` belum ada → file dibuat
  (`src/components/layout/MobileDrawer.tsx`).
- Kolom label grid timeline menempel (sticky) saat scroll horizontal di
  layar sempit.
- TopBar di mobile: diberi padding kiri agar judul tidak tertutup tombol
  hamburger.

### Migration Database

- `supabase/migrations/0005_v2_jenis_kelas.sql` — tambah 5 nilai enum
  `jenis_kelas` (TG, Benkyou Houdai, Semi Private, Grup Kecil, Regular).
- `supabase/migrations/0006_v2.sql` — tabel `kategori_sesi` + seed 9
  kategori; kolom soft delete `kelas.diarsipkan`, `klien.is_aktif`;
  `jadwal_slot.tanggal_mulai`; rekreasi RPC yang terdampak; RPC baru
  `arsipkan_kelas`, `arsipkan_klien`, `upsert_kategori_sesi`; grants
  per-signature.

> ⚠️ **Urutan menjalankan migration**: `0005` DULU, baru `0006`. Keduanya
> aditif (tidak menghapus/mengubah data yang ada), sehingga v1 tetap jalan.

### Catatan untuk Pengguna

- Aturan sesi (rate) dapat diubah kapan saja di **Admin → Aturan Sesi**
  tanpa perlu mengubah kode.
- Lobby Display diakses lewat `/lobby-display` setelah login (disarankan
  akun viewer untuk TV).

---

## [1.0.0] - 2026-08-13

### Fitur Baru (v1, baseline)

- Sistem jadwal sensei pengganti Excel: single source of truth.
- Timeline visual (Today / Weekly / Monthly) per sensei & per ruangan.
- Validasi bentrok sensei & ruangan di server (RPC + trigger anti-bypass),
  bukan hanya di UI.
- Form input jadwal dengan pre-check bentrok real-time (debounced).
- Cek ketersediaan sensei per rentang tanggal.
- Halaman Admin CRUD (sensei, klien, kelas, ruangan, jadwal).
- Profil sensei (data diri, JLPT, kalender mingguan personal).
- Dashboard jam mengajar per sensei (mingguan/bulanan) dengan badge target.
- RLS aktif di semua tabel; auth email+password Supabase (role admin/viewer).

### Perbaikan Bug (fase polish v1)

- "Form belum lengkap" saat simpan jadwal rutin karena stale `tanggal` →
  `switchMode()` membersihkan field yang tidak relevan; toast menampilkan
  pesan error spesifik pertama.
- `AdminSenseiTab.tsx`: `senseiSchema.parse` membuang `is_aktif` → digabung
  ulang via spread.
- `authStore.ts`: duplikasi `useIsAdmin()` dihapus.
- `tailwind.config.ts`: kunci duplikat `'on-surface'` dihapus.
- Branding: logo tampil di login & sidebar; judul sidebar → "Jadwal Sensei
  Ichikara"; subtitle "School Admin" dihapus; em/en dash diganti di semua
  string UI; title `index.html` disesuaikan.

### Migration Database

- `0001_schema.sql` — tipe enum + 7 tabel + CHECK constraints + index.
- `0002_rls.sql` — RLS semua tabel + helper `is_admin`/`is_authenticated` +
  trigger `handle_new_user` + publikasi realtime.
- `0003_functions.sql` — 15 RPC + trigger anti-bypass.
- `0004_seed.sql` — data contoh (opsional).
