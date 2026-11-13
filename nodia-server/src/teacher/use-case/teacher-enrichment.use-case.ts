import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { EntityManager } from 'typeorm';
import { TeacherService, type TeacherScope } from '../teacher.service.js';
import {
  TEACHER_GENERATION_PORT,
  type TeacherGenerationPort,
} from '../types/teacher.types.js';
import type { TeacherEnrichmentCommandDto } from '../dto/teacher-enrichment.dto.js';
import {
  ENRICHMENT_POLICY_VERSION,
  type PreparedSource,
  type ReviewSchedule,
} from '../types/teacher-enrichment.types.js';
import {
  hash,
  object,
  requireUuid,
  teacherError,
  text,
} from '../policies/teacher-validation.js';
import {
  rateReview,
  validTimezone,
} from '../policies/teacher-enrichment-scheduling.js';
import {
  gradeActivity,
  validateActivity,
  validateVisual,
} from '../policies/teacher-enrichment-activities.js';
import { prepareSource } from '../policies/teacher-enrichment-sources.js';
import { admitTeacherGeneration } from './teacher-generation-admission.js';
import {
  acceptedEnrichmentEquivalences,
  enrichmentRecord,
  readAnchor,
  rejectFinalHelp,
  type EnrichmentRecord,
  conceptLearningStates,
  conceptProvenance,
  validateConceptSourceRefs,
} from './teacher-enrichment-persistence.js';
import { conceptRelations, publicActivityData, publicVisualData } from '../policies/teacher-enrichment-projections.js';

function revision(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 2147483646
  )
    teacherError('invalid_input', 400);
  return value;
}
async function stateRevision(
  m: EntityManager,
  sessionId: string,
  lock = false,
): Promise<number> {
  const [row]: { revision: number }[] = await m.query(
    `SELECT revision FROM teacher_enrichment_states WHERE session_id=$1 ${lock ? 'FOR UPDATE' : ''}`,
    [sessionId],
  );
  return row?.revision ?? 0;
}
async function objective(
  m: EntityManager,
  sessionId: string,
  id: unknown,
): Promise<string | null> {
  if (id === undefined || id === null) return null;
  const [row]: { id: string }[] = await m.query(
    'SELECT o.id FROM teacher_objectives o JOIN teacher_sessions s ON s.id=o.session_id AND s.current_plan_revision_id=o.plan_revision_id WHERE o.session_id=$1 AND o.id=$2',
    [sessionId, requireUuid(id)],
  );
  if (!row) teacherError('invalid_input', 400);
  return row.id;
}
async function insertRecord(
  m: EntityManager,
  sessionId: string,
  kind: string,
  data: Record<string, unknown>,
): Promise<string> {
  const [count]: { count: string }[] = await m.query(
    'SELECT count(*)::text AS count FROM teacher_enrichment_records WHERE session_id=$1 AND kind=$2',
    [sessionId, kind],
  );
  if (Number(count.count) >= 500) teacherError('capacity_unavailable', 429);
  const id = randomUUID();
  await m.query(
    'INSERT INTO teacher_enrichment_records(id,session_id,kind,data) VALUES($1,$2,$3,$4)',
    [id, sessionId, kind, data],
  );
  return id;
}
function publicRecord(row: EnrichmentRecord) {
  const base = {
    id: row.id,
    revision: row.revision,
    created_at: row.created_at,
  };
  if (row.kind === 'source')
    return {
      ...base,
      title: row.data.title,
      media_type: row.data.media_type,
      content_hash: row.data.content_hash,
      page_count: (row.data.pages as unknown[]).length,
      notices: row.data.notices,
    };
  if (row.kind === 'activity')
    return { ...base, ...publicActivityData(row.data) };
  if (row.kind === 'visual') return { ...base, ...publicVisualData(row.data) };
  if (row.kind === 'card') return { ...base, ...row.data,
    availability: row.data.policy_version === ENRICHMENT_POLICY_VERSION && typeof row.data.due_at === 'string'
      && Number.isFinite(Date.parse(row.data.due_at)) ? 'available' : 'unsupported' };
  return { ...base, ...row.data };
}
@Injectable()
export class TeacherEnrichmentUseCase {
  constructor(
    private readonly store: TeacherService,
    @Inject(TEACHER_GENERATION_PORT)
    private readonly generation: TeacherGenerationPort,
  ) {}

  dashboard(actor: ActorReference, sessionId: string, page = 1) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      teacherError('invalid_input', 400);
    return this.store.scope(
      actor,
      sessionId,
      async ({ manager: m, session: s }) => {
        const kinds = [
          'card',
          'thread',
          'source',
          'activity',
          'concept',
          'equivalence',
          'visual',
        ];
        const rows: EnrichmentRecord[] = await m.query(
          `SELECT r.* FROM unnest($2::text[]) AS kinds(kind)
           CROSS JOIN LATERAL (SELECT * FROM teacher_enrichment_records
             WHERE session_id=$1 AND kind=kinds.kind
             ORDER BY CASE WHEN kinds.kind='card' AND data->>'policy_version'=$4 THEN data->>'due_at' END NULLS LAST,created_at,id LIMIT 21 OFFSET $3) r`,
          [sessionId, kinds, (page - 1) * 20, ENRICHMENT_POLICY_VERSION],
        );
        const lists = kinds.map((kind) =>
          rows.filter((row) => row.kind === kind),
        );
        const learning = await conceptLearningStates(m, s!, lists[kinds.indexOf('concept')].slice(0, 20));
        const provenance = await conceptProvenance(m, s!, lists[kinds.indexOf('concept')].slice(0, 20));
        const result = Object.fromEntries(
          kinds.map((kind, i) => [
            kind,
            lists[i].slice(0, 20).map(row => row.kind === 'concept'
              ? { ...publicRecord(row), learning_state: learning.get(row.id), ...provenance.get(row.id) }
              : publicRecord(row)),
          ]),
        );
        return {
          schema_version: 1,
          revision: await stateRevision(m, sessionId),
          policy_version: ENRICHMENT_POLICY_VERSION,
          page,
          limit: 20,
          review_cards: result.card,
          threads: result.thread,
          sources: result.source,
          activities: result.activity,
          concepts: result.concept,
          equivalences: result.equivalence,
          accepted_equivalences: await acceptedEnrichmentEquivalences(m, s!),
          visuals: result.visual,
          has_more: lists.some((rows) => rows.length > 20),
          allowed_actions: {
            edit: {
              enabled: s!.state !== 'paused' && s!.state !== 'archived',
              reason_code:
                s!.state === 'archived'
                  ? 'session_archived'
                  : s!.state === 'paused'
                    ? 'session_paused'
                    : null,
            },
          },
        };
      },
    );
  }
  thread(actor: ActorReference, sessionId: string, id: string) {
    return this.store.scope(actor, sessionId, async ({ manager: m }) => {
      const row = await enrichmentRecord(m, sessionId, id, 'thread');
      const events: {
        id: string;
        data: Record<string, unknown>;
        created_at: Date;
      }[] = await m.query(
        "SELECT id,data,created_at FROM teacher_enrichment_events WHERE session_id=$1 AND record_id=$2 AND kind='message' ORDER BY created_at DESC,id DESC LIMIT 21",
        [sessionId, id],
      );
      return {
        thread: publicRecord(row),
        messages: events
          .slice(0, 20)
          .reverse()
          .map((e) => ({ id: e.id, created_at: e.created_at, ...e.data })),
        has_more: events.length > 20,
      };
    });
  }
  source(actor: ActorReference, sessionId: string, id: string) {
    return this.store.scope(actor, sessionId, async ({ manager: m }) => {
      const row = await enrichmentRecord(m, sessionId, id, 'source');
      return { id: row.id, ...row.data };
    });
  }
  concepts(actor: ActorReference, sessionId: string, page = 1, query = '') {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      teacherError('invalid_input', 400);
    const search = text(query, 0, 120).replace(/[\\%_]/g, '\\$&');
    return this.store.scope(actor, sessionId, async ({ manager }) => {
      const rows: EnrichmentRecord[] = await manager.query(
        "SELECT * FROM teacher_enrichment_records WHERE session_id=$1 AND kind='concept' AND (data->>'label' ILIKE $2 OR data->>'statement' ILIKE $2) ORDER BY created_at,id LIMIT 21 OFFSET $3",
        [sessionId, `%${search}%`, (page - 1) * 20],
      );
      return {
        items: rows.slice(0, 20).map(publicRecord),
        has_more: rows.length > 20,
        page,
        limit: 20,
      };
    });
  }
  concept(actor: ActorReference, sessionId: string, id: string) {
    return this.store.scope(actor, sessionId, async ({ manager, session }) => {
      const row = await enrichmentRecord(manager, sessionId, id, 'concept');
      const learning = await conceptLearningStates(manager, session!, [row]);
      const provenance = await conceptProvenance(manager, session!, [row]);
      return { ...publicRecord(row), learning_state: learning.get(row.id), ...provenance.get(row.id) };
    });
  }
  async execute(
    actor: ActorReference,
    sessionId: string,
    key: string,
    command: TeacherEnrichmentCommandDto,
  ) {
    requireUuid(key);
    revision(command.expected_revision);
    let prepared: PreparedSource | undefined;
    if (command.operation === 'source_create') {
      const previous = await this.store.scope(
        actor,
        sessionId,
        async ({ manager, actor: current, session }) => {
          const [receipt]: {
            payload_hash: string;
            receipt: Record<string, unknown>;
          }[] = await manager.query(
            'SELECT payload_hash,receipt FROM teacher_requests WHERE actor_id=$1 AND request_key=$2',
            [current.actorId, key],
          );
          if (receipt) {
            const digest = hash({
              operation: 'enrichment:source_create',
              session_id: sessionId,
              body: command,
            });
            if (receipt.payload_hash !== digest)
              teacherError('idempotency_conflict');
            return receipt.receipt;
          }
          if (session!.state === 'paused' || session!.state === 'archived')
            teacherError(
              session!.state === 'paused'
                ? 'session_paused'
                : 'session_archived',
            );
          if (revision(command.expected_revision) !== await stateRevision(manager, sessionId))
            teacherError('revision_conflict', 409);
          return null;
        },
      );
      if (previous) return previous;
      prepared = await prepareSource(command.payload);
    }
    return this.store.command(
      actor,
      sessionId,
      key,
      `enrichment:${command.operation}`,
      command,
      async (scope) => {
        const { manager: m, session: s } = scope;
        if (s!.state === 'paused' || s!.state === 'archived')
          teacherError(
            s!.state === 'paused' ? 'session_paused' : 'session_archived',
          );
        await m.query(
          'INSERT INTO teacher_enrichment_states(session_id) VALUES($1) ON CONFLICT DO NOTHING',
          [sessionId],
        );
        const current = await stateRevision(m, sessionId, true);
        if (revision(command.expected_revision) !== current)
          teacherError('revision_conflict', 409);
        const receipt = await this.apply(scope, command, prepared);
        await m.query(
          'UPDATE teacher_enrichment_states SET revision=revision+1 WHERE session_id=$1',
          [sessionId],
        );
        return {
          status: 200,
          receipt: { session_id: sessionId, revision: current + 1, ...receipt },
        };
      },
    );
  }
  private async apply(
    scope: TeacherScope,
    command: TeacherEnrichmentCommandDto,
    prepared?: PreparedSource,
  ): Promise<Record<string, unknown>> {
    const { manager: m, session: s } = scope;
    const sessionId = s!.id;
    const p = command.payload;
    switch (command.operation) {
      case 'card_create': {
        object(p, ['question', 'answer', 'objective_id', 'timezone']);
        const id = await insertRecord(m, sessionId, 'card', {
          question: text(p.question, 1, 2000),
          answer: text(p.answer, 1, 2000),
          objective_id: await objective(m, sessionId, p.objective_id),
          timezone: validTimezone(p.timezone),
          due_at: new Date().toISOString(),
          state: 'new',
          interval_days: 0,
          reviews: 0,
          origin: 'user_authored',
          policy_version: ENRICHMENT_POLICY_VERSION,
        });
        return { kind: 'review_card', resource_id: id };
      }
      case 'review_rate': {
        object(p, ['card_id', 'expected_card_revision', 'rating']);
        const card = await enrichmentRecord(
          m,
          sessionId,
          p.card_id,
          'card',
          true,
        );
        if (revision(p.expected_card_revision) !== card.revision)
          teacherError('revision_conflict');
        if (card.data.policy_version !== ENRICHMENT_POLICY_VERSION)
          teacherError('invalid_input', 400);
        if (
          typeof card.data.due_at !== 'string' ||
          !Number.isFinite(Date.parse(card.data.due_at))
        )
          teacherError('invalid_input', 400);
        if (Date.parse(card.data.due_at) > Date.now())
          teacherError('review_not_due', 409);
        const schedule = rateReview(
          card.data as unknown as ReviewSchedule,
          Number(p.rating),
          Date.now(),
        );
        if (typeof p.rating !== 'number') teacherError('invalid_input', 400);
        const ratingId = randomUUID();
        const data = {
          ...card.data,
          ...schedule,
          policy_version: ENRICHMENT_POLICY_VERSION,
          recommendation: p.rating === 1 ? { kind: 'reinforce', reason: 'self_reported_forgetting',
            evidence_id: ratingId, grants_verification: false } : null,
        };
        await m.query(
          'UPDATE teacher_enrichment_records SET revision=revision+1,data=$3,updated_at=clock_timestamp() WHERE session_id=$1 AND id=$2',
          [sessionId, card.id, data],
        );
        await m.query(
          "INSERT INTO teacher_enrichment_events(id,session_id,record_id,kind,data) VALUES($1,$2,$3,'rating',$4)",
          [
            ratingId,
            sessionId,
            card.id,
            {
              rating: p.rating,
              previous_due_at: card.data.due_at,
              previous_schedule: { due_at: card.data.due_at, timezone: card.data.timezone,
                interval_days: card.data.interval_days, reviews: card.data.reviews, state: card.data.state },
              schedule,
              policy_version: ENRICHMENT_POLICY_VERSION,
              assessment_kind: 'self_rating',
              grants_verification: false,
            },
          ],
        );
        return {
          kind: 'review_rating',
          resource_id: card.id,
          due_at: schedule.due_at,
        };
      }
      case 'thread_create': {
        object(p, ['content_version_id', 'block_id', 'selection']);
        await rejectFinalHelp(m, sessionId);
        const data = {
          content_version_id: requireUuid(p.content_version_id),
          block_id: text(p.block_id, 1, 64),
          selection: text(p.selection, 1, 2000, false),
        };
        await readAnchor(m, sessionId, data);
        const id = await insertRecord(m, sessionId, 'thread', data);
        return { kind: 'clarification', resource_id: id };
      }
      case 'thread_message': {
        object(p, ['thread_id', 'text']);
        await rejectFinalHelp(m, sessionId);
        const thread = await enrichmentRecord(
          m,
          sessionId,
          p.thread_id,
          'thread',
          true,
        );
        const context = await readAnchor(m, sessionId, thread.data);
        const [count]: { count: string }[] = await m.query(
          "SELECT count(*)::text AS count FROM teacher_enrichment_events WHERE session_id=$1 AND record_id=$2 AND kind='message'",
          [sessionId, thread.id],
        );
        if (Number(count.count) >= 200)
          teacherError('capacity_unavailable', 429);
        const message = text(p.text, 1, 2000);
        await m.query(
          "INSERT INTO teacher_enrichment_events(id,session_id,record_id,kind,data) VALUES($1,$2,$3,'message',$4)",
          [
            randomUUID(),
            sessionId,
            thread.id,
            { role: 'user', text: message, job_id: null },
          ],
        );
        const history: { data: Record<string, unknown> }[] = await m.query(
          "SELECT data FROM teacher_enrichment_events WHERE session_id=$1 AND record_id=$2 AND kind='message' ORDER BY created_at DESC,id DESC LIMIT 12",
          [sessionId, thread.id],
        );
        const result = await admitTeacherGeneration(
          scope,
          this.generation,
          'contextual_reply',
          {
            thread_id: thread.id,
            visible_context: context,
            selection: thread.data.selection,
            anchor_hash: hash({
              block: context,
              selection: thread.data.selection,
            }),
            messages: history.reverse().map((e) => e.data),
          },
          {},
          randomUUID(),
        );
        return { ...result, kind: 'job', thread_id: thread.id };
      }
      case 'source_create': {
        if (!prepared) teacherError('invalid_input', 400);
        const existing: { id: string }[] = await m.query(
          "SELECT id FROM teacher_enrichment_records WHERE session_id=$1 AND kind='source' AND data->>'content_hash'=$2 AND data->>'title'=$3 LIMIT 1",
          [sessionId, prepared.content_hash, prepared.title],
        );
        const id =
          existing[0]?.id ??
          (await insertRecord(m, sessionId, 'source', { ...prepared }));
        return { kind: 'learning_source', resource_id: id };
      }
      case 'activity_create': {
        object(p, ['kind', 'objective_id', 'prompt', 'payload', 'solution']);
        const activity = validateActivity({
          kind: p.kind,
          prompt: p.prompt,
          payload: p.payload,
          solution: p.solution,
        });
        const id = await insertRecord(m, sessionId, 'activity', {
          ...activity,
          schema_version: 1,
          objective_id: await objective(m, sessionId, p.objective_id),
          answered: false,
          origin: 'user_authored',
          solution_seen_at: new Date().toISOString(),
        });
        return { kind: 'learning_activity', resource_id: id };
      }
      case 'activity_respond': {
        object(p, ['activity_id', 'expected_activity_revision', 'answer']);
        const activity = await enrichmentRecord(
          m,
          sessionId,
          p.activity_id,
          'activity',
          true,
        );
        if (publicActivityData(activity.data).availability !== 'available')
          teacherError('invalid_input', 400);
        if (revision(p.expected_activity_revision) !== activity.revision)
          teacherError('revision_conflict');
        const snapshot = validateActivity({
          kind: activity.data.kind,
          prompt: activity.data.prompt,
          payload: activity.data.payload,
          solution: activity.data.solution,
        });
        const observation = gradeActivity(snapshot, p.answer);
        await m.query(
          "INSERT INTO teacher_enrichment_events(id,session_id,record_id,kind,data) VALUES($1,$2,$3,'response',$4)",
          [
            randomUUID(),
            sessionId,
            activity.id,
            {
              answer: p.answer,
              observation,
              objective_id: activity.data.objective_id,
              activity_revision: activity.revision,
              solution_seen_at: activity.data.solution_seen_at,
            },
          ],
        );
        await m.query(
          "UPDATE teacher_enrichment_records SET revision=revision+1,data=jsonb_set(data,'{answered}','true'),updated_at=clock_timestamp() WHERE session_id=$1 AND id=$2",
          [sessionId, activity.id],
        );
        return {
          kind: 'activity_observation',
          resource_id: activity.id,
          observation,
          solution: activity.data.solution,
        };
      }
      case 'concept_create': {
        object(p, ['label', 'statement', 'conditions', 'objective_id', 'relations', 'source_refs']);
        const relations = conceptRelations(p.relations);
        const targets = [...new Set(relations.flatMap(relation => relation.target_concept_ids))];
        if (targets.length) {
          const rows: { id: string }[] = await m.query(
            "SELECT r.id FROM teacher_enrichment_records r JOIN teacher_sessions s ON s.id=r.session_id WHERE r.id=ANY($1::uuid[]) AND r.kind='concept' AND s.owner_user_id=$2",
            [targets, s!.owner_user_id]);
          if (rows.length !== targets.length) teacherError('not_found', 404);
        }
        const sourceRefs = await validateConceptSourceRefs(m, sessionId, p.source_refs);
        const id = await insertRecord(m, sessionId, 'concept', {
          label: text(p.label, 1, 160),
          statement: text(p.statement, 1, 2000),
          conditions:
            p.conditions === undefined ? '' : text(p.conditions, 0, 2000),
          objective_id: await objective(m, sessionId, p.objective_id),
          plan_revision_id: p.objective_id ? s!.current_plan_revision_id : null,
          origin: 'user_authored',
          verification_state: 'not_verified',
          relations,
          source_refs: sourceRefs,
        });
        return { kind: 'learning_concept', resource_id: id };
      }
      case 'equivalence_set':
        return this.equivalence(scope, p);
      case 'visual_create': {
        const visual = validateVisual(p);
        return {
          kind: 'learning_visual',
          resource_id: await insertRecord(m, sessionId, 'visual', { ...visual, schema_version: 1 }),
        };
      }
      default:
        teacherError('invalid_input', 400);
    }
  }
  private async equivalence(
    scope: TeacherScope,
    payload: Record<string, unknown>,
  ) {
    const p = object(payload, [
      'from_concept_id',
      'to_concept_id',
      'state',
      'expected_equivalence_revision',
    ]);
    const { manager: m, session: s } = scope;
    const from = await enrichmentRecord(m, s!.id, p.from_concept_id, 'concept');
    const targetId = requireUuid(p.to_concept_id);
    const [to]: { id: string; session_id: string; owner_user_id: string }[] =
      await m.query(
        "SELECT r.id,r.session_id,s.owner_user_id FROM teacher_enrichment_records r JOIN teacher_sessions s ON s.id=r.session_id WHERE r.id=$1 AND r.kind='concept'",
        [targetId],
      );
    // Cross-plan memory is private to the source owner, including for admin actors.
    if (!to || to.owner_user_id !== s!.owner_user_id || to.id === from.id)
      teacherError('not_found', 404);
    if (!['proposed', 'accepted', 'rejected'].includes(String(p.state)))
      teacherError('invalid_input', 400);
    const rows: EnrichmentRecord[] = await m.query(
      "SELECT * FROM teacher_enrichment_records WHERE session_id=$1 AND kind='equivalence' AND data->>'from_concept_id'=$2 AND data->>'to_concept_id'=$3 FOR UPDATE",
      [s!.id, from.id, to.id],
    );
    let id: string;
    if (rows[0]) {
      if (revision(p.expected_equivalence_revision) !== rows[0].revision)
        teacherError('revision_conflict');
      id = rows[0].id;
      await m.query(
        'UPDATE teacher_enrichment_records SET revision=revision+1,data=$3,updated_at=clock_timestamp() WHERE session_id=$1 AND id=$2',
        [
          s!.id,
          id,
          {
            ...rows[0].data,
            state: p.state,
            reviewed_at: new Date().toISOString(),
          },
        ],
      );
    } else {
      if (p.expected_equivalence_revision !== undefined)
        teacherError('revision_conflict');
      id = await insertRecord(m, s!.id, 'equivalence', {
        from_concept_id: from.id,
        to_concept_id: to.id,
        target_session_id: to.session_id,
        state: p.state,
        reviewed_at: p.state === 'proposed' ? null : new Date().toISOString(),
        transfers_verification: false,
      });
    }
    await m.query(
      "INSERT INTO teacher_enrichment_events(id,session_id,record_id,kind,data) VALUES($1,$2,$3,'equivalence',$4)",
      [
        randomUUID(),
        s!.id,
        id,
        {
          actor_id: scope.actor.actorId,
          previous_state: rows[0]?.data.state ?? null,
          next_state: p.state,
          previous_revision: rows[0]?.revision ?? null,
          from_concept_id: from.id,
          to_concept_id: to.id,
        },
      ],
    );
    return { kind: 'concept_equivalence', resource_id: id };
  }
}
