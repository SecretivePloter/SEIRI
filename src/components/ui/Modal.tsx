// Modal — radius 8px, shadow floating, backdrop. Level 2 elevation DESIGN.md.

import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-inverse-surface/40 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`mt-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-card bg-surface-container-lowest shadow-floating`}>
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-secondary hover:bg-surface-container hover:text-on-surface"
            aria-label="Tutup"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-border-soft px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
