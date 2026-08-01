import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';

export function createStepCardsContent(): JSONContent {
  return {
    type: 'stepCards',
    content: [
      { type: 'stepCard', attrs: { title: '', highlightTitle: '', highlightBody: '' }, content: [{ type: 'paragraph' }] },
      { type: 'stepCard', attrs: { title: '', highlightTitle: '', highlightBody: '' }, content: [{ type: 'paragraph' }] },
    ],
  };
}

/** Insert at the caret when possible, otherwise append at the document boundary. */
export function insertStepCards(editor: Editor): boolean {
  const content = createStepCardsContent();
  const before = editor.state.doc;
  const insertedAtSelection = editor.chain().focus().insertContent(content).run();
  if (insertedAtSelection && !editor.state.doc.eq(before)) return true;

  return editor.chain()
    .focus()
    .insertContentAt(editor.state.doc.content.size, content)
    .run();
}
