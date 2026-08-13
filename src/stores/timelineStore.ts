// Zustand: filter & state timeline (dipakai bersama Timeline sensei & ruangan).

import { create } from 'zustand';
import type { JenisKelas } from '@/lib/types/domain';
import { todayWIB } from '@/lib/time';

export type TimelineMode = 'today' | 'weekly' | 'monthly';

interface TimelineFilterState {
  mode: TimelineMode;
  anchorDate: string; // yyyy-mm-dd
  jenisFilter: JenisKelas[]; // kosong = semua
  search: string;
  setMode: (m: TimelineMode) => void;
  setAnchorDate: (d: string) => void;
  toggleJenis: (j: JenisKelas) => void;
  setSearch: (s: string) => void;
}

export const useTimelineFilterStore = create<TimelineFilterState>((set, get) => ({
  mode: 'today',
  anchorDate: todayWIB(),
  jenisFilter: [],
  search: '',
  setMode: (mode) => set({ mode }),
  setAnchorDate: (anchorDate) => set({ anchorDate }),
  toggleJenis: (j) => {
    const cur = get().jenisFilter;
    set({ jenisFilter: cur.includes(j) ? cur.filter((x) => x !== j) : [...cur, j] });
  },
  setSearch: (search) => set({ search }),
}));
