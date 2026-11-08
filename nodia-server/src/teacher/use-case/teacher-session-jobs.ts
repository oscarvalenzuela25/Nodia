import type { EntityManager } from 'typeorm';
import type { TeacherGenerationJob } from '../types/teacher.types.js';

export type SessionListJob = { job_id: string; state: TeacherGenerationJob['state']; purpose: TeacherGenerationJob['purpose'] };

/** Only IDs from the already authorized, bounded session page enter this read. */
export async function latestSessionJobs(manager: EntityManager, sessionIds: readonly string[]): Promise<Map<string, SessionListJob>> {
  const ids = [...new Set(sessionIds)];
  if (ids.length > 50) throw new Error('teacher_session_page_exceeds_limit');
  if (!ids.length) return new Map();
  const rows: (SessionListJob & { session_id: string })[] = await manager.query(
    "SELECT DISTINCT ON (session_id) session_id,id AS job_id,state,purpose FROM teacher_generation_jobs WHERE session_id=ANY($1::uuid[]) ORDER BY session_id,(state IN ('queued','running')) DESC,created_at DESC,id DESC",
    [ids],
  );
  const allowed = new Set(ids);
  return new Map(rows.filter(row => allowed.has(row.session_id)).map(row => [row.session_id,
    { job_id: row.job_id, state: row.state, purpose: row.purpose },
  ]));
}
