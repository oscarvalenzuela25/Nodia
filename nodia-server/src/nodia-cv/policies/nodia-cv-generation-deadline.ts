import type { AiSelection } from '../../ai-generation/ai-selection.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';

type CvGenerationTiming = {
  queue: Pick<NodiaAiRuntimePolicy['queue'], 'wait_seconds'>;
  timing: Pick<
    NodiaAiRuntimePolicy['timing'],
    'provider_dispatch_seconds' | 'run_seconds'
  >;
};

// The CV purpose budget fits below the shortest native execution ceiling (300 s).
const CV_AGENTIC_DISPATCH_SECONDS = 270;

export function cvGenerationDispatchSeconds(
  mode: AiSelection['mode'],
  { queue, timing }: CvGenerationTiming,
) {
  if (mode === 'api_key') return timing.provider_dispatch_seconds;
  return Math.min(
    CV_AGENTIC_DISPATCH_SECONDS,
    timing.run_seconds - queue.wait_seconds,
  );
}
