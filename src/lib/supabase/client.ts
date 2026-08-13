import { createClient } from '@supabase/supabase-js';

// Satu-satunya tempat createClient dipanggil (NFR brief).
// Env vars via .env.local — jangan pernah hardcode.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Gagal cepat & jelas — lebih baik error eksplisit daripada query misterius
  throw new Error(
    'Konfigurasi Supabase tidak ditemukan. Salin .env.example ke .env.local ' +
      'lalu isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
