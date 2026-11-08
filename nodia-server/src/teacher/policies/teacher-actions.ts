import type { TeacherSessionRow } from '../types/teacher.types.js';
export type TeacherActions = Record<
  string,
  {
    enabled: boolean;
    reason_code: string | null;
    consequence?: {
      assisted: true;
      grants_verification: false;
      notice_key: string;
    };
  }
>;
export function actions(
  keys: readonly string[],
  enabled: boolean,
  reason: string | null = null,
): TeacherActions {
  return Object.fromEntries(
    keys.map((k) => [k, { enabled, reason_code: enabled ? null : reason }]),
  );
}
export function sessionActions(s: TeacherSessionRow): TeacherActions {
  const mutable = s.state !== 'paused' && s.state !== 'archived',
    hasPlan = !!s.current_plan_revision_id;
  return {
    ...actions(
      ['edit', 'propose_plan', 'start_diagnostic'],
      mutable,
      s.state === 'paused' ? 'session_paused' : 'session_archived',
    ),
    ...actions(
      ['accept_plan'],
      mutable && !hasPlan,
      hasPlan
        ? 'plan_exists'
        : s.state === 'paused'
          ? 'session_paused'
          : 'session_archived',
    ),
    ...actions(
      ['activate_revision', 'prepare_unit', 'start_section_final'],
      mutable && hasPlan,
      hasPlan ? 'session_paused' : 'plan_required',
    ),
    ...actions(['pause'], mutable, 'session_paused'),
    ...actions(['resume'], s.state === 'paused', 'not_paused'),
    ...actions(['archive'], s.state !== 'archived', 'session_archived'),
    ...actions(['unarchive'], s.state === 'archived', 'not_archived'),
  };
}
