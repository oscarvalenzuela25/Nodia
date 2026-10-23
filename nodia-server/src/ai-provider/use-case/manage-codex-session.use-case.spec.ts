import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ManageCodexSessionUseCase } from './manage-codex-session.use-case.js';
import { CodexLoginControl } from '../../common/ai/codex/codex-login-control.js';
import {
  CodexLoginJournal,
  type CodexLoginRecord,
} from '../../common/ai/codex/codex-login-journal.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { AiProviderService } from '../ai-provider.service.js';

// Policy fixture only: actual filesystem/flock/IPC/process closure is exercised by the Linux harness.
class MemoryJournal extends CodexLoginJournal {
  records = new Map<string, CodexLoginRecord>();
  override async read(id: string) {
    return this.records.get(id) ?? null;
  }
  override async write(value: CodexLoginRecord) {
    this.decode(value);
    this.records.set(value.id, value);
  }
  override async reserve(value: CodexLoginRecord) {
    if (this.records.has(value.id)) return false;
    await this.write(value);
    return true;
  }
  override async locked<T>(_id: string, work: () => Promise<T>) {
    return work();
  }
  override async admission<T>(work: () => Promise<T>) {
    return work();
  }
  override async entries() {
    return [...this.records.values()];
  }
  override async prune() {
    for (const value of this.records.values())
      if (
        value.acknowledged &&
        ['failed', 'succeeded', 'cancelled'].includes(value.state) &&
        !value.native &&
        Date.parse(value.expiresAt) + 60000 < Date.now()
      )
        this.records.delete(value.id);
    return this.records.size;
  }
}
const identity = { providerId: '42', actorId: '9007199254740993' };
const record = (patch: Partial<CodexLoginRecord> = {}): CodexLoginRecord => ({
  version: 1,
  id: randomUUID(),
  ...identity,
  expiresAt: new Date(Date.now() + 290000).toISOString(),
  state: 'cancelled',
  reason: null,
  owner: null,
  native: null,
  acknowledged: false,
  ...patch,
});

describe('Codex durable login policy', () => {
  it('fences cancel-before-start with its exact durable request and never calls launch', async () => {
    const journal = new MemoryJournal(),
      control = new CodexLoginControl(journal),
      id = randomUUID(),
      launch = vi.fn();
    expect((await control.cancel('42', id, identity.actorId)).state).toBe(
      'cancelled',
    );
    expect(
      (
        await control.start(
          '42',
          identity.actorId,
          id,
          new Date(Date.now() + 200000).toISOString(),
          launch,
        )
      ).state,
    ).toBe('cancelled');
    expect(launch).not.toHaveBeenCalled();
    expect(journal.records.size).toBe(1);
  });
  it.each(['9007199254740992', '9007199254740994'])(
    'binds adjacent BIGINT actor %s exactly',
    async (actor) => {
      const journal = new MemoryJournal(),
        value = record();
      await journal.write(value);
      const control = new CodexLoginControl(journal);
      await expect(control.status('42', value.id, actor)).rejects.toMatchObject(
        { status: 404 },
      );
      await expect(control.cancel('42', value.id, actor)).rejects.toMatchObject(
        { status: 404 },
      );
      await expect(
        control.acknowledge('42', value.id, actor),
      ).rejects.toMatchObject({ status: 404 });
      expect(await control.current('42', actor)).toEqual({ job: null });
    },
  );
  it('binds provider identity even after its configuration disappears', async () => {
    const journal = new MemoryJournal(),
      value = record();
    await journal.write(value);
    const control = new CodexLoginControl(journal);
    await expect(
      control.status('43', value.id, identity.actorId),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await control.status('42', value.id, identity.actorId),
    ).toMatchObject({ state: 'cancelled' });
  });
  it.each([
    undefined,
    new Date(0).toISOString(),
    new Date(Date.now() + 600000).toISOString(),
  ])(
    'rejects missing, expired or extended admission deadline %s',
    async (deadline) => {
      const journal = new MemoryJournal(),
        control = new CodexLoginControl(journal);
      await expect(
        control.start('42', identity.actorId, randomUUID(), deadline),
      ).rejects.toBeDefined();
      expect(journal.records.size).toBe(0);
    },
  );
  it('does not replay an uncertain or reserved request or renew its deadline', async () => {
    const journal = new MemoryJournal(),
      value = record({ state: 'unknown' });
    await journal.write(value);
    const control = new CodexLoginControl(journal),
      launch = vi.fn();
    await expect(
      control.start('42', identity.actorId, value.id, value.expiresAt, launch),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      control.start(
        '42',
        identity.actorId,
        value.id,
        new Date(Date.now() + 100000).toISOString(),
        launch,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(launch).not.toHaveBeenCalled();
    expect(journal.records.size).toBe(1);
  });
  it('never turns missing observation into cancellation', async () => {
    const control = new CodexLoginControl(new MemoryJournal());
    await expect(
      control.status('42', randomUUID(), identity.actorId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('retains unacknowledged terminal proof after TTL and rejects capacity overflow', async () => {
    const journal = new MemoryJournal();
    for (let i = 0; i < 100; i++)
      await journal.write(record({ expiresAt: new Date(0).toISOString() }));
    const control = new CodexLoginControl(journal);
    await expect(
      control.start(
        '42',
        identity.actorId,
        randomUUID(),
        new Date(Date.now() + 10000).toISOString(),
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(journal.records.size).toBe(100);
  });
  it('acknowledges terminal evidence, prunes only after TTL and accepts a lost ACK retry after prune', async () => {
    const journal = new MemoryJournal(),
      value = record({ expiresAt: new Date(0).toISOString() });
    await journal.write(value);
    const control = new CodexLoginControl(journal);
    expect(await journal.prune()).toBe(1);
    expect(await control.acknowledge('42', value.id, identity.actorId)).toEqual(
      { acknowledged: true },
    );
    expect(await journal.prune()).toBe(0);
    expect(await control.acknowledge('42', value.id, identity.actorId)).toEqual(
      { acknowledged: true },
    );
    await expect(
      control.start('42', identity.actorId, value.id, value.expiresAt),
    ).rejects.toMatchObject({ status: 410 });
  });
  it('rejects ACK for pending/unknown native work', async () => {
    const journal = new MemoryJournal(),
      value = record({ state: 'unknown' });
    await journal.write(value);
    await expect(
      new CodexLoginControl(journal).acknowledge(
        '42',
        value.id,
        identity.actorId,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('bounds active admissions even when existing workers cannot be observed', async () => {
    const journal = new MemoryJournal();
    for (let i = 0; i < 4; i++)
      await journal.write(record({ state: 'unknown' }));
    await expect(
      new CodexLoginControl(journal).start(
        '42',
        identity.actorId,
        randomUUID(),
        new Date(Date.now() + 10000).toISOString(),
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
  it.each(['userCode', 'verificationUrl', 'access_token', 'nativeLoginId'])(
    'never persists private field %s in the journal schema',
    (field) => {
      expect(() =>
        new CodexLoginJournal().decode({
          ...record(),
          [field]: 'SYNTHETIC-ONLY',
        }),
      ).toThrow();
    },
  );
  it('does not persist partial or reused PID certificates', () => {
    expect(() =>
      new CodexLoginJournal().decode(record({ native: { pid: 2 } as never })),
    ).toThrow();
  });
});

describe('Codex use case authorization boundary', () => {
  function setup() {
    const providers = {
      findProviderById: vi.fn().mockResolvedValue({
        id: '42',
        is_active: true,
        catalog: { key: 'openai', is_active: true },
      }),
    };
    const runtime = {
      releaseIdle: vi.fn().mockResolvedValue(undefined),
      observe: vi.fn(),
      acquire: vi.fn(),
      invalidate: vi.fn(),
      rotateChatGeneration: vi.fn().mockResolvedValue(undefined),
    };
    const logins = {
      start: vi.fn().mockImplementation(async (_p, _a, _r, _e, release) => {
        await release();
        return { state: 'running' };
      }),
      status: vi.fn(),
      cancel: vi.fn(),
      acknowledge: vi.fn(),
      current: vi.fn(),
    };
    const useCase = new ManageCodexSessionUseCase(
      providers as unknown as AiProviderService,
      runtime as unknown as CodexRuntimeService,
      logins as unknown as CodexLoginControl,
    );
    return { providers, runtime, logins, useCase };
  }
  it('validates the provider and passes exact request/deadline before native admission', async () => {
    const { useCase, logins, runtime } = setup(),
      id = randomUUID(),
      expiry = new Date().toISOString();
    await useCase.start('42', identity.actorId, id, expiry);
    expect(logins.start).toHaveBeenCalledWith(
      '42',
      identity.actorId,
      id,
      expiry,
      expect.any(Function),
    );
    expect(runtime.releaseIdle).toHaveBeenCalledWith('42');
  });
  it('allows trusted observation/cancel/ACK after provider deletion without a DB lookup', async () => {
    const { useCase, providers, logins } = setup(),
      id = randomUUID();
    providers.findProviderById.mockResolvedValue(null);
    await useCase.statusRequest('42', id, identity.actorId);
    await useCase.cancelRequest('42', id, identity.actorId);
    await useCase.acknowledgeRequest('42', id, identity.actorId);
    expect(providers.findProviderById).not.toHaveBeenCalled();
    expect(logins.status).toHaveBeenCalledWith('42', id, identity.actorId);
    await expect(
      useCase.status('42', id, identity.actorId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      useCase.cancel('42', id, identity.actorId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it.each([
    { is_active: false, catalog: { key: 'openai' } },
    { is_active: true, catalog: { key: 'gemini' } },
    null,
  ])(
    'rejects unavailable/non-Codex provider before launching %#',
    async (provider) => {
      const { useCase, providers, logins } = setup();
      providers.findProviderById.mockResolvedValue(provider);
      await expect(useCase.start('42', '1')).rejects.toBeDefined();
      expect(logins.start).not.toHaveBeenCalled();
    },
  );
  it('does not release a bounded supervisor when the API module restarts', () => {
    const { useCase, logins } = setup();
    useCase.onModuleDestroy();
    expect(logins.cancel).not.toHaveBeenCalled();
  });
  it('keeps account logout separate from stopping a login attempt and releases its local lease on error', async () => {
    const { useCase, runtime } = setup(),
      release = vi.fn(),
      request = vi.fn().mockRejectedValue(new Error('fixture'));
    runtime.acquire.mockResolvedValue({
      profile: { rpc: { request } },
      release,
    });
    await expect(useCase.logout('42')).rejects.toThrow('fixture');
    expect(runtime.rotateChatGeneration).toHaveBeenCalledWith('42');
    expect(
      runtime.rotateChatGeneration.mock.invocationCallOrder[0],
    ).toBeLessThan(request.mock.invocationCallOrder[0]);
    expect(release).toHaveBeenCalledOnce();
  });
});
