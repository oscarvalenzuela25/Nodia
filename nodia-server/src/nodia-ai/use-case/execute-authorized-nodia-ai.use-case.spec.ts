import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { ExecuteAuthorizedNodiaAiUseCase } from './execute-authorized-nodia-ai.use-case.js';
import { AuthorizeNodiaAiUseCase } from './authorize-nodia-ai.use-case.js';
import { NodiaAiAuthorizationService } from '../nodia-ai-authorization.service.js';
import { actorFixture } from '../../authorization/use-case/authority.fixture.js';

describe('Authorized NodiaAI effect boundary', () => {
  const actor = actorFixture('1');
  const modules = [
    { id: '10', key: 'nodia_ai', route: '/nodia-ai', assigned: true },
    {
      id: '11',
      key: 'finance',
      route: '/finances-personal',
      assigned: true,
    },
  ];
  const query = vi.fn(async (sql: string) =>
    sql.includes('FROM users u JOIN auth_sessions')
      ? [
          {
            actorId: actor.userId,
            sessionId: actor.sessionId,
            isSuperAdmin: false,
            modules,
            actionKeys: [],
          },
        ]
      : [],
  );
  const manager = { query } as unknown as EntityManager;
  const transaction = vi.fn(
    async (
      _isolation: string,
      work: (manager: EntityManager) => Promise<unknown>,
    ) => work(manager),
  );
  const unscoped = vi.fn(() => {
    throw Error('Unscoped authorization query');
  });
  const source = {
    transaction,
    manager: { query: unscoped },
  } as unknown as DataSource;
  const execute = new ExecuteAuthorizedNodiaAiUseCase(
    source,
    new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(source)),
  );
  const requirements = { moduleRoutes: ['/finances-personal'] };
  beforeEach(() => {
    vi.clearAllMocks();
    modules[1].assigned = true;
  });
  it('uses the same transactional manager for module policy and the domain port', async () => {
    const result = await execute.execute(
      actor,
      requirements,
      async (identity, tx) => {
        expect(identity.userId).toBe('1');
        expect(identity.transaction).toBe(manager);
        expect(tx).toBe(manager);
        return 'saved';
      },
    );
    expect(result).toBe('saved');
    expect(unscoped).not.toHaveBeenCalled();
    expect(
      query.mock.calls
        .map(([sql]) => sql)
        .findIndex((sql) => sql.startsWith('LOCK TABLE')),
    ).toBeLessThan(
      query.mock.calls
        .map(([sql]) => sql)
        .findIndex((sql) => sql.includes('FROM users')),
    );
  });
  it('does not invoke a port after a destination assignment is revoked', async () => {
    modules[1].assigned = false;
    const port = vi.fn(async () => undefined);
    await expect(
      execute.execute(actor, requirements, port),
    ).rejects.toMatchObject({ status: 403 });
    expect(port).not.toHaveBeenCalled();
  });
  it('propagates a port failure without replaying its effects', async () => {
    const port = vi.fn(async () => {
      throw Error('Synthetic effect failure');
    });
    await expect(execute.execute(actor, requirements, port)).rejects.toThrow(
      'Synthetic effect failure',
    );
    expect(port).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed session identity without allowing port execution', async () => {
    const port = vi.fn(async () => undefined);
    await expect(
      execute.execute({ ...actor, sessionId: 'invalid' }, requirements, port),
    ).rejects.toMatchObject({ status: 401 });
    expect(port).not.toHaveBeenCalled();
  });
  it('does not turn database failure into an empty successful authorization', async () => {
    query.mockRejectedValueOnce(new Error('Synthetic database outage'));
    const port = vi.fn(async () => undefined);
    await expect(execute.execute(actor, requirements, port)).rejects.toThrow(
      'Synthetic database outage',
    );
    expect(port).not.toHaveBeenCalled();
  });
});
