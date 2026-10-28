import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export interface DisplayScheduleItem {
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  nama: string;
}

let interpreterClient: SupabaseClient | null = null;

function getInterpreterClient(): SupabaseClient {
  if (interpreterClient) return interpreterClient;

  const url = import.meta.env.VITE_INTERPRETASYNC_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_INTERPRETASYNC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) throw new Error('Konfigurasi feed kalender interpreter belum diatur.');

  interpreterClient = createClient(url, anonKey, {
    db: { schema: 'ichikara' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return interpreterClient;
}

async function unwrapSchedule<T>(request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data as T;
}

/** Public RPC returns only date, time, and interpreter name. */
export function fetchInterpreterDisplaySchedule(from: string, to: string): Promise<DisplayScheduleItem[]> {
  return unwrapSchedule(getInterpreterClient().rpc('public_display_schedule', { p_from: from, p_to: to }));
}

/** Public RPC returns only date, time, and sensei name. */
export function fetchSenseiDisplaySchedule(from: string, to: string): Promise<DisplayScheduleItem[]> {
  return unwrapSchedule(supabase.rpc('public_display_schedule', { p_from: from, p_to: to }));
}
