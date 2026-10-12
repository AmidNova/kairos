import { useId } from "react";

/**
 * Symbole Kairos : une courbe de prix qui croise un point — le moment opportun.
 * La tuile s'inverse avec le thème (encre en clair, ivoire en sombre).
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-from)" />
          <stop offset="100%" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--text)" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="var(--bg)" strokeOpacity="0.18" strokeWidth="1.25" />
      <path
        d="M6.5 11.5 L12 15 L16 12.5 L25.5 21.5"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="17.25" r="2.6" fill="var(--brand-from)" stroke="var(--text)" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[26px] leading-none italic tracking-tight">Kairos</span>
    </span>
  );
}
