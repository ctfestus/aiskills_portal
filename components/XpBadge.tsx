'use client';

import { useId } from 'react';

/**
 * XP reward badge -- a chunky glossy crest, the visual language games use for points.
 *
 * Replaces the lucide `Sparkles` glyph on reward surfaces: sparkles reads as "AI" everywhere else in
 * this app (the Ask AI assistant, the AI review players), so using it for XP muddled two very
 * different meanings.
 *
 * Original artwork, deliberately not a copy of any other product's badge asset. Gold is a reward
 * semantic here rather than tenant branding, so it stays gold across tenants -- like a coin.
 *
 *   XpBadge      one crest, for inline and small sizes
 *   XpBadgeStack three crests plus sparkles, for the moment that actually matters
 *
 * Gradient and clip ids come from useId so several badges on one page cannot collide (colons are
 * stripped -- they are legal in an id but brittle inside url(#...) references).
 */

// One crest, drawn in a 28x30 box so all three copies in the stack can share it.
const CREST = 'M5.6 1.4h16.8a3.6 3.6 0 0 1 3.6 3.6v10.9c0 6-4.9 10-12 12.9C6.9 25.9 2 21.9 2 15.9V5a3.6 3.6 0 0 1 3.6-3.6z';
// Lightning bolt: XP as energy. Reads at 16px, where a finer mark would turn to mush.
const BOLT  = 'M16.4 6.2 9.6 16.4h3.8l-1.2 6.9 6.8-10.1h-3.9z';

function useSvgId(): string {
  return useId().replace(/:/g, '');
}

function Gradients({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor="#FFE47A" />
        <stop offset="55%" stopColor="#FFC93C" />
        <stop offset="100%" stopColor="#F5A700" />
      </linearGradient>
      <linearGradient id={`${id}-bronze`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor="#EFC69B" />
        <stop offset="100%" stopColor="#D9A273" />
      </linearGradient>
      <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor="#E4EEF6" />
        <stop offset="100%" stopColor="#BDD1E0" />
      </linearGradient>
      <clipPath id={`${id}-clip`}><path d={CREST} /></clipPath>
    </defs>
  );
}

/** The gloss sweep across a crest, clipped to its shape. */
function Gloss({ id }: { id: string }) {
  return (
    <g clipPath={`url(#${id}-clip)`}>
      <path d="M-4 20 22-6h9L5 26z" fill="#fff" opacity="0.28" />
    </g>
  );
}

/** Gold crest plus its drop shadow and gloss, at the origin of a 28x30 box. */
function GoldCrest({ id }: { id: string }) {
  return (
    <>
      <path d={CREST} fill="#E89600" transform="translate(0 1)" opacity="0.55" />
      <path d={CREST} fill={`url(#${id}-gold)`} />
      <Gloss id={id} />
      <path d={BOLT} fill="#F07800" />
    </>
  );
}

export function XpBadge({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  const id = useSvgId();
  return (
    <svg
      width={size} height={Math.round(size * (30 / 28))} viewBox="0 0 28 30" className={className}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
    >
      <Gradients id={id} />
      <GoldCrest id={id} />
    </svg>
  );
}

/**
 * Three crests fanned out with sparkles -- bronze and silver behind, gold in front.
 * For the reward tile, where there is room for it to read properly.
 */
export function XpBadgeStack({ size = 52, className }: { size?: number; className?: string }) {
  const id = useSvgId();
  return (
    <svg
      width={size} height={Math.round(size * (44 / 56))} viewBox="0 0 56 44" className={className} aria-hidden="true"
    >
      <Gradients id={id} />

      {/* Transform order matters: rotate about the crest's OWN centre (14,15) first, then scale about
          the origin, then position. Rotating about the origin instead splays the side crests into
          wide blobs and pushes them outside the viewBox -- verified by rasterising, not by eye. */}
      <g transform="translate(6.6 12.9) scale(0.74) rotate(-18 14 15)">
        <path d={CREST} fill={`url(#${id}-bronze)`} />
      </g>
      <g transform="translate(28.6 12.9) scale(0.74) rotate(18 14 15)">
        <path d={CREST} fill={`url(#${id}-silver)`} />
      </g>
      <g transform="translate(14 6)">
        <GoldCrest id={id} />
      </g>

      {/* Sparkles sit in the corners the crests leave empty. */}
      <rect x="1.5" y="3" width="5.4" height="5.4" rx="1.6" fill="#FFE066" transform="rotate(45 4.2 5.7)" />
      <rect x="49" y="1.5" width="4.6" height="4.6" rx="1.4" fill="#FFE066" transform="rotate(45 51.3 3.8)" />
      <rect x="49" y="35" width="6" height="6" rx="1.8" fill="#FFE066" transform="rotate(45 52 38)" />
    </svg>
  );
}

export default XpBadge;
