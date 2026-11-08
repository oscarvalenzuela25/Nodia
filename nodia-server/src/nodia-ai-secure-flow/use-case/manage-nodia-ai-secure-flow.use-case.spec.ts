import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ManageNodiaAiSecureFlowUseCase } from './manage-nodia-ai-secure-flow.use-case.js';
import { secureFlowFixture } from '../../../test/fixtures/nodia-ai-secure-flow.fixture.js';
import type { SecureFlowKind } from '../types/secure-flow.types.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => {}),
}));
function setup(kind?: SecureFlowKind) {
  const f = secureFlowFixture(kind);
  return {
    ...f,
    uc: new ManageNodiaAiSecureFlowUseCase(
      f.store as never,
      f.status as never,
      f.proposals as never,
      f.keys as never,
      f.native as never,
      f.revoke as never,
      f.policy,
    ),
  };
}
describe('NodiaAI trusted human secure flows', () => {
  it('requires a secret when sole-active-key normalization only repeats the unchanged selection', async () => {
    const f = setup('api_key_update');
    f.source.command_template.command = { is_selected: true };
    f.source.preconditions.target = {
      id: '41',
      is_active: true,
      is_selected: true,
      label: 'Existing',
    };
    await expect(
      f.uc.execute(f.identity, f.execution.id, f.flowId, 'key', f.request({})),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.keys.execute).not.toHaveBeenCalled();
    expect(f.step.minimal_receipt).toBeNull();
  });
  it.each([
    undefined,
    {},
    {
      action: 'text',
      frame_id: 'a'.repeat(32),
      text: 'synthetic',
      unexpected: 'field',
    },
    { action: 'click', frame_id: 'a'.repeat(32), x: -1, y: 0 },
  ])(
    'rejects an invalid viewer command before arming a native request',
    async (payload) => {
      const f = setup('connection_login');
      f.descriptor.status = 'pending';
      f.descriptor.native_reference = {
        provider_id: '31',
        provider_key: 'gemini',
        mode: 'agentic',
        job_id: 'a'.repeat(32),
      };
      const request = {
        ...f.request(),
        ...(payload === undefined ? {} : { payload }),
      };
      await expect(
        f.uc.execute(f.identity, f.execution.id, f.flowId, 'input', request),
      ).rejects.toThrow();
      expect(f.descriptor.status).toBe('pending');
      expect(f.descriptor.request_id).toBeNull();
      expect(f.native.input).not.toHaveBeenCalled();
    },
  );
  it.each(['short', 'contains spaces', 'x'.repeat(2049)])(
    'rejects invalid authorization code format before its native witness',
    async (code) => {
      const f = setup('connection_login');
      f.descriptor.status = 'pending';
      f.descriptor.native_reference = {
        provider_id: '31',
        provider_key: 'gemini',
        mode: 'agentic',
        job_id: 'a'.repeat(32),
      };
      await expect(
        f.uc.execute(
          f.identity,
          f.execution.id,
          f.flowId,
          'code',
          f.request({ code }),
        ),
      ).rejects.toThrow('nodia_ai:invalid_input');
      expect(f.descriptor.status).toBe('pending');
      expect(f.native.submitCode).not.toHaveBeenCalled();
    },
  );
  it('observes and cancels an existing login even when its material provider configuration changed', async () => {
    const f = setup('connection_login');
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'start',
      f.request(),
    );
    f.port.verifyPreconditions.mockRejectedValue(
      new ConflictException('nodia_ai:preconditions_changed'),
    );
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'status',
      f.request(),
    );
    expect(f.descriptor.status).toBe('pending');
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'cancel',
      f.request(),
    );
    expect(f.descriptor.status).toBe('cancelled');
  });
  it('keeps an existing native flow pending after a known busy code request so it remains cancellable', async () => {
    const f = setup('connection_login');
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'start',
      f.request(),
    );
    f.native.submitCode.mockRejectedValue(
      new ConflictException('ai_provider:runtime_busy'),
    );
    await expect(
      f.uc.execute(
        f.identity,
        f.execution.id,
        f.flowId,
        'code',
        f.request({ code: 'synthetic-code' }),
      ),
    ).rejects.toThrow('ai_provider:runtime_busy');
    expect(f.descriptor.status).toBe('pending');
    expect(
      (
        await f.uc.execute(
          f.identity,
          f.execution.id,
          f.flowId,
          'cancel',
          f.request(),
        )
      ).flow.status,
    ).toBe('cancelled');
    expect(f.native.cancelRequest).toHaveBeenCalledTimes(1);
  });
  it.each(['policy', 'operations', 'modules', 'scope', 'source', 'chat'])(
    'rejects durable grant or linkage drift: %s',
    async (variant) => {
      const f = setup();
      if (variant === 'policy') f.grant.policy_version = 'obsolete/0';
      if (variant === 'operations') f.grant.allowed_operations = ['invented'];
      if (variant === 'modules') f.grant.allowed_modules = ['/finance'];
      if (variant === 'scope') f.grant.allowed_scope = { invented: true };
      if (variant === 'source') f.step.source_step_id = randomUUID();
      if (variant === 'chat') f.job.conversation_id = randomUUID();
      await expect(
        f.uc.execute(
          f.identity,
          f.execution.id,
          f.flowId,
          'key',
          f.request({ secret: 'synthetic-only' }),
        ),
      ).rejects.toThrow('nodia_ai:operation_not_found');
      expect(f.keys.execute).not.toHaveBeenCalled();
    },
  );
  it('accepts the native key character boundary within the shared UTF-8 HTTP limit', async () => {
    const f = setup();
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'key',
      f.request({ secret: 'é'.repeat(8192) }),
    );
    expect(f.keys.execute).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.saved)).not.toContain('é');
  });
  it('updates approved metadata without replacing an existing key secret', async () => {
    const f = setup('api_key_update');
    f.source.command_template.command = { label: 'Approved label' };
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'key',
      f.request({}),
    );
    expect(f.keys.execute.mock.calls[0][1]).toEqual({
      label: 'Approved label',
    });
  });
  it('rejects an update with neither secret nor approved metadata', async () => {
    const f = setup('api_key_update');
    await expect(
      f.uc.execute(f.identity, f.execution.id, f.flowId, 'key', f.request({})),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.keys.execute).not.toHaveBeenCalled();
  });
  it('returns opaque metadata without a native job, session or secret', async () => {
    const f = setup('connection_login');
    f.descriptor.native_reference = {
      provider_id: '31',
      provider_key: 'gemini',
      mode: 'agentic',
      job_id: 'a'.repeat(32),
    };
    const result = await f.uc.get(f.identity, f.execution.id);
    expect(result.flow.reference).toBe(f.flowId);
    expect(JSON.stringify(result)).not.toContain(f.identity.sessionId);
    expect(JSON.stringify(result)).not.toContain('job_id');
  });
  it.each(['foreign_owner', 'foreign_session'])(
    'rejects %s before receiving a secret',
    async (kind) => {
      const f = setup();
      const identity = {
        ...f.identity,
        ...(kind === 'foreign_owner'
          ? { userId: '999' }
          : { sessionId: randomUUID() }),
      };
      await expect(
        f.uc.execute(
          identity,
          f.execution.id,
          f.flowId,
          'key',
          f.request({ secret: 'synthetic-secret' }),
        ),
      ).rejects.toThrow('nodia_ai:operation_not_found');
      expect(f.keys.execute).not.toHaveBeenCalled();
    },
  );
  it.each(['api_key_create', 'api_key_update'] as const)(
    'writes %s and minimal receipt inside the same manager',
    async (kind) => {
      const f = setup(kind),
        request = f.request({ secret: 'synthetic-secret' });
      const result = await f.uc.execute(
        f.identity,
        f.execution.id,
        f.flowId,
        'key',
        request,
      );
      expect(result.flow.status).toBe('completed');
      expect(f.keys.execute.mock.calls[0][2].transaction).toBe(f.manager);
      expect(f.step.minimal_receipt).toEqual({
        schema_version: 1,
        resource_key: 'secure_flows',
        id: f.flowId,
        operation: kind,
      });
      expect(JSON.stringify(f.saved)).not.toContain('synthetic-secret');
      expect(f.job.state).toBe('done');
      expect(f.grant.revoked_at).toEqual(f.now);
      await f.uc.execute(f.identity, f.execution.id, f.flowId, 'key', request);
      expect(f.keys.execute).toHaveBeenCalledTimes(1);
    },
  );
  it('deletes only the exact frozen key without a secret payload', async () => {
    const f = setup('api_key_delete');
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'delete',
      f.request(),
    );
    expect(f.keys.remove).toHaveBeenCalledWith(
      '41',
      expect.objectContaining({ transaction: f.manager }),
    );
  });
  it('revokes only its own Nodia session with a local receipt', async () => {
    const f = setup('nodia_logout');
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'logout',
      f.request(),
    );
    expect(f.revoke.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ...f.identity, transaction: f.manager }),
    );
    expect(f.step.minimal_receipt?.operation).toBe('nodia_logout');
    expect(f.native.logout).not.toHaveBeenCalled();
  });
  it.each([
    { secret: 'synthetic', label: 'override' },
    { code: 'not-a-secret' },
    { secret: '' },
    { secret: 'x'.repeat(8193) },
  ])(
    'rejects a secret payload that changes the frozen command',
    async (payload) => {
      const f = setup();
      await expect(
        f.uc.execute(
          f.identity,
          f.execution.id,
          f.flowId,
          'key',
          f.request(payload),
        ),
      ).rejects.toThrow('nodia_ai:invalid_input');
      expect(f.keys.execute).not.toHaveBeenCalled();
    },
  );
  it('does not perform a native effect when preconditions changed', async () => {
    const f = setup();
    f.port.verifyPreconditions.mockRejectedValue(
      new ConflictException('nodia_ai:preconditions_changed'),
    );
    await expect(
      f.uc.execute(
        f.identity,
        f.execution.id,
        f.flowId,
        'key',
        f.request({ secret: 'synthetic' }),
      ),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    expect(f.keys.execute).not.toHaveBeenCalled();
  });
  it('locks configuration before the exact snapshot and write', async () => {
    const f = setup();
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'key',
      f.request({ secret: 'synthetic' }),
    );
    const lockCall = f.manager.query.mock.calls.findIndex(([sql]) =>
      String(sql).includes('LOCK TABLE ai_provider_catalog'),
    );
    expect(lockCall).toBeGreaterThanOrEqual(0);
    expect(f.manager.query.mock.invocationCallOrder[lockCall]).toBeLessThan(
      f.port.verifyPreconditions.mock.invocationCallOrder[0],
    );
  });
  it('cancels a waiting flow despite obsolete material preconditions', async () => {
    const f = setup();
    f.port.verifyPreconditions.mockRejectedValue(
      new ConflictException('nodia_ai:preconditions_changed'),
    );
    const result = await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'cancel',
      f.request(),
    );
    expect(result.flow.status).toBe('cancelled');
    expect(f.port.verifyPreconditions).not.toHaveBeenCalled();
    expect(f.keys.execute).not.toHaveBeenCalled();
  });
  it('rejects expired flow and wrong revision before native effects', async () => {
    const f = setup();
    f.descriptor.expires_at = f.now.toISOString();
    await expect(
      f.uc.execute(
        f.identity,
        f.execution.id,
        f.flowId,
        'key',
        f.request({ secret: 'synthetic' }),
      ),
    ).rejects.toThrow('nodia_ai:secure_flow_expired');
    expect(f.keys.execute).not.toHaveBeenCalled();
  });
  it('arms start before remote I/O and stores only its sanitized reference', async () => {
    const f = setup('connection_login'),
      result = await f.uc.execute(
        f.identity,
        f.execution.id,
        f.flowId,
        'start',
        f.request(),
      );
    expect(result.flow.status).toBe('pending');
    expect(result.interaction?.kind).toBe('gemini_agentic');
    expect(f.descriptor.native_reference?.job_id).toBe('a'.repeat(32));
    expect(JSON.stringify(f.saved)).not.toContain('authorization_url');
    expect(JSON.stringify(f.saved)).not.toContain('accounts.google.com');
    expect(f.native.start).toHaveBeenCalledTimes(1);
  });
  it('does not replay a lost native start response', async () => {
    const f = setup('connection_login');
    f.native.start.mockRejectedValue(new Error('synthetic transport failure'));
    const request = f.request();
    await expect(
      f.uc.execute(f.identity, f.execution.id, f.flowId, 'start', request),
    ).rejects.toThrow('nodia_ai:secure_flow_unknown');
    expect(f.descriptor.status).toBe('unknown');
    await expect(
      f.uc.execute(f.identity, f.execution.id, f.flowId, 'start', f.request()),
    ).rejects.toThrow('nodia_ai:secure_flow_busy');
    await f.uc.execute(f.identity, f.execution.id, f.flowId, 'start', request);
    expect(f.native.start).toHaveBeenCalledTimes(1);
  });
  it.each(['codex_logout', 'sync_models'] as const)(
    'blocks replay of an uncertain %s command',
    async (kind) => {
      const f = setup(kind);
      f.descriptor.status = 'unknown';
      await expect(
        f.uc.execute(
          f.identity,
          f.execution.id,
          f.flowId,
          kind === 'sync_models' ? 'sync' : 'logout',
          f.request(),
        ),
      ).rejects.toThrow('nodia_ai:secure_flow_busy');
      expect(f.native.logout).not.toHaveBeenCalled();
      expect(f.native.discover).not.toHaveBeenCalled();
    },
  );
  it('reconciles a pending login from an observed success, not client assertion', async () => {
    const f = setup('connection_login');
    await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'start',
      f.request(),
    );
    f.native.observeRequest.mockResolvedValue({
      ...(await f.native.start.mock.results[0].value),
      state: 'completed',
    });
    const result = await f.uc.execute(
      f.identity,
      f.execution.id,
      f.flowId,
      'status',
      f.request(),
    );
    expect(result.flow.status).toBe('completed');
    expect(f.step.minimal_receipt?.operation).toBe('connection_login');
  });
  it('rechecks authority after remote completion before recording success', async () => {
    const f = setup('connection_login');
    f.native.start.mockImplementation(async () => {
      f.status.authorize.mockRejectedValue(
        new ForbiddenException('nodia_ai:capability_denied'),
      );
      return {
        reference: {
          provider_id: '31',
          provider_key: 'gemini',
          mode: 'agentic',
          job_id: 'a'.repeat(32),
        },
        state: 'completed',
        human: { kind: 'gemini_agentic', data: {} },
      };
    });
    await expect(
      f.uc.execute(f.identity, f.execution.id, f.flowId, 'start', f.request()),
    ).rejects.toThrow('nodia_ai:capability_denied');
    expect(f.step.minimal_receipt).toBeNull();
    expect(f.descriptor.status).toBe('unknown');
  });
});
