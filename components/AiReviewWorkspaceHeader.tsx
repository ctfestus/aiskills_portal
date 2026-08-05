'use client';

import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  accentColor: string;
  isDark: boolean;
  reviewsUsed?: number;
  maxReviews?: number;
  analyzing?: boolean;
}

export default function AiReviewWorkspaceHeader({ icon, title, description, accentColor, isDark, reviewsUsed = 0, maxReviews, analyzing = false }: Props) {
  const surface = isDark ? 'rgba(255,255,255,0.035)' : '#f7f8fa';
  const text = isDark ? '#edf1f5' : '#111827';
  const muted = isDark ? '#8d99a6' : '#667085';
  const remaining = maxReviews === undefined ? null : Math.max(0, maxReviews - reviewsUsed);

  return (
    <div className="rounded-2xl px-4 py-4 sm:px-5" style={{ background: surface }}>
      <div className="flex items-start gap-3.5">
        <span className="relative inline-flex w-11 h-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: accentColor, background: `${accentColor}16` }}>
          {icon}
          {analyzing && <span className="absolute inset-0 rounded-xl animate-ping motion-reduce:animate-none" style={{ border: `1px solid ${accentColor}`, opacity: 0.3 }} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accentColor }}>
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: accentColor }}>
                {analyzing && <span className="absolute inset-0 rounded-full animate-ping motion-reduce:animate-none" style={{ background: accentColor, opacity: 0.45 }} />}
              </span>
              {analyzing ? 'AI analysing' : 'AI review workspace'}
            </p>
            {remaining !== null && (
              <span className="rounded-lg px-2 py-1 text-[9px] font-bold tabular-nums" style={{ color: muted, background: isDark ? 'rgba(255,255,255,0.045)' : '#fff' }}>
                {remaining} of {maxReviews} review{maxReviews === 1 ? '' : 's'} left
              </span>
            )}
          </div>
          <h3 className="mt-1 text-[15px] font-bold leading-snug" style={{ color: text }}>{title}</h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: muted }}>{description}</p>
        </div>
      </div>
      {maxReviews !== undefined && maxReviews > 0 && (
        <div className="mt-3.5 flex gap-1.5" aria-label={`${reviewsUsed} of ${maxReviews} review attempts used`}>
          {Array.from({ length: maxReviews }, (_, index) => (
            <span key={index} className="h-1 flex-1 rounded-full" style={{ background: index < reviewsUsed ? (isDark ? 'rgba(255,255,255,0.12)' : '#d7dce3') : accentColor, opacity: index < reviewsUsed ? 1 : 0.65 }} />
          ))}
        </div>
      )}
    </div>
  );
}
