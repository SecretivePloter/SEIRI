// Zustand: filter & state timeline (dipakai bersama Timeline sensei & ruangan).
// v2: tambah filter sensei + status; semua filter bisa dikombinasikan (AND)
// dan di-reset satu klik.

import { create } from 'zustand';
import type { JenisKelas } from '@/lib/types/domain';
import { todayWIB } from '@/lib/time';

export type TimelineMode = 'today' | 'weekly' | 'monthly';

/** Filter status jadwal: 'aktif' ikut menampilkan planning (pudar). */
export type StatusFilter = 'aktif' | 'tidak_aktif' | 'semua';

interface TimelineFilterState {
  mode: TimelineMode;
  anchorDate: string; // yyyy-mm-dd
  jenisFilter: JenisKelas[]; // kosong = semua
  senseiFilter: string[]; // kosong = semua
  statusFilter: StatusFilter; // default: aktif (+planning pudar)
  search: string;
  /** true = tampilkan blok exception (dibatalkan/pengganti) di timeline */
  showException: boolean;
  setMode: (m: TimelineMode) => void;
  setAnchorDate: (d: string) => void;
  toggleJenis: (j: JenisKelas) => void;
  toggleSensei: (id: string) => void;
  setStatusFilter: (s: StatusFilter) => void;
  setSearch: (s: string) => void;
  toggleShowException: () => void;
  resetFilters: () => void;
  hasActiveFilters: () => boolean;
}

export const useTimelineFilterStore = create<TimelineFilterState>((set, get) => ({
  mode: 'today',
  anchorDate: todayWIB(),
  jenisFilter: [],
  senseiFilter: [],
  statusFilter: 'aktif',
  search: '',
  showException: true,
  setMode: (mode) => set({ mode }),
  setAnchorDate: (anchorDate) => set({ anchorDate }),
  toggleJenis: (j) => {
    const cur = get().jenisFilter;
    set({ jenisFilter: cur.includes(j) ? cur.filter((x) => x !== j) : [...cur, j] });
  },
  toggleSensei: (id) => {
    const cur = get().senseiFilter;
    set({ senseiFilter: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  },
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSearch: (search) => set({ search }),
  toggleShowException: () => set((s) => ({ showException: !s.showException })),
  resetFilters: () => set({ jenisFilter: [], senseiFilter: [], statusFilter: 'aktif', search: '', showException: true }),
  hasActiveFilters: () => {
    const s = get();
    return s.jenisFilter.length > 0 || s.senseiFilter.length > 0 || s.statusFilter !== 'aktif' || s.search !== '' || !s.showException;
  },
}));
