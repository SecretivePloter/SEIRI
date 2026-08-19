// useLobbyData — data jadwal utk Lobby Display: resolve rentang hari ini
// (aktif + planning) + Realtime subscription. Jam & tanggal dihitung WIB.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveJadwal } from '@/lib/api/jadwal';
import { supabase } from '@/lib/supabase/client';
import type { JadwalResolved } from '@/lib/types/domain';
import { todayWIB } from '@/lib/time';

export function useLobbyData() {
  const [jadwal, setJadwal] = useState<JadwalResolved[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = todayWIB();
    setLoading(true);
    setError(null);
    try {
      const data = await resolveJadwal(today, today, { status: ['aktif', 'planning'] });
      setJadwal(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat jadwal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: perubahan jadwal_slot -> refetch (lobby berjalan di TV tanpa reload)
  useEffect(() => {
    const channel = supabase
      .channel('lobby-display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jadwal_slot' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jadwal_exception' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return useMemo(() => ({ jadwal, loading, error, reload: load }), [jadwal, loading, error, load]);
}
