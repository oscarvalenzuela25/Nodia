import {
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiReportRegistryUseCase } from './nodia-ai-report-registry.use-case.js';
import {
  CompileNodiaAiReportUseCase,
  NodiaAiReportQueryError,
} from './compile-nodia-ai-report.use-case.js';
import {
  RunNodiaAiReportUseCase,
  validReportDate,
  validReportInstant,
} from './run-nodia-ai-report.use-case.js';
import type { NodiaAiSourceReportResult } from '../types/report-result.types.js';
import type {
  NodiaAiCrossReportResult,
  NodiaAiReportQuery,
  NodiaAiReportSourceError,
} from '../types/report-composition.types.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
function fail(field: string): never {
  throw new NodiaAiReportQueryError('invalid_input', field);
}
type CursorState = Record<string, string | null>;
interface CompositeCursor {
  sources: CursorState;
  source_errors: NodiaAiReportSourceError[];
  clarification_keys: string[];
}
export interface NodiaAiReportExecutionOptions {
  signal?: AbortSignal;
  deadlineAt?: number;
}

/** Bounded composition; each source commits independently, so SQL failures cannot poison peers. */
@Injectable()
export class ComposeNodiaAiReportUseCase {
  private readonly outputValidator: ValidateFunction;
  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: NodiaAiReportRegistryUseCase,
    private readonly compiler: CompileNodiaAiReportUseCase,
    private readonly run: RunNodiaAiReportUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {
    const schema = JSON.parse(
      readFileSync(
        new URL('../config/report-composition.schema.json', import.meta.url),
        'utf8',
      ),
    ) as object;
    const ajv = new Ajv2020({
      strict: true,
      coerceTypes: false,
      removeAdditional: false,
      useDefaults: false,
    });
    (
      createRequire(import.meta.url)('ajv-formats') as (
        instance: Ajv2020,
      ) => void
    )(ajv);
    this.outputValidator = ajv.compile(schema);
  }

  async execute(
    identity: NodiaAiActorReference,
    value: unknown,
    options: NodiaAiReportExecutionOptions = {},
  ): Promise<NodiaAiCrossReportResult> {
    const input = this.prepare(value);
    const pageLimit = input.page_limit ?? this.policy.results.list_default_rows;
    const fingerprint = createHash('sha256')
      .update(canonical({ identity, query: { ...input, cursor: undefined } }))
      .digest('hex');
    const cursor = this.decodeCursor(input, fingerprint);
    this.checkCancellation(options);
    await this.authorizeGlobal(identity);
    const blocks: NodiaAiSourceReportResult[] = [];
    const sourceErrors: NodiaAiReportSourceError[] =
      cursor?.source_errors ?? [];
    const clarifications: string[] = cursor?.clarification_keys ?? [];
    const next: CursorState = Object.create(null) as CursorState;
    // Fixed per-source allocation bounds both sum(rows) and composite keyset work.
    const sourceLimit = Math.floor(pageLimit / input.sources.length);
    for (const source of input.sources) {
      this.checkCancellation(options);
      if (cursor && cursor.sources[source.alias] === null) {
        next[source.alias] = null;
        continue;
      }
      try {
        const block = await this.run.execute(identity, {
          catalog_version: input.catalog_version,
          combine: 'separate',
          sources: [source],
          page_limit: sourceLimit,
          ...(cursor?.sources[source.alias]
            ? { cursor: cursor.sources[source.alias] }
            : {}),
        });
        blocks.push(block);
        next[source.alias] = block.next_cursor;
      } catch (error) {
        // Session/NodiaAI revocation is fatal. Destination/resource revocation is an unknown source.
        await this.authorizeGlobal(identity);
        if (
          error instanceof NodiaAiReportQueryError &&
          error.code === 'invalid_input'
        )
          throw error;
        const status = error instanceof HttpException ? error.getStatus() : 503;
        if (status === 401) throw error;
        const code =
          error instanceof NodiaAiReportQueryError
            ? error.code
            : status === 403 || status === 404
              ? 'source_unavailable'
              : 'report_unavailable';
        if (
          code === 'needs_clarification' &&
          error instanceof NodiaAiReportQueryError
        )
          clarifications.push(`${source.alias}.${error.field}`);
        sourceErrors.push({
          source_alias: source.alias,
          error: {
            code,
            message_key: `nodia_ai:${code}`,
            field_errors: [],
            retry_action: 'manual_after_review',
            correlation_id: randomUUID(),
          },
        });
        // Failed sources are retried only by a new explicit query, not automatically during pagination.
        next[source.alias] = null;
      }
      this.checkCancellation(options);
    }
    await this.authorizeGlobal(identity);
    // A destination revoked while another independent source ran must not escape composition.
    for (const block of blocks) {
      this.checkCancellation(options);
      const request = input.sources.find(
        (source) => source.alias === block.source_alias,
      )!;
      await this.run.verifyAuthority(identity, {
        catalog_version: input.catalog_version,
        combine: 'separate',
        sources: [request],
        page_limit: 1,
      });
    }
    const more = Object.values(next).some((item) => item !== null);
    if (more && input.combine === 'compare_compatible')
      throw new NodiaAiReportQueryError(
        'unsupported_semantics',
        'combine.pagination',
      );
    const table = this.table(blocks, input.combine);
    const result: NodiaAiCrossReportResult = {
      status: sourceErrors.length
        ? blocks.length
          ? 'partial'
          : clarifications.length === sourceErrors.length
            ? 'needs_clarification'
            : 'partial'
        : blocks.every((block) => block.status === 'empty')
          ? 'empty'
          : 'ok',
      report_id: randomUUID(),
      catalog_version: input.catalog_version,
      combine: input.combine,
      snapshot_consistency: 'independent_source_snapshots',
      source_results: blocks,
      ...table,
      provenance: blocks.map((block) => ({
        source_alias: block.source_alias,
        source_key: block.source_key,
        observed_at: block.observed_at,
        scope: block.scope,
        measure_keys: input.sources
          .find((source) => source.alias === block.source_alias)!
          .measures.map((measure) => measure.measure_key),
        period: block.period,
        basis_key: block.basis_key,
        matched_records: block.matched_records,
      })),
      group_page_complete: !more,
      next_cursor: more
        ? Buffer.from(
            JSON.stringify({
              v: 1,
              query: fingerprint,
              sources: next,
              source_errors: sourceErrors,
              clarification_keys: clarifications,
            }),
          ).toString('base64url')
        : null,
      clarification_keys: clarifications,
      source_errors: sourceErrors,
    };
    this.checkCancellation(options);
    this.validateResult(result, input);
    return result;
  }

  /** No report SQL. Callers can pass a query restricted to previously successful source aliases. */
  async verifyAuthority(
    identity: NodiaAiActorReference,
    value: unknown,
    manager?: EntityManager,
  ): Promise<void> {
    const input = this.prepare(value);
    await this.authorizeGlobal(identity, manager);
    for (const source of input.sources)
      await this.run.verifyAuthority(
        identity,
        {
          catalog_version: input.catalog_version,
          combine: 'separate',
          sources: [source],
          page_limit: 1,
        },
        manager,
      );
  }

  validateResult(value: unknown, queryValue?: unknown): NodiaAiJsonObject {
    // Serialization happens only after a bounded, accessor-free JSON walk.
    let size = 0;
    const seen = new Set<object>();
    const inspect = (node: unknown, depth: number): void => {
      if (
        depth > this.policy.results.json_depth ||
        size > this.policy.results.tool_result_utf8_bytes
      )
        fail('result_limit');
      if (node === null || typeof node === 'boolean') {
        size += 5;
        return;
      }
      if (typeof node === 'number') {
        if (!Number.isFinite(node)) fail('result');
        size += 24;
        return;
      }
      if (typeof node === 'string') {
        size += Buffer.byteLength(node);
        return;
      }
      if (
        !node ||
        typeof node !== 'object' ||
        seen.has(node) ||
        (!Array.isArray(node) &&
          Object.getPrototypeOf(node) !== Object.prototype)
      )
        fail('result');
      seen.add(node);
      const entries = Object.entries(
        Object.getOwnPropertyDescriptors(node),
      ).filter(([key]) => !Array.isArray(node) || key !== 'length');
      if (
        entries.length > this.policy.results.json_collection_items ||
        Object.getOwnPropertySymbols(node).length
      )
        fail('result_limit');
      for (const [key, descriptor] of entries) {
        if (!('value' in descriptor) || !descriptor.enumerable) fail('result');
        size += Buffer.byteLength(key);
        inspect(descriptor.value, depth + 1);
      }
      seen.delete(node);
    };
    inspect(value, 0);
    const encoded = JSON.stringify(value);
    if (
      Buffer.byteLength(encoded) > this.policy.results.tool_result_utf8_bytes ||
      !this.outputValidator(value)
    )
      fail('result');
    const result = value as NodiaAiCrossReportResult;
    const query =
      queryValue === undefined ? undefined : this.prepare(queryValue);
    if (
      result.catalog_version !== this.registry.catalogVersion ||
      (query && result.combine !== query.combine)
    )
      fail('result');
    const aliases = result.source_results.map((source) => source.source_alias);
    if (
      query &&
      result.source_results.reduce(
        (total, source) => total + source.rows.length,
        0,
      ) > (query.page_limit ?? this.policy.results.list_default_rows)
    )
      fail('result');
    const errors = result.source_errors.map((error) => error.source_alias);
    const errorCodes = [
      'source_unavailable',
      'report_unavailable',
      'unsupported_semantics',
      'needs_clarification',
    ];
    if (
      result.source_errors.some(
        (entry) =>
          !errorCodes.includes(entry.error.code) ||
          entry.error.message_key !== `nodia_ai:${entry.error.code}` ||
          entry.error.field_errors.length ||
          entry.error.retry_action !== 'manual_after_review' ||
          (query &&
            !query.sources.some(
              (source) => source.alias === entry.source_alias,
            )),
      )
    )
      fail('result');
    if (
      new Set(result.clarification_keys).size !==
        result.clarification_keys.length ||
      result.clarification_keys.some(
        (key) =>
          !result.source_errors.some(
            (entry) =>
              entry.error.code === 'needs_clarification' &&
              key.startsWith(`${entry.source_alias}.`),
          ),
      )
    )
      fail('result');
    if (
      query &&
      !query.cursor &&
      canonical([...aliases, ...errors].sort()) !==
        canonical(query.sources.map((source) => source.alias).sort())
    )
      fail('result');
    if (
      (!aliases.length && !errors.length) ||
      new Set([...aliases, ...errors]).size !==
        aliases.length + errors.length ||
      result.provenance.length !== aliases.length ||
      result.rows.length > this.policy.results.report_max_groups ||
      result.group_page_complete !== (result.next_cursor === null)
    )
      fail('result');
    const verifyTable = (
      columns: NodiaAiCrossReportResult['columns'],
      rows: NodiaAiCrossReportResult['rows'],
    ) => {
      if (
        new Set(columns.map((column) => column.key)).size !== columns.length ||
        rows.some((row) => row.length !== columns.length)
      )
        fail('result');
      for (const row of rows)
        for (const [index, value] of row.entries()) {
          const column = columns[index];
          if (value === null) continue;
          if (
            column.value_type === 'date' &&
            (typeof value !== 'string' || !validReportDate(value))
          )
            fail('result');
          if (
            column.value_type === 'instant' &&
            (typeof value !== 'string' || !validReportInstant(value))
          )
            fail('result');
          if (
            column.value_type === 'decimal' &&
            (typeof value !== 'string' ||
              !/^-?\d+(?:\.\d+)?$/.test(value) ||
              (column.scale !== null &&
                (value.split('.')[1]?.length ?? 0) > column.scale))
          )
            fail('result');
          if (
            column.value_type === 'number' &&
            (typeof value !== 'number' || !Number.isSafeInteger(value))
          )
            fail('result');
          if (column.value_type === 'boolean' && typeof value !== 'boolean')
            fail('result');
          if (
            ['text', 'date', 'instant'].includes(column.value_type) &&
            typeof value !== 'string'
          )
            fail('result');
        }
    };
    for (const [index, source] of result.source_results.entries()) {
      const provenance = result.provenance[index];
      const definition = this.registry.get(source.source_key);
      const measureKeys = provenance.measure_keys;
      const scopeKeys = Object.keys(source.scope);
      const allowedScopeKeys =
        definition.scope.kind === 'personal'
          ? ['subject_user_id']
          : definition.scope.kind === 'rental'
            ? ['property_id']
            : ['business_id', 'provider_id'];
      if (scopeKeys.some((key) => !allowedScopeKeys.includes(key)))
        fail('result');
      if (
        source.basis_key !==
        (source.period?.dimension_key ?? definition.descriptor.basis_key)
      )
        fail('result');
      const expectedRequest = query?.sources.find(
        (request) => request.alias === source.source_alias,
      );
      if (
        query &&
        (!expectedRequest ||
          expectedRequest.source_key !== source.source_key ||
          canonical(expectedRequest.period ?? null) !==
            canonical(source.period) ||
          Object.entries(expectedRequest.scope).some(
            ([key, id]) =>
              source.scope[key as keyof typeof source.scope] !== id,
          ) ||
          canonical(
            expectedRequest.measures.map((measure) => measure.measure_key),
          ) !== canonical(measureKeys))
      )
        fail('result');
      if (expectedRequest) {
        const expectedColumns = this.compiler.execute({
          request: expectedRequest,
          source: definition,
          catalogVersion: result.catalog_version,
          scopeSql: 'TRUE',
          scopeParameters: [],
          scopeFingerprint: 'output_validation',
          sourceTimezone: expectedRequest.period?.timezone,
          limits: {
            maxGroups: this.policy.results.report_max_groups,
            maxFilters: this.policy.results.report_max_filters,
            maxCollectionItems: this.policy.results.json_collection_items,
            defaultGroups: this.policy.results.list_default_rows,
          },
        }).columns;
        if (
          canonical(source.columns) !==
          canonical(
            expectedColumns.map((column) => ({
              key: column.output_key,
              label_key: `nodia_ai.reports.${column.output_key}`,
              value_type: column.value_type,
              unit: column.unit,
              scale: column.scale,
              source_aliases: [source.source_alias],
            })),
          )
        )
          fail('result');
      }
      if (
        source.catalog_version !== result.catalog_version ||
        source.catalog_version !== this.registry.catalogVersion ||
        source.status !== (source.matched_records === '0' ? 'empty' : 'ok') ||
        source.group_page_complete !== (source.next_cursor === null) ||
        source.columns.some(
          (column) =>
            canonical(column.source_aliases) !==
            canonical([source.source_alias]),
        ) ||
        provenance.source_alias !== source.source_alias ||
        provenance.source_key !== source.source_key ||
        provenance.observed_at !== source.observed_at ||
        provenance.matched_records !== source.matched_records ||
        canonical(provenance.scope) !== canonical(source.scope) ||
        canonical(provenance.period) !== canonical(source.period) ||
        provenance.basis_key !== source.basis_key ||
        !measureKeys.length ||
        measureKeys.some((key) => !Object.hasOwn(definition.measures, key))
      )
        fail('result');
      const amountColumns = source.columns.filter(
        (column) => column.unit !== null,
      );
      if (
        amountColumns.length !== measureKeys.length ||
        canonical(Object.keys(source.totals).sort()) !==
          canonical(amountColumns.map((column) => column.key).sort()) ||
        amountColumns.some((column) => {
          const total = source.totals[column.key];
          return (
            !/^-?\d+(?:\.\d+)?$/.test(total) ||
            (column.scale !== null &&
              (total.split('.')[1]?.length ?? 0) > column.scale)
          );
        })
      )
        fail('result');
      for (const [measureIndex, column] of amountColumns.entries()) {
        const descriptor =
          definition.measures[measureKeys[measureIndex]].descriptor;
        if (
          !descriptor.supported ||
          column.value_type !== 'decimal' ||
          column.scale !== descriptor.scale ||
          column.unit !==
            (descriptor.unit === 'money'
              ? descriptor.currency
              : descriptor.unit)
        )
          fail('result');
      }
      if (
        source.rows.some((row) =>
          source.columns.some(
            (column, index) => column.unit !== null && row[index] === null,
          ),
        )
      )
        fail('result');
      verifyTable(source.columns, source.rows);
    }
    const expected = this.table(result.source_results, result.combine);
    if (
      canonical(result.columns) !== canonical(expected.columns) ||
      canonical(result.rows) !== canonical(expected.rows)
    )
      fail('result');
    verifyTable(result.columns, result.rows);
    if (
      (errors.length === 0 &&
        (result.status !==
          (result.source_results.every((source) => source.status === 'empty')
            ? 'empty'
            : 'ok') ||
          result.clarification_keys.length)) ||
      (errors.length > 0 &&
        !['partial', 'needs_clarification'].includes(result.status)) ||
      (result.status === 'needs_clarification' &&
        (aliases.length > 0 ||
          result.clarification_keys.length !== errors.length)) ||
      (result.group_page_complete &&
        result.source_results.some((source) => !source.group_page_complete))
    )
      fail('result');
    return JSON.parse(encoded) as NodiaAiJsonObject;
  }

  private prepare(value: unknown): NodiaAiReportQuery {
    const input = this.registry.validate(
      'query',
      value,
    ) as unknown as NodiaAiReportQuery;
    if (input.catalog_version !== this.registry.catalogVersion)
      fail('catalog_version');
    const limit = input.page_limit ?? this.policy.results.list_default_rows;
    if (
      input.sources.length > this.policy.results.json_collection_items ||
      input.sources.length > this.policy.budget.tool_calls_per_run ||
      input.sources.reduce(
        (count, source) =>
          count +
          (source.filters?.all?.length ?? 0) +
          (source.filters?.any?.length ?? 0),
        0,
      ) > this.policy.results.report_max_filters ||
      input.sources.length > this.policy.results.report_max_groups ||
      limit < input.sources.length ||
      limit > this.policy.results.report_max_groups ||
      new Set(input.sources.map((source) => source.alias)).size !==
        input.sources.length
    )
      fail('sources');
    const outputKeys = [
      ...(input.combine === 'separate'
        ? ['source_alias']
        : (input.sources[0].group_by ?? []).map(
            (_, index) => `group.${index}`,
          )),
      ...input.sources.flatMap((source) =>
        [
          ...(input.combine === 'separate' ? (source.group_by ?? []) : []),
          ...source.measures,
        ].map((column) => `${source.alias}.${column.output_key}`),
      ),
    ];
    if (new Set(outputKeys).size !== outputKeys.length) fail('output_key');
    let totalColumns =
      input.combine === 'separate'
        ? 1
        : (input.sources[0].group_by?.length ?? 0);
    for (const request of input.sources) {
      totalColumns +=
        request.measures.length +
        (input.combine === 'separate' ? (request.group_by?.length ?? 0) : 0);
      if (totalColumns > this.policy.results.json_collection_items)
        fail('sources');
      const source = this.registry.get(request.source_key);
      const allowedScopeKeys =
        source.scope.kind === 'personal'
          ? ['subject_user_id']
          : source.scope.kind === 'rental'
            ? ['property_id']
            : ['business_id', 'provider_id'];
      for (const [key, id] of Object.entries(request.scope)) {
        if (!allowedScopeKeys.includes(key))
          throw new NodiaAiReportQueryError('unsupported_semantics', 'scope');
        if (
          key !== 'business_id' &&
          (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n)
        )
          fail('scope');
      }
      // Full typed compiler preflight before executing any source. Scope ownership is checked later natively.
      this.compiler.execute({
        request,
        source,
        catalogVersion: input.catalog_version,
        scopeSql: 'TRUE',
        scopeParameters: [],
        scopeFingerprint: 'preflight',
        sourceTimezone: request.period?.timezone,
        pageLimit: Math.floor(limit / input.sources.length),
        limits: {
          maxGroups: this.policy.results.report_max_groups,
          maxFilters: this.policy.results.report_max_filters,
          maxCollectionItems: this.policy.results.json_collection_items,
          defaultGroups: this.policy.results.list_default_rows,
        },
      });
    }
    if (input.combine === 'compare_compatible') {
      const signature = (request: NodiaAiReportQuery['sources'][number]) => {
        const source = this.registry.get(request.source_key);
        return canonical({
          measures: request.measures.map((measure) => {
            const descriptor = source.measures[measure.measure_key].descriptor;
            return {
              aggregation: measure.aggregation,
              unit: descriptor.unit,
              currency: descriptor.currency,
              scale: descriptor.scale,
              semantic: descriptor.semantic,
              grain: descriptor.grain,
            };
          }),
          period: request.period
            ? {
                kind: request.period.kind,
                from: request.period.from,
                to_exclusive: request.period.to_exclusive,
                timezone: request.period.timezone,
                basis:
                  source.fields[request.period.dimension_key]?.descriptor
                    .semantics,
              }
            : null,
          basis: request.period ? null : source.descriptor.basis_key,
          groups: (request.group_by ?? []).map((group) => {
            const descriptor = source.fields[group.dimension_key].descriptor;
            return {
              type: descriptor.value_type,
              semantic: descriptor.semantics,
              temporal: descriptor.temporal_kind,
            };
          }),
        });
      };
      const first = signature(input.sources[0]);
      if (input.sources.some((source) => signature(source) !== first))
        throw new NodiaAiReportQueryError('unsupported_semantics', 'combine');
    }
    return input;
  }

  private decodeCursor(
    input: NodiaAiReportQuery,
    fingerprint: string,
  ): CompositeCursor | null {
    if (!input.cursor) return null;
    if (
      Buffer.byteLength(input.cursor) >
        this.policy.results.tool_arguments_utf8_bytes ||
      !/^[A-Za-z0-9_-]+$/.test(input.cursor)
    )
      fail('cursor');
    try {
      const parsed = JSON.parse(
        Buffer.from(input.cursor, 'base64url').toString('utf8'),
      ) as {
        v: unknown;
        query: unknown;
        sources: unknown;
        source_errors: unknown;
        clarification_keys: unknown;
      };
      if (
        !parsed ||
        Object.keys(parsed).sort().join(',') !==
          'clarification_keys,query,source_errors,sources,v' ||
        parsed.v !== 1 ||
        parsed.query !== fingerprint ||
        !parsed.sources ||
        typeof parsed.sources !== 'object' ||
        Array.isArray(parsed.sources)
      )
        fail('cursor');
      const sources = parsed.sources as CursorState;
      if (
        canonical(Object.keys(sources).sort()) !==
          canonical(input.sources.map((source) => source.alias).sort()) ||
        Object.values(sources).every((cursor) => cursor === null) ||
        Object.values(sources).some(
          (cursor) =>
            cursor !== null && (typeof cursor !== 'string' || !cursor.length),
        )
      )
        fail('cursor');
      if (
        !Array.isArray(parsed.source_errors) ||
        !Array.isArray(parsed.clarification_keys) ||
        parsed.source_errors.length > input.sources.length ||
        parsed.clarification_keys.length > input.sources.length
      )
        fail('cursor');
      const sourceErrors = parsed.source_errors as NodiaAiReportSourceError[];
      const clarificationKeys = parsed.clarification_keys as string[];
      const aliases = sourceErrors.map((entry) => entry?.source_alias);
      if (
        new Set(aliases).size !== aliases.length ||
        sourceErrors.some(
          (entry) =>
            !entry ||
            sources[entry.source_alias] !== null ||
            !entry.error ||
            ![
              'source_unavailable',
              'report_unavailable',
              'unsupported_semantics',
              'needs_clarification',
            ].includes(entry.error.code) ||
            entry.error.message_key !== `nodia_ai:${entry.error.code}` ||
            entry.error.retry_action !== 'manual_after_review' ||
            !Array.isArray(entry.error.field_errors) ||
            entry.error.field_errors.length ||
            typeof entry.error.correlation_id !== 'string' ||
            !/^[0-9a-f-]{36}$/.test(entry.error.correlation_id),
        ) ||
        clarificationKeys.some(
          (key) =>
            typeof key !== 'string' ||
            !aliases.some((alias) => key.startsWith(`${alias}.`)),
        )
      )
        fail('cursor');
      return {
        sources,
        source_errors: sourceErrors,
        clarification_keys: clarificationKeys,
      };
    } catch {
      return fail('cursor');
    }
  }

  private async authorizeGlobal(
    identity: NodiaAiActorReference,
    manager?: EntityManager,
  ): Promise<void> {
    const work = async (transaction: EntityManager) => {
      if (!transaction.queryRunner?.isTransactionActive) fail('transaction');
      await lockAuthority(
        transaction,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await this.authorize.execute(identity, {}, transaction);
    };
    if (manager) await work(manager);
    else await this.dataSource.transaction('READ COMMITTED', work);
  }
  private checkCancellation(options: NodiaAiReportExecutionOptions): void {
    if (
      options.signal?.aborted ||
      (options.deadlineAt && Date.now() >= options.deadlineAt)
    )
      throw new ServiceUnavailableException('nodia_ai:report_cancelled');
  }

  private table(
    blocks: NodiaAiSourceReportResult[],
    combine: NodiaAiReportQuery['combine'],
  ): Pick<NodiaAiCrossReportResult, 'columns' | 'rows'> {
    if (!blocks.length) return { columns: [], rows: [] };
    if (combine === 'separate') {
      const columns: NodiaAiCrossReportResult['columns'] = [
        {
          key: 'source_alias',
          label_key: 'nodia_ai.reports.source_alias',
          value_type: 'text',
          unit: null,
          scale: null,
          source_aliases: blocks.map((block) => block.source_alias),
        },
        ...blocks.flatMap((block) =>
          block.columns.map((column) => ({
            ...column,
            key: `${block.source_alias}.${column.key}`,
          })),
        ),
      ];
      const rows: NodiaAiCrossReportResult['rows'] = [];
      let offset = 1;
      for (const block of blocks) {
        for (const sourceRow of block.rows) {
          const row = Array(columns.length).fill(
            null,
          ) as NodiaAiCrossReportResult['rows'][number];
          row[0] = block.source_alias;
          sourceRow.forEach((value, index) => {
            row[offset + index] = value;
          });
          rows.push(row);
        }
        offset += block.columns.length;
      }
      return { columns, rows };
    }
    const dimensionCount = blocks[0].columns.filter(
      (column) => column.unit === null,
    ).length;
    const columns: NodiaAiCrossReportResult['columns'] = [
      ...blocks[0].columns.slice(0, dimensionCount).map((column, index) => ({
        ...column,
        key: `group.${index}`,
        source_aliases: blocks.map((block) => block.source_alias),
      })),
      ...blocks.flatMap((block) =>
        block.columns.slice(dimensionCount).map((column) => ({
          ...column,
          key: `${block.source_alias}.${column.key}`,
        })),
      ),
    ];
    const groups = new Map<string, NodiaAiCrossReportResult['rows'][number]>();
    let offset = dimensionCount;
    for (const block of blocks) {
      for (const sourceRow of block.rows) {
        const dimensions = sourceRow.slice(0, dimensionCount);
        const key = canonical(dimensions);
        let row = groups.get(key);
        if (!row) {
          row = [
            ...dimensions,
            ...Array(columns.length - dimensionCount).fill(null),
          ] as NodiaAiCrossReportResult['rows'][number];
          groups.set(key, row);
        }
        sourceRow.slice(dimensionCount).forEach((value, index) => {
          row[offset + index] = value;
        });
      }
      offset += block.columns.length - dimensionCount;
    }
    return { columns, rows: [...groups.values()] };
  }
}
