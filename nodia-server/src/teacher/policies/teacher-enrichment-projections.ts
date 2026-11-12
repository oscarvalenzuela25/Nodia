import { validateActivity, validateVisual } from './teacher-enrichment-activities.js';
import { object, requireUuid, teacherError } from './teacher-validation.js';

/** Historical unknown payloads remain identifiable but never become executable render data. */
export function publicActivityData(data: Record<string, unknown>) {
  const version = data.schema_version;
  const base = {
    kind: typeof data.kind === 'string' ? data.kind.slice(0, 80) : 'unknown',
    prompt: typeof data.prompt === 'string' ? data.prompt.slice(0, 3000) : '',
    objective_id: typeof data.objective_id === 'string' ? data.objective_id : null,
    answered: data.answered === true,
    assisted: true,
    independent: false,
    ...(typeof version === 'number' && Number.isSafeInteger(version) ? { schema_version: version } : {}),
  };
  try {
    if (version !== undefined && version !== 1) throw Error('unsupported');
    const activity = validateActivity({ kind: data.kind, prompt: data.prompt, payload: data.payload, solution: data.solution });
    return { ...base, kind: activity.kind, payload: activity.payload, availability: 'available' as const };
  } catch { return { ...base, payload: {}, availability: 'unsupported' as const }; }
}
export function publicVisualData(data: Record<string, unknown>) {
  const version = data.schema_version;
  const base = {
    kind: typeof data.kind === 'string' ? data.kind.slice(0, 80) : 'unknown',
    title: typeof data.title === 'string' ? data.title.slice(0, 160) : '',
    ...(typeof version === 'number' && Number.isSafeInteger(version) ? { schema_version: version } : {}),
  };
  try {
    if (version !== undefined && version !== 1) throw Error('unsupported');
    return { ...base, ...validateVisual({ kind: data.kind, title: data.title, labels: data.labels, values: data.values }), availability: 'available' as const };
  } catch { return { ...base, labels: [], values: [], availability: 'unsupported' as const }; }
}
export interface ConceptRelation {
  kind: 'support' | 'derivation' | 'contradiction' | 'prerequisite';
  target_concept_ids: string[];
  combination: 'all';
  status: 'proposed';
  origin: 'user_authored';
}
/** These proposed content relationships never become advancement prerequisites or facts. */
export function conceptRelations(value: unknown): ConceptRelation[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) teacherError('invalid_input', 400);
  return value.map(raw => {
    const v = object(raw, ['kind', 'target_concept_ids']);
    if (!['support', 'derivation', 'contradiction', 'prerequisite'].includes(String(v.kind))
      || !Array.isArray(v.target_concept_ids) || !v.target_concept_ids.length || v.target_concept_ids.length > 4)
      teacherError('invalid_input', 400);
    const ids = v.target_concept_ids.map(requireUuid);
    if (new Set(ids).size !== ids.length) teacherError('invalid_input', 400);
    return { kind: v.kind as ConceptRelation['kind'], target_concept_ids: ids,
      combination: 'all', status: 'proposed', origin: 'user_authored' };
  });
}
