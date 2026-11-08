import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { CheckModuleAccessUseCase } from './check-module-access.use-case.js';

const fixture = () => {
  const query = vi
    .fn()
    .mockResolvedValue([{ actor_active: true, allowed: true }]);
  return {
    query,
    useCase: new CheckModuleAccessUseCase({ query } as unknown as DataSource),
  };
};

describe('CheckModuleAccessUseCase', () => {
  it('normalizes and deduplicates requirements in one parameterized authority read', async () => {
    const f = fixture();
    await f.useCase.execute('12', [
      '//TOOLS/NODIA-AI//',
      '/nodia-ai?chat=42',
      '/users',
    ]);
    expect(f.query).toHaveBeenCalledOnce();
    expect(f.query.mock.calls[0][1]).toEqual([
      '12',
      ['/nodia-ai', '/users'],
      'all',
      expect.objectContaining({ '/tools/nodia-ai': '/nodia-ai' }),
    ]);
  });

  it('uses the inherited manager so revocation is checked under its authority locks', async () => {
    const f = fixture();
    const query = vi
      .fn()
      .mockResolvedValue([{ actor_active: true, allowed: false }]);
    await expect(
      f.useCase.execute('12', ['/ai-providers'], {
        query,
      } as unknown as EntityManager),
    ).rejects.toThrow('core:module_access_required');
    expect(f.query).not.toHaveBeenCalled();
  });

  it.each([
    { rows: [] },
    { rows: [{ actor_active: false, allowed: true }] },
    { rows: [{ actor_active: null, allowed: true }] },
  ])('rejects absent or invalid actor evidence', async ({ rows }) => {
    const f = fixture();
    f.query.mockResolvedValue(rows);
    await expect(f.useCase.execute('12', ['/users'])).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each([false, null, undefined, 'true'])(
    'does not interpret invalid permission evidence as authorization: %s',
    async (allowed) => {
      const f = fixture();
      f.query.mockResolvedValue([{ actor_active: true, allowed }]);
      await expect(
        f.useCase.execute('12', ['/users']),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it.each(['0', '-1', 'abc', '9223372036854775808'])(
    'rejects an invalid actor before SQL: %s',
    async (actorId) => {
      const f = fixture();
      await expect(
        f.useCase.execute(actorId, ['/users']),
      ).rejects.toThrow(UnauthorizedException);
      expect(f.query).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid route instead of dropping a requirement', async () => {
    const f = fixture();
    await expect(
      f.useCase.execute('12', ['/users', '']),
    ).rejects.toThrow(ForbiddenException);
    expect(f.query).not.toHaveBeenCalled();
  });

  it('propagates database failures without creating authorization', async () => {
    const f = fixture();
    const failure = new Error('Synthetic database unavailable');
    f.query.mockRejectedValue(failure);
    await expect(f.useCase.execute('12', ['/users'])).rejects.toBe(
      failure,
    );
  });

  it('requests union only for the explicitly shared catalog policy', async () => {
    const f = fixture();
    await f.useCase.execute(
      '12',
      ['/users', '/roles'],
      undefined,
      'any',
    );
    expect(f.query.mock.calls[0][1]).toEqual([
      '12',
      ['/users', '/roles'],
      'any',
      expect.objectContaining({ '/settings/users': '/users' }),
    ]);
  });
});
