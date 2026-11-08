import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../authorization/authority-transaction.js';
import { hasAuthorityTransactionLocks } from '../authorization/authority-transaction-proof.js';

export interface BusinessAccessScope {
  readonly userId: string;
  readonly isSuperAdmin: boolean;
}

export interface BusinessAccessOptions {
  /** Writers must use their transaction manager and lock before domain records. */
  lock?: boolean;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resourcePolicies = {
  businesses: { from: 'businesses resource', business: 'resource.id', idType: 'uuid' },
  products: { from: 'products resource', business: 'resource.business_id', idType: 'bigint' },
  product_logs: { from: 'product_logs resource JOIN products parent ON parent.id=resource.product_id', business: 'parent.business_id', idType: 'uuid' },
  providers: { from: 'providers resource', business: 'resource.business_id', idType: 'bigint' },
  provider_contacts: { from: 'personal_info_provider resource JOIN providers parent ON parent.id=resource.provider_id', business: 'parent.business_id', idType: 'bigint' },
  invoices: { from: 'invoices resource', business: 'resource.business_id', idType: 'bigint' },
} as const;
export type BusinessDataResource = keyof typeof resourcePolicies;

/** Expressions and placeholders are backend-owned, never HTTP/model parameters. */
export function businessAccessPredicate(
  businessIdExpression: string,
  actorParameter = ':businessAccessUserId',
): string {
  if (
    !/^[a-zA-Z_][a-zA-Z0-9_]*\.(?:business_id|id)$/.test(businessIdExpression) ||
    !/^(?::[a-zA-Z_][a-zA-Z0-9_]*|\$[1-9][0-9]*)$/.test(actorParameter)
  )
    throw new ForbiddenException('business:invalid_access_scope');
  return `EXISTS (SELECT 1 FROM businesses nodia_scope_business
    WHERE nodia_scope_business.id = ${businessIdExpression}
      AND (nodia_scope_business.owner_id = ${actorParameter} OR EXISTS (
        SELECT 1 FROM business_collaborators nodia_scope_collaborator
        WHERE nodia_scope_collaborator.business_id = nodia_scope_business.id
          AND nodia_scope_collaborator.user_id = ${actorParameter}
          AND nodia_scope_collaborator.is_active = true)))`;
}

/** A current session-backed decision; never serialize or reuse as a durable grant. */
export async function resolveBusinessAccess(
  manager: EntityManager,
  actor: ActorReference | undefined,
): Promise<BusinessAccessScope> {
  if (!actor) throw new UnauthorizedException('auth:session_expired');
  const current = await currentActor(manager, actor);
  return Object.freeze({ userId: current.actorId, isSuperAdmin: current.isSuperAdmin });
}

/** Apply before pagination, aggregation or streaming; ownership is part of the SQL. */
export function scopeBusinessQuery<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  businessIdExpression: string,
  scope: BusinessAccessScope,
): SelectQueryBuilder<T> {
  const predicate = businessAccessPredicate(businessIdExpression);
  if (!scope.isSuperAdmin) {
    // Keep existing OR filters inside parentheses so they cannot escape ownership.
    if (query.expressionMap.wheres.length)
      query.expressionMap.wheres = [{ type: 'simple', condition: {
        operator: 'brackets', condition: query.expressionMap.wheres,
      } }];
    query.andWhere(predicate, { businessAccessUserId: scope.userId });
  }
  return query;
}

/** All requested businesses must exist and be visible; errors disclose no foreign IDs. */
export async function assertBusinessesAccess(
  manager: EntityManager,
  actor: ActorReference | undefined,
  businessIds: readonly string[],
  options: BusinessAccessOptions = {},
): Promise<BusinessAccessScope> {
  if (!actor) throw new UnauthorizedException('auth:session_expired');
  if (!Array.isArray(businessIds) || businessIds.length > 10_000 ||
      businessIds.some((id) => typeof id !== 'string' || !uuidPattern.test(id)))
    throw new NotFoundException('business:resource_not_found');
  const ids = [...new Set(businessIds.map((id) => id.toLowerCase()))].sort();
  if (options.lock) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (!(await hasAuthorityTransactionLocks(manager)))
      await lockAuthority(manager, false, actor?.statementTimeoutMs);
  }
  const scope = await resolveBusinessAccess(manager, actor);
  if (!ids.length) return scope;
  if (options.lock) {
    // Membership writers lock the same parent before replacing collaborators.
    const locked: { id: string }[] = await manager.query(
      'SELECT id::text FROM businesses WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',
      [ids],
    );
    if (locked.length !== ids.length)
      throw new NotFoundException('business:resource_not_found');
  }
  // A separate READ COMMITTED statement after the parent locks observes revocation.
  const visible: { id: string }[] = await manager.query(
    `SELECT business.id::text FROM businesses business
      WHERE business.id=ANY($1::uuid[])
        AND ($3::boolean OR ${businessAccessPredicate('business.id', '$2')})`,
    [ids, scope.userId, scope.isSuperAdmin],
  );
  if (visible.length !== ids.length)
    throw new NotFoundException('business:resource_not_found');
  return scope;
}

/** Fresh visibility for bounded cached/read results; writers still need business/domain locks. */
export async function assertBusinessResourcesAccess(
  manager: EntityManager,
  actor: ActorReference | undefined,
  resource: BusinessDataResource,
  resourceIds: readonly string[],
): Promise<BusinessAccessScope> {
  const scope = await resolveBusinessAccess(manager, actor);
  if (!Object.hasOwn(resourcePolicies, resource))
    throw new ForbiddenException('business:invalid_access_scope');
  const policy = resourcePolicies[resource];
  if (!Array.isArray(resourceIds) || resourceIds.length > 1000 || resourceIds.some((id) =>
    typeof id !== 'string' || (policy.idType === 'uuid' ? !uuidPattern.test(id)
      : !/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n)))
    throw new NotFoundException('business:resource_not_found');
  const ids = [...new Set(resourceIds.map((id) => id.toLowerCase()))];
  if (!ids.length) return scope;
  const visible: { id: string }[] = await manager.query(
    `SELECT resource.id::text AS id FROM ${policy.from}
      WHERE resource.id=ANY($1::${policy.idType}[])
        AND ($3::boolean OR ${businessAccessPredicate(policy.business, '$2')})`,
    [ids, scope.userId, scope.isSuperAdmin],
  );
  if (visible.length !== ids.length)
    throw new NotFoundException('business:resource_not_found');
  return scope;
}
