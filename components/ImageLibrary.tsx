'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Upload, Loader2, Images } from 'lucide-react';
import { useC } from '@/lib/theme';
import { uploadToCloudinaryWithMeta } from '@/lib/uploadToCloudinary';

export interface LibraryImage {
  publicId: string;
  url: string;
  thumbUrl: string;
  folder: string;
  format?: string;
  createdAt: string;
  width: number;
  height: number;
}

interface Props {
  onSelect: (value: string) => void;
  onClose: () => void;
  /** Folder used when uploading a new image from within the library. */
  uploadFolder?: string;
  /** Pre-select this folder filter on open. */
  initialFolder?: string;
  /**
   * Persist a stable Cloudinary public_id instead of a full URL (resolved at render
   * via resolveCoverUrl). Use for content covers so switching accounts can't orphan them.
   * SVGs still return a full URL (they must not be f_auto-transformed).
   */
  returnPublicId?: boolean;
}

const FOLDERS = [
  { value: '', label: 'All images' },
  { value: 'lesson-images', label: 'Lesson images' },
  { value: 'covers', label: 'Covers' },
  { value: 'course-options', label: 'Course options' },
  { value: 'datasets/covers', label: 'Dataset covers' },
  { value: 'avatars', label: 'Avatars' },
  { value: 'tool-logos', label: 'Tool logos' },
];

export function ImageLibrary({ onSelect, onClose, uploadFolder, initialFolder, returnPublicId }: Props) {
  const C = useC();
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [folder, setFolder] = useState(initialFolder ?? '');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchImages = useCallback(async (cursor?: string) => {
    setLoading(true);
    if (!cursor) setError('');
    try {
      const params = new URLSearchParams();
      if (folder) params.set('folder', folder);
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/assets?${params}`);
      if (!res.ok) throw new Error('Failed to load library');
      const data = await res.json();
      setImages(prev => cursor ? [...prev, ...data.images] : data.images);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setError('Could not load images. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    setImages([]);
    setNextCursor(null);
    fetchImages();
  }, [fetchImages]);

  // For cover usage we persist the bare public_id; SVGs keep their full URL.
  const valueOf = (img: LibraryImage) =>
    returnPublicId && img.format !== 'svg' ? img.publicId : img.url;

  async function handleUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const { url, publicId } = await uploadToCloudinaryWithMeta(file, uploadFolder ?? (folder || 'assets'));
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      onSelect(returnPublicId && !isSvg ? (publicId || url) : url);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Upload failed');
      setUploading(false);
    }
  }

  const filtered = search.trim()
    ? images.filter(img =>
        img.publicId.toLowerCase().includes(search.toLowerCase()) ||
        img.folder.toLowerCase().includes(search.toLowerCase())
      )
    : images;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.card, borderRadius: 22, width: '100%', maxWidth: 880, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Images size={18} style={{ color: C.cta, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text, flex: 1 }}>Image Library</span>
          <label style={{ padding: '8px 14px', borderRadius: 10, background: C.cta, color: C.ctaText, fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Upload new
            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
          </label>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: C.input, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.divider}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.faint, pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by name..."
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <select
            value={folder}
            onChange={e => { setFolder(e.target.value); setSearch(''); }}
            style={{ padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            {FOLDERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
          {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

          {loading && images.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted }}>
              <Loader2 size={28} className="animate-spin" />
            </div>
          )}

          {!loading && !error && images.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
              <Images size={44} style={{ opacity: 0.25, marginBottom: 14, display: 'block', margin: '0 auto 14px' }} />
              <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>No images yet</p>
              <p style={{ fontSize: 13, margin: 0 }}>Use the Upload button to add your first image.</p>
            </div>
          )}

          {filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
              {filtered.map(img => (
                <button
                  key={img.publicId}
                  onClick={() => { onSelect(valueOf(img)); onClose(); }}
                  style={{ position: 'relative', padding: 0, borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', border: '3px solid transparent', cursor: 'pointer', background: C.input, transition: 'border-color 0.15s, transform 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.cta; e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <img src={img.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', padding: '20px 8px 7px' }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {img.folder}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!search.trim() && nextCursor && !loading && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => fetchImages(nextCursor)}
                style={{ padding: '9px 22px', borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Load more
              </button>
            </div>
          )}

          {loading && images.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: C.muted }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${C.divider}`, fontSize: 11, color: C.faint, textAlign: 'center', flexShrink: 0 }}>
          Images are stored securely on Cloudinary
        </div>
      </div>
    </div>,
    document.body
  );
}
