'use client';

// Shared, presentational audio player.
//
// A native <audio controls> element (theme-neutral browser chrome) inside a themed
// wrapper, with an optional caption line. Self-sufficient (inline styles, theme via
// `isDark`) so it renders correctly OUTSIDE the `.lesson-content` scope too -- it is
// reused by the course player (CourseTaker) and by the standard-attachment previews in
// the authoring editors, in addition to the interactive audio block.

interface LessonAudioPlayerProps {
  src: string;
  title?: string;
  isDark?: boolean;
  className?: string;
}

export function LessonAudioPlayer({ src, title, isDark = false, className = '' }: LessonAudioPlayerProps) {
  if (!src) return null;
  return (
    <div className={className || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <audio
        controls
        src={src}
        preload="metadata"
        // color-scheme pins the browser's native player to the app theme (light/dark),
        // instead of following the OS setting. This is the one visual lever the native
        // <audio> control exposes; its internal buttons/timeline aren't CSS-styleable.
        style={{ width: '100%', borderRadius: 10, colorScheme: isDark ? 'dark' : 'light' }}
      />
      {title ? (
        <span style={{ fontSize: 12.5, color: isDark ? '#a1a1aa' : '#71717a' }}>{title}</span>
      ) : null}
    </div>
  );
}
