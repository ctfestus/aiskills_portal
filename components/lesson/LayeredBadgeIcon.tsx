import type { ReactNode } from 'react';

interface LayeredBadgeIconProps {
  children: ReactNode;
  size?: number;
  className?: string;
  label?: string;
}

/**
 * Shared dimensional badge for interactive lesson tools. The glyph is supplied by
 * each tool, while the offset layer, depth, gloss, and sizing remain consistent.
 */
export function LayeredBadgeIcon({ children, size = 23, className, label }: LayeredBadgeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x="5" y="2.7" width="16.6" height="16.2" rx="3.8" fill="currentColor" opacity="0.24" />
      <rect x="3" y="6" width="16.6" height="16.2" rx="3.8" fill="currentColor" opacity="0.22" />
      <rect x="3" y="4.2" width="16.6" height="16.2" rx="3.8" fill="currentColor" />
      <path d="M3.8 9.4 14.3 4.2h4.1c.7 0 1.2.5 1.2 1.2v2L5.7 13.7H3V11c0-.7.3-1.3.8-1.6Z" fill="#fff" opacity="0.18" />
      {children}
    </svg>
  );
}
