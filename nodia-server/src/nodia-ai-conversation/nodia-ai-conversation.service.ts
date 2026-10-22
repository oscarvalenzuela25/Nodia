import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NodiaAiConversation } from './entities/nodia-ai-conversation.entity.js';
import { NodiaAiMessage } from './entities/nodia-ai-message.entity.js';
import { NodiaAiMessagePart } from './entities/nodia-ai-message-part.entity.js';
import { NodiaAiRun } from '../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { randomUUID } from 'node:crypto';
@Injectable()
export class NodiaAiConversationService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(work);
  }
  findByRequest(manager: EntityManager, ownerId: string, requestId: string) {
    return manager
      .getRepository(NodiaAiConversation)
      .findOne({ where: { owner_id: ownerId, client_request_id: requestId } });
  }
  async insertIfAbsent(manager: EntityManager, entity: NodiaAiConversation) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(NodiaAiConversation)
      .values(entity)
      .orIgnore()
      .execute();
  }
  async now(manager: EntityManager): Promise<Date> {
    const [row]: { now: Date }[] = await manager.query(
      'SELECT clock_timestamp() AS now',
    );
    return new Date(row.now);
  }
  find(
    manager: EntityManager,
    id: string,
    lock: 'pessimistic_read' | 'pessimistic_write' = 'pessimistic_read',
  ) {
    return manager
      .getRepository(NodiaAiConversation)
      .findOne({ where: { id }, lock: { mode: lock } });
  }
  save(manager: EntityManager, entity: NodiaAiConversation) {
    return manager.getRepository(NodiaAiConversation).save(entity);
  }
  async auditInspection(
    manager: EntityManager,
    actorId: string,
    sessionId: string,
    conversationId: string,
    operation: string,
  ) {
    await manager.query(
      'INSERT INTO nodia_ai_audit_events (id,actor_id,session_public_id,conversation_id,event_key,correlation_id,minimal_details) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [
        randomUUID(),
        actorId,
        sessionId,
        conversationId,
        'conversation.inspected',
        randomUUID(),
        { operation },
      ],
    );
  }
  async auditInspections(
    manager: EntityManager,
    actorId: string,
    sessionId: string,
    conversationIds: string[],
    operation: string,
  ) {
    if (conversationIds.length === 0) return;
    // The list use case supplies its bounded page only. Preserve one independent
    // event/correlation per inspected chat in the same authorization transaction.
    await manager.query(
      `INSERT INTO nodia_ai_audit_events
        (id,actor_id,session_public_id,conversation_id,event_key,correlation_id,minimal_details)
       SELECT audit_row.id,$2,$3,audit_row.conversation_id,'conversation.inspected',audit_row.correlation_id,$6
       FROM unnest($1::uuid[],$4::uuid[],$5::uuid[])
         AS audit_row(id,conversation_id,correlation_id)`,
      [
        conversationIds.map(() => randomUUID()),
        actorId,
        sessionId,
        conversationIds,
        conversationIds.map(() => randomUUID()),
        { operation },
      ],
    );
  }
  async list(
    manager: EntityManager,
    options: {
      ownerId?: string;
      now: Date;
      archived?: boolean;
      pinned?: boolean;
      search?: string;
      permittedRoutes: string[];
      after: string[] | null;
      limit: number;
    },
  ) {
    const query = manager
      .getRepository(NodiaAiConversation)
      .createQueryBuilder('c')
      .where('c.lifecycle = :lifecycle AND c.expires_at > :now', {
        lifecycle: 'active',
        now: options.now,
      });
    if (options.ownerId !== undefined)
      query.andWhere('c.owner_id = :owner', { owner: options.ownerId });
    if (options.archived !== undefined)
      query.andWhere('c.is_archived = :archived', {
        archived: options.archived,
      });
    if (options.pinned !== undefined)
      query.andWhere('c.is_pinned = :pinned', { pinned: options.pinned });
    if (options.search !== undefined)
      query.andWhere(
        `(c.title ILIKE :search ESCAPE '\\' OR c.id IN (
      SELECT m.conversation_id FROM nodia_ai_message_parts p
      JOIN nodia_ai_messages m ON m.id=p.message_id AND m.conversation_id=p.conversation_id
      JOIN nodia_ai_conversations search_chat ON search_chat.id=m.conversation_id
      WHERE p.kind='text' AND p.text ILIKE :search ESCAPE '\\'
      AND (m.role='assistant' OR (m.role='user' AND m.author_id=search_chat.owner_id))
      AND search_chat.lifecycle='active' AND search_chat.expires_at > :now
      ${options.ownerId !== undefined ? 'AND search_chat.owner_id=:owner' : ''}
      AND m.source_scope_manifest->'schema_version' = '1'::jsonb
      AND (m.source_scope_manifest - 'schema_version' - 'module_routes') = '{}'::jsonb
      AND jsonb_typeof(m.source_scope_manifest->'module_routes')='array'
      AND jsonb_array_length(CASE WHEN jsonb_typeof(m.source_scope_manifest->'module_routes')='array'
        THEN m.source_scope_manifest->'module_routes' ELSE '[]'::jsonb END)<=64
      AND (m.source_scope_manifest->'module_routes') <@ CAST(:routes AS jsonb)))`,
        {
          search: `%${options.search.replace(/[\\%_]/g, '\\$&')}%`,
          routes: JSON.stringify(options.permittedRoutes),
        },
      );
    if (options.after)
      query.andWhere('(c.updated_at, c.id) < (:afterDate, :afterId)', {
        afterDate: options.after[0],
        afterId: options.after[1],
      });
    const { entities, raw } = await query
      .addSelect(
        `to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        'cursor_updated_at',
      )
      .orderBy('c.updated_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(options.limit + 1)
      .setLock('pessimistic_read', undefined, ['c'])
      .getRawAndEntities();
    return entities.map((entity, index) =>
      Object.assign(entity, {
        cursor_updated_at: String(raw[index].cursor_updated_at),
      }),
    );
  }
  messages(
    manager: EntityManager,
    conversationId: string,
    after: string | undefined,
    limit: number,
    direction: 'forward' | 'backward' = 'forward',
  ) {
    const query = manager
      .getRepository(NodiaAiMessage)
      .createQueryBuilder('m')
      .where('m.conversation_id = :id', { id: conversationId });
    if (after)
      query.andWhere(
        direction === 'backward' ? 'm.seq < :after' : 'm.seq > :after',
        { after },
      );
    return query
      .orderBy('m.seq', direction === 'backward' ? 'DESC' : 'ASC')
      .take(limit + 1)
      .getMany();
  }
  messageRuns(
    manager: EntityManager,
    messageIds: string[],
  ): Promise<
    {
      id: string;
      user_message_id: string;
      assistant_message_id: string | null;
    }[]
  > {
    if (!messageIds.length) return Promise.resolve([]);
    return manager.query(
      `SELECT id,user_message_id,assistant_message_id FROM nodia_ai_runs
       WHERE user_message_id=ANY($1::uuid[]) OR assistant_message_id=ANY($1::uuid[])
       ORDER BY id LIMIT $2`,
      [messageIds, messageIds.length + 1],
    );
  }
  parts(manager: EntityManager, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([] as NodiaAiMessagePart[]);
    return manager
      .getRepository(NodiaAiMessagePart)
      .createQueryBuilder('p')
      .where('p.message_id IN (:...ids)', { ids })
      .orderBy('p.part_index', 'ASC')
      .getMany();
  }
  findMessageRequest(
    manager: EntityManager,
    conversationId: string,
    actorId: string,
    clientMessageId: string,
  ) {
    return manager.getRepository(NodiaAiMessage).findOne({
      where: {
        conversation_id: conversationId,
        author_id: actorId,
        client_message_id: clientMessageId,
      },
    });
  }
  findMessageRun(manager: EntityManager, messageId: string) {
    return manager
      .getRepository(NodiaAiRun)
      .findOne({ where: { user_message_id: messageId } });
  }
  latestRun(manager: EntityManager, conversationId: string) {
    return manager.getRepository(NodiaAiRun).findOne({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC', id: 'DESC' },
    });
  }
}
