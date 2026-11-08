import { describe, expect, it, vi } from 'vitest';
import { DataSource, type EntityManager } from 'typeorm';
import {
  assertBusinessesAccess,
  assertBusinessResourcesAccess,
  businessAccessPredicate,
  resolveBusinessAccess,
  scopeBusinessQuery,
} from './business-access.js';

const actor = { userId: '9007199254740993', sessionId: '11111111-1111-4111-8111-111111111111' };
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function fixture() {
  const state = {
    current: true,
    superAdmin: false,
    inheritedLocks: false,
    locked: [first, second],
    visible: [first, second],
    resources: ['1', '2', '3'],
  };
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('AS authority_locks'))
      return [{ authority_locks: state.inheritedLocks ? 9 : 0 }];
    if (sql.startsWith('SELECT u.id')) return state.current ? [{
      actorId: actor.userId, sessionId: actor.sessionId, isSuperAdmin: state.superAdmin,
    }] : [];
    if (sql.startsWith('SELECT id::text FROM businesses'))
      return state.locked.map((id) => ({ id }));
    if (sql.startsWith('SELECT business.id::text'))
      return state.visible.map((id) => ({ id }));
    if (sql.startsWith('SELECT resource.id::text'))
      return state.resources.map((id) => ({ id }));
    return [];
  });
  const manager = { query, queryRunner: { isTransactionActive: true } } as unknown as EntityManager;
  return { state, query, manager };
}

describe('business access SQL policy', () => {
  it('scopes all existing OR filters before pagination using the real TypeORM builder', () => {
    const source = new DataSource({ type: 'postgres', entities: [] });
    const query = source.createQueryBuilder().select('product.id').from('products', 'product')
      .where('product.code=:code OR product.name=:name', { code: 'A', name: 'B' });
    expect(scopeBusinessQuery(query, 'product.business_id', { userId: actor.userId, isSuperAdmin: false }))
      .toBe(query);
    query.limit(10);
    const [sql, parameters] = query.getQueryAndParameters();
    expect(sql).toContain('WHERE (product.code=$1 OR product.name=$2) AND EXISTS');
    expect(sql).toContain('nodia_scope_business.owner_id = $3');
    expect(sql).toContain('nodia_scope_collaborator.user_id = $3');
    expect(sql).toContain('nodia_scope_collaborator.is_active = true');
    expect(parameters).toEqual(['A', 'B', actor.userId]);
    expect(sql.indexOf('AND EXISTS')).toBeLessThan(sql.indexOf('LIMIT 10'));
  });

  it('allows super administrators to query all businesses without replacing existing filters', () => {
    const source = new DataSource({ type: 'postgres', entities: [] });
    const query = source.createQueryBuilder().select('invoice.id').from('invoices', 'invoice')
      .where('invoice.code=:code', { code: 'A' });
    scopeBusinessQuery(query, 'invoice.business_id', { userId: actor.userId, isSuperAdmin: true });
    const [sql, parameters] = query.getQueryAndParameters();
    expect(sql).not.toContain('business_collaborators');
    expect(parameters).toEqual(['A']);
  });

  it.each(['product.business_id OR true', 'other_table.secret', 'product;DROP.id'])(
    'rejects arbitrary scope expression %s', (expression) => {
      expect(() => businessAccessPredicate(expression)).toThrow('business:invalid_access_scope');
    },
  );

  it('rejects SQL disguised as a parameter while allowing positional parameters', () => {
    expect(() => businessAccessPredicate('provider.business_id', '$2 OR true')).toThrow('invalid_access_scope');
    expect(businessAccessPredicate('provider.business_id', '$2')).toContain('user_id = $2');
  });
});

describe('current business membership assertions', () => {
  it('rejects a missing actor before accessing persistence', async () => {
    const f = fixture();
    await expect(resolveBusinessAccess(f.manager, undefined)).rejects.toThrow('session_expired');
    await expect(assertBusinessesAccess(f.manager, undefined, [])).rejects.toThrow('session_expired');
    expect(f.query).not.toHaveBeenCalled();
  });

  it('rejects revoked sessions and refreshes super administrator authority on each call', async () => {
    const f = fixture();
    expect(await resolveBusinessAccess(f.manager, actor)).toEqual({ userId: actor.userId, isSuperAdmin: false });
    f.state.superAdmin = true;
    expect((await resolveBusinessAccess(f.manager, actor)).isSuperAdmin).toBe(true);
    f.state.current = false;
    await expect(resolveBusinessAccess(f.manager, actor)).rejects.toThrow('session_expired');
  });

  it('requires every requested business and does not disclose a missing or foreign ID', async () => {
    const f = fixture();
    f.state.visible = [first];
    await expect(assertBusinessesAccess(f.manager, actor, [first, second])).rejects.toMatchObject({
      message: 'business:resource_not_found',
    });
    f.state.visible = [];
    await expect(assertBusinessesAccess(f.manager, actor, [second])).rejects.toMatchObject({
      message: 'business:resource_not_found',
    });
  });

  it('normalizes and deduplicates UUIDs while keeping bigint actor IDs exact', async () => {
    const f = fixture();
    f.state.visible = [first];
    expect(await assertBusinessesAccess(f.manager, actor, [first.toUpperCase(), first])).toEqual({
      userId: actor.userId, isSuperAdmin: false,
    });
    expect(f.query.mock.calls.at(-1)).toEqual([
      expect.any(String), [ [first], actor.userId, false ],
    ]);
  });

  it('rejects invalid IDs before issuing a cast or querying business data', async () => {
    const f = fixture();
    await expect(assertBusinessesAccess(f.manager, actor, ['not-a-uuid'])).rejects.toThrow('resource_not_found');
    expect(f.query).not.toHaveBeenCalled();
  });

  it('locks authority before business parents and rechecks membership after acquiring the locks', async () => {
    const f = fixture();
    f.state.visible = [first];
    await expect(assertBusinessesAccess(f.manager, actor, [first, second], { lock: true }))
      .rejects.toThrow('resource_not_found');
    const sql = f.query.mock.calls.map(([statement]) => statement);
    const authorityLock = sql.findIndex((statement) => statement.startsWith('LOCK TABLE actions'));
    const parentLock = sql.findIndex((statement) => statement.includes('ORDER BY id FOR SHARE'));
    const membership = sql.findIndex((statement) => statement.startsWith('SELECT business.id'));
    expect(authorityLock).toBeGreaterThan(-1);
    expect(parentLock).toBeGreaterThan(authorityLock);
    expect(membership).toBeGreaterThan(parentLock);
  });

  it('preserves the inherited authority locks and time budget', async () => {
    const f = fixture();
    f.state.inheritedLocks = true;
    await assertBusinessesAccess(f.manager, actor, [first, second], { lock: true });
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('SET LOCAL') || sql.startsWith('LOCK TABLE'))).toBe(false);
  });

  it('initializes a write frontier with no business IDs while still validating the actor', async () => {
    const f = fixture();
    await expect(assertBusinessesAccess(f.manager, actor, [], { lock: true })).resolves.toEqual({
      userId: actor.userId, isSuperAdmin: false,
    });
    expect(f.query.mock.calls.some(([sql]) => sql.includes('FROM businesses'))).toBe(false);
    f.state.current = false;
    await expect(assertBusinessesAccess(f.manager, actor, [], { lock: true })).rejects.toThrow('session_expired');
  });

  it('refuses write locks outside a transaction and propagates persistence failures', async () => {
    const f = fixture();
    Object.assign(f.manager.queryRunner ?? {}, { isTransactionActive: false });
    await expect(assertBusinessesAccess(f.manager, actor, [first], { lock: true })).rejects.toThrow('transaction_required');
    expect(f.query).not.toHaveBeenCalled();
    f.query.mockRejectedValueOnce(new Error('synthetic database unavailable'));
    await expect(resolveBusinessAccess(f.manager, actor)).rejects.toThrow('synthetic database unavailable');
  });
});

describe('bounded business resource read authority', () => {
  it('rechecks a cached page in one resource query instead of one query per row', async () => {
    const f = fixture();
    await expect(assertBusinessResourcesAccess(f.manager, actor, 'products', ['1', '2', '3']))
      .resolves.toEqual({ userId: actor.userId, isSuperAdmin: false });
    expect(f.query).toHaveBeenCalledTimes(2);
    f.state.resources = ['1', '2'];
    await expect(assertBusinessResourcesAccess(f.manager, actor, 'products', ['1', '2', '3']))
      .rejects.toThrow('business:resource_not_found');
  });

  it.each([
    ['product_logs', first, 'JOIN products parent ON parent.id=resource.product_id'],
    ['provider_contacts', '1', 'JOIN providers parent ON parent.id=resource.provider_id'],
  ] as const)('resolves the current parent of %s before accepting a cached identity', async (resource, id, join) => {
    const f = fixture();
    f.state.resources = [id];
    await assertBusinessResourcesAccess(f.manager, actor, resource, [id]);
    expect(f.query).toHaveBeenLastCalledWith(expect.stringContaining(join), [[id], actor.userId, false]);
    expect(f.query.mock.calls.at(-1)?.[0]).toContain('nodia_scope_business.id = parent.business_id');
  });

  it('uses current super administrator authority and still rejects nonexistent cached identities', async () => {
    const f = fixture();
    f.state.superAdmin = true;
    f.state.resources = ['1'];
    expect((await assertBusinessResourcesAccess(f.manager, actor, 'invoices', ['1'])).isSuperAdmin).toBe(true);
    expect(f.query).toHaveBeenLastCalledWith(expect.any(String), [['1'], actor.userId, true]);
    f.state.resources = [];
    await expect(assertBusinessResourcesAccess(f.manager, actor, 'invoices', ['1'])).rejects.toThrow('resource_not_found');
  });

  it('rejects oversized pages and invalid resource identities without querying domain tables', async () => {
    const f = fixture();
    await expect(assertBusinessResourcesAccess(f.manager, actor, 'product_logs', ['1'])).rejects.toThrow('resource_not_found');
    await expect(assertBusinessResourcesAccess(f.manager, actor, 'providers', Array.from({ length: 1001 }, () => '1')))
      .rejects.toThrow('resource_not_found');
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('SELECT resource.'))).toBe(false);
  });
});
