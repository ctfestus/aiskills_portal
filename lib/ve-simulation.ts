export type SimulationMetric = 'trust' | 'quality' | 'risk' | 'communication';

export type SimulationImpactPreset =
  | 'strong'
  | 'good'
  | 'risky'
  | 'poor'
  | 'recovery'
  | 'neutral';

export type SimulationState = Record<SimulationMetric, number>;

export interface SimulationRequirement {
  id: string;
  label?: string;
  type?: string;
  options?: string[];
  optionImpacts?: string[];
  correctAnswer?: string;
}

export interface SimulationLesson {
  requirements?: SimulationRequirement[];
}

export interface SimulationModule {
  lessons?: SimulationLesson[];
}

export type SimulationProgress = Record<string, { completed?: boolean; selectedAnswer?: string; notes?: string }>;

export const SIMULATION_BASE_STATE: SimulationState = {
  trust: 70,
  quality: 50,
  risk: 30,
  communication: 50,
};

export const SIMULATION_IMPACT_PRESETS: Record<SimulationImpactPreset, {
  label: string;
  shortLabel: string;
  description: string;
  effect: Partial<Record<SimulationMetric, number>>;
  coachMessage: string;
}> = {
  strong: {
    label: 'Strong evidence-based choice',
    shortLabel: 'Strong',
    description: 'Best option: validates evidence, reduces risk, and builds stakeholder trust.',
    effect: { trust: 8, quality: 12, risk: -10, communication: 3 },
    coachMessage: 'This is the strongest professional move: it validates the evidence before making a claim.',
  },
  good: {
    label: 'Good practical choice',
    shortLabel: 'Good',
    description: 'Useful option: moves the work forward with manageable risk.',
    effect: { trust: 5, quality: 6, risk: -4, communication: 4 },
    coachMessage: 'This is a solid choice that keeps the work moving and protects the team from avoidable mistakes.',
  },
  risky: {
    label: 'Risky assumption',
    shortLabel: 'Risky',
    description: 'Risky option: may be reasonable, but needs more evidence or clearer communication.',
    effect: { trust: -5, quality: -4, risk: 12, communication: -3 },
    coachMessage: 'This choice carries risk because it moves ahead before the evidence is strong enough.',
  },
  poor: {
    label: 'Poor professional judgement',
    shortLabel: 'Poor',
    description: 'Weak option: increases risk, lowers confidence, or misses the stakeholder need.',
    effect: { trust: -10, quality: -8, risk: 20, communication: -6 },
    coachMessage: 'This choice would likely create stakeholder pushback or delay because it misses the core issue.',
  },
  recovery: {
    label: 'Good recovery',
    shortLabel: 'Recovery',
    description: 'Recovery option: corrects course after uncertainty, delay, or earlier mistakes.',
    effect: { trust: 6, quality: 5, risk: -8, communication: 6 },
    coachMessage: 'This is a useful recovery move: it acknowledges the gap and gets the work back on track.',
  },
  neutral: {
    label: 'Neutral choice',
    shortLabel: 'Neutral',
    description: 'Informational option: records the decision without changing the simulation strongly.',
    effect: {},
    coachMessage: 'Decision recorded. Keep moving forward.',
  },
};

export const SIMULATION_IMPACT_OPTIONS = Object.entries(SIMULATION_IMPACT_PRESETS).map(([value, preset]) => ({
  value: value as SimulationImpactPreset,
  label: preset.label,
  shortLabel: preset.shortLabel,
  description: preset.description,
}));

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function normalizeSimulationImpact(value?: string | null): SimulationImpactPreset {
  return value && value in SIMULATION_IMPACT_PRESETS ? value as SimulationImpactPreset : 'neutral';
}

export function getDecisionImpact(requirement: SimulationRequirement, selectedAnswer?: string): SimulationImpactPreset {
  if (!selectedAnswer) return 'neutral';
  const options = requirement.options ?? [];
  const selectedIdx = options.findIndex(option => option === selectedAnswer);
  const configuredImpact = selectedIdx >= 0 ? requirement.optionImpacts?.[selectedIdx] : undefined;
  if (configuredImpact) return normalizeSimulationImpact(configuredImpact);
  if (requirement.correctAnswer) return selectedAnswer === requirement.correctAnswer ? 'strong' : 'risky';
  return 'neutral';
}

export function describeDecisionImpact(requirement: SimulationRequirement, selectedAnswer?: string) {
  const impact = getDecisionImpact(requirement, selectedAnswer);
  return {
    impact,
    ...SIMULATION_IMPACT_PRESETS[impact],
  };
}

export function buildSimulationReport(modules: SimulationModule[], progress: SimulationProgress) {
  const state: SimulationState = { ...SIMULATION_BASE_STATE };
  const decisions: Array<{ label: string; answer: string; impact: SimulationImpactPreset; impactLabel: string }> = [];

  for (const mod of modules ?? []) {
    for (const lesson of mod.lessons ?? []) {
      for (const req of lesson.requirements ?? []) {
        const entry = progress?.[req.id];
        if (!entry?.completed) continue;

        if (req.type === 'decision' && entry.selectedAnswer) {
          const impact = getDecisionImpact(req, entry.selectedAnswer);
          const preset = SIMULATION_IMPACT_PRESETS[impact];
          for (const metric of Object.keys(preset.effect) as SimulationMetric[]) {
            state[metric] += preset.effect[metric] ?? 0;
          }
          decisions.push({
            label: req.label || 'Decision point',
            answer: entry.selectedAnswer,
            impact,
            impactLabel: preset.label,
          });
          continue;
        }

        if (req.type === 'debrief') {
          state.communication += 3;
          state.trust += 2;
        } else if (req.type === 'text' && entry.notes) {
          state.communication += 2;
          state.quality += 2;
        } else if (req.type === 'upload' || req.type === 'dashboard_critique' || req.type === 'code_review' || req.type === 'excel_review') {
          state.quality += 4;
          state.trust += 2;
        } else if (req.type === 'mcq') {
          state.quality += 1;
        }
      }
    }
  }

  const scores: SimulationState = {
    trust: clampScore(state.trust),
    quality: clampScore(state.quality),
    risk: clampScore(state.risk),
    communication: clampScore(state.communication),
  };

  const overall = clampScore((scores.trust + scores.quality + scores.communication + (100 - scores.risk)) / 4);
  const outcome =
    overall >= 85 ? 'Excellent workplace judgement' :
    overall >= 75 ? 'Strong professional performance' :
    overall >= 60 ? 'Developing professional judgement' :
    'Needs stronger workplace judgement';

  const strengths: string[] = [];
  if (scores.quality >= 75) strengths.push('You made evidence-led decisions and completed technically meaningful work.');
  if (scores.trust >= 75) strengths.push('Your choices would build stakeholder confidence in a real team setting.');
  if (scores.communication >= 75) strengths.push('You communicated clearly enough for others to act on your work.');
  if (strengths.length === 0) strengths.push('You completed the workflow and showed progress across the mission.');

  const growthAreas: string[] = [];
  if (scores.risk > 55) growthAreas.push('Reduce risk by validating evidence before escalating or making recommendations.');
  if (scores.quality < 70) growthAreas.push('Strengthen the technical quality of your analysis before presenting conclusions.');
  if (scores.communication < 70) growthAreas.push('Make stakeholder updates more direct, specific, and action-oriented.');
  if (growthAreas.length === 0) growthAreas.push('To go further, quantify business impact and make the next action even clearer.');

  return { scores, overall, outcome, strengths, growthAreas, decisions };
}
