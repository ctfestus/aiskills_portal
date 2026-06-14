'use client';

// Callout block: a styled note / tip / warning / info / success box that holds any
// block content. Has an editable title, a variant (which sets the default color
// scheme), and optional border-style + free border-color overrides.
//
// Variant theming is via CSS keyed off `.lesson-callout[data-variant]`; border
// style/color overrides are applied inline so they win over the variant defaults.

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { Info, Lightbulb, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';
import { ColorField, Segmented, StyleMenu, MenuRow, BORDER_STYLE_OPTIONS, type BorderStyle } from '@/components/lesson/nodes/StyleControls';

export type CalloutVariant = 'note' | 'tip' | 'warning' | 'info' | 'success';

const VARIANTS: Record<CalloutVariant, { label: string; Icon: typeof Info }> = {
  note: { label: 'Note', Icon: FileText },
  tip: { label: 'Tip', Icon: Lightbulb },
  warning: { label: 'Warning', Icon: AlertTriangle },
  info: { label: 'Info', Icon: Info },
  success: { label: 'Success', Icon: CheckCircle2 },
};

const VARIANT_OPTIONS: { value: CalloutVariant; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'tip', label: 'Tip' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
];

function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable;
  const variant: CalloutVariant = (node.attrs.variant as CalloutVariant) in VARIANTS
    ? (node.attrs.variant as CalloutVariant)
    : 'note';
  const { label, Icon } = VARIANTS[variant];
  const title = (node.attrs.title as string) || '';
  const borderStyle = (node.attrs.borderStyle as BorderStyle) || 'solid';
  const borderColor = (node.attrs.borderColor as string) || '';

  // Override border inline; leave color to the variant CSS unless a custom one is set.
  const wrapperStyle: React.CSSProperties = borderStyle === 'none'
    ? { border: 'none' }
    : { borderStyle, borderWidth: 1, ...(borderColor ? { borderColor } : {}) };

  return (
    <NodeViewWrapper className="lesson-callout" data-variant={variant} style={wrapperStyle}>
      <div className="lesson-callout__head" contentEditable={false}>
        <Icon className="lesson-callout__icon" width={15} height={15} />
        {editable ? (
          <NodeTextInput className="lesson-callout__title-input" value={title} placeholder={label} onCommit={(v) => updateAttributes({ title: v })} />
        ) : (
          <span className="lesson-callout__label">{title || label}</span>
        )}
        {editable && (
          <StyleMenu>
            <MenuRow label="Style"><Segmented<CalloutVariant> value={variant} onChange={(v) => updateAttributes({ variant: v })} options={VARIANT_OPTIONS} /></MenuRow>
            <MenuRow label="Border"><Segmented<BorderStyle> value={borderStyle} onChange={(v) => updateAttributes({ borderStyle: v })} options={BORDER_STYLE_OPTIONS} /></MenuRow>
            {borderStyle !== 'none' && (
              <MenuRow label="Color"><ColorField value={borderColor} onChange={(v) => updateAttributes({ borderColor: v })} /></MenuRow>
            )}
          </StyleMenu>
        )}
      </div>
      <NodeViewContent className="lesson-callout__body" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'note',
        parseHTML: (el) => el.getAttribute('data-variant') || 'note',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
      title: { default: '' },
      borderStyle: { default: 'solid' },
      borderColor: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }, { tag: 'blockquote[data-callout]' }];
  },

  // Fallback HTML: optional title (bold) + body, inside a blockquote the sanitizer
  // keeps. Variant/border styling lives only in the canonical doc.
  renderHTML({ node, HTMLAttributes }) {
    const title = (node.attrs.title as string) || '';
    return [
      'blockquote',
      mergeAttributes(HTMLAttributes, { 'data-callout': '' }),
      ...(title ? [['p', ['strong', title]]] : []),
      ['div', 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
