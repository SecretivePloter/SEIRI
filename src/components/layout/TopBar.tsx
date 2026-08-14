// TopBar — bar navigasi mode (Today/Weekly/Monthly) + aksi halaman.

import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

export function TopBar({
  title,
  subtitle,
  nav,
  actions,
}: {
  title: string;
  subtitle?: string;
  nav?: ReactNode; // tab navigasi mode timeline
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-gutter pl-12 md:pl-gutter">
      <div className="min-w-0">
        <h2 className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">{title}</h2>
        {subtitle && <p className="truncate font-label-sm text-label-sm text-secondary">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {nav}
        {actions}
      </div>
    </header>
  );
}

/** Segmented control utk mode Today/Weekly/Monthly */
export function ModeTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-outline-variant bg-surface-container-low p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-4 py-1.5 font-label-md text-label-md transition-colors ${
            value === o.value
              ? 'border border-outline-variant bg-surface text-primary shadow-sm'
              : 'text-secondary hover:text-primary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Navigasi periode (prev / label / next) */
export function PeriodNav({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface px-2 py-1">
      <button onClick={onPrev} className="rounded p-1 text-secondary hover:bg-surface-container hover:text-on-surface" aria-label="Sebelumnya">
        <Icon name="chevron_left" size={18} />
      </button>
      <span className="min-w-[140px] text-center font-label-md text-label-md text-on-surface">{label}</span>
      <button onClick={onNext} className="rounded p-1 text-secondary hover:bg-surface-container hover:text-on-surface" aria-label="Berikutnya">
        <Icon name="chevron_right" size={18} />
      </button>
    </div>
  );
}
