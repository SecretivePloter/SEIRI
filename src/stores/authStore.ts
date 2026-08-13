// Auth/session store — profile user login & role.

import { create } from 'zustand';
import { getMyProfile } from '@/lib/api/auth';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/domain';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  loading: true,
  initialized: false,

  init: async () => {
    set({ loading: true });
    const profile = await getMyProfile();
    set({ profile, loading: false, initialized: true });

    // Sinkronkan saat login/logout di tab lain atau session berakhir
    supabase.auth.onAuthStateChange(() => {
      void getMyProfile().then((p) => set({ profile: p }));
    });
  },

  refresh: async () => {
    const profile = await getMyProfile();
    set({ profile });
  },

  clear: () => set({ profile: null }),
}));

/** Helper: apakah user yang login berperan admin? (viewer = read-only) */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.profile?.role === 'admin');
}
