// Form controls: Input, Select, Textarea + Field wrapper (label + error).
// Gaya mengikuti DESIGN.md: border #CBD5E1, focus indigo + glow 2px @10%.

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const controlBase =
  'w-full rounded border border-border-input bg-surface-container-lowest px-3 py-2 ' +
  'font-body-md text-body-md text-on-surface placeholder:text-secondary/60 ' +
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 ' +
  'disabled:opacity-50 disabled:bg-surface-container-low';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlBase} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlBase} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlBase} min-h-[72px] ${className}`} {...props} />;
}

/** Wrapper label + control + pesan error */
export function Field({
  label,
  error,
  hint,
  required,
  className = '',
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="font-label-md text-label-md text-on-surface-variant">
        {label} {required && <span className="text-error">*</span>}
      </span>
      {children}
      {hint && !error && <span className="font-label-sm text-label-sm text-secondary">{hint}</span>}
      {error && <span className="font-label-sm text-label-sm text-error">{error}</span>}
    </label>
  );
}
