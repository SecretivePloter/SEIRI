# Halaman display publik

Halaman TV berada di `/display` dan tidak memerlukan login. Data dibaca melalui dua RPC publik khusus; endpoint hanya mengembalikan nama sensei/interpreter, tanggal, dan jam. Jangan menambahkan field seperti nama klien, lokasi, alamat, kontak, atau catatan internal ke feed ini.

## Mode

- `/display` atau `/display?mode=cycle&interval=30`: berganti antara kalender interpreter mingguan dan timeline sensei hari ini, setiap 30 detik.
- `/display?mode=cycle&interval=45`: interval dalam detik (10–600).
- `/display?mode=single&view=interpreter`: kalender interpreter saja.
- `/display?mode=single&view=sensei`: timeline sensei saja.

## Setup deployment

1. Terapkan `supabase/migrations/0011_public_display.sql` pada Supabase SEIRI.
2. Terapkan `supabase/migrations/20261028_public_display_feed.sql` pada Supabase Interpretasync.
3. Tambahkan `VITE_INTERPRETASYNC_SUPABASE_URL` dan `VITE_INTERPRETASYNC_SUPABASE_ANON_KEY` ke environment Vercel SEIRI. Gunakan URL serta publishable/anon key proyek Interpretasync; jangan gunakan service-role key.
4. Deploy SEIRI ke `edukasi.ichikara.co.id` dan buka `/display`.

Feed hanya menerima rentang dalam minggu berjalan (WIB). Halaman memuat ulang kedua feed setiap 60 detik.
