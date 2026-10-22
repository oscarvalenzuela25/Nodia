import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** In-memory SQL dependency for use-case tests, never imported by production. */
export function eventJournalFixture(run?: {
  id: string;
  state: string;
  revision?: number;
  error_code?: string | null;
}) {
  const events: {
    id: string;
    conversation_id: string;
    run_id: string;
    seq: string;
    event_key: string;
    public_payload: NodiaAiJsonObject;
    scope_manifest: NodiaAiJsonObject;
  }[] = [];
  let sequence = 0n;
  function query(sql: string, args: unknown[] = []): unknown[] | undefined {
    if (sql === 'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE')
      return [{ id: args[0] }];
    if (
      sql.startsWith(
        'SELECT run_id,public_payload,scope_manifest FROM nodia_ai_events',
      )
    )
      return events.filter(
        (item) =>
          item.conversation_id === args[0] && item.event_key === args[1],
      );
    if (sql.includes('SET next_event_seq=next_event_seq+1')) {
      if (
        events.filter((item) => item.run_id === args[1]).length >=
        Number(args[2])
      )
        return [];
      return [{ seq: String(++sequence) }];
    }
    if (sql.startsWith('INSERT INTO nodia_ai_events')) {
      events.push({
        id: String(args[0]),
        conversation_id: String(args[1]),
        seq: String(args[2]),
        event_key: String(args[3]),
        run_id: String(args[4]),
        public_payload: JSON.parse(String(args[5])),
        scope_manifest: JSON.parse(String(args[6])),
      });
      return [];
    }
    if (sql.includes('UPDATE nodia_ai_runs SET revision=revision+1') && run) {
      run.revision = (run.revision ?? 1) + 1;
      return [
        {
          revision: run.revision,
          state: run.state,
          error_code: run.error_code ?? null,
        },
      ];
    }
    return undefined;
  }
  return { events, query };
}
