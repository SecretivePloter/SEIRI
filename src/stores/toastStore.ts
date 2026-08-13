// Toast queue global — notifikasi error/sukses dari Supabase & aksi UI.

import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, title: string, detail?: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, title, detail) => {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, kind, title, detail }] });
    // auto-dismiss 6 detik
    setTimeout(() => get().dismiss(id), 6000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Shortcut utk dipakai di luar komponen React */
export const toast = {
  success: (title: string, detail?: string) => useToastStore.getState().push('success', title, detail),
  error: (title: string, detail?: string) => useToastStore.getState().push('error', title, detail),
  info: (title: string, detail?: string) => useToastStore.getState().push('info', title, detail),
};
