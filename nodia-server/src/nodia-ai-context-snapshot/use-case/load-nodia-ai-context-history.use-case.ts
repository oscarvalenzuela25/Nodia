import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  isNodiaAiScopeVisible,
  type ContextHistoryItem,
} from '../../nodia-ai-context/use-case/build-nodia-ai-context.use-case.js';

export interface NodiaAiContextHistoryWindow {
  conversationId: string;
  actorId: string;
  throughSeq: string;
  moduleRoutes: readonly string[];
  afterSeq?: string;
  maxBytes: number;
}
export interface NodiaAiLoadedContextHistory {
  history: ContextHistoryItem[];
  complete: boolean;
  throughSeq: string;
}
const sequence = /^(0|[1-9][0-9]*)$/;
const invalid = (): never => {
  throw new InternalServerErrorException('nodia_ai:context_invalid');
};

/** SQL bounds the returned UTF-8 window before any canonical content reaches Node. */
@Injectable()
export class LoadNodiaAiContextHistoryUseCase {
  async load(
    manager: EntityManager,
    input: NodiaAiContextHistoryWindow,
  ): Promise<NodiaAiLoadedContextHistory> {
    this.requireTransaction(manager);
    const after = input.afterSeq ?? '0';
    if (!sequence.test(input.throughSeq) || !sequence.test(after) ||
      BigInt(after) > BigInt(input.throughSeq) ||
      !Number.isSafeInteger(input.maxBytes) || input.maxBytes < 2 ||
      input.moduleRoutes.length > 64 || input.moduleRoutes.some((route) =>
        typeof route !== 'string' || !route.startsWith('/') || route.length > 255)) invalid();
    const [row]: {
      history: unknown;
      complete: unknown;
      through_seq: unknown;
    }[] = await manager.query(
      `WITH visible AS (
        SELECT m.*,
          ((m.role='assistant' OR (m.role='user' AND m.author_id=$3::bigint))
            AND m.source_scope_manifest->'schema_version'='1'::jsonb
            AND (m.source_scope_manifest-'schema_version'-'module_routes')='{}'::jsonb
            AND jsonb_typeof(m.source_scope_manifest->'module_routes')='array'
            AND jsonb_array_length(CASE WHEN jsonb_typeof(m.source_scope_manifest->'module_routes')='array'
              THEN m.source_scope_manifest->'module_routes' ELSE '[]'::jsonb END)<=64
            AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.source_scope_manifest->'module_routes')='array'
                THEN m.source_scope_manifest->'module_routes' ELSE '[]'::jsonb END) AS route
              WHERE jsonb_typeof(route)<>'string' OR NOT ((route#>>'{}')=ANY($4::text[]))
            )) AS allowed
        FROM nodia_ai_messages m
        WHERE m.conversation_id=$1 AND m.seq>$5::bigint AND m.seq<=$2::bigint AND m.status='sealed'
      ), projected AS (
        SELECT m.seq,jsonb_build_object('seq',m.seq::text,'role',m.role,
          'scope',CASE WHEN m.allowed THEN m.source_scope_manifest ELSE 'null'::jsonb END,
          'parts',CASE WHEN m.allowed THEN COALESCE((
            SELECT jsonb_agg(jsonb_build_object('kind',p.kind,'text',p.text)
              || CASE WHEN p.attachment_id IS NOT NULL THEN jsonb_build_object('attachment_id',p.attachment_id) ELSE '{}'::jsonb END
              ORDER BY p.part_index)
            FROM nodia_ai_message_parts p WHERE p.message_id=m.id
          ),'[]'::jsonb) ELSE '[]'::jsonb END) AS payload FROM visible m
      ), costed AS (
        SELECT seq,payload,sum(octet_length(payload::text)+1) OVER (ORDER BY seq ROWS UNBOUNDED PRECEDING) AS bytes
        FROM projected
      )
      SELECT COALESCE(jsonb_agg(payload ORDER BY seq) FILTER (WHERE bytes<=$6::bigint-2),'[]'::jsonb) AS history,
        count(*)=count(*) FILTER (WHERE bytes<=$6::bigint-2) AS complete,
        COALESCE((max(seq) FILTER (WHERE bytes<=$6::bigint-2))::text,$5::text) AS through_seq
      FROM costed`,
      [input.conversationId, input.throughSeq, input.actorId,
        [...input.moduleRoutes], after, input.maxBytes],
    );
    if (!row || !Array.isArray(row.history) || typeof row.complete !== 'boolean' ||
      typeof row.through_seq !== 'string' || !sequence.test(row.through_seq) ||
      BigInt(row.through_seq) < BigInt(after) || BigInt(row.through_seq) > BigInt(input.throughSeq)) return invalid();
    const authorized = new Set(input.moduleRoutes);
    let previous = BigInt(after);
    const history = row.history.map((item: unknown): ContextHistoryItem => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return invalid();
      const value = item as Record<string, unknown>;
      if (typeof value.seq !== 'string' || !sequence.test(value.seq) ||
        BigInt(value.seq) <= previous || BigInt(value.seq) > BigInt(input.throughSeq) ||
        (value.role !== 'user' && value.role !== 'assistant') || !Array.isArray(value.parts)) return invalid();
      previous = BigInt(value.seq);
      const visible = isNodiaAiScopeVisible(value.scope, authorized);
      // Defense in depth: a scope regression can never return restricted content from this port.
      if (!visible) return { seq: value.seq, role: value.role, scope: null, parts: [] };
      const parts = value.parts.map((part: unknown): ContextHistoryItem['parts'][number] => {
        if (!part || typeof part !== 'object' || Array.isArray(part)) return invalid();
        const record = part as Record<string, unknown>;
        if (typeof record.kind !== 'string' || (record.text !== null && typeof record.text !== 'string') ||
          (record.attachment_id !== undefined && typeof record.attachment_id !== 'string')) return invalid();
        return { kind: record.kind, text: record.text,
          ...(typeof record.attachment_id === 'string' ? { attachment_id: record.attachment_id } : {}) };
      });
      return { seq: value.seq, role: value.role, scope: value.scope, parts };
    });
    if ((history.length ? history[history.length - 1].seq : after) !== row.through_seq ||
      Buffer.byteLength(JSON.stringify(history), 'utf8') > input.maxBytes) invalid();
    return { history, complete: row.complete, throughSeq: row.through_seq };
  }

  /** Hash all original sealed sources, independent of the caller's current visibility. */
  async fingerprint(manager: EntityManager, conversationId: string, throughSeq: string): Promise<string> {
    this.requireTransaction(manager);
    if (!sequence.test(throughSeq)) invalid();
    const [row]: { hash: unknown }[] = await manager.query(
      `WITH hashes AS (
        SELECT m.seq,encode(sha256(convert_to(jsonb_build_object(
          'id',m.id,'seq',m.seq::text,'role',m.role,'author_id',m.author_id::text,
          'status',m.status,'source_scope_manifest',m.source_scope_manifest,
          'parts',COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'part_index',p.part_index,'kind',p.kind,'text',p.text,'attachment_id',p.attachment_id)
            ORDER BY p.part_index) FROM nodia_ai_message_parts p WHERE p.message_id=m.id),'[]'::jsonb)
        )::text,'UTF8')),'hex') AS hash
        FROM nodia_ai_messages m
        WHERE m.conversation_id=$1 AND m.seq<=$2::bigint AND m.status='sealed'
      )
      SELECT encode(sha256(convert_to(jsonb_build_object('schema_version',1,
        'conversation_id',$1::text,'through_seq',$2::text,
        'message_hashes',COALESCE(string_agg(hash,'' ORDER BY seq),''))::text,'UTF8')),'hex') AS hash
      FROM hashes`,
      [conversationId, throughSeq],
    );
    if (!row || typeof row.hash !== 'string' || !/^[0-9a-f]{64}$/.test(row.hash)) return invalid();
    return row.hash;
  }

  private requireTransaction(manager: EntityManager) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new InternalServerErrorException('authorization:transaction_required');
  }
}
