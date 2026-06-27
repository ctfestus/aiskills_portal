// Per-job model + thinking selection for Gemini calls.
//
// Routes different kinds of work to different Gemini tiers -- cheap/fast for
// classification and short text transforms, stronger + thinking for grading and
// authoring -- without every caller hardcoding a model name.
//
// Back-compat is the contract for this first step: the 'default' job reproduces today's
// behavior exactly (GEMINI_MODEL, no thinkingConfig), so any caller that passes no `job`
// is unchanged. Routes opt into the other jobs one at a time in a later change; nothing in
// production exercises a non-default job yet.
//
// Every model is env-overridable. Nothing is hardcoded to a tenant.

export type GeminiJob =
  | 'default'    // today's behavior -- do not change without a migration plan
  | 'classify'   // cheap deterministic picks (e.g. the Ask-AI format classifier)
  | 'transform'  // cheap text rewrites (e.g. the Ask-AI text actions)
  | 'grade'      // reasoning-heavy review/grading; quality matters most
  | 'author'     // course/content generation
  | 'vision';    // image/document understanding

export type GeminiJobConfig = {
  model: string;
  // Gemini 2.5 thinking budget in tokens (SDK is @google/genai ^1.17, the 2.5 generation;
  // thinkingBudget is the validated control there, not the 3.x thinking_level).
  // undefined => omit thinkingConfig entirely (model default applies)
  // 0 => thinking off
  // The positive budgets below are starting points; they are tuned and validated against
  // the installed SDK when a route actually opts in. Only 'default' is wired to production
  // today, and it carries no budget.
  thinkingBudget?: number;
};

function envModel(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : fallback;
}

export function resolveGeminiJob(job: GeminiJob = 'default'): GeminiJobConfig {
  switch (job) {
    case 'classify':
    case 'transform':
      return { model: envModel('GEMINI_MODEL_CHEAP', 'gemini-2.5-flash-lite'), thinkingBudget: 0 };
    case 'grade':
      return { model: envModel('GEMINI_MODEL_SMART', 'gemini-2.5-flash'), thinkingBudget: 8192 };
    case 'author':
      return { model: envModel('GEMINI_MODEL_SMART', 'gemini-2.5-flash'), thinkingBudget: 4096 };
    case 'vision':
      return {
        model: envModel('GEMINI_MODEL_VISION', envModel('GEMINI_MODEL_SMART', 'gemini-2.5-flash')),
        thinkingBudget: 2048,
      };
    case 'default':
    default:
      // Byte-for-byte the pre-router behavior: GEMINI_MODEL, no thinkingConfig.
      return { model: envModel('GEMINI_MODEL', 'gemini-2.0-flash') };
  }
}

/**
 * Extract the model's visible text from a Gemini response, skipping any internal "thought"
 * parts that thinking models can emit. Equivalent to `response.text` when no thought parts
 * are present (the default-job case), so back-compat holds; robust for the grading/authoring
 * paths once they enable thinking.
 */
export function extractGeminiText(response: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
}): string {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const visible = parts
      .filter((p) => p && typeof p.text === 'string' && p.thought !== true)
      .map((p) => p.text as string);
    if (visible.length) return visible.join('');
  }
  return response?.text ?? '';
}
