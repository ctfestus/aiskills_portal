'use client';

// Audio block: an inline HTML5 <audio> player for narration / voiceover clips inside a
// lesson. The URL is either an uploaded Cloudinary file or a pasted direct link. Has an
// optional caption and alignment; controls show in the editor only when selected. Modeled
// on LessonImage. Inserted via insertContent({ type: 'lessonAudio', ... }) from the toolbar.

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Segmented, StyleMenu, MenuRow } from '@/components/lesson/nodes/StyleControls';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';

type Align = 'left' | 'center' | 'right';

function AudioView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable;
  const src = (node.attrs.src as string) || '';
  const title = (node.attrs.title as string) || '';
  const align = (node.attrs.align as Align) || 'left';

  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <NodeViewWrapper className="lesson-audio" style={{ display: 'flex', flexDirection: 'column', alignItems }}>
      {editable && (
        <div className="lesson-block-corner">
          <StyleMenu>
            <MenuRow label="Align">
              <Segmented<Align>
                value={align}
                onChange={(v) => updateAttributes({ align: v })}
                options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
              />
            </MenuRow>
          </StyleMenu>
        </div>
      )}

      <audio controls src={src} preload="metadata" className="lesson-audio__player" />

      {editable ? (
        <NodeTextInput
          className="lesson-audio__caption-input"
          value={title}
          placeholder="Add a caption (optional)"
          onCommit={(v) => updateAttributes({ title: v })}
        />
      ) : title ? (
        <figcaption className="lesson-audio__caption">{title}</figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}

export const LessonAudio = Node.create({
  name: 'lessonAudio',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (el) => el.getAttribute('src') || '',
        renderHTML: (attrs) => (attrs.src ? { src: attrs.src } : {}),
      },
      title: { default: '' },
      align: { default: 'left' },
    };
  },

  parseHTML() {
    return [{ tag: 'audio[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['audio', mergeAttributes(HTMLAttributes, { controls: 'controls' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioView);
  },
});
