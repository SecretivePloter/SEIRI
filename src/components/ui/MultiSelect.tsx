// MultiSelect — dropdown multi-pilih generik utk filter (jenis kelas,
// sensei, dsb). Kombinasi filter antar MultiSelect = AND di sisi pemakai.
// Kelas Tailwind statis (tidak ada concatenation dinamis).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
  /** elemen opsional di depan label (mis. dot warna kategori) */
  swatch?: ReactNode;
}

export function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onToggle,
  onReset,
  className = '',
}: {
  label: string;
  options: MultiSelectOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  onReset?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar dropdown
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const active = selected.length > 0;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded border px-3 py-2 font-body-md text-body-md transition-colors ${
          active
            ? 'border-primary bg-primary-fixed/30 text-primary'
            : 'border-border-input bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
        }`}
      >
        <span className="truncate">{label}</span>
        {active && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-label-sm text-label-sm text-on-primary">
            {selected.length}
          </span>
        )}
        <Icon name={open ? 'expand_less' : 'expand_more'} size={18} className="ml-auto shrink-0 text-secondary" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-card border border-outline-variant bg-surface-container-lowest py-1 shadow-floating">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-body-md text-body-md text-on-surface hover:bg-surface-container-low"
              >
                <input type="checkbox" readOnly checked={checked} className="pointer-events-none accent-[#102b8c]" />
                {opt.swatch}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
          {active && onReset && (
            <>
              <div className="my-1 border-t border-border-soft" />
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-label-md text-label-md text-error hover:bg-surface-container-low"
              >
                <Icon name="filter_alt_off" size={16} /> Hapus pilihan ini
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Tombol reset semua filter (satu klik kembali ke default) */
export function ResetFiltersButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded border border-outline-variant px-3 py-2 font-label-md text-label-md text-secondary transition-colors hover:bg-surface-container-low hover:text-on-surface"
    >
      <Icon name="restart_alt" size={16} /> Reset filter
    </button>
  );
}
