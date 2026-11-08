import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { CheckActionPermissionUseCase } from './check-action-permission.use-case.js';

describe('CheckActionPermissionUseCase compatibility', () => {
  it('does not require a role or action from an active user', async () => {
    const query = vi
      .fn()
      .mockResolvedValue([{ actor_active: true, allowed: true }]);
    const useCase = new CheckActionPermissionUseCase({
      query,
    } as unknown as DataSource);

    await expect(useCase.execute('12', 'ai:manage')).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(expect.any(String), ['12', [], 'all',
      expect.objectContaining({ '/settings/users': '/users', '/tools/nodia-ai': '/nodia-ai' }),
    ]);
  });

  it('still rejects an inactive user instead of granting anonymous access', async () => {
    const query = vi
      .fn()
      .mockResolvedValue([{ actor_active: false, allowed: false }]);
    const useCase = new CheckActionPermissionUseCase({
      query,
    } as unknown as DataSource);

    await expect(useCase.execute('12', 'ai:manage')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when no permission result is returned', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const useCase = new CheckActionPermissionUseCase({
      query,
    } as unknown as DataSource);

    await expect(useCase.execute('12', 'invoice:analyze')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
