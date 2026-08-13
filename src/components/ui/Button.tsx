// Button — varian mengikuti DESIGN.md:
// primary (solid indigo), secondary (outline indigo), ghost (text indigo),
// danger (solid merah utk aksi merusak), neutral-outline utk toolbar.

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-label-md text-label-md ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-container',
  secondary: 'border border-primary text-primary hover:bg-primary-fixed/40',
  ghost: 'text-primary hover:bg-primary-fixed/30',
  danger: 'bg-error text-on-error hover:bg-[#a01414]',
  outline: 'border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
