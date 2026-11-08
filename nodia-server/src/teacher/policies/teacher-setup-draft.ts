import { teacherError, text } from './teacher-validation.js';

export function setupDraftText(value: unknown): string {
  const valueText = text(value, 0, 4000, false);
  if (Buffer.byteLength(valueText, 'utf8') > 8192)
    teacherError('invalid_input', 400);
  return valueText;
}

export function setupDraftRevision(actual: number, expected: unknown): void {
  if (!Number.isInteger(expected) || Number(expected) < 0)
    teacherError('invalid_input', 400);
  if (actual !== expected || actual >= 2147483647)
    teacherError('draft_revision_conflict');
}

/** An older tab may send its own message, but cannot clear a newer draft. */
export function canClearSetupDraft(
  current: { setup_draft_text: string; setup_draft_revision: number },
  expectedRevision: unknown,
  sentText: string,
): boolean {
  return expectedRevision === current.setup_draft_revision
    && current.setup_draft_revision < 2147483647
    && current.setup_draft_text.trim() === sentText;
}
