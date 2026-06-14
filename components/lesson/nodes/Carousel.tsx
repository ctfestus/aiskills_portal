'use client';

// Carousel: a stepped lesson container -- learners page through slides with side
// arrows and numbered pagination (1 . 2 . 3 . check), like a guided walkthrough.
//
// Same visibility mechanism as Tabs: active index is local React state surfaced as
// data-active on the wrapper; each slide tags itself with data-slide-index; CSS pairs
// them so only the active slide shows -- no fragile cross-node ProseMirror reactivity.
// Capped at 20 slides (the :nth pairs + addSlide guard).

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { ChevronLeft, ChevronRight, Check, Plus, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';

const MAX_SLIDES = 20;

function CarouselView({ node, editor, getPos }: NodeViewProps) {
  const editable = editor.isEditable;
  const count = node.childCount;
  const [active, setActive] = useState(0);
  const current = Math.min(active, count - 1);

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
    <NodeViewWrapper className="lesson-carousel" data-active={current}>
      <div className="lesson-carousel__viewport">
        <button
          type="button"
          className="lesson-carousel__arrow"
          aria-label="Previous slide"
          disabled={current === 0}
          onMouseDown={(e) => { e.preventDefault(); go(current - 1); }}
        >
          <ChevronLeft width={20} height={20} />
        </button>
        <NodeViewContent className="lesson-carousel__slides" />
        <button
          type="button"
          className="lesson-carousel__arrow"
          aria-label="Next slide"
          disabled={current >= count - 1}
          onMouseDown={(e) => { e.preventDefault(); go(current + 1); }}
        >
          <ChevronRight width={20} height={20} />
        </button>
      </div>

      <div className="lesson-carousel__nav" contentEditable={false}>
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="lesson-carousel__dot-wrap">
            <button
              type="button"
              className="lesson-carousel__dot"
              data-active={i === current ? 'true' : 'false'}
              onMouseDown={(e) => { e.preventDefault(); go(i); }}
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
  // Each slide is a shadowed card: an optional cover image fills the top (flush to
  // the rounded card corners) and the text body sits below. Tags itself with its
  // index; the parent wrapper carries data-active. CSS pairs them so visibility does
  // not depend on ReactNodeViewRenderer's DOM nesting.
  const editable = editor.isEditable;
  const cover = (node.attrs.cover as string) || '';
  const coverAlt = (node.attrs.coverAlt as string) || '';
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
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-carousel-slide]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-carousel-slide': '' }), 0];
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
