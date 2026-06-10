'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start with 'light' so server and initial client render match.
  // Read localStorage in useEffect (after hydration) to avoid mismatch.
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = (localStorage.getItem('ff-theme') as Theme) === 'dark' ? 'dark' : 'light';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    document.documentElement.style.colorScheme = saved;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ff-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.style.colorScheme = next;
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {/* reducedMotion="user" makes every motion/react animation honor the OS "Reduce motion" setting automatically (WCAG 2.3.3). */}
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </ThemeContext.Provider>
  );
}
