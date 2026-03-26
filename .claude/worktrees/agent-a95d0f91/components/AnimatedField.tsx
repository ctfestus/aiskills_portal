import React from 'react';

export type ThemeColor = 'forest' | 'lime' | 'emerald' | 'rose' | 'amber';
export type ThemeMode = 'light' | 'dark' | 'auto';

const themeStyles: Record<ThemeColor, React.CSSProperties> = {
  forest:  { '--theme-color-1': '#006128', '--theme-color-2': '#ADEE66' } as React.CSSProperties,
  lime:    { '--theme-color-1': '#ADEE66', '--theme-color-2': '#006128' } as React.CSSProperties,
  emerald: { '--theme-color-1': '#10b981', '--theme-color-2': '#3b82f6' } as React.CSSProperties,
  rose:    { '--theme-color-1': '#f43f5e', '--theme-color-2': '#fb923c' } as React.CSSProperties,
  amber:   { '--theme-color-1': '#f59e0b', '--theme-color-2': '#ef4444' } as React.CSSProperties,
};

export function AnimatedField({ 
  children, 
  className = '', 
  theme = 'forest',
  mode = 'dark'
}: { 
  children: React.ReactNode, 
  className?: string, 
  theme?: ThemeColor,
  mode?: ThemeMode
}) {
  const innerBg = mode === 'light' ? 'bg-white' : 'bg-zinc-950'; // 'auto' resolves to dark (bg-zinc-950) by default
  return (
    <div className={`animated-border-wrapper ${className}`} style={themeStyles[theme]}>
      <div className={`animated-border-inner ${innerBg}`}>
        {children}
      </div>
    </div>
  );
}
