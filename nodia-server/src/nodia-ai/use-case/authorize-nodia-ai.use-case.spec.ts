import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthorizeNodiaAiUseCase } from './authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiResourceUseCase } from './authorize-nodia-ai-resource.use-case.js';
import type { NodiaAiAuthorizationService } from '../nodia-ai-authorization.service.js';
import type { NodiaAiAuthorizationSnapshot } from '../types/nodia-ai-authorization.types.js';

const identity = {
  userId: '9007199254740993',
  sessionId: '11111111-1111-4111-8111-111111111111',
};
const nodia = {
  id: '10',
  key: 'nodia_ai',
  route: '/nodia-ai',
  assigned: true,
};
const finance = {
  id: '11',
  key: 'personal_finance',
  route: '/finances-personal',
  assigned: true,
};
let snapshot: NodiaAiAuthorizationSnapshot | null;
const load = vi.fn(async () => snapshot);
const authorize = new AuthorizeNodiaAiUseCase({
  loadCurrentActor: load,
} as unknown as NodiaAiAuthorizationService);
const resource = new AuthorizeNodiaAiResourceUseCase(authorize);

beforeEach(() => {
  vi.clearAllMocks();
  snapshot = {
    actorId: identity.userId,
    sessionId: identity.sessionId,
    isSuperAdmin: false,
    modules: [{ ...nodia }, { ...finance }],
    actionKeys: [],
  };
});

describe('NodiaAI current authority', () => {
  it('projects historical requirements to current authority without merging duplicate identities', async () => {
    snapshot!.modules = [{ ...nodia, route: '/tools/nodia-ai' }, { ...finance, route: '/tools/finances-personal' }];
    const result = await authorize.execute(identity, { moduleRoutes: ['/tools/finances-personal'] });
    expect(result.modules.map(module => module.route)).toEqual(['/nodia-ai', '/finances-personal']);
    expect(snapshot!.modules[0].route).toBe('/tools/nodia-ai');
    snapshot!.modules.push({ ...nodia, id: '99', route: '/nodia-ai' });
    await expect(authorize.execute(identity)).rejects.toThrow('nodia_ai:capability_denied');
  });
  it('filters many catalog requirements with one current read and no exposed permission keys', async () => {
    const result = await authorize.filterAuthorized(identity, [
      { moduleRoutes: [finance.route] },
      { actionKeys: ['ai:manage'] },
      { actionKeys: ['missing:action'] },
      { moduleRoutes: ['/tools/missing'] },
    ]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.allowed).toEqual([true, true, true, false]);
    expect(result.actor).not.toHaveProperty('actionKeys');
    expect(Object.isFrozen(result.actor)).toBe(true);
    expect(Object.isFrozen(result.actor.modules)).toBe(true);
    snapshot!.modules[1].assigned = false;
    expect((await authorize.filterAuthorized(identity, [{ moduleRoutes: [finance.route] }])).allowed).toEqual([false]);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('does not read a snapshot for invalid catalog identity and rejects missing NodiaAI before filtering', async () => {
    await expect(authorize.filterAuthorized({ ...identity, userId: '0' }, [])).rejects.toBeInstanceOf(UnauthorizedException);
    expect(load).not.toHaveBeenCalled();
    snapshot!.modules[0].assigned = false;
    await expect(authorize.filterAuthorized(identity, [{}])).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('returns stable module IDs without converting bigint or exposing assignments/actions', async () => {
    const actor = await authorize.execute(identity, {
      moduleRoutes: [finance.route],
      actionKeys: ['ai:manage'],
    });
    expect(actor.actorId).toBe('9007199254740993');
    expect(actor.modules).toEqual([
      expect.objectContaining({ id: '10' }),
      expect.objectContaining({ id: '11' }),
    ]);
    expect(actor.modules[0]).not.toHaveProperty('assigned');
    expect(actor).not.toHaveProperty('actionKeys');
  });
  it('queries current state again rather than reusing a previous decision', async () => {
    await authorize.execute(identity);
    snapshot!.modules[0].assigned = false;
    await expect(authorize.execute(identity)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('rejects a revoked/expired session or inactive/missing actor', async () => {
    snapshot = null;
    await expect(authorize.execute(identity)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it.each(['0', '-1', '1e2', '9223372036854775808', '1 OR 1=1'])(
    'rejects malformed/out-of-range actor %s',
    async (userId) => {
      await expect(
        authorize.execute({ ...identity, userId }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(load).not.toHaveBeenCalled();
    },
  );
  it('rejects a malformed session before database access', async () => {
    await expect(
      authorize.execute({ ...identity, sessionId: 'invalid' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(load).not.toHaveBeenCalled();
  });
  it('does not accept an identity returned for another actor/session', async () => {
    snapshot!.actorId = '2';
    await expect(authorize.execute(identity)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('requires NodiaAI even if the destination is assigned', async () => {
    snapshot!.modules = [{ ...finance }];
    await expect(
      authorize.execute(identity, { moduleRoutes: [finance.route] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('requires each destination and omits unassigned modules from discovery', async () => {
    snapshot!.modules[1].assigned = false;
    expect((await authorize.execute(identity)).modules).toEqual([
      { id: '10', key: 'nodia_ai', route: nodia.route },
    ]);
    await expect(
      authorize.execute(identity, { moduleRoutes: [finance.route] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects the entire multi-module request if one destination is absent', async () => {
    await expect(
      authorize.execute(identity, {
        moduleRoutes: [finance.route, '/reservations'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('resolves modules by current route and stable database key/ID, not assumed IDs', async () => {
    snapshot!.modules[1].id = '762';
    expect(
      (await authorize.execute(identity, { moduleRoutes: [finance.route] }))
        .modules[1].id,
    ).toBe('762');
    snapshot!.modules[0].key = 'counterfeit';
    await expect(authorize.execute(identity)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('fails closed on ambiguous destination routes, including super administrators', async () => {
    snapshot!.isSuperAdmin = true;
    snapshot!.modules.push({ ...finance, id: '999', key: 'duplicate' });
    expect(
      (await authorize.execute(identity)).modules.map((m) => m.route),
    ).not.toContain(finance.route);
    await expect(
      authorize.execute(identity, { moduleRoutes: [finance.route] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('fails closed when the NodiaAI route is ambiguous', async () => {
    snapshot!.modules.push({ ...nodia, id: '77', key: 'duplicate' });
    await expect(authorize.execute(identity)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('allows assigned modules without role actions even when a registration declares actions', async () => {
    const actor = await authorize.execute(identity, {
      moduleRoutes: [finance.route],
      actionKeys: ['ai:manage', 'missing:action'],
    });
    expect(actor.actorId).toBe(identity.userId);
    expect(actor.isSuperAdmin).toBe(false);
    snapshot!.modules[1].assigned = false;
    await expect(
      authorize.execute(identity, {
        moduleRoutes: [finance.route],
        actionKeys: ['ai:manage'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('super administrator bypasses assignments/actions without changing actor identity', async () => {
    snapshot!.isSuperAdmin = true;
    snapshot!.modules.forEach((m) => {
      m.assigned = false;
    });
    const actor = await authorize.execute(identity, {
      moduleRoutes: [finance.route],
      actionKeys: ['ai:manage'],
    });
    expect(actor.isSuperAdmin).toBe(true);
    expect(actor.actorId).toBe(identity.userId);
    snapshot!.modules = [];
    await expect(authorize.execute(identity)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('does not turn dependency failure into permission or an empty successful catalog', async () => {
    load.mockRejectedValueOnce(new Error('Synthetic database unavailable'));
    await expect(authorize.execute(identity)).rejects.toThrow(
      'Synthetic database unavailable',
    );
  });
});

describe('NodiaAI persisted resource authority', () => {
  it('allows own resources and uses current module authority', async () => {
    const actor = await resource.execute(
      identity,
      { ownerId: identity.userId, access: 'author' },
      { moduleRoutes: [finance.route] },
    );
    expect(actor.actorId).toBe(identity.userId);
  });
  it('hides another owner resource from an ordinary user', async () => {
    await expect(
      resource.execute(identity, { ownerId: '2', access: 'read' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('allows super administrator inspection, never confirmation/authorship as the owner', async () => {
    snapshot!.isSuperAdmin = true;
    expect(
      (await resource.execute(identity, { ownerId: '2', access: 'read' }))
        .actorId,
    ).toBe(identity.userId);
    await expect(
      resource.execute(identity, { ownerId: '2', access: 'author' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('blocks recovery after destination permission is removed even if resource ownership remains', async () => {
    snapshot!.modules[1].assigned = false;
    await expect(
      resource.execute(
        identity,
        { ownerId: identity.userId, access: 'read' },
        { moduleRoutes: [finance.route] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
