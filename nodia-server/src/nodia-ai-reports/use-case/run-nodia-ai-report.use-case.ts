import {
  Injectable,
  Inject,
  NotFoundException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { randomUUID, createHash } from 'node:crypto';
import {
  lockAuthority,
  runFinanceScope,
} from '../../authorization/authority-transaction.js';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { assertBusinessesAccess } from '../../business-access/business-access.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiReportRegistryUseCase } from './nodia-ai-report-registry.use-case.js';
import {
  CompileNodiaAiReportUseCase,
  NodiaAiReportQueryError,
} from './compile-nodia-ai-report.use-case.js';
import type {
  ReportSourceRequest,
  CompiledReportQuery,
  ReportScalar,
} from '../types/report-query.types.js';
import type { NodiaAiSourceReportResult } from '../types/report-result.types.js';

export function validReportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function validReportInstant(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) &&
    validReportDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  );
}
function validExactDecimal(
  value: unknown,
  scale: number | null,
): value is string {
  return (
    typeof value === 'string' &&
    /^-?\d+(?:\.\d+)?$/.test(value) &&
    (scale === null || (value.split('.')[1]?.length ?? 0) <= scale)
  );
}

/** One source, one SQL snapshot: details, all-filtered totals and count cannot diverge. */
@Injectable()
export class RunNodiaAiReportUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: NodiaAiReportRegistryUseCase,
    private readonly compiler: CompileNodiaAiReportUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly rentals: RentalTransactionService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  async execute(
    identity: NodiaAiActorReference,
    value: unknown,
    existingManager?: EntityManager,
  ): Promise<NodiaAiSourceReportResult> {
    return (await this.perform(identity, value, existingManager, false))!;
  }

  /** Same native resource checks as execution, without reading report data. */
  async verifyAuthority(
    identity: NodiaAiActorReference,
    value: unknown,
    existingManager?: EntityManager,
  ): Promise<void> {
    await this.perform(identity, value, existingManager, true);
  }

  private async perform(
    identity: NodiaAiActorReference,
    value: unknown,
    existingManager: EntityManager | undefined,
    authorityOnly: boolean,
  ): Promise<NodiaAiSourceReportResult | void> {
    const input = this.registry.validate('query', value);
    if (input.catalog_version !== this.registry.catalogVersion)
      throw new NodiaAiReportQueryError('invalid_input', 'catalog_version');
    // AI-31 owns cross-source alignment, partial results and combined presentation.
    if (
      input.combine !== 'separate' ||
      !Array.isArray(input.sources) ||
      input.sources.length !== 1
    )
      throw new NodiaAiReportQueryError('unsupported_semantics', 'combine');
    const request = input.sources[0] as unknown as ReportSourceRequest;
    for (const [key, id] of Object.entries(request.scope)) {
      if (
        key !== 'business_id' &&
        (typeof id !== 'string' ||
          !/^[1-9][0-9]{0,18}$/.test(id) ||
          BigInt(id) > 9223372036854775807n)
      )
        throw new NodiaAiReportQueryError('invalid_input', 'scope');
    }
    const source = this.registry.getPublished(request.source_key);
    const timeout = this.policy.timing.read_query_seconds * 1000;
    const work = async (manager: EntityManager) => {
      if (!manager.queryRunner?.isTransactionActive)
        throw new NodiaAiReportQueryError('invalid_input', 'transaction');
      // Matches the native domain's authority order; no MVCC query before this lock.
      await lockAuthority(manager, false, timeout);
      const [isolation]: { transaction_isolation: string }[] =
        await manager.query('SHOW transaction_isolation');
      if (isolation?.transaction_isolation !== 'read committed')
        throw new NodiaAiReportQueryError(
          'invalid_input',
          'transaction_isolation',
        );
      const actor = await this.authorize.execute(
        identity,
        { moduleRoutes: source.requiredModuleRoutes },
        manager,
      );
      const scope = { ...request.scope };
      const allowed =
        source.scope.kind === 'personal'
          ? ['subject_user_id']
          : source.scope.kind === 'rental'
            ? ['property_id']
            : ['business_id', 'provider_id'];
      if (Object.keys(scope).some((key) => !allowed.includes(key)))
        throw new NodiaAiReportQueryError('unsupported_semantics', 'scope');
      const run = async (scopeId: string, sourceTimezone?: string) => {
        const parameters: unknown[] = [scopeId];
        let scopeSql = `${source.scope.idExpressionSql} = $1`;
        if (scope.provider_id !== undefined) {
          const provider = Object.hasOwn(source.fields, 'provider_id')
            ? source.fields.provider_id
            : undefined;
          if (!provider || provider.existsSql)
            throw new NodiaAiReportQueryError(
              'unsupported_semantics',
              'scope.provider_id',
            );
          const rows: { id: string }[] = await manager.query(
            'SELECT id::text FROM providers WHERE id=$1 AND business_id=$2 FOR SHARE',
            [scope.provider_id, scope.business_id],
          );
          if (rows.length !== 1)
            throw new NotFoundException('provider:not_found');
          parameters.push(scope.provider_id);
          scopeSql += ` AND ${provider.expressionSql} = $2`;
        }
        const compiled = this.compiler.execute({
          request,
          source,
          catalogVersion: this.registry.catalogVersion,
          scopeSql,
          scopeParameters: parameters,
          scopeFingerprint: createHash('sha256')
            .update(
              JSON.stringify({
                actor: actor.actorId,
                session: actor.sessionId,
                scope,
              }),
            )
            .digest('hex'),
          sourceTimezone,
          ...(typeof input.page_limit === 'number'
            ? { pageLimit: input.page_limit }
            : {}),
          ...(typeof input.cursor === 'string' ? { cursor: input.cursor } : {}),
          limits: {
            maxGroups: this.policy.results.report_max_groups,
            maxFilters: this.policy.results.report_max_filters,
            maxCollectionItems: this.policy.results.json_collection_items,
            defaultGroups: this.policy.results.list_default_rows,
          },
        });
        if (authorityOnly) return;
        await manager.query(
          `SET LOCAL statement_timeout = '${Math.min(5000, timeout)}ms'`,
        );
        const output: unknown = await manager.query(
          compiled.sql,
          compiled.parameters,
        );
        const result = this.project(output, compiled, scope);
        if (
          Buffer.byteLength(JSON.stringify(result), 'utf8') >
          this.policy.results.tool_result_utf8_bytes
        )
          throw new NodiaAiReportQueryError(
            'unsupported_semantics',
            'result_limit',
          );
        return result;
      };
      const nativeIdentity = {
        userId: actor.actorId,
        sessionId: actor.sessionId,
        transaction: manager,
        statementTimeoutMs: timeout,
      };
      if (source.scope.kind === 'personal') {
        return runFinanceScope(
          this.dataSource,
          { ...nativeIdentity, ownerId: scope.subject_user_id },
          async ({ ownerId }) => {
            scope.subject_user_id = ownerId;
            return run(ownerId);
          },
        );
      }
      if (source.scope.kind === 'rental') {
        if (!scope.property_id)
          throw new NodiaAiReportQueryError(
            'needs_clarification',
            'scope.property_id',
          );
        return this.rentals.read(
          nativeIdentity,
          scope.property_id,
          ({ property }) => {
            if (request.period?.kind === 'civil_date' && !property.timezone)
              throw new NodiaAiReportQueryError(
                'needs_clarification',
                'property.timezone',
              );
            return run(property.id, property.timezone ?? undefined);
          },
        );
      }
      if (!scope.business_id)
        throw new NodiaAiReportQueryError(
          'needs_clarification',
          'scope.business_id',
        );
      await assertBusinessesAccess(manager, identity, [scope.business_id], {
        lock: true,
      });
      if (
        source.sourceKey === 'business_sales' ||
        source.sourceKey === 'business_sale_items'
      ) {
        const [business]: { sales_timezone: string }[] = await manager.query(
          'SELECT sales_timezone FROM businesses WHERE id=$1',
          [scope.business_id],
        );
        if (business?.sales_timezone !== 'America/Santiago')
          throw new NodiaAiReportQueryError(
            'needs_clarification',
            'business.sales_timezone',
          );
        if (
          request.period &&
          request.period.timezone !== business.sales_timezone
        )
          throw new NodiaAiReportQueryError(
            'unsupported_semantics',
            'period.timezone',
          );
        return run(scope.business_id, business.sales_timezone);
      }
      return run(scope.business_id);
    };
    try {
      return await (existingManager
        ? work(existingManager)
        : this.dataSource.transaction('READ COMMITTED', work));
    } catch (error) {
      if (
        error instanceof HttpException ||
        error instanceof NodiaAiReportQueryError
      )
        throw error;
      throw new ServiceUnavailableException('nodia_ai:report_unavailable');
    }
  }

  private project(
    output: unknown,
    query: CompiledReportQuery,
    scope: ReportSourceRequest['scope'],
  ): NodiaAiSourceReportResult {
    const invalid = (): never => {
      throw new Error('nodia_ai:report_output_invalid');
    };
    if (!Array.isArray(output) || output.length !== 1)
      throw new Error('nodia_ai:report_output_invalid');
    const row = output[0] as Record<string, unknown>;
    if (
      !row ||
      typeof row !== 'object' ||
      Object.keys(row).sort().join(',') !== 'matched_records,rows,totals' ||
      typeof row.matched_records !== 'string' ||
      !/^(0|[1-9][0-9]*)$/.test(row.matched_records) ||
      !Array.isArray(row.rows) ||
      row.rows.length > query.pageLimit + 1 ||
      !row.totals ||
      typeof row.totals !== 'object' ||
      Array.isArray(row.totals)
    )
      invalid();
    const aggregates = query.columns.filter(
      (column) =>
        column.measure_key !== undefined &&
        !query.omittedTotalKeys?.includes(column.sql_key),
    );
    const totals = row.totals as Record<string, unknown>;
    if (
      Object.keys(totals).length !== aggregates.length ||
      aggregates.some(
        (column) => !validExactDecimal(totals[column.sql_key], column.scale),
      )
    )
      invalid();
    const allRows = row.rows as Record<string, unknown>[];
    const columns = query.columns.map((column) => ({
      key: column.output_key,
      label_key: `nodia_ai.reports.${column.output_key}`,
      value_type: column.value_type,
      unit: column.unit,
      scale: column.scale,
      source_aliases: [query.request.alias],
    }));
    const projected = allRows.map((entry) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        Object.keys(entry).length !== query.columns.length
      )
        invalid();
      return query.columns.map((column): ReportScalar => {
        const value = entry[column.sql_key];
        if (value === null && column.measure_key === undefined) return null;
        const valid =
          column.value_type === 'boolean'
            ? typeof value === 'boolean'
            : column.value_type === 'number'
              ? typeof value === 'number' && Number.isSafeInteger(value)
              : typeof value === 'string' &&
                (column.value_type === 'decimal'
                  ? validExactDecimal(value, column.scale)
                  : column.value_type === 'date'
                    ? validReportDate(value)
                    : column.value_type === 'instant'
                      ? validReportInstant(value)
                      : true);
        if (!valid) invalid();
        return value as ReportScalar;
      });
    });
    const hasMore = allRows.length > query.pageLimit;
    const page = projected.slice(0, query.pageLimit);
    return {
      status: row.matched_records === '0' ? 'empty' : 'ok',
      report_id: randomUUID(),
      catalog_version: this.registry.catalogVersion,
      source_key: query.request.source_key,
      source_alias: query.request.alias,
      scope,
      columns,
      rows: page,
      totals: Object.fromEntries(
        aggregates.map((column) => [
          column.output_key,
          totals[column.sql_key] as string,
        ]),
      ),
      matched_records: row.matched_records as string,
      period: query.request.period ?? null,
      basis_key:
        query.request.period?.dimension_key ??
        this.registry.get(query.request.source_key).descriptor.basis_key,
      observed_at: new Date().toISOString(),
      group_page_complete: !hasMore,
      next_cursor: hasMore
        ? this.compiler.nextCursor(query, allRows[query.pageLimit - 1])
        : null,
    };
  }
}
