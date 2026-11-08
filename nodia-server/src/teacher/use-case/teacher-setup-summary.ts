import type { EntityManager } from 'typeorm';
/** An immutable model-provided brief, anchored to the stored assistant message version. */
export async function latestTeacherSetupSummary(
  m: EntityManager,
  sessionId: string,
): Promise<unknown | null> {
  const [row]: { summary: unknown }[] = await m.query(
    "SELECT result_ref->'setup_summary' AS summary FROM teacher_generation_jobs WHERE session_id=$1 AND purpose='setup_reply' AND state='ready' AND result_ref ? 'setup_summary' ORDER BY updated_at DESC,id DESC LIMIT 1",
    [sessionId],
  );
  return row?.summary ?? null;
}
