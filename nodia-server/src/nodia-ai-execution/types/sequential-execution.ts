import type { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';

/** A completed prefix is immutable. A set has at most one active step. */
export function nextNodiaAiExecutionStep(
  steps: readonly NodiaAiExecutionStep[],
): number {
  const index = steps.findIndex((step) => step.state !== 'completed');
  if (index < 0) return steps.length;
  if (steps.slice(index + 1).some((step) => step.state === 'completed'))
    return -1;
  return index;
}

/** Two events per remaining effect and four reserved terminal/recovery events. */
export function nodiaAiExecutionResumeEventSlots(
  steps: readonly NodiaAiExecutionStep[],
): number {
  const next = nextNodiaAiExecutionStep(steps);
  return 2 * (steps.length - Math.max(next, 0)) + 4;
}
