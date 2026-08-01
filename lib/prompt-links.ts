/**
 * Provider handoff URLs for interactive lesson prompt blocks.
 *
 * These links prefill a new chat so the learner can review the prompt before
 * submitting it. They intentionally never submit a prompt on the learner's behalf.
 */

export const CLAUDE_PROMPT_MAX_LENGTH = 14_000;

function hasPrompt(prompt: string): boolean {
  return prompt.trim().length > 0;
}

export function buildChatGptPromptUrl(prompt: string): string | null {
  if (!hasPrompt(prompt)) return null;
  return `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`;
}

export function buildClaudePromptUrl(prompt: string): string | null {
  if (!hasPrompt(prompt) || prompt.length > CLAUDE_PROMPT_MAX_LENGTH) return null;
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}
