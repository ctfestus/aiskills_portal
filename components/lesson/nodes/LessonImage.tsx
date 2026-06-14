'use client';

// Image with formatting: alignment, size preset, caption, alt text, and an optional
// border (style + free color) and rounded corners. Extends the base Image extension
// so setImage() and existing `image` nodes keep working; the extra attrs live in the
// canonical doc JSON. Controls show in the editor only when the image is selected.

import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  ColorField, Segmented, StyleBar, BORDER_STYLE_OPTIONS, borderCss, type BorderStyle,
} from '@/components/lesson/nodes/StyleControls';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';

type Align = 'left' | 'center' | 'right';
type Size = 'small' | 'medium' | 'full';

const SIZE_MAX: Record<Size, string> = { small: '320px', medium: '480px', full: '100%' };

function ImageView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const editable = editor.isEditable;
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || '';
  const align = (node.attrs.align as Align) || 'center';
  const size = (node.attrs.size as Size) || 'full';
  const caption = (node.attrs.caption as string) || '';
  const borderStyle = (node.attrs.borderStyle as BorderStyle) || 'none';
  const borderColor = (node.attrs.borderColor as string) || '';
  const rounded = node.attrs.rounded !== false;

  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <NodeViewWrapper className="lesson-image" style={{ display: 'flex', flexDirection: 'column', alignItems }}>
      {editable && selected && (
        <StyleBar>
          <Segmented<Align>
            title="Align"
            value={align}
            onChange={(v) => updateAttributes({ align: v })}
            options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
          />
          <Segmented<Size>
            title="Size"
            value={size}
            onChange={(v) => updateAttributes({ size: v })}
            options={[{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'full', label: 'Full' }]}
          />
          <Segmented<'rounded' | 'square'>
            title="Corners"
            value={rounded ? 'rounded' : 'square'}
            onChange={(v) => updateAttributes({ rounded: v === 'rounded' })}
            options={[{ value: 'rounded', label: 'Rounded' }, { value: 'square', label: 'Square' }]}
          />
          <Segmented<BorderStyle>
            title="Border"
            value={borderStyle}
            onChange={(v) => updateAttributes({ borderStyle: v })}
            options={BORDER_STYLE_OPTIONS}
          />
          {borderStyle !== 'none' && (
            <ColorField title="Border color" value={borderColor} onChange={(v) => updateAttributes({ borderColor: v })} />
          )}
          <NodeTextInput
            className="lesson-image__alt-input"
            value={alt}
            placeholder="Alt text"
            onCommit={(v) => updateAttributes({ alt: v })}
          />
        </StyleBar>
      )}

      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: SIZE_MAX[size],
          width: '100%',
          borderRadius: rounded ? 10 : 0,
          ...borderCss(borderStyle, borderColor, '#e4e4e7'),
          ...(borderStyle !== 'none' ? { padding: 3 } : {}),
        }}
      />

      {editable ? (
        <NodeTextInput
          className="lesson-image__caption-input"
          value={caption}
          placeholder="Add a caption (optional)"
          onCommit={(v) => updateAttributes({ caption: v })}
        />
      ) : caption ? (
        <figcaption className="lesson-image__caption">{caption}</figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}

export const LessonImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: { default: 'center' },
      size: { default: 'full' },
      caption: { default: '' },
      borderStyle: { default: 'none' },
      borderColor: { default: '' },
      rounded: { default: true },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
