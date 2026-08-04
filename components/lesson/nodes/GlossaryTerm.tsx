'use client';

// Glossary term: an inline mark that attaches a short definition to a word or phrase.
//
// Unlike the other interactive blocks this is a Mark (it wraps selected text rather
// than sitting between paragraphs). The term shows a dotted underline; on hover or
// focus a pure-CSS popover (content: attr(data-definition)) shows the definition
// without leaving the sentence -- so no JS popover/node view is needed. tabindex makes
// it tappable on touch devices. Authored via the toolbar "Define" button (which
// prompts for the definition); the definition is plain text living in an attribute.

import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    glossaryTerm: {
      setGlossaryTerm: (attrs: {
        definition: string;
        pronunciation?: string;
        example?: string;
        learnMoreUrl?: string;
      }) => ReturnType;
      unsetGlossaryTerm: () => ReturnType;
    };
  }
}

export const GlossaryTerm = Mark.create({
  name: 'glossaryTerm',

  addAttributes() {
    return {
      definition: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-definition') || '',
        renderHTML: (attrs) => (attrs.definition ? { 'data-definition': attrs.definition } : {}),
      },
      pronunciation: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-pronunciation') || '',
        renderHTML: (attrs) => (attrs.pronunciation ? { 'data-pronunciation': attrs.pronunciation } : {}),
      },
      example: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-example') || '',
        renderHTML: (attrs) => (attrs.example ? { 'data-example': attrs.example } : {}),
      },
      learnMoreUrl: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-learn-more-url') || '',
        renderHTML: (attrs) => (attrs.learnMoreUrl ? { 'data-learn-more-url': attrs.learnMoreUrl } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-definition]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      class: 'lesson-term',
      tabindex: '0',
      role: 'button',
      'aria-label': 'Open definition',
    }), 0];
  },

  addCommands() {
    return {
      setGlossaryTerm: (attrs) => ({ commands }) => commands.setMark(this.name, attrs),
      unsetGlossaryTerm: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});
