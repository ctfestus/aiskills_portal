'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, X, ArrowDownToLine, Loader2, Minus, Plus } from 'lucide-react';
import { pdfPageImageUrl, pdfDownloadUrl } from '@/lib/cloudinary-pdf';

interface PdfCarouselProps {
  url: string;                 // Cloudinary PDF url
  pages: number;               // total page count
  fileName?: string;
  accent?: string;
  isDark?: boolean;
  allowDownload?: boolean;
}

const PAGE_ASPECT = 0.773;     // letter-portrait width/height; pages object-contain inside
const SLIDE = 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * LinkedIn-style document carousel: the active page sits centred with its
 * neighbours peeking at the edges, all pages the same size. Pages are
 * delivered as Cloudinary page-images (no client PDF engine). Inline shows
 * the peek filmstrip; fullscreen shows one large page.
 */
export default function PdfCarousel({
  url, pages, fileName, accent = '#006128', isDark = false, allowDownload = true,
}: PdfCarouselProps) {
  const total = Math.max(1, Math.floor(pages) || 1);
  const [page, setPage] = useState(1);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set());
  const markLoaded = useCallback((p: number) => {
    setLoadedSet(prev => (prev.has(p) ? prev : new Set(prev).add(p)));
  }, []);
  // Fullscreen hi-res layer load tracking (separate, larger image)
  const [hiResSet, setHiResSet] = useState<Set<number>>(() => new Set());
  const markHiRes = useCallback((p: number) => {
    setHiResSet(prev => (prev.has(p) ? prev : new Set(prev).add(p)));
  }, []);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);      // fullscreen zoom factor
  const [cw, setCw] = useState(0);          // measured container width
  const wrapRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback((delta: number) => {
    setPage(p => Math.min(total, Math.max(1, p + delta)));
    setZoom(1);
  }, [total]);

  const jumpTo = useCallback((p: number) => {
    setPage(Math.min(total, Math.max(1, p)));
    setZoom(1);
  }, [total]);

  // Custom progress slider (drag/click to seek)
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const seek = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el || total <= 1) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    jumpTo(Math.round(ratio * (total - 1)) + 1);
  }, [total, jumpTo]);
  const progressPct = total > 1 ? ((page - 1) / (total - 1)) * 100 : 0;

  // Measure the container width. ResizeObserver fires on observe, so there is
  // no synchronous setState in the effect body.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setCw(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keyboard navigation while fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, go]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  // -- geometry: size pages by height (kept modest), then constrain the
  // visible "stage" so neighbours only peek a little and gaps stay tight --
  const narrow = cw > 0 && cw < 560;
  const gap = narrow ? 8 : 12;
  // Pages are a sensible fixed height; the full width is then filled by however
  // many pages fit (more on wide screens, ~1 on mobile). Width is capped so a
  // single page never dominates a narrow container.
  const MAX_H = 480;
  let pageH = MAX_H;
  let pageW = Math.round(pageH * PAGE_ASPECT);
  const maxW = cw > 0 ? Math.round(cw * (narrow ? 0.86 : 0.62)) : pageW;
  if (pageW > maxW) { pageW = maxW; pageH = Math.round(pageW / PAGE_ASPECT); }
  const stageW = cw > 0 ? cw - 32 : 0;   // 16px subtle-grey inset on left/right (matches top/bottom)

  // Scroll the track to keep the active page centred, but clamp at both ends so
  // the first page is left-aligned and the last is right-aligned (LinkedIn-style).
  const pitch = pageW + gap;
  const trackW = total * pageW + (total - 1) * gap;
  const rawScroll = (page - 1) * pitch + pageW / 2 - stageW / 2;
  const maxScroll = trackW - stageW;
  const scrollX = maxScroll <= 0 ? maxScroll / 2 : Math.max(0, Math.min(rawScroll, maxScroll));

  const btnBg = 'rgba(255,255,255,0.92)';
  const btnIcon = '#3f3f46';

  const circleBtn = (onClick: () => void, pos: React.CSSProperties, icon: React.ReactNode, label: string, hidden = false) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute z-30 flex items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95"
      style={{
        width: 42, height: 42, background: btnBg, color: btnIcon, backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : 'auto', ...pos,
      }}
    >
      {icon}
    </button>
  );

  // Render a small window of pages around the active one
  const start = Math.max(1, page - 2);
  const end = Math.min(total, page + 2);
  const windowPages: number[] = [];
  for (let i = start; i <= end; i++) windowPages.push(i);

  return (
    <>
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl select-none"
        style={{ height: pageH + 32, background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f2f4' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Stage: constrains how much of the neighbours peeks in */}
        {cw > 0 && (
          <div className="absolute overflow-hidden"
            style={{ left: '50%', top: '50%', width: stageW, height: pageH, transform: 'translate(-50%, -50%)' }}>
            {windowPages.map(i => {
              const active = i === page;
              const x = (i - 1) * pitch - scrollX;
              return (
                <div
                  key={i}
                  onClick={() => !active && setPage(i)}
                  className="absolute rounded-lg overflow-hidden"
                  style={{
                    width: pageW, height: pageH, left: 0, top: '50%',
                    transform: `translate(${x}px, -50%)`,
                    transition: `${SLIDE}, opacity 0.34s`,
                    opacity: active ? 1 : 0.92,
                    cursor: active ? 'default' : 'pointer',
                    background: '#fff',
                  }}
                >
                  {active && !loadedSet.has(i) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} />
                    </div>
                  )}
                  <img
                    ref={el => { if (el && el.complete && el.naturalWidth > 0) markLoaded(i); }}
                    src={pdfPageImageUrl(url, i, 1400)}
                    alt={`Page ${i}`}
                    onLoad={() => markLoaded(i)}
                    draggable={false}
                    className="w-full h-full object-contain"
                    style={{ opacity: loadedSet.has(i) ? 1 : 0, transition: 'opacity 0.15s' }}
                  />
                </div>
              );
            })}

            {circleBtn(() => go(-1), { left: 8, top: '50%', transform: 'translateY(-50%)' }, <ChevronLeft className="w-6 h-6" />, 'Previous page', page <= 1)}
            {circleBtn(() => go(1), { right: 8, top: '50%', transform: 'translateY(-50%)' }, <ChevronRight className="w-6 h-6" />, 'Next page', page >= total)}
          </div>
        )}

        {/* Fullscreen */}
        {circleBtn(() => { setFullscreen(true); setZoom(1); }, { right: 12, bottom: 12 }, <Maximize2 className="w-5 h-5" />, 'Fullscreen')}
      </div>

      {/* Fullscreen overlay -- grey bars + light page area, custom progress bar */}
      {fullscreen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] flex flex-col" style={{ background: '#e9eaec' }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

          {/* Top bar */}
          <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ background: '#4f4f53' }}>
            <span className="text-[15px] font-semibold truncate flex-1" style={{ color: '#fff' }}>{fileName || 'Document'}</span>
            <span className="text-[13px] tabular-nums hidden sm:block" style={{ color: 'rgba(255,255,255,0.65)' }}>{total} pages</span>
            {allowDownload && (
              <a href={pdfDownloadUrl(url)} target="_blank" rel="noopener noreferrer" download={fileName || true} title="Download"
                className="p-2 rounded-lg transition-colors hover:bg-white/15" style={{ color: '#fff' }}>
                <ArrowDownToLine className="w-5 h-5" />
              </a>
            )}
            <button type="button" onClick={() => { setFullscreen(false); setZoom(1); }} title="Close"
              className="p-2 rounded-lg transition-colors hover:bg-white/15" style={{ color: '#fff' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Page area -- flex + m-auto on the image (not items-center) so the top stays scrollable when the page is zoomed taller than the view */}
          <div className="relative flex-1 min-h-0 overflow-auto flex p-6">
            {!loadedSet.has(page) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} />
              </div>
            )}
            <div className="relative m-auto" style={{ height: `${84 * zoom}vh`, maxWidth: zoom === 1 ? '100%' : 'none' }}>
              {/* Instant low-res base (already cached from the inline carousel) */}
              <img
                ref={el => { if (el && el.complete && el.naturalWidth > 0) markLoaded(page); }}
                src={pdfPageImageUrl(url, page, 1400)}
                alt=""
                onLoad={() => markLoaded(page)}
                draggable={false}
                className="block h-full w-auto max-w-full object-contain"
                style={{ opacity: loadedSet.has(page) ? 1 : 0, transition: 'opacity 0.15s' }}
              />
              {/* Sharp hi-res, fades in over the base */}
              <img
                key={page}
                ref={el => { if (el && el.complete && el.naturalWidth > 0) markHiRes(page); }}
                src={pdfPageImageUrl(url, page, 2800)}
                alt={`Page ${page}`}
                onLoad={() => markHiRes(page)}
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ opacity: hiResSet.has(page) ? 1 : 0, transition: 'opacity 0.2s' }}
              />
            </div>
            {[-1 as const, 1 as const].map(dir => {
              const hidden = dir === -1 ? page <= 1 : page >= total;
              return (
                <button key={dir} type="button" onClick={() => go(dir)}
                  aria-label={dir === -1 ? 'Previous page' : 'Next page'}
                  className="fixed top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full text-white transition-all hover:scale-105 active:scale-95"
                  style={{
                    [dir === -1 ? 'left' : 'right']: 16,
                    background: 'rgba(0,0,0,0.5)',
                    opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : 'auto',
                  } as React.CSSProperties}>
                  {dir === -1 ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                </button>
              );
            })}
          </div>

          {/* Bottom bar: counter + custom progress bar + zoom */}
          <div className="flex items-center gap-4 px-5 py-3 flex-shrink-0" style={{ background: '#4f4f53' }}>
            <span className="text-[13px] font-semibold tabular-nums flex-shrink-0" style={{ color: '#fff' }}>{page} / {total}</span>

            <div
              ref={trackRef}
              className="relative flex-1 h-5 flex items-center cursor-pointer touch-none"
              onPointerDown={e => { setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); seek(e.clientX); }}
              onPointerMove={e => { if (dragging) seek(e.clientX); }}
              onPointerUp={e => { setDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
            >
              <div className="w-full h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }}>
                <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: '#fff' }} />
              </div>
              <div className="absolute w-3.5 h-3.5 rounded-full bg-white"
                style={{ left: `${progressPct}%`, transform: 'translateX(-50%)', boxShadow: '0 1px 4px rgba(0,0,0,0.45)' }} />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button type="button" onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                disabled={zoom <= 1} title="Zoom out"
                className="w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
                style={{ color: '#fff' }}>
                <Minus className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                disabled={zoom >= 3} title="Zoom in"
                className="w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
                style={{ color: '#fff' }}>
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
