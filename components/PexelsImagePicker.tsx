'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Check, Image as ImageIcon } from 'lucide-react';

interface Photo {
  id: number;
  photographer: string;
  alt: string;
  src: { medium: string; large: string };
}

interface Props {
  value: string | null;
  altValue: string | null;
  onChange: (url: string, alt: string) => void;
  onClear: () => void;
  C: {
    card: string;
    cardBorder: string;
    input: string;
    text: string;
    muted: string;
    faint: string;
    cta: string;
    ctaText: string;
    divider: string;
  };
  token: string;
}

const DEFAULT_QUERY = 'data technology africa business';

export function PexelsImagePicker({ value, altValue, onChange, onClear, C }: Props) {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState('');
  const [photos, setPhotos]       = useState<Photo[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchPhotos(q: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pexels-search?q=${encodeURIComponent(q)}&per_page=18`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Search failed'); return; }
      setPhotos(json.photos ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  // Load defaults when modal opens
  useEffect(() => {
    if (open) fetchPhotos(DEFAULT_QUERY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPhotos(query.trim() || DEFAULT_QUERY);
    }, 420);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function select(photo: Photo) {
    setSelectedId(photo.id);
    onChange(photo.src.large, photo.photographer);
    setOpen(false);
  }

  function openModal() {
    setQuery('');
    setPhotos([]);
    setError('');
    setOpen(true);
  }

  return (
    <>
      {/* Trigger */}
      {value ? (
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', background: C.input }}>
          <img src={value} alt={altValue ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div
            className="pexels-overlay"
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.42)'; (e.currentTarget.querySelectorAll('button') as NodeListOf<HTMLElement>).forEach(b => b.style.opacity = '1'); }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; (e.currentTarget.querySelectorAll('button') as NodeListOf<HTMLElement>).forEach(b => b.style.opacity = '0'); }}
          >
            <button
              onClick={openModal}
              style={{ opacity: 0, transition: 'opacity 0.2s', padding: '8px 18px', borderRadius: 9, border: 'none', background: 'white', color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Change
            </button>
            <button
              onClick={onClear}
              style={{ opacity: 0, transition: 'opacity 0.2s', padding: '8px 13px', borderRadius: 9, border: 'none', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <X size={12} /> Remove
            </button>
          </div>
          {altValue && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 11, padding: '5px 10px', pointerEvents: 'none' }}>
              Photo by {altValue} on Pexels
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={openModal}
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: 14, border: `2px dashed ${C.cardBorder}`, background: C.input, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.faint, transition: 'border-color 0.2s, color 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.cta; e.currentTarget.style.color = C.cta; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.cardBorder; e.currentTarget.style.color = C.faint; }}
        >
          <ImageIcon size={30} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Browse Pexels photos</span>
          <span style={{ fontSize: 12 }}>Click to search and select a cover image</span>
        </button>
      )}

      {/* Modal - rendered in a portal so parent overflow/transform cannot clip it */}
      {open && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ background: C.card, borderRadius: 22, width: '100%', maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.faint, pointerEvents: 'none' }} />
                {loading && (
                  <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: C.faint }} />
                )}
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Type to search... e.g. sales, africa, technology, finance"
                  style={{ width: '100%', padding: '12px 42px 12px 42px', borderRadius: 12, border: `1.5px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: C.input, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.muted }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Label row */}
            <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.faint, fontWeight: 600 }}>
                {query.trim() ? `Results for "${query.trim()}"` : 'Suggested photos -- type above to search'}
              </p>
            </div>

            {/* Grid body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 20px' }}>
              {error && <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', padding: 20 }}>{error}</p>}

              {!error && loading && photos.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: C.faint }}>
                  <Loader2 size={30} className="animate-spin" />
                </div>
              )}

              {!error && photos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {photos.map(photo => {
                    const isSel = selectedId === photo.id;
                    return (
                      <button
                        key={photo.id}
                        onClick={() => select(photo)}
                        style={{
                          position: 'relative', padding: 0, margin: 0,
                          border: isSel ? `3px solid ${C.cta}` : '3px solid transparent',
                          borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                          background: C.input, display: 'block', width: '100%',
                          transition: 'border-color 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = `${C.cta}80`; e.currentTarget.style.transform = 'scale(1.02)'; }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        <img
                          src={photo.src.medium}
                          alt={photo.alt || photo.photographer}
                          style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                        />
                        {/* Photographer credit */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.62))',
                          padding: '18px 8px 6px', color: 'white', fontSize: 11,
                          textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {photo.photographer}
                        </div>
                        {/* Selected overlay */}
                        {isSel && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: C.cta, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={18} color="white" strokeWidth={3} />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 24px', borderTop: `1px solid ${C.divider}`, fontSize: 11, color: C.faint, textAlign: 'center', flexShrink: 0 }}>
              Photos provided by <strong>Pexels</strong> - free to use, no attribution required
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
