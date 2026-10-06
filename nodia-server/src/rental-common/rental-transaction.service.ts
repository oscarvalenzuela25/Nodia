import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { RentalProperty } from '../rental-property/entities/rental-property.entity.js';
import { RentalCollaborator } from '../rental-collaborator/entities/rental-collaborator.entity.js';
import { RentalOperation as RentalOperationEntity } from '../rental-operation/entities/rental-operation.entity.js';
import { RentalAuditEvent } from '../rental-audit/entities/rental-audit-event.entity.js';
import { User } from '../user/entities/user.entity.js';
import { isRentalId, normalizePercent } from './rental-validation.js';
import { isRentalInstant } from './rental-time.js';
import type {
  MutationResult,
  RentalContext,
  RentalEffect,
  RentalMutationOptions,
  RentalOperationResponse,
} from './types/rental.types.js';
import {
  RENTAL_AUDIT_ACTIONS,
  RENTAL_AUDIT_RESOURCES,
} from '../rental-audit/dto/rental-audit-query.dto.js';
import { RentalClock } from './rental-clock.js';

const requestPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireRequestKey(value: unknown): string {
  if (typeof value !== 'string' || !requestPattern.test(value))
    throw new BadRequestException('rental:invalid_input');
  return value.toLowerCase();
}
export function canonicalRentalCommand(value: unknown, key = ''): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const array = value.map((entry) => canonicalRentalCommand(entry));
    if (key === 'same_day_approvals') return array.sort();
    if (key === 'rules')
      return array.sort(
        (a, b) =>
          Number((a as { min_days_before: number }).min_days_before) -
          Number((b as { min_days_before: number }).min_days_before),
      );
    return array;
  }
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalRentalCommand(v, k)]),
    );
  if (typeof value === 'string' && key.endsWith('_percent'))
    return normalizePercent(value);
  if (
    typeof value === 'string' &&
    key.endsWith('_at') &&
    isRentalInstant(value)
  )
    return new Date(value).toISOString();
  return value;
}
function hash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalRentalCommand(value)))
    .digest('hex');
}
/** Omitted create defaults and their explicit equivalents represent the same intent. */
function normalizedCommand(
  operation: RentalMutationOptions['operation'],
  command: object,
): object {
  const defaults: Partial<
    Record<RentalMutationOptions['operation'], Record<string, unknown>>
  > = {
    'property.create': {
      location: null,
      default_nightly_rate: null,
      default_deposit_percent: null,
      minimum_turnover_minutes: 0,
      notes: null,
      is_active: true,
    },
    'collaborator.create': { position: null, is_active: true },
    'policy.create': { is_active: true },
    'reservation.create': {
      external_reference: null,
      cleaning_fee: '0',
      discount_amount: '0',
      commission_amount: '0',
      deposit_due_at: null,
      balance_due_at: null,
      cancellation_policy_id: null,
      notes: null,
      is_active: true,
    },
    'reservation.confirm': { same_day_approvals: [] },
    'payment.create': { method: null, reference: null, notes: null },
    'expense.create': {
      reservation_id: null,
      category: null,
      notes: null,
      paid_on: null,
    },
    'block.create': { notes: null, is_active: true },
  };
  return {
    ...defaults[operation],
    ...Object.fromEntries(
      Object.entries(command).filter(([, value]) => value !== undefined),
    ),
  };
}
const privateFields = new Set([
  'guest_name',
  'guest_contact',
  'notes',
  'platform_description',
  'description',
  'email',
  'name',
  'location',
  'position',
  'reference',
]);
function redact(value: unknown, key = '', depth = 0): unknown {
  if (depth > 8) throw new BadRequestException('rental:invalid_input');
  if (privateFields.has(key)) return { redacted: true };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.length > 100) return { changed: true };
    return value.map((entry) => redact(entry, key, depth + 1));
  }
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redact(v, k, depth + 1)]),
    );
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string' && value.length > 1000)
    return { redacted: true };
  return value;
}
function restoreResponse(value: unknown): RentalOperationResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InternalServerErrorException('rental:server_error');
  const result = value as RentalOperationResponse;
  const body = result.body;
  if (
    result.schema_version !== 1 ||
    ![200, 201].includes(result.http_status) ||
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(result).length !== 3 ||
    !Object.keys(result).every((key) =>
      ['schema_version', 'http_status', 'body'].includes(key),
    ) ||
    Object.keys(body).length !== 6 ||
    !Object.keys(body).every((key) =>
      [
        'operation',
        'property_id',
        'resource_type',
        'resource_id',
        'status',
        'updated_at',
      ].includes(key),
    ) ||
    !RENTAL_AUDIT_ACTIONS.includes(body.operation) ||
    !RENTAL_AUDIT_RESOURCES.includes(body.resource_type) ||
    body.operation.split('.')[0] !== body.resource_type ||
    ![
      'active',
      'inactive',
      'draft',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'voided',
      'pending',
      'paid',
    ].includes(body.status) ||
    result.http_status !== (body.operation.endsWith('.create') ? 201 : 200) ||
    !isRentalId(body.property_id) ||
    !isRentalId(body.resource_id) ||
    !isRentalInstant(body.updated_at) ||
    Buffer.byteLength(JSON.stringify(result)) > 16384
  )
    throw new InternalServerErrorException('rental:server_error');
  return result;
}

@Injectable()
export class RentalTransactionService {
  private readonly logger = new Logger('RentalTransaction');
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: RentalClock,
  ) {}
  private async transaction<T>(
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    const originalQuery = runner.query.bind(runner);
    try {
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      const deadline = Date.now() + 10_000;
      await originalQuery("SET LOCAL lock_timeout = '2s'");
      await originalQuery("SET LOCAL statement_timeout = '5s'");
      // The runner is private to this transaction. Reduce the SQL timeout near
      // its deadline; never race a live transaction against an HTTP timer.
      runner.query = async (...args: Parameters<typeof runner.query>) => {
        const remaining = deadline - Date.now();
        if (remaining <= 0)
          throw new ServiceUnavailableException('rental:temporarily_busy');
        if (remaining < 5000)
          await originalQuery(`SET LOCAL statement_timeout = '${remaining}ms'`);
        return originalQuery(...args);
      };
      const result = await fn(runner.manager);
      if (Date.now() >= deadline)
        throw new ServiceUnavailableException('rental:temporarily_busy');
      await runner.commitTransaction();
      return result;
    } catch (error) {
      runner.query = originalQuery;
      if (runner.isTransactionActive) {
        try {
          await runner.rollbackTransaction();
        } catch {
          this.logger.error({
            event: 'rental.transaction_failed',
            reason: 'rollback_unavailable',
          });
          throw new ServiceUnavailableException('rental:temporarily_busy');
        }
      }
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string }).code;
        if (['55P03', '57014', '40P01', '40001'].includes(code ?? ''))
          throw new ServiceUnavailableException('rental:temporarily_busy');
        if (['23505', '23503', '23514'].includes(code ?? ''))
          throw new ConflictException('rental:conflict');
        throw new InternalServerErrorException('rental:server_error');
      }
      if (error instanceof HttpException) throw error;
      const code =
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;
      if (
        [
          'ECONNREFUSED',
          'ECONNRESET',
          'ETIMEDOUT',
          'EPIPE',
          '57P01',
          '57P02',
          '57P03',
        ].includes(String(code))
      )
        throw new ServiceUnavailableException('rental:temporarily_busy');
      this.logger.error({
        event: 'rental.transaction_failed',
        reason: 'unexpected_failure',
      });
      throw new InternalServerErrorException('rental:server_error');
    } finally {
      runner.query = originalQuery;
      try {
        await runner.release();
      } catch {
        // Releasing a pool connection cannot invalidate a successful commit.
        this.logger.error({
          event: 'rental.transaction_failed',
          reason: 'release_unavailable',
        });
      }
    }
  }
  private async context(
    manager: EntityManager,
    actorId: string,
    propertyId: string,
    write: boolean,
    ownerOnly: boolean,
  ): Promise<RentalContext> {
    if (!isRentalId(actorId) || !isRentalId(propertyId))
      throw new BadRequestException('rental:invalid_input');
    const property = await manager.getRepository(RentalProperty).findOne({
      where: { id: propertyId },
      lock: { mode: write ? 'pessimistic_write' : 'pessimistic_read' },
    });
    if (!property) throw new NotFoundException('rental:not_found');
    // A fresh READ COMMITTED statement after gaining the lock observes revocation.
    const owner = property.owner_id === actorId;
    const actor = await manager.getRepository(User).findOne({
      where: { id: actorId, is_active: true },
      select: { id: true },
    });
    if (
      !actor ||
      (!owner &&
        !(await manager.getRepository(RentalCollaborator).existsBy({
          property_id: propertyId,
          user_id: actorId,
          is_active: true,
        })))
    )
      throw new NotFoundException('rental:not_found');
    if (ownerOnly && !owner)
      throw new ForbiddenException('rental:owner_required');
    return { manager, property, actorId, now: this.clock.now(), owner };
  }
  read<T>(
    actorId: string,
    propertyId: string,
    fn: (context: RentalContext) => Promise<T>,
    ownerOnly = false,
  ): Promise<T> {
    return this.transaction(async (manager) =>
      fn(await this.context(manager, actorId, propertyId, false, ownerOnly)),
    );
  }
  list<T>(
    actorId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!isRentalId(actorId))
      throw new BadRequestException('rental:invalid_input');
    return this.transaction(async (manager) => {
      if (
        !(await manager
          .getRepository(User)
          .existsBy({ id: actorId, is_active: true }))
      )
        throw new NotFoundException('rental:not_found');
      return fn(manager);
    });
  }
  mutate(
    options: RentalMutationOptions,
    fn: (context: RentalContext) => Promise<RentalEffect>,
  ): Promise<MutationResult> {
    const key = requireRequestKey(options.requestKey);
    if (options.resourceId !== null && !isRentalId(options.resourceId))
      throw new BadRequestException('rental:invalid_input');
    const requestHash = hash({
      schema_version: 1,
      operation: options.operation,
      property_id: options.propertyId,
      resource_id: options.resourceId,
      command: normalizedCommand(options.operation, options.command),
    });
    return this.transaction(async (manager) => {
      const context = await this.context(
        manager,
        options.actorId,
        options.propertyId,
        true,
        options.ownerOnly ?? false,
      );
      const previous = await manager
        .getRepository(RentalOperationEntity)
        .findOneBy({
          property_id: options.propertyId,
          actor_id: options.actorId,
          request_key: key,
        });
      if (previous) {
        if (
          previous.operation !== options.operation ||
          previous.request_hash !== requestHash
        )
          throw new ConflictException('rental:idempotency_conflict');
        return restoreResponse(previous.response).body;
      }
      const effect = await fn(context);
      return this.persist(context, key, options.operation, requestHash, effect);
    });
  }
  async createProperty(
    actorId: string,
    requestKey: string,
    command: object,
    fn: (manager: EntityManager, now: Date) => Promise<RentalProperty>,
  ): Promise<MutationResult> {
    if (!isRentalId(actorId))
      throw new BadRequestException('rental:invalid_input');
    const key = requireRequestKey(requestKey),
      requestHash = hash({
        schema_version: 1,
        operation: 'property.create',
        resource_id: null,
        command: normalizedCommand('property.create', command),
      });
    const lockKey = createHash('sha256')
      .update(`rental.property.create:${actorId}:${key}`)
      .digest()
      .readBigInt64BE()
      .toString();
    return this.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [
        lockKey,
      ]);
      if (
        !(await manager
          .getRepository(User)
          .existsBy({ id: actorId, is_active: true }))
      )
        throw new NotFoundException('rental:not_found');
      const previous = await manager
        .getRepository(RentalOperationEntity)
        .findOneBy({
          actor_id: actorId,
          request_key: key,
          operation: 'property.create',
        });
      if (previous) {
        await this.context(manager, actorId, previous.property_id, true, true);
        if (previous.request_hash !== requestHash)
          throw new ConflictException('rental:idempotency_conflict');
        return restoreResponse(previous.response).body;
      }
      const now = this.clock.now(),
        property = await fn(manager, now);
      if (property.owner_id !== actorId)
        throw new InternalServerErrorException('rental:server_error');
      return this.persist(
        { manager, property, actorId, now, owner: true },
        key,
        'property.create',
        requestHash,
        {
          resource_id: property.id,
          resource_type: 'property',
          status: property.is_active ? 'active' : 'inactive',
          updated_at: property.updated_at,
          changes: { created: true },
        },
      );
    });
  }
  private async persist(
    context: RentalContext,
    requestKey: string,
    operation: RentalMutationOptions['operation'],
    requestHash: string,
    effect: RentalEffect,
  ): Promise<MutationResult> {
    const result: MutationResult = {
      operation,
      property_id: context.property.id,
      resource_type: effect.resource_type,
      resource_id: effect.resource_id,
      status: effect.status,
      updated_at: effect.updated_at.toISOString(),
    };
    const response: RentalOperationResponse = {
      schema_version: 1,
      http_status: operation.endsWith('.create') ? 201 : 200,
      body: result,
    };
    restoreResponse(response);
    const changes = redact(effect.changes) as Record<string, unknown>;
    if (Buffer.byteLength(JSON.stringify(changes)) > 8192)
      throw new BadRequestException('rental:invalid_input');
    await context.manager.getRepository(RentalAuditEvent).save({
      property_id: context.property.id,
      actor_id: context.actorId,
      action: operation,
      resource_type: effect.resource_type,
      resource_id: effect.resource_id,
      changes,
    });
    await context.manager.getRepository(RentalOperationEntity).save({
      property_id: context.property.id,
      actor_id: context.actorId,
      request_key: requestKey,
      operation,
      request_hash: requestHash,
      response,
    });
    return result;
  }
  recover(
    actorId: string,
    propertyId: string,
    requestKey: string,
  ): Promise<RentalOperationResponse> {
    const key = requireRequestKey(requestKey);
    return this.read(actorId, propertyId, async ({ manager, owner }) => {
      const operation = await manager
        .getRepository(RentalOperationEntity)
        .findOneBy({
          property_id: propertyId,
          actor_id: actorId,
          request_key: key,
        });
      if (!operation) throw new NotFoundException('rental:not_found');
      if (
        !owner &&
        /^(property|collaborator|policy)\./.test(operation.operation)
      )
        throw new ForbiddenException('rental:owner_required');
      return restoreResponse(operation.response);
    });
  }
}
