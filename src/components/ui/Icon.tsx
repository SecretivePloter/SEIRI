// Ikon Material Symbols — satu cara pakai ikon di seluruh app.

export function Icon({ name, className = '', size }: { name: string; className?: string; size?: number }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={size ? { fontSize: size } : undefined}
      aria-hidden
    >
      {name}
    </span>
  );
}
