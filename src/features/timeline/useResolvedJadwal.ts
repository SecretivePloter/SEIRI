// Hook shared utk data jadwal ter-resolve + Realtime auto-refresh.
// Dipakai timeline sensei, timeline ruangan, dan kalender profil.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveJadwal } from '@/lib/api/jadwal';
import { supabase } from '@/lib/supabase/client';
import type { JadwalResolved, StatusSlot } from '@/lib/types/domain';

export function useResolvedJadwal(
  from: string,
  to: string,
  opts?: { senseiId?: string; ruanganId?: string; status?: StatusSlot[] },
) {
  const [jadwal, setJadwal] = useState<JadwalResolved[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialisasi daftar status supaya bisa jadi dependency useEffect yang stabil
  const statusKey = opts?.status ? opts.status.join(',') : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await resolveJadwal(from, to, opts);
      setJadwal(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat jadwal');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, opts?.senseiId, opts?.ruanganId, statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: perubahan jadwal_slot -> refetch rentang yang tampil
  useEffect(() => {
    const channel = supabase
      .channel(`timeline-${from}-${to}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jadwal_slot' },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, from, to]);

  return useMemo(() => ({ jadwal, loading, error, reload: load }), [jadwal, loading, error, load]);
}
