'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { FONTS, FontOption, loadGoogleFont } from '@/lib/fonts';

interface FontPickerModalProps {
  currentFont: string;
  onSelect: (fontId: string) => void;
  onClose: () => void;
  dark?: boolean;
}

const CATEGORIES: { key: FontOption['category']; label: string }[] = [
  { key: 'sans',  label: 'Sans-serif' },
  { key: 'serif', label: 'Serif' },
  { key: 'mono',  label: 'Monospace' },
];

export function FontPickerModal({ currentFont, onSelect, onClose, dark = true }: FontPickerModalProps) {
  // Load all Google Fonts when modal opens
  useEffect(() => {
    FONTS.forEach(loadGoogleFont);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const bg      = dark ? '#1a1a1a' : '#ffffff';
  const border  = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
  const catLbl  = dark ? '#555' : '#aaa';
  const text    = dark ? '#f0f0f0' : '#111';
  const hover   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const active  = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const divider = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: bg, border: `1px solid ${border}`, maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${divider}` }}>
          <p className="text-sm font-semibold" style={{ color: text }}>Choose a Font</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:opacity-60"
            style={{ color: catLbl }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Font list */}
        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-4">
          {CATEGORIES.map(({ key, label }) => (
            <div key={key}>
              <p className="px-2 pb-1.5 text-[10px] uppercase tracking-widest font-semibold" style={{ color: catLbl }}>
                {label}
              </p>
              <div className="space-y-0.5">
                {FONTS.filter(f => f.category === key).map(f => {
                  const selected = currentFont === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => { onSelect(f.id); onClose(); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left"
                      style={{
                        background: selected ? active : 'transparent',
                        fontFamily: f.cssFamily,
                      }}
                      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = hover; }}
                      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: text }}>{f.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: catLbl }}>The quick brown fox jumps</p>
                      </div>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: text }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
