# Changelog

Semua perubahan penting pada **Jadwal Sensei (PT Ichikara)** dicatat di file
ini, mengikuti format [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/).
Versi mengikuti [Semantic Versioning](https://semver.org/).

## [2.2.0] - 2026-08-18

### Fitur Baru

- **Exception per tanggal utk jadwal rutin** (terpisah dari status
  aktif/nonaktif level jadwal_slot):
  - Tabel `jadwal_exception` (slot_id + tanggal unik) dgn tipe
    `'dibatalkan'` / `'ganti_sensei'`, sensei_pengganti, catatan, pembuat.
  - Di modal detail jadwal (`JadwalDetailModal`): tombol **"Batalkan Hari
    Ini"** (opsional catatan) dan **"Ganti Sensei Hari Ini"** (dropdown
    sensei pengganti yg tersedia di jam itu + induk cek bentrok), plus
    **undo** ("Batalkan Pembatalan" / "Batalkan Pergantian Sensei").
  - Tombol lama di-modal diperjelas jadi **"Nonaktifkan Jadwal Rutin
    Ini"** agar berbeda makna dr 2 tombol baru.
  - Modal menampilkan badge status exception aktif utk tanggal itu
    (mis. "Dibatalkan hari ini" / "Digantikan oleh [nama]").
  - Rendering: blok dibatalkan & baris asli pengganti diredupkan + label;
    baris di sensei PENGganti tampil normal + badge "Pengganti".
    Konsisten di timeline, timeline ruangan, lobi, profil sensei.
- **Payroll konsisten lewat resolve_jadwal** (single source of truth):
  - `hitung_jam_mengajar` & `hitung_jam_per_kelas` hanya memakai baris
    `dihitung` — sesi di-'batalkan' TIDAK dihitung siapa pun; sesi
    'ganti_sensei' dihitung ke SENSEI PENGGANTI (sensei_efektif_id) utk
    tanggal itu saja.
- **Halaman Kanban baru** (`/kanban`): 3 kolom status waktu hari ini
  (Akan Dimulai / Sedang Berlangsung / Selesai), card per kelas (kelas +
  sensei + lokasi + jam), filter per jenis kelas, realtime + timer WIB.
- **Filter toggle** di Timeline: "Tampilkan pembatalan/pergantian sensei"
  (default ON).

### Perubahan

- `resolve_jadwal` di-rewrite: output kolom baru (sensei_efektif_id,
  sensei_efektif_nama, sensei_pengganti_id/nama, is_rutin, exception_*,
  is_pengganti, dihitung). Signature TIDAK berubah (kompatibel).
- RPC baru: `simpan_exception_jadwal`, `hapus_exception_jadwal`,
  `list_sensei_pengganti_tersedia`.
- `src/lib/types/domain.ts`: `JadwalResolved` += field exception dll.
- `src/lib/api/exception.ts`: service baru utk exception.
- `src/features/timeline/ScheduleBlock.tsx`: label + redup utk exception.
- `src/features/timeline/JadwalDetailModal.tsx`: tombol exception + undo +
  badge status + rename tombol nonaktif.
- `src/features/timeline/TimelinePage.tsx` & `timelineStore.ts`: toggle
  tampilkan exception (default ON).
- `src/features/lobby/LobbyDisplayPage.tsx` & `useLobbyData.ts`:
  tampilkan label exception + listen jadwal_exception.
- `src/features/kanban/KanbanPage.tsx` (baru) + route `/kanban` +
  navigasi Sidebar & MobileDrawer.
- `src/features/sensei-profile/SenseiProfilePage.tsx`: label exception di
  DetailList.

### Migration Database

- `supabase/migrations/0010_exception.sql` — tabel `jadwal_exception` + RLS;
  rewrite `resolve_jadwal`, `hitung_jam_mengajar`, `hitung_jam_per_kelas`;
  RPC baru exception + grants.

> ⚠️ **Urutan migration**: `0005` → ... → `0009` → `0010`. `resolve_jadwal`
> di 0010 MENGIDENTIK-kan kolom output (additive kolom, signature sama).
> Jangan menimpa dgn versi 0003/0006 setelah 0010 jalan (overwrite).

---

## [2.1.0] - 2026-08-18

### Fitur Baru

- **Hapus data master yang aman** di halaman Admin (sensei, kelas, ruangan):
  tombol hapus + modal konfirmasi `HapusMasterDialog`. Sistem mengevaluasi
  otomatis 3 kondisi via RPC `evaluasi_hapus_master`:
  - `block`: masih dipakai jadwal aktif mendatang → hapus ditolak, dengan
    pesan berapa jumlah jadwal terkait.
  - `soft`: punya riwayat jadwal lamau → diarsipkan/nonaktifkan (bukan
    dihapus permanen) sehingga laporan jam mengajar & penggajian tetap utuh.
  - `hard`: belum pernah dipakai jadwal → dihapus permanen (aman karena FK
    `on delete restrict` terpenuhi saat 0 referensi).
- **Denah ruangan 2 lantai di Lobby Display** (`/lobby-display`):
  - Tabel `ruangan` ditambah kolom posisi: `lantai`, `posisi_slot` (1-4 =
    slot #1-#4), `urutan_dalam_slot` (sub-kotak saat beberapa ruangan dalam
    1 slot), `tipe` (`'fisik'`/`'virtual'`).
  - Lantai 2 (atas) & Lantai 1 (bawah), 4 kolom slot horizontal; sub-kotak
    diwarnai sesuai jenis kelas (`jenisStyles`) saat kelas berlangsung +
    progress bar; font adaptif via `useBlockSize`/`data-size`.
  - Ruangan denah: Lt2 #1 Natsu 1/Fuyu 1/Aki 1, #2 Aki 2, #3 Aki 3, #4
    Aki 4; Lt1 #1 Haru 1, #2 Natsu 2/Haru 2, #3 Haru 3, #4 Natsu 4
    (kapasitas 2 orang)/Haru 4. Master lama `Natsu`/`Haru`/`Aki` di-rename
    jadi `Natsu 1`/`Haru 1`/`Aki 1`.
  - "Online" (virtual) & "Fuyu 2" tidak digambar di denah tapi tetap
    `is_aktif = true` sehingga muncul di dropdown form jadwal.
  - Panel "Sedang Berlangsung" & "Kelas Selanjutnya" (termasuk
    kelas_perusahaan/kelas_rumah/Online) tetap tampil.
  - Penyesuaian tampilan (v2.1.1): label kolom cukup `#1`-`#4` (tanpa
    kata SLOT); kotak ruangan diperbesar proporsional (denah 2x lebih
    lebar dari panel samping); urutan kolom kiri-ke-kanan jadi
    `#2, #1, #3, #4` di KEDUA lantai (murni urutan render, nilai
    `posisi_slot` di database tidak berubah); hierarki teks: nama
    ruangan paling menonjol (font adaptif 12/15/19px), nama kelas
    boleh wrap 2 baris (tidak dipotong ellipsis), jam mulai-selesai
    selalu utuh, label "Lantai 1/2" diperkecil.

### Perubahan

- `src/features/lobby/LobbyDisplayPage.tsx` ditulis ulang dari daftar card
  menjadi denah ruangan 2 lantai; panel kelas aktif/selanjutnya tetap.
- `src/features/timeline/ScheduleBlock.tsx`: `useBlockSize` di-export agar
  dipakai ulang oleh sub-kotak denah.
- `src/lib/types/domain.ts`: `Ruangan` kini punya `lantai`, `posisi_slot`,
  `urutan_dalam_slot`, `tipe`.
- `src/lib/api/ruangan.ts`: `RuanganInput` mendukung field denah & tipe.
- Tab Admin ruangan/sensei/kelas: tombol hapus + `HapusMasterDialog`;
  form ruangan menambah field tipe/lantai/posisi slot/urutan dalam slot.

### Migration Database

- `supabase/migrations/0008_master_delete.sql` — RPC
  `evaluasi_hapus_master(text, uuid) → jsonb` + grants.
- `supabase/migrations/0009_ruangan_denah.sql` — kolom denah di `ruangan` +
  rename master lama + UPSERT data denah (termasuk `Natsu 4`).

> ⚠️ **Urutan menjalankan migration**: `0005` → `0006` → `0007` → `0008` →
> `0009`. Jangan jalankan `0003` setelah `0007`/`0008` (overwrite
> `check_ketersediaan_sensei` versi lama).

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
