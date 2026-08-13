// Loading / Empty / Error states — setiap halaman WAJIB pakai salah satu.
// ErrorState selalu menyediakan tombol retry (NFR: jangan asumsikan
// network sukses).

import { Button } from './Button';
import { Icon } from './Icon';

export function LoadingState({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-secondary">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
      <p className="font-body-md text-body-md">{label}</p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-container-high ${className}`} />;
}

/** Skeleton baris tabel */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[52px] w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="material-symbols-outlined text-4xl text-outline-variant" aria-hidden>
        {icon}
      </span>
      <p className="font-headline-sm text-headline-sm text-on-surface">{title}</p>
      {description && <p className="max-w-sm font-body-md text-body-md text-secondary">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-error-container p-3 text-on-error-container">
        <Icon name="error" size={28} />
      </div>
      <p className="font-headline-sm text-headline-sm text-on-surface">Terjadi kesalahan</p>
      <p className="max-w-md font-body-md text-body-md text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <Icon name="refresh" size={18} /> Coba lagi
        </Button>
      )}
    </div>
  );
}
