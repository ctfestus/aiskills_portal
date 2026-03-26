'use client';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed bottom-5 right-5 z-[9998] w-10 h-10 rounded-full border shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      style={{
        background: theme === 'dark' ? '#27272a' : '#ffffff',
        borderColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
        color: theme === 'dark' ? '#e4e4e7' : '#18181b',
        boxShadow: theme === 'dark'
          ? '0 4px 14px rgba(0,0,0,0.5)'
          : '0 4px 14px rgba(0,0,0,0.12)',
      }}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
