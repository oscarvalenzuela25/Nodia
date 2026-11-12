import { object, text, teacherError } from './teacher-validation.js';
import type {
  ActivityKind,
  EnrichmentActivity,
  ActivityObservation,
} from '../types/teacher-enrichment.types.js';

function strings(value: unknown, min = 1): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > 24)
    teacherError('invalid_input', 400);
  return value.map((v) => text(v, 1, 500));
}
/** Only known declarative data is retained; no HTML, scripts or renderer names. */
export function validateActivity(value: unknown): EnrichmentActivity {
  const v = object(value, ['kind', 'prompt', 'payload', 'solution']);
  const prompt = text(v.prompt, 1, 3000);
  const kind = v.kind as ActivityKind;
  if (kind === 'ordering') {
    const payload = object(v.payload, ['items']);
    const items = strings(payload.items, 2);
    const solution = strings(v.solution, 2);
    if (
      new Set(items).size !== items.length ||
      solution.length !== items.length ||
      new Set(solution).size !== items.length ||
      solution.some((s) => !items.includes(s))
    )
      teacherError('invalid_input', 400);
    return { kind, prompt, payload: { items }, solution };
  }
  if (kind === 'classification') {
    const payload = object(v.payload, ['items', 'categories']);
    const items = strings(payload.items);
    const categories = strings(payload.categories, 2);
    if (
      new Set(items).size !== items.length ||
      new Set(categories).size !== categories.length
    )
      teacherError('invalid_input', 400);
    const solution = object(v.solution, items);
    if (
      Object.keys(solution).length !== items.length ||
      items.some(
        (item) =>
          typeof solution[item] !== 'string' ||
          !categories.includes(solution[item] as string),
      )
    )
      teacherError('invalid_input', 400);
    return { kind, prompt, payload: { items, categories }, solution };
  }
  if (kind === 'error_location') {
    const payload = object(v.payload, ['lines']);
    const lines = strings(payload.lines, 2);
    if (
      typeof v.solution !== 'number' ||
      !Number.isInteger(v.solution) ||
      v.solution < 1 ||
      v.solution > lines.length
    )
      teacherError('invalid_input', 400);
    return { kind, prompt, payload: { lines }, solution: v.solution };
  }
  if (kind === 'completion') {
    object(v.payload, []);
    return { kind, prompt, payload: {}, solution: text(v.solution, 1, 2000) };
  }
  teacherError('invalid_input', 400);
}
const normalized = (v: string) =>
  v.normalize('NFC').trim().replace(/\s+/g, ' ');
export function gradeActivity(
  activity: EnrichmentActivity,
  answer: unknown,
): ActivityObservation {
  let correct = false;
  if (activity.kind === 'ordering') {
    const values = strings(answer, 2);
    const expected = activity.solution as string[];
    if (
      values.length !== expected.length ||
      new Set(values).size !== expected.length ||
      values.some((v) => !expected.includes(v))
    )
      teacherError('invalid_input', 400);
    correct = values.every((v, i) => v === expected[i]);
  } else if (activity.kind === 'classification') {
    const expected = activity.solution as Record<string, string>;
    const values = object(answer, Object.keys(expected));
    if (
      Object.keys(values).length !== Object.keys(expected).length ||
      Object.values(values).some(
        (v) =>
          typeof v !== 'string' ||
          !(activity.payload.categories as string[]).includes(v),
      )
    )
      teacherError('invalid_input', 400);
    correct = Object.keys(expected).every(
      (key) => values[key] === expected[key],
    );
  } else if (activity.kind === 'error_location') {
    if (
      typeof answer !== 'number' ||
      !Number.isInteger(answer) ||
      answer < 1 ||
      answer > (activity.payload.lines as string[]).length
    )
      teacherError('invalid_input', 400);
    correct = answer === activity.solution;
  } else
    correct =
      normalized(text(answer, 1, 2000)) ===
      normalized(activity.solution as string);
  return {
    correct,
    explanation: 'teacher:activity_observed',
    independent: false,
    assisted: true,
    assistance_reason: 'user_authored_solution',
    grants_verification: false,
  };
}

export function validateVisual(value: unknown) {
  const v = object(value, ['kind', 'title', 'labels', 'values']);
  if (!['bar_chart', 'timeline'].includes(String(v.kind)))
    teacherError('invalid_input', 400);
  const labels = strings(v.labels);
  if (
    !Array.isArray(v.values) ||
    v.values.length !== labels.length ||
    v.values.some(
      (x) => typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 1e12,
    )
  )
    teacherError('invalid_input', 400);
  return {
    kind: v.kind as 'bar_chart' | 'timeline',
    title: text(v.title, 1, 160),
    labels,
    values: v.values as number[],
  };
}
