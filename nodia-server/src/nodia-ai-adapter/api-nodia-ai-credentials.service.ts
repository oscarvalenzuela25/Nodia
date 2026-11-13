import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { decryptSecret } from '../ai-provider/helpers/ai-key-crypto.helper.js';
import type { NodiaAiSelection } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiAdapterError } from './types/nodia-ai-adapter.types.js';
import { isApiThinkingLevel } from '../common/ai/api-reasoning.js';

export type NodiaAiApiProvider = 'openai' | 'gemini';
export interface NodiaAiApiConfiguration {
  providerKey: NodiaAiApiProvider;
  connectionId: string;
  keyId: string;
  configurationGeneration: string;
  resourceKey: string;
  sessionGeneration: string;
}
export function apiObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  const record = apiObject(value);
  return record
    ? Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, canonical(record[key])]),
      )
    : value;
}
function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
export function assertApiSelection(selection: NodiaAiSelection): void {
  if (
    !selection ||
    selection.mode !== 'api_key' ||
    !/^[1-9][0-9]{0,18}$/.test(selection.connection_id) ||
    BigInt(selection.connection_id) > 9223372036854775807n ||
    typeof selection.model_id !== 'string' ||
    !selection.model_id.trim() ||
    Buffer.byteLength(selection.model_id, 'utf8') > 1024 ||
    (selection.effort_id !== null &&
      !isApiThinkingLevel('openai', selection.effort_id))
  )
    throw new NodiaAiAdapterError(
      'adapter_invalid_selection',
      'not_dispatched',
    );
}

/** Exact selected key only. Metadata observation never decrypts or rotates a key. */
@Injectable()
export class ApiNodiaAiCredentialsService {
  constructor(private readonly source: DataSource) {}

  private async selected(selection: NodiaAiSelection, manager: EntityManager) {
    assertApiSelection(selection);
    const rows: unknown = await manager.query(
      `SELECT p.id::text,p.fields,p.updated_at,p.is_active,p.use_api_key,
       c.key AS provider_key,c.is_active AS catalog_active,c.can_use_api_key,
       k.id::text AS key_id,k.secret_fingerprint,k.updated_at AS key_updated_at,
       k.cooldown_until,k.is_active AS key_active,k.is_selected
       FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
       JOIN ai_api_keys k ON k.provider_id=p.id AND k.is_selected=true
       WHERE p.id=$1${manager.queryRunner?.isTransactionActive ? ' FOR SHARE OF p,c,k' : ''}`,
      [selection.connection_id],
    );
    const row =
      Array.isArray(rows) && rows.length === 1 ? apiObject(rows[0]) : null;
    if (
      !row ||
      row.id !== selection.connection_id ||
      row.is_active !== true ||
      row.use_api_key !== true ||
      row.catalog_active !== true ||
      row.can_use_api_key !== true ||
      row.key_active !== true ||
      row.is_selected !== true ||
      !['gemini', 'openai'].includes(String(row.provider_key)) ||
      typeof row.key_id !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(row.key_id) ||
      typeof row.secret_fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.secret_fingerprint) ||
      (row.cooldown_until !== null &&
        row.cooldown_until !== undefined &&
        (!Number.isFinite(new Date(String(row.cooldown_until)).getTime()) ||
          new Date(String(row.cooldown_until)).getTime() > Date.now()))
    )
      throw new NodiaAiAdapterError(
        'api_configuration_unavailable',
        'not_dispatched',
      );
    const fields = apiObject(row.fields) ?? {};
    if (selection.effort_id !== null && !isApiThinkingLevel(String(row.provider_key), selection.effort_id))
      throw new NodiaAiAdapterError('adapter_invalid_selection', 'not_dispatched');
    const scoped = apiObject(fields.api_key) ?? (fields.agentic ? {} : fields);
    const models = scoped.available_models;
    if (
      !Array.isArray(models) ||
      !models.some((model) => apiObject(model)?.id === selection.model_id)
    )
      throw new NodiaAiAdapterError('api_model_unavailable', 'not_dispatched');
    return row;
  }

  async configuration(
    selection: NodiaAiSelection,
    manager = this.source.manager,
  ): Promise<NodiaAiApiConfiguration> {
    const row = await this.selected(selection, manager);
    const identity = { provider: row.provider_key, connection: row.id };
    return {
      providerKey: row.provider_key as NodiaAiApiProvider,
      connectionId: selection.connection_id,
      keyId: row.key_id as string,
      resourceKey: 'api-connection:' + digest(identity),
      sessionGeneration: digest({
        ...identity,
        key: row.key_id,
        fingerprint: row.secret_fingerprint,
        updated: row.key_updated_at,
      }).slice(0, 32),
      configurationGeneration: digest({
        selection,
        fields: row.fields,
        updated: row.updated_at,
        key: row.key_id,
        fingerprint: row.secret_fingerprint,
        keyUpdated: row.key_updated_at,
      }),
    };
  }

  async secret(
    selection: NodiaAiSelection,
    expected: NodiaAiApiConfiguration,
  ): Promise<string> {
    const current = await this.configuration(selection);
    if (current.configurationGeneration !== expected.configurationGeneration)
      throw new NodiaAiAdapterError(
        'adapter_configuration_changed',
        'not_dispatched',
      );
    const rows: unknown = await this.source.manager.query(
      `SELECT secret_ciphertext FROM ai_api_keys WHERE provider_id=$1 AND id=$2
       AND is_active=true AND is_selected=true AND (cooldown_until IS NULL OR cooldown_until<=now())`,
      [selection.connection_id, current.keyId],
    );
    const cipher =
      Array.isArray(rows) && rows.length === 1
        ? apiObject(rows[0])?.secret_ciphertext
        : null;
    try {
      if (typeof cipher !== 'string') throw Error();
      const secret = decryptSecret(cipher);
      if (
        !secret.trim() ||
        Buffer.byteLength(secret, 'utf8') > 16384 ||
        /[\r\n\0]/.test(secret)
      )
        throw Error();
      // Recheck the epoch after decryption; never hand out a replacement key for this turn.
      if (
        (await this.configuration(selection)).configurationGeneration !==
        expected.configurationGeneration
      )
        throw Error();
      return secret;
    } catch {
      throw new NodiaAiAdapterError(
        'api_credential_unavailable',
        'not_dispatched',
      );
    }
  }
}
