# Halaman display publik

`/display` tetap menjadi halaman display lobby yang baru. Isinya menggunakan iframe ke jalur display baca-saja pada dua aplikasi dan mempertahankan komponen serta gaya halaman aslinya. Halaman lama `/lobby-display` tidak diubah.

## Mode

- `/display` atau `/display?mode=cycle&interval=30`: berganti antara Kalender interpreter bulanan dan Timeline Sensei hari ini setiap 30 detik.
- `interval` menerima nilai 10–600 detik.
- `/display?mode=single&view=interpreter`: Kalender interpreter saja.
- `/display?mode=single&view=sensei`: Timeline Sensei saja.

Jalur sumber publik yang dipakai iframe adalah `/display-source` pada kedua domain. Kalender memakai filter dan grid bulanan yang sama dengan `/kalender`; timeline memakai komponen yang sama dengan `/timeline`. Fitur edit dan modal detail tidak tersedia di jalur display.

## Migrasi database

1. Jalankan `supabase/migrations/0013_public_display_timeline.sql` pada Supabase SEIRI.
2. Jalankan `supabase/migrations/20261029_public_display_calendar.sql` pada Supabase Interpretasync.

RPC publik hanya dapat membaca field yang diperlukan untuk tampilan. Feed tidak mengembalikan alamat, nama ruangan spesifik, kontak, ataupun catatan internal. Gunakan publishable/anon key aplikasi, jangan pernah gunakan service-role key di browser.
