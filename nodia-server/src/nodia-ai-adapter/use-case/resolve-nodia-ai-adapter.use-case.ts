import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiAdapterError } from '../types/nodia-ai-adapter.types.js';

/** Selection uses the exact connection/catalog pair, never a model name or default. */
@Injectable()
export class ResolveNodiaAiAdapterUseCase {
  constructor(private readonly source: DataSource) {}

  async execute(
    selection: NodiaAiSelection,
    manager: EntityManager = this.source.manager,
  ): Promise<'gemini' | 'openai'> {
    if (
      !selection ||
      typeof selection.connection_id !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(selection.connection_id) ||
      BigInt(selection.connection_id) > 9223372036854775807n ||
      typeof selection.model_id !== 'string' ||
      !selection.model_id.trim() ||
      Buffer.byteLength(selection.model_id, 'utf8') > 1024 ||
      !(
        selection.effort_id === null ||
        (typeof selection.effort_id === 'string' &&
          selection.effort_id.trim() &&
          Buffer.byteLength(selection.effort_id, 'utf8') <= 256)
      )
    )
      throw new NodiaAiAdapterError(
        'adapter_invalid_selection',
        'not_dispatched',
      );
    if (!['token_plan_web', 'token_plan_agentic'].includes(selection.mode))
      throw new NodiaAiAdapterError(
        'adapter_mode_unsupported',
        'not_dispatched',
      );
    const rows: unknown = await manager.query(
      `SELECT p.id::text, p.is_active, p.use_token_plan_web, p.use_token_plan_agentic,
       c.key AS provider_key, c.is_active AS catalog_active,
       c.can_use_token_plan_web, c.can_use_token_plan_agentic
       FROM ai_providers p INNER JOIN ai_provider_catalog c ON c.id=p.catalog_id
       WHERE p.id=$1${manager.queryRunner?.isTransactionActive ? ' FOR SHARE OF p,c' : ''}`,
      [selection.connection_id],
    );
    const row =
      Array.isArray(rows) &&
      rows.length === 1 &&
      rows[0] !== null &&
      typeof rows[0] === 'object' &&
      !Array.isArray(rows[0])
        ? (rows[0] as Record<string, unknown>)
        : null;
    const channel =
      selection.mode === 'token_plan_web'
        ? 'token_plan_web'
        : 'token_plan_agentic';
    if (
      !row ||
      row.id !== selection.connection_id ||
      row.is_active !== true ||
      row.catalog_active !== true ||
      row[`use_${channel}`] !== true ||
      row[`can_use_${channel}`] !== true
    )
      throw new NodiaAiAdapterError(
        'adapter_connection_unavailable',
        'not_dispatched',
      );
    if (row.provider_key === 'gemini') return 'gemini';
    if (
      row.provider_key === 'openai' &&
      selection.mode === 'token_plan_agentic'
    )
      return 'openai';
    throw new NodiaAiAdapterError(
      'adapter_provider_mode_unsupported',
      'not_dispatched',
    );
  }
}
