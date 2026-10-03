import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { CheckActionPermissionUseCase } from './check-action-permission.use-case.js';

describe('CheckActionPermissionUseCase', () => {
  it('allows an active role with the required action', async () => {
    const query = vi.fn().mockResolvedValue([{ allowed: true }]);
    const useCase = new CheckActionPermissionUseCase({
      query,
    } as unknown as DataSource);

    await expect(useCase.execute('12', 'ai:manage')).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ur.user_id = $1'),
      ['12', 'ai:manage'],
    );
  });

  it('denies a user without the required action', async () => {
    const query = vi.fn().mockResolvedValue([{ allowed: false }]);
    const useCase = new CheckActionPermissionUseCase({
      query,
    } as unknown as DataSource);

    await expect(useCase.execute('12', 'ai:manage')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('fails closed when no permission result is returned', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const useCase = new CheckActionPermissionUseCase({
      query,
    } as unknown as DataSource);

    await expect(useCase.execute('12', 'invoice:analyze')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
