'use client';

// Carousel: a stepped lesson container -- learners page through slides with side
// arrows and numbered pagination (1 . 2 . 3 . check), like a guided walkthrough.
//
// Same visibility mechanism as Tabs: active index is local React state surfaced as
// data-active on the wrapper; each slide tags itself with data-slide-index; CSS pairs
// them so only the active slide shows -- no fragile cross-node ProseMirror reactivity.
// Capped at 20 slides (the :nth pairs + addSlide guard).
//
// Card appearance (roundness + border) is set ONCE on the carousel and applied to
// EVERY slide via inherited CSS variables (--card-radius / --cover-radius /
// --card-border-*). Per-slide attrs are content only (cover image, title).

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { ChevronLeft, ChevronRight, Check, Plus, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';
import { ColorField, Segmented, StyleMenu, MenuRow, BORDER_STYLE_OPTIONS, type BorderStyle } from '@/components/lesson/nodes/StyleControls';

const MAX_SLIDES = 20;

type RadiusKey = 'none' | 'sm' | 'md' | 'lg';
const CARD_RADIUS: Record<RadiusKey, number> = { none: 0, sm: 8, md: 14, lg: 22 };
const COVER_RADIUS: Record<RadiusKey, number> = { none: 0, sm: 6, md: 10, lg: 16 };
const RADIUS_OPTIONS: { value: RadiusKey; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
];

function CarouselView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const editable = editor.isEditable;
  const count = node.childCount;
  const [active, setActive] = useState(0);
  const current = Math.min(active, count - 1);

  // Carousel-wide card appearance, applied to all slides via CSS variables.
  const radius = (node.attrs.radius as RadiusKey) in CARD_RADIUS ? (node.attrs.radius as RadiusKey) : 'md';
  const borderStyle = (node.attrs.borderStyle as BorderStyle) || 'none';
  const borderColor = (node.attrs.borderColor as string) || '';
  const cardVars = {
    '--card-radius': `${CARD_RADIUS[radius]}px`,
    '--cover-radius': `${COVER_RADIUS[radius]}px`,
    '--card-border-style': borderStyle === 'none' ? 'none' : borderStyle,
    '--card-border-width': borderStyle === 'none' ? '0' : '1px',
    ...(borderColor ? { '--card-border-color': borderColor } : {}),
  } as React.CSSProperties;

  const go = (i: number) => setActive(Math.max(0, Math.min(i, count - 1)));

  const childPos = (index: number): number | null => {
    const base = typeof getPos === 'function' ? getPos() : undefined;
    if (base == null) return null;
    let found: number | null = null;
    node.forEach((_child, offset, i) => { if (i === index) found = base + 1 + offset; });
    return found;
  };

  const addSlide = () => {
    if (count >= MAX_SLIDES) return;
    const base = typeof getPos === 'function' ? getPos() : undefined;
    if (base == null) return;
    const endInside = base + node.nodeSize - 1;
    editor.chain().focus().insertContentAt(endInside, { type: 'carouselSlide', content: [{ type: 'paragraph' }] }).run();
    setActive(count);
  };

  const removeSlide = (index: number) => {
    if (count <= 1) return;
    const pos = childPos(index);
    if (pos == null) return;
    const size = node.child(index).nodeSize;
    editor.chain().focus().deleteRange({ from: pos, to: pos + size }).run();
    setActive((a) => Math.max(0, Math.min(a, count - 2)));
  };

  return (
    <NodeViewWrapper className="lesson-carousel" data-active={current} style={cardVars}>
      <div className="lesson-carousel__controls" contentEditable={false}>
        {editable && (
          <StyleMenu>
            <MenuRow label="Roundness"><Segmented<RadiusKey> value={radius} onChange={(v) => updateAttributes({ radius: v })} options={RADIUS_OPTIONS} /></MenuRow>
            <MenuRow label="Card border"><Segmented<BorderStyle> value={borderStyle} onChange={(v) => updateAttributes({ borderStyle: v })} options={BORDER_STYLE_OPTIONS} /></MenuRow>
            {borderStyle !== 'none' && (
              <MenuRow label="Color"><ColorField value={borderColor} onChange={(v) => updateAttributes({ borderColor: v })} /></MenuRow>
            )}
          </StyleMenu>
        )}
        <div className="lesson-carousel__arrows">
          <button
            type="button"
            className="lesson-carousel__arrow"
            aria-label="Previous slide"
            disabled={current === 0}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(current - 1)}
          >
            <ChevronLeft width={20} height={20} />
          </button>
          <button
            type="button"
            className="lesson-carousel__arrow"
            aria-label="Next slide"
            disabled={current >= count - 1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(current + 1)}
          >
            <ChevronRight width={20} height={20} />
          </button>
        </div>
      </div>

      <div className="lesson-carousel__viewport">
        <NodeViewContent className="lesson-carousel__slides" />
      </div>

      <div className="lesson-carousel__nav" contentEditable={false}>
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="lesson-carousel__dot-wrap">
            <button
              type="button"
              className="lesson-carousel__dot"
              data-active={i === current ? 'true' : 'false'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(i)}
            >
              {i + 1}
            </button>
            {editable && count > 1 && (
              <button
                type="button"
                className="lesson-carousel__remove"
                aria-label="Remove slide"
                onMouseDown={(e) => { e.preventDefault(); removeSlide(i); }}
              >
                <X width={9} height={9} />
              </button>
            )}
          </span>
        ))}
        <span className="lesson-carousel__check" data-on={current >= count - 1 ? 'true' : 'false'}>
          <Check width={16} height={16} />
        </span>
        {editable && count < MAX_SLIDES && (
          <button
            type="button"
            className="lesson-carousel__add"
            aria-label="Add slide"
            onMouseDown={(e) => { e.preventDefault(); addSlide(); }}
          >
            <Plus width={13} height={13} />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function CarouselSlideView({ node, getPos, editor, updateAttributes }: NodeViewProps) {
  // Each slide is a card: an optional cover image, an optional title, and the body.
  // Card roundness/border come from the parent carousel's CSS variables. Tags itself
  // with its index; the parent wrapper carries data-active. CSS pairs them so
  // visibility does not depend on ReactNodeViewRenderer's DOM nesting.
  const editable = editor.isEditable;
  const cover = (node.attrs.cover as string) || '';
  const coverAlt = (node.attrs.coverAlt as string) || '';
  const title = (node.attrs.title as string) || '';
  const [uploading, setUploading] = useState(false);

  let index = 0;
  if (typeof getPos === 'function') {
    const pos = getPos();
    if (pos != null) {
      try { index = editor.state.doc.resolve(pos).index(); } catch { index = 0; }
    }
  }

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, 'lesson-images');
      updateAttributes({ cover: url });
    } catch {
      if (typeof window !== 'undefined') window.alert('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <NodeViewWrapper className="lesson-carousel__slide" data-slide-index={index}>
      <div className="lesson-carousel__body">
        {cover ? (
          <div className="lesson-carousel__cover-wrap" contentEditable={false}>
            <img className="lesson-carousel__cover" src={cover} alt={coverAlt} draggable={false} />
            {editable && (
              <div className="lesson-carousel__cover-actions">
                <label className="lesson-carousel__cover-btn">
                  {uploading ? 'Uploading...' : 'Change'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
                </label>
                <button type="button" className="lesson-carousel__cover-btn" onMouseDown={(e) => { e.preventDefault(); updateAttributes({ cover: '' }); }}>Remove</button>
              </div>
            )}
          </div>
        ) : editable ? (
          <label className="lesson-carousel__cover-add" contentEditable={false}>
            {uploading ? <Loader2 className="lesson-carousel__spin" width={15} height={15} /> : <ImageIcon width={15} height={15} />}
            {uploading ? 'Uploading...' : 'Add cover image'}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
        ) : null}
        {editable ? (
          <NodeTextInput className="lesson-carousel__title-input" value={title} placeholder="Card title (optional)" onCommit={(v) => updateAttributes({ title: v })} />
        ) : title ? (
          <p className="lesson-carousel__title">{title}</p>
        ) : null}
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}

export const CarouselSlide = Node.create({
  name: 'carouselSlide',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      cover: { default: '' },
      coverAlt: { default: '' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-carousel-slide]' }];
  },

  // Fallback HTML: title as a bold line + body (sanitizer keeps p/strong; the wrapper
  // div is stripped but its children are kept), matching accordion/tab titles.
  renderHTML({ node, HTMLAttributes }) {
    const title = (node.attrs.title as string) || '';
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-carousel-slide': '' }),
      ...(title ? [['p', ['strong', title]]] : []),
      ['div', 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CarouselSlideView);
  },
});

export const Carousel = Node.create({
  name: 'carousel',
  group: 'block',
  content: 'carouselSlide+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      radius: { default: 'md' },
      borderStyle: { default: 'none' },
      borderColor: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-carousel]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-carousel': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CarouselView);
  },
});
