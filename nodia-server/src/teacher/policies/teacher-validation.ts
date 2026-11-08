import { createHash, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type {
  AssessmentCandidate,
  AssessmentCounts,
  AssessmentPolicy,
  BlueprintSlot,
  LearningPacket,
  PlanOutline,
  PrivateGuide,
  PrivateKey,
  TeacherAnswer,
  TeacherSelection,
} from '../types/teacher.types.js';

export function teacherError(code: string, status = 409): never {
  throw new HttpException({ code, message: `teacher:${code}` }, status);
}
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value))
    teacherError('invalid_input', 400);
  return value;
}
export function canonical(value: unknown, depth = 0): string {
  if (depth > 12) teacherError('invalid_input', 400);
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length > 128) teacherError('invalid_input', 400);
    return `[${value.map((v) => canonical(v, depth + 1)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    if (Object.keys(value).length > 128) teacherError('invalid_input', 400);
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k], depth + 1)}`,
      )
      .join(',')}}`;
  }
  teacherError('invalid_input', 400);
}
export function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function text(
  value: unknown,
  min: number,
  max: number,
  trim = true,
): string {
  if (typeof value !== 'string') teacherError('invalid_input', 400);
  const result = trim ? value.trim() : value;
  if (
    result.length < min ||
    result.length > max ||
    result.includes('\u0000') ||
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      result,
    ) ||
    Buffer.byteLength(result) > max * 4
  )
    teacherError('invalid_input', 400);
  return result;
}
export function object(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    teacherError('invalid_input', 400);
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((k) => !keys.includes(k)))
    teacherError('invalid_input', 400);
  return v;
}
function array(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    teacherError('invalid_input', 400);
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    teacherError('invalid_input', 400);
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') teacherError('invalid_input', 400);
  return value;
}
export function language(value: unknown): string {
  const v = text(value, 2, 35);
  if (!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(v))
    teacherError('invalid_input', 400);
  return v;
}
export function selection(value: unknown): TeacherSelection {
  const v = object(value, ['connection_id', 'mode', 'model_id', 'effort_id']);
  const id = text(v.connection_id, 1, 19, false);
  if (
    !/^[1-9][0-9]*$/.test(id) ||
    BigInt(id) > 9223372036854775807n ||
    !['agentic', 'api_key'].includes(String(v.mode))
  )
    teacherError('invalid_input', 400);
  const model = text(v.model_id, 1, 1024, false);
  if (!model.trim() || Buffer.byteLength(model) > 1024)
    teacherError('invalid_input', 400);
  const effort = v.effort_id === null ? null : text(v.effort_id, 1, 256, false);
  if (effort !== null && (!effort.trim() || Buffer.byteLength(effort) > 256))
    teacherError('invalid_input', 400);
  return {
    connection_id: id,
    mode: v.mode as TeacherSelection['mode'],
    model_id: model,
    effort_id: effort,
  };
}
export function defaultPolicy(objectives = 1): AssessmentPolicy {
  const n = Math.max(12, 2 * objectives),
    short_text = Math.ceil(n / 3),
    completion = Math.max(2, Math.floor(n / 6));
  return {
    version: 'teacher-assessment/1',
    practice_counts: { single_choice: 3, completion: 1, short_text: 1 },
    final_counts: {
      single_choice: n - short_text - completion,
      completion,
      short_text,
    },
    diagnostic_counts: { single_choice: 4, completion: 2, short_text: 2 },
    final_threshold_percent: 90,
    coverage_per_objective: 2,
    criterion_ids: ['objective', 'accuracy', 'clarity'],
    normalization: 'NFC-trim-collapse',
  };
}
export function policy(value: unknown, objectives = 1): AssessmentPolicy {
  const v = object(value, [
    'version',
    'practice_counts',
    'final_counts',
    'diagnostic_counts',
    'final_threshold_percent',
    'coverage_per_objective',
    'criterion_ids',
    'normalization',
  ]);
  if (
    v.version !== 'teacher-assessment/1' ||
    v.final_threshold_percent !== 90 ||
    v.coverage_per_objective !== 2 ||
    canonical(v.criterion_ids) !==
      canonical(['objective', 'accuracy', 'clarity']) ||
    v.normalization !== 'NFC-trim-collapse'
  )
    teacherError('invalid_input', 400);
  const counts = (
    value: unknown,
    min: number,
    max: number,
  ): AssessmentCounts => {
    const c = object(value, ['single_choice', 'completion', 'short_text']);
    const result = {
      single_choice: integer(c.single_choice, 1, 24),
      completion: integer(c.completion, 1, 24),
      short_text: integer(c.short_text, 1, 8),
    };
    const total = Object.values(result).reduce((s, n) => s + n, 0);
    if (total < min || total > max) teacherError('invalid_input', 400);
    return result;
  };
  const final_counts = counts(v.final_counts, Math.max(10, 2 * objectives), 24);
  return {
    version: 'teacher-assessment/1',
    practice_counts: counts(v.practice_counts, 3, 12),
    final_counts,
    diagnostic_counts: counts(v.diagnostic_counts, 3, 12),
    final_threshold_percent: 90,
    coverage_per_objective: 2,
    criterion_ids: ['objective', 'accuracy', 'clarity'],
    normalization: 'NFC-trim-collapse',
  };
}
export function outline(
  value: unknown,
  ownedIds: ReadonlySet<string> = new Set(),
  accept = true,
): PlanOutline {
  const v = object(value, [
    'schema_version',
    'title',
    'topic',
    'objective',
    'explanation_language',
    'organization',
    'day_count',
    'sections',
    'assessment_policy',
  ]);
  if (
    v.schema_version !== 1 ||
    !['days', 'topics'].includes(String(v.organization))
  )
    teacherError('invalid_input', 400);
  const days = v.organization === 'days' ? integer(v.day_count, 1, 365) : null;
  if (v.organization === 'topics' && v.day_count !== null)
    teacherError('invalid_input', 400);
  const idMap = new Map<string, string>();
  const id = (raw: unknown) => {
    const ref = text(raw, 1, 64, false);
    if (idMap.has(ref)) teacherError('invalid_input', 400);
    const normalized = ownedIds.has(ref) ? requireUuid(ref) : randomUUID();
    idMap.set(ref, normalized);
    return normalized;
  };
  const pending: { prereqs: unknown[]; unitRefs: unknown[][] }[] = [];
  let totalUnits = 0;
  const sections = array(v.sections, 1, 24).map((raw) => {
    const s = object(raw, [
      'id',
      'title',
      'required',
      'prerequisite_section_ids',
      'objectives',
      'units',
    ]);
    const sid = id(s.id);
    const objectives = array(s.objectives, 1, 12).map((raw) => {
      const o = object(raw, ['id', 'description']);
      return { id: id(o.id), description: text(o.description, 1, 2000) };
    });
    const unitRefs: unknown[][] = [];
    const units = array(s.units, 1, 60).map((raw) => {
      const u = object(raw, [
        'id',
        'title',
        'objective_ids',
        'day_start',
        'day_end',
      ]);
      unitRefs.push(array(u.objective_ids, 1, 12));
      const start = days === null ? null : integer(u.day_start, 1, days),
        end = days === null ? null : integer(u.day_end, start!, days);
      if (days === null && (u.day_start !== null || u.day_end !== null))
        teacherError('invalid_input', 400);
      return {
        id: id(u.id),
        title: text(u.title, 1, 160),
        objective_ids: [] as string[],
        day_start: start,
        day_end: end,
      };
    });
    totalUnits += units.length;
    pending.push({
      prereqs: array(s.prerequisite_section_ids, 0, 23),
      unitRefs,
    });
    return {
      id: sid,
      title: text(s.title, 1, 160),
      required: bool(s.required),
      prerequisite_section_ids: [] as string[],
      objectives,
      units,
    };
  });
  if (totalUnits > 60 || (accept && !sections.some((s) => s.required)))
    teacherError('invalid_input', 400);
  sections.forEach((s, i) => {
    s.prerequisite_section_ids = pending[i].prereqs.map((ref) => {
      const mapped = idMap.get(String(ref));
      if (!mapped || !sections.some((x) => x.id === mapped) || mapped === s.id)
        teacherError('invalid_input', 400);
      return mapped;
    });
    if (
      new Set(s.prerequisite_section_ids).size !==
      s.prerequisite_section_ids.length
    )
      teacherError('invalid_input', 400);
    s.units.forEach((u, j) => {
      u.objective_ids = pending[i].unitRefs[j].map((ref) => {
        const mapped = idMap.get(String(ref));
        if (!mapped || !s.objectives.some((o) => o.id === mapped))
          teacherError('invalid_input', 400);
        return mapped;
      });
      if (new Set(u.objective_ids).size !== u.objective_ids.length)
        teacherError('invalid_input', 400);
    });
    if (
      s.objectives.some(
        (o) => !s.units.some((u) => u.objective_ids.includes(o.id)),
      )
    )
      teacherError('invalid_input', 400);
  });
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (sid: string) => {
    if (visiting.has(sid)) teacherError('invalid_input', 400);
    if (done.has(sid)) return;
    visiting.add(sid);
    sections.find((s) => s.id === sid)!.prerequisite_section_ids.forEach(visit);
    visiting.delete(sid);
    done.add(sid);
  };
  sections.forEach((s) => visit(s.id));
  const maxObjectives = Math.max(...sections.map((s) => s.objectives.length));
  return {
    schema_version: 1,
    title: text(v.title, 1, 120),
    topic: text(v.topic, 1, 240),
    objective: text(v.objective, 1, 2000),
    explanation_language: language(v.explanation_language),
    organization: v.organization as 'days' | 'topics',
    day_count: days,
    sections,
    assessment_policy: policy(
      v.assessment_policy ?? defaultPolicy(maxObjectives),
      maxObjectives,
    ),
  };
}
export function guide(value: unknown): PrivateGuide {
  const v = object(value, [
    'schema_version',
    'strategy',
    'context_notes',
    'examples_context',
    'prerequisite_knowledge',
    'preferred_formats',
  ]);
  if (
    v.schema_version !== 1 ||
    !['explanatory', 'examples_first', 'balanced'].includes(String(v.strategy))
  )
    teacherError('invalid_input', 400);
  const formats = array(v.preferred_formats, 1, 3).map((x) => {
    if (!['single_choice', 'completion', 'short_text'].includes(String(x)))
      teacherError('invalid_input', 400);
    return x as PrivateGuide['preferred_formats'][number];
  });
  return {
    schema_version: 1,
    strategy: v.strategy as PrivateGuide['strategy'],
    context_notes: text(v.context_notes, 0, 2000),
    examples_context: text(v.examples_context, 0, 2000),
    prerequisite_knowledge: array(v.prerequisite_knowledge, 0, 12).map((x) =>
      text(x, 1, 500),
    ),
    preferred_formats: [...new Set(formats)],
  };
}
export function answer(value: unknown): TeacherAnswer {
  const v = object(value, ['kind', 'option_id', 'text']);
  if (v.kind === 'dont_know' && Object.keys(v).length === 1)
    return { kind: 'dont_know' };
  if (v.kind === 'single_choice' && Object.keys(v).length === 2)
    return {
      kind: 'single_choice',
      option_id: text(v.option_id, 1, 64, false),
    };
  if (
    (v.kind === 'completion' || v.kind === 'short_text') &&
    Object.keys(v).length === 2
  ) {
    const t = text(v.text, 0, 2000, false);
    if (Buffer.byteLength(t) > 8192) teacherError('invalid_input', 400);
    return { kind: v.kind, text: t };
  }
  teacherError('invalid_input', 400);
}
export function blueprint(
  objectiveIds: readonly string[],
  counts: AssessmentCounts,
): BlueprintSlot[] {
  if (
    objectiveIds.length < 1 ||
    objectiveIds.length > 12 ||
    new Set(objectiveIds).size !== objectiveIds.length
  )
    teacherError('invalid_input', 400);
  const kinds = (
    ['single_choice', 'completion', 'short_text'] as const
  ).flatMap((kind) => Array.from({ length: counts[kind] }, () => kind));
  return kinds.map((kind, i) => ({
    ordinal: i + 1,
    objective_id: objectiveIds[i % objectiveIds.length],
    kind,
    max_points: kind === 'short_text' ? 6 : 2,
  }));
}
export function parseJsonOutput(raw: string): unknown {
  if (Buffer.byteLength(raw) > 32768)
    teacherError('invalid_generated_content', 422);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    teacherError('invalid_generated_content', 422);
  }
  const walk = (v: unknown, depth: number) => {
    if (depth > 12) teacherError('invalid_generated_content', 422);
    if (Array.isArray(v)) {
      if (v.length > 128) teacherError('invalid_generated_content', 422);
      v.forEach((x) => walk(x, depth + 1));
    } else if (v && typeof v === 'object') {
      if (Object.keys(v).length > 128)
        teacherError('invalid_generated_content', 422);
      Object.values(v).forEach((x) => walk(x, depth + 1));
    }
  };
  walk(parsed, 0);
  return parsed;
}
export function assessment(
  value: unknown,
  slots: readonly BlueprintSlot[],
  target: {
    scope: AssessmentCandidate['scope'];
    plan_revision_id: string | null;
    section_id: string | null;
    unit_id: string | null;
  },
): AssessmentCandidate {
  const v = object(value, [
    'schema_version',
    'scope',
    'plan_revision_id',
    'section_id',
    'unit_id',
    'items',
  ]);
  if (
    v.schema_version !== 1 ||
    (['scope', 'plan_revision_id', 'section_id', 'unit_id'] as const).some(
      (k) => v[k] !== target[k],
    )
  )
    teacherError('invalid_generated_content', 422);
  const refs = new Set<string>();
  const items = array(v.items, slots.length, slots.length).map((raw, i) => {
    const item = object(raw, [
      'local_ref',
      'objective_id',
      'kind',
      'prompt',
      'options',
      'private_key',
      'explanation',
      'hint',
    ]);
    const slot = slots[i];
    if (item.objective_id !== slot.objective_id || item.kind !== slot.kind)
      teacherError('invalid_generated_content', 422);
    const ref = text(item.local_ref, 1, 64, false);
    if (refs.has(ref)) teacherError('invalid_generated_content', 422);
    refs.add(ref);
    let options: { id: string; label: string }[] | undefined;
    let key: PrivateKey;
    if (slot.kind === 'single_choice') {
      options = array(item.options, 2, 5).map((raw) => {
        const o = object(raw, ['id', 'label']);
        return { id: text(o.id, 1, 64, false), label: text(o.label, 1, 500) };
      });
      if (new Set(options.map((o) => o.id)).size !== options.length)
        teacherError('invalid_generated_content', 422);
      const k = object(item.private_key, ['kind', 'option_id']);
      if (
        k.kind !== 'single_choice' ||
        !options.some((o) => o.id === k.option_id)
      )
        teacherError('invalid_generated_content', 422);
      key = { kind: 'single_choice', option_id: k.option_id as string };
    } else if (slot.kind === 'completion') {
      if (item.options !== undefined)
        teacherError('invalid_generated_content', 422);
      const k = object(item.private_key, [
        'kind',
        'alternatives',
        'case_sensitive',
        'ambiguous',
      ]);
      if (k.kind !== 'completion')
        teacherError('invalid_generated_content', 422);
      key = {
        kind: 'completion',
        alternatives: array(k.alternatives, 1, 12).map((x) =>
          text(x, 1, 2000, false),
        ),
        case_sensitive: bool(k.case_sensitive),
        ...(k.ambiguous === undefined ? {} : { ambiguous: bool(k.ambiguous) }),
      };
    } else {
      if (item.options !== undefined)
        teacherError('invalid_generated_content', 422);
      const k = object(item.private_key, ['kind', 'criteria']);
      if (k.kind !== 'short_text')
        teacherError('invalid_generated_content', 422);
      const ids = ['objective', 'accuracy', 'clarity'] as const;
      key = {
        kind: 'short_text',
        criteria: array(k.criteria, 3, 3).map((raw, j) => {
          const c = object(raw, ['criterion_id', 'anchors']);
          if (c.criterion_id !== ids[j])
            teacherError('invalid_generated_content', 422);
          return {
            criterion_id: ids[j],
            anchors: array(c.anchors, 3, 3).map((x) => text(x, 1, 1000)) as [
              string,
              string,
              string,
            ],
          };
        }),
      };
    }
    const hint = item.hint === undefined ? undefined : text(item.hint, 1, 1000);
    // Optional assistance must never expose a suspected answer. Keep the
    // conservative detector, omitting the hint from the normalized candidate.
    const safeHint =
      hint &&
      key.kind === 'completion' &&
      key.alternatives.some((a) =>
        hint
          .normalize('NFC')
          .toLowerCase()
          .includes(a.normalize('NFC').toLowerCase()),
      )
      ? undefined : hint;
    return {
      local_ref: ref,
      objective_id: slot.objective_id,
      kind: slot.kind,
      prompt: text(item.prompt, 1, 2000),
      ...(options ? { options } : {}),
      private_key: key,
      explanation: text(item.explanation, 1, 3000),
      ...(safeHint ? { hint: safeHint } : {}),
    };
  });
  return { schema_version: 1, ...target, items };
}
export function packet(
  value: unknown,
  slots: readonly BlueprintSlot[],
  target: { unit_id: string; plan_revision_id: string; section_id: string },
): LearningPacket {
  const v = object(value, [
    'schema_version',
    'unit_id',
    'plan_revision_id',
    'blocks',
    'practice_assessment',
  ]);
  if (
    v.schema_version !== 1 ||
    v.unit_id !== target.unit_id ||
    v.plan_revision_id !== target.plan_revision_id
  )
    teacherError('invalid_generated_content', 422);
  const ids = new Set<string>();
  const blocks = array(v.blocks, 1, 16).map((raw) => {
    const b = object(raw, ['id', 'kind', 'title', 'body_markdown']);
    if (
      !['explanation', 'example', 'guided_practice', 'summary'].includes(
        String(b.kind),
      )
    )
      teacherError('invalid_generated_content', 422);
    const id = text(b.id, 1, 64, false);
    if (ids.has(id)) teacherError('invalid_generated_content', 422);
    ids.add(id);
    const body = text(b.body_markdown, 1, 3000);
    if (/<\/?[a-z!]|!\[[^\]]*\]\(|\]\(\s*(?:javascript|data):/i.test(body))
      teacherError('invalid_generated_content', 422);
    return {
      id,
      kind: b.kind as LearningPacket['blocks'][number]['kind'],
      title: text(b.title, 1, 160),
      body_markdown: body,
    };
  });
  return {
    schema_version: 1,
    unit_id: target.unit_id,
    plan_revision_id: target.plan_revision_id,
    blocks,
    practice_assessment: assessment(v.practice_assessment, slots, {
      scope: 'unit_practice',
      ...target,
    }),
  };
}
