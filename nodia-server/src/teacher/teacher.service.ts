import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
  type CurrentActor,
} from '../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import type { TeacherSessionRow } from './types/teacher.types.js';
import {
  hash,
  requireUuid,
  teacherError,
} from './policies/teacher-validation.js';
import { lockNodiaAiQueue } from '../nodia-ai-runtime/queue-lock.js';

export interface TeacherScope {
  manager: EntityManager;
  actor: CurrentActor;
  session: TeacherSessionRow | null;
  reference: ActorReference;
}
@Injectable()
export class TeacherService {
  constructor(
    readonly source: DataSource,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}
  async scope<T>(
    actor: ActorReference,
    sessionId: string | null,
    work: (scope: TeacherScope) => Promise<T>,
    locked = false,
  ): Promise<T> {
    if (sessionId) requireUuid(sessionId);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      await lockAuthority(manager);
      const current = await currentActor(manager, actor);
      await this.modules.execute(current.actorId, ['/nodia-teacher'], manager);
      if (locked) await lockNodiaAiQueue(manager);
      let session: TeacherSessionRow | null = null;
      if (sessionId) {
        const rows: TeacherSessionRow[] = await manager.query(
          `SELECT * FROM teacher_sessions WHERE id=$1 ${locked ? 'FOR UPDATE' : ''}`,
          [sessionId],
        );
        session = rows[0] ?? null;
        if (
          !session ||
          (!current.isSuperAdmin && session.owner_user_id !== current.actorId)
        )
          teacherError('not_found', 404);
      }
      return work({ manager, actor: current, session, reference: actor });
    });
  }
  async command<T extends Record<string, unknown>>(
    actor: ActorReference,
    sessionId: string | null,
    key: string,
    operation: string,
    body: unknown,
    work: (scope: TeacherScope) => Promise<{ status: number; receipt: T }>,
  ): Promise<T> {
    requireUuid(key);
    const digest = hash({ operation, session_id: sessionId, body });
    return this.scope(
      actor,
      sessionId,
      async (scope) => {
        const m = scope.manager;
        // Actor request lock serializes the first insert too, before a session exists.
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `teacher-request:${scope.actor.actorId}:${key}`,
        ]);
        const previous: {
          payload_hash: string;
          receipt: T;
          session_id: string | null;
        }[] = await m.query(
          'SELECT payload_hash,receipt,session_id FROM teacher_requests WHERE actor_id=$1 AND request_key=$2',
          [scope.actor.actorId, key],
        );
        if (previous[0]) {
          if (previous[0].payload_hash !== digest)
            teacherError('idempotency_conflict');
          if (previous[0].session_id && !scope.session) {
            const rows: TeacherSessionRow[] = await m.query(
              'SELECT * FROM teacher_sessions WHERE id=$1',
              [previous[0].session_id],
            );
            if (
              !rows[0] ||
              (!scope.actor.isSuperAdmin &&
                rows[0].owner_user_id !== scope.actor.actorId)
            )
              teacherError('not_found', 404);
          }
          return previous[0].receipt;
        }
        const result = await work(scope);
        const actualSession =
          sessionId ??
          (typeof result.receipt.session_id === 'string'
            ? result.receipt.session_id
            : null);
        await m.query(
          'INSERT INTO teacher_requests(actor_id,request_key,operation,session_id,payload_hash,http_status,receipt) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            scope.actor.actorId,
            key,
            operation,
            actualSession,
            digest,
            result.status,
            result.receipt,
          ],
        );
        return result.receipt;
      },
      true,
    );
  }
  async receipt(actor: ActorReference, key: string) {
    requireUuid(key);
    return this.scope(actor, null, async ({ manager, actor: current }) => {
      const [row]: {
        request_key: string;
        session_id: string | null;
        receipt: Record<string, unknown>;
      }[] = await manager.query(
        'SELECT request_key,operation,session_id,http_status,receipt,completed_at FROM teacher_requests WHERE actor_id=$1 AND request_key=$2',
        [current.actorId, key],
      );
      if (!row) teacherError('not_found', 404);
      if (row.session_id) {
        const [session]: TeacherSessionRow[] = await manager.query(
          'SELECT * FROM teacher_sessions WHERE id=$1',
          [row.session_id],
        );
        if (
          !session ||
          (!current.isSuperAdmin && session.owner_user_id !== current.actorId)
        )
          teacherError('not_found', 404);
      }
      return row;
    });
  }
}
