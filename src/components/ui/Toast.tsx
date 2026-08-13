// Renderer toast global — dipasang sekali di AppLayout.

import { useToastStore } from '@/stores/toastStore';
import { Icon } from './Icon';

const kindStyles = {
  success: 'border-cat-bimbel-accent bg-cat-bimbel text-cat-bimbel-text',
  error: 'border-error bg-error-container text-on-error-container',
  info: 'border-primary bg-primary-fixed text-on-primary-fixed',
} as const;

const kindIcons = { success: 'check_circle', error: 'error', info: 'info' } as const;

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-card border-l-4 p-3 shadow-floating ${kindStyles[t.kind]}`}
          role="alert"
        >
          <Icon name={kindIcons[t.kind]} size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-label-md text-label-md">{t.title}</p>
            {t.detail && <p className="mt-0.5 break-words font-body-md text-body-md opacity-80">{t.detail}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Tutup notifikasi">
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
