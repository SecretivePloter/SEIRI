// StatCard — kartu metrik (dashboard, daftar kelas, ketersediaan).

import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function StatCard({
  label,
  value,
  suffix,
  sub,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  sub?: ReactNode;
  icon?: string;
  tone?: 'default' | 'accent' | 'warn';
}) {
  const iconBg =
    tone === 'accent'
      ? 'bg-primary-container/20 text-primary'
      : tone === 'warn'
        ? 'bg-error-container text-on-error-container'
        : 'bg-surface-variant text-on-surface-variant';

  return (
    <div className="flex items-center gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-sm transition-colors hover:border-primary/30">
      {icon && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          <Icon name={icon} size={24} />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{label}</p>
        <p className="mt-0.5 font-display-lg text-display-lg text-on-surface">
          {value}
          {suffix && <span className="ml-1 font-body-md text-headline-sm text-secondary">{suffix}</span>}
        </p>
        {sub && <div className="font-label-sm text-label-sm text-secondary">{sub}</div>}
      </div>
    </div>
  );
}
