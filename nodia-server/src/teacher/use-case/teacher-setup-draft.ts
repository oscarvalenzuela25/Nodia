import type { TeacherScope } from '../teacher.service.js';
import { teacherError } from '../policies/teacher-validation.js';
import { setupDraftRevision, setupDraftText } from '../policies/teacher-setup-draft.js';

export function setupDraftResult(scope: TeacherScope) {
  return {
    setup_draft_text: scope.session!.setup_draft_text,
    setup_draft_revision: scope.session!.setup_draft_revision,
  };
}

/** The caller holds the existing session lock and transaction. No generation or revision bump. */
export async function saveSetupDraft(scope: TeacherScope, expected: unknown, value: unknown) {
  const session = scope.session!;
  if (session.state === 'paused') teacherError('session_paused');
  if (session.state === 'archived') teacherError('session_archived');
  const draft = setupDraftText(value);
  setupDraftRevision(session.setup_draft_revision, expected);
  if (draft !== session.setup_draft_text) {
    const [saved]: { setup_draft_text: string; setup_draft_revision: number }[] = await scope.manager.query(
      'WITH saved AS (UPDATE teacher_sessions SET setup_draft_text=$2,setup_draft_revision=setup_draft_revision+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING setup_draft_text,setup_draft_revision) SELECT setup_draft_text,setup_draft_revision FROM saved',
      [session.id, draft],
    );
    Object.assign(session, saved);
  }
  return setupDraftResult(scope);
}
