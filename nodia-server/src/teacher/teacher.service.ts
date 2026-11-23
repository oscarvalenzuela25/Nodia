import { Injectable, InternalServerErrorException } from '@nestjs/common';
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

type TeacherReceipt = {
  request_key: string;
  operation: string;
  session_id: string | null;
  http_status: number;
  receipt: Record<string, unknown>;
  completed_at: Date;
};
type TeacherRequestClosure =
  | { status: 'closed'; request_key: string }
  | { status: 'saved'; request: TeacherReceipt };

const closeOperation = 'close_request';

export function assertTeacherRequestOpen(operation: string): void {
  if (operation === closeOperation) teacherError('request_closed', 410);
}

function lockTeacherRequest(
  manager: EntityManager,
  actorId: string,
  key: string,
) {
  // PostgreSQL treats upper- and lowercase UUIDs as the same key.
  return manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `teacher-request:${actorId}:${key.toLowerCase()}`,
  ]);
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
    transaction = actor.transaction,
  ): Promise<T> {
    if (sessionId) requireUuid(sessionId);
    const run = async (manager: EntityManager) => {
      if (!transaction) await lockAuthority(manager);
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
    };
    if (!transaction) return this.source.transaction('READ COMMITTED', run);
    // The internal runtime owns the authority barrier and statement deadline.
    if (!transaction.queryRunner?.isTransactionActive)
      throw new InternalServerErrorException(
        'authorization:transaction_required',
      );
    return run(transaction);
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
        await lockTeacherRequest(m, scope.actor.actorId, key);
        const previous: {
          operation: string;
          payload_hash: string;
          receipt: T;
          session_id: string | null;
        }[] = await m.query(
          'SELECT operation,payload_hash,receipt,session_id FROM teacher_requests WHERE actor_id=$1 AND request_key=$2',
          [scope.actor.actorId, key],
        );
        if (previous[0]) {
          assertTeacherRequestOpen(previous[0].operation);
          if (previous[0].payload_hash !== digest)
            teacherError('idempotency_conflict');
          if (!scope.session)
            await this.requireReceiptAuthority(scope, previous[0].session_id);
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
    return this.scope(actor, null, async (scope) => {
      const row = await this.findReceipt(scope, key);
      if (!row) teacherError('not_found', 404);
      assertTeacherRequestOpen(row.operation);
      await this.requireReceiptAuthority(scope, row.session_id);
      return row;
    });
  }

  async closeRequest(
    actor: ActorReference,
    key: string,
  ): Promise<TeacherRequestClosure> {
    const requestKey = requireUuid(key).toLowerCase();
    return this.scope(actor, null, async (scope) => {
      const { manager, actor: current } = scope;
      await lockTeacherRequest(manager, current.actorId, requestKey);
      const previous = await this.findReceipt(scope, requestKey);
      if (previous && previous.operation !== closeOperation) {
        await this.requireReceiptAuthority(scope, previous.session_id);
        return { status: 'saved', request: previous };
      }

      const closed = { status: 'closed', request_key: requestKey } as const;
      if (!previous) {
        // Record the close itself before letting the client submit a new intent.
        await manager.query(
          'INSERT INTO teacher_requests(actor_id,request_key,operation,payload_hash,http_status,receipt) VALUES($1,$2,$3,$4,200,$5)',
          [current.actorId, requestKey, closeOperation, hash(closed), closed],
        );
      }
      return closed;
    });
  }

  private async findReceipt({ manager, actor }: TeacherScope, key: string) {
    const [row]: TeacherReceipt[] = await manager.query(
      'SELECT request_key,operation,session_id,http_status,receipt,completed_at FROM teacher_requests WHERE actor_id=$1 AND request_key=$2',
      [actor.actorId, key],
    );
    return row;
  }

  private async requireReceiptAuthority(
    { manager, actor }: TeacherScope,
    sessionId: string | null,
  ) {
    if (!sessionId) return;
    const [session]: Pick<TeacherSessionRow, 'owner_user_id'>[] =
      await manager.query(
        'SELECT owner_user_id FROM teacher_sessions WHERE id=$1',
        [sessionId],
      );
    if (
      !session ||
      (!actor.isSuperAdmin && session.owner_user_id !== actor.actorId)
    )
      teacherError('not_found', 404);
  }
}
