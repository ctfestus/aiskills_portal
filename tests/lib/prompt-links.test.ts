import { describe, expect, it } from 'vitest';
import {
  buildChatGptPromptUrl,
  buildClaudePromptUrl,
  CLAUDE_PROMPT_MAX_LENGTH,
} from '@/lib/prompt-links';

describe('prompt provider links', () => {
  it('returns no handoff URL for an empty prompt', () => {
    expect(buildChatGptPromptUrl('   ')).toBeNull();
    expect(buildClaudePromptUrl('\n\t')).toBeNull();
  });

  it('preserves and safely encodes the complete ChatGPT prompt', () => {
    const prompt = 'Act as a coach.\nUse: research & analysis?';
    const url = buildChatGptPromptUrl(prompt);

    expect(url).toBe(`https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`);
    expect(decodeURIComponent(url!.split('prompt=')[1])).toBe(prompt);
  });

  it('preserves and safely encodes the complete Claude prompt', () => {
    const prompt = 'Compare <option A> with "option B".\nReturn a table.';
    const url = buildClaudePromptUrl(prompt);

    expect(url).toBe(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`);
    expect(decodeURIComponent(url!.split('?q=')[1])).toBe(prompt);
  });

  it('guards Claude handoffs above the documented prompt length', () => {
    expect(buildClaudePromptUrl('x'.repeat(CLAUDE_PROMPT_MAX_LENGTH))).not.toBeNull();
    expect(buildClaudePromptUrl('x'.repeat(CLAUDE_PROMPT_MAX_LENGTH + 1))).toBeNull();
  });
});
