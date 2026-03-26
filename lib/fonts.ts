export interface FontOption {
  id: string;
  name: string;
  category: 'sans' | 'serif' | 'mono';
  googleFamily?: string; // undefined = system font, no network request
  cssFamily: string;
}

export const FONTS: FontOption[] = [
  // Sans-serif
  { id: 'sans',    name: 'System Sans',      category: 'sans',  cssFamily: 'ui-sans-serif, system-ui, sans-serif' },
  { id: 'inter',   name: 'Inter',             category: 'sans',  googleFamily: 'Inter:wght@400;500;600;700',             cssFamily: "'Inter', sans-serif" },
  { id: 'lato',    name: 'Lato',              category: 'sans',  googleFamily: 'Lato:wght@400;700',                      cssFamily: "'Lato', sans-serif" },
  { id: 'poppins', name: 'Poppins',           category: 'sans',  googleFamily: 'Poppins:wght@400;500;600;700',           cssFamily: "'Poppins', sans-serif" },
  { id: 'nunito',  name: 'Nunito',            category: 'sans',  googleFamily: 'Nunito:wght@400;500;600;700',            cssFamily: "'Nunito', sans-serif" },
  { id: 'outfit',  name: 'Outfit',            category: 'sans',  googleFamily: 'Outfit:wght@400;500;600;700',            cssFamily: "'Outfit', sans-serif" },
  // Serif
  { id: 'serif',     name: 'System Serif',     category: 'serif', cssFamily: 'ui-serif, Georgia, serif' },
  { id: 'lora',      name: 'Lora',             category: 'serif', googleFamily: 'Lora:wght@400;500;600;700',             cssFamily: "'Lora', serif" },
  { id: 'merriweather', name: 'Merriweather',  category: 'serif', googleFamily: 'Merriweather:wght@400;700',             cssFamily: "'Merriweather', serif" },
  { id: 'playfair',  name: 'Playfair Display', category: 'serif', googleFamily: 'Playfair+Display:wght@400;500;600;700', cssFamily: "'Playfair Display', serif" },
  // Monospace
  { id: 'mono',       name: 'System Mono',      category: 'mono',  cssFamily: 'ui-monospace, monospace' },
  { id: 'jetbrains',  name: 'JetBrains Mono',   category: 'mono',  googleFamily: 'JetBrains+Mono:wght@400;500;700',      cssFamily: "'JetBrains Mono', monospace" },
  { id: 'fira',       name: 'Fira Code',         category: 'mono',  googleFamily: 'Fira+Code:wght@400;500;700',           cssFamily: "'Fira Code', monospace" },
];

export function getFontById(id: string): FontOption {
  return FONTS.find(f => f.id === id) ?? FONTS[0];
}

/** Inject a Google Font <link> into document.head — no-op if already loaded or no googleFamily. */
export function loadGoogleFont(font: FontOption): void {
  if (typeof document === 'undefined') return; // SSR guard
  if (!font.googleFamily) return;
  const id = `gfont-${font.id}`;
  if (document.getElementById(id)) return; // already loaded
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}
