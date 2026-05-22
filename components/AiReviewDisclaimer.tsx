'use client';

const AI_REVIEW_DISCLAIMER =
  'This review is AI-generated and intended to support learning and improvement. It may contain mistakes, so please double-check important feedback, calculations, dashboard insights, and recommendations.';

interface Props {
  isDark?: boolean;
}

export default function AiReviewDisclaimer({ isDark = false }: Props) {
  return (
    <p
      className="text-[10.5px] leading-relaxed"
      style={{
        color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(17,24,39,0.45)',
      }}
    >
      {AI_REVIEW_DISCLAIMER}
    </p>
  );
}
