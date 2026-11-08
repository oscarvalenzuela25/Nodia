import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ManageNodiaAiSecureFlowUseCase } from './manage-nodia-ai-secure-flow.use-case.js';
import { RecoverNodiaAiSecureFlowsUseCase } from './recover-nodia-ai-secure-flows.use-case.js';
import { secureFlowFixture } from '../../../test/fixtures/nodia-ai-secure-flow.fixture.js';
import type { AiProviderSecureObservation } from '../../ai-provider/use-case/manage-ai-provider-secure-session.use-case.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => {}),
}));
function setup() {
  const f = secureFlowFixture('connection_login');
  const manage = () =>
    new ManageNodiaAiSecureFlowUseCase(
      f.store as never,
      f.status as never,
      f.proposals as never,
      f.keys as never,
      f.native as never,
      f.revoke as never,
      f.policy,
    );
  f.manager.query = vi.fn(async (sql: string) =>
    sql.includes('AS execution_id FROM nodia_ai_jobs')
      ? [{ execution_id: f.execution.id }]
      : [],
  ) as never;
  const authority = { execute: vi.fn(async () => f.actor) };
  return {
    ...f,
    manage,
    authority,
    recover: () =>
      new RecoverNodiaAiSecureFlowsUseCase(
        f.store as never,
        authority as never,
        f.native as never,
        f.policy,
      ),
  };
}
function armed(f: ReturnType<typeof setup>) {
  f.descriptor.native_request = {
    request_id: f.step.native_request_key,
    provider_id: '31',
    provider_key: 'gemini',
    mode: 'agentic',
  };
  f.descriptor.status = 'invoking';
  f.descriptor.request_id = randomUUID();
  f.descriptor.request_action = 'start';
  f.descriptor.request_revision = 2;
}
describe('Durable secure login recovery by immutable native request', () => {
  it('persists the native request and immutable deadline before sending a login', async () => {
    const f = setup(),
      request = f.request(),
      initial = f.native.start.getMockImplementation()!;
    f.native.start.mockImplementation(async () => {
      expect(f.isActive()).toBe(false);
      expect(f.step.recovery_descriptor?.native_request).toEqual({
        request_id: f.step.native_request_key,
        provider_id: '31',
        provider_key: 'gemini',
        mode: 'agentic',
      });
      expect(f.step.native_request_key).not.toBe(request.client_request_id);
      return initial();
    });
    const result = await f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'start', request);
    expect(f.native.start).toHaveBeenCalledWith(
      '31',
      'agentic',
      f.identity,
      f.step.native_request_key,
      f.descriptor.expires_at,
    );
    expect(JSON.stringify(result.flow)).not.toContain('native_request');
    expect(JSON.stringify(f.saved)).not.toContain('authorization_url');
  });
  it('finds a lost start response from a fresh coordinator without another start', async () => {
    const f = setup();
    f.native.start.mockRejectedValueOnce(new Error('synthetic lost response'));
    await expect(
      f
        .manage()
        .execute(f.identity, f.execution.id, f.flowId, 'start', f.request()),
    ).rejects.toThrow('nodia_ai:secure_flow_unknown');
    expect(f.descriptor.native_reference).toBeNull();
    const result = await f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'status', f.request());
    expect(result.flow.status).toBe('pending');
    expect(f.native.observeRequest).toHaveBeenCalledWith(
      f.descriptor.native_request,
      f.identity.userId,
    );
    expect(f.native.start).toHaveBeenCalledTimes(1);
    expect(f.descriptor.native_reference?.job_id).toBe('a'.repeat(32));
  });
  it('cancels an armed start by durable request even before its native reference exists', async () => {
    const f = setup();
    armed(f);
    const original = f.descriptor.native_request!.request_id;
    const result = await f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'cancel', f.request());
    expect(result.flow.status).toBe('cancelled');
    expect(f.native.cancelRequest).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: original }),
      f.identity.userId,
    );
    expect(f.native.start).not.toHaveBeenCalled();
    expect(f.native.acknowledgeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: original }),
      f.identity.userId,
    );
    expect(f.descriptor.native_request).toBeNull();
    expect(f.descriptor.request_action).toBe('cancel');
  });
  it.each(['status', 'cancel'] as const)(
    'prefers the exact durable request for %s even after a native reference is known',
    async (action) => {
      const f = setup();
      await f
        .manage()
        .execute(f.identity, f.execution.id, f.flowId, 'start', f.request());
      expect(f.descriptor.native_reference).not.toBeNull();
      const nativeRequest = structuredClone(f.descriptor.native_request);
      await f
        .manage()
        .execute(f.identity, f.execution.id, f.flowId, action, f.request());
      expect(
        action === 'status' ? f.native.observeRequest : f.native.cancelRequest,
      ).toHaveBeenCalledWith(nativeRequest, f.identity.userId);
      expect(f.native.status).not.toHaveBeenCalled();
      expect(f.native.cancel).not.toHaveBeenCalled();
    },
  );
  it('keeps a busy durable admission uncertain instead of advertising a start that cannot be replayed', async () => {
    const f = setup();
    f.native.start.mockRejectedValueOnce(
      new ConflictException('ai_provider:runtime_busy'),
    );
    await expect(
      f
        .manage()
        .execute(f.identity, f.execution.id, f.flowId, 'start', f.request()),
    ).rejects.toThrow('ai_provider:runtime_busy');
    expect(f.descriptor.status).toBe('unknown');
    expect(f.descriptor.native_request?.request_id).toBe(
      f.step.native_request_key,
    );
    await f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'status', f.request());
    expect(f.native.start).toHaveBeenCalledTimes(1);
    expect(f.native.observeRequest).toHaveBeenCalledTimes(1);
  });
  it('does not allow lookup to escape the original owner/session', async () => {
    const f = setup();
    armed(f);
    await expect(
      f
        .manage()
        .execute(
          { ...f.identity, sessionId: randomUUID() },
          f.execution.id,
          f.flowId,
          'status',
          f.request(),
        ),
    ).rejects.toThrow('nodia_ai:operation_not_found');
    expect(f.native.observeRequest).not.toHaveBeenCalled();
  });
  it.each(['request_id', 'provider_id', 'provider_key', 'mode'])(
    'rejects persisted native target drift in %s',
    async (field) => {
      const f = setup();
      armed(f);
      f.descriptor.native_request![field] =
        field === 'request_id'
          ? randomUUID()
          : field === 'provider_id'
            ? '999'
            : field === 'provider_key'
              ? 'openai'
              : 'api_key';
      await expect(
        f
          .manage()
          .execute(f.identity, f.execution.id, f.flowId, 'status', f.request()),
      ).rejects.toThrow(
        field === 'mode'
          ? 'nodia_ai:invalid_persisted_state'
          : 'nodia_ai:operation_not_found',
      );
      expect(f.native.observeRequest).not.toHaveBeenCalled();
    },
  );
  it('keeps the native request stable when a human submits an authorization code', async () => {
    const f = setup();
    await f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'start', f.request());
    const original = f.descriptor.native_request!.request_id;
    await f
      .manage()
      .execute(
        f.identity,
        f.execution.id,
        f.flowId,
        'code',
        f.request({ code: 'synthetic-code' }),
      );
    expect(f.descriptor.native_request!.request_id).toBe(original);
    expect(f.descriptor.request_action).toBe('code');
    expect(JSON.stringify(f.saved)).not.toContain('synthetic-code');
  });
  it('does not overwrite a cancelled receipt when an older start response arrives later', async () => {
    const f = setup();
    let resolveStart!: (value: AiProviderSecureObservation) => void;
    f.native.start.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        }),
    );
    const start = f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'start', f.request());
    const caught = start.catch((error) => error);
    for (let tick = 0; tick < 20 && !resolveStart; tick++)
      await Promise.resolve();
    expect(resolveStart).toBeTypeOf('function');
    await f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'cancel', f.request());
    resolveStart(await f.native.observeRequest());
    await caught;
    expect(f.descriptor.status).toBe('cancelled');
    expect(f.execution.state).toBe('cancelled');
    expect(f.step.minimal_receipt).toBeNull();
    expect(f.native.start).toHaveBeenCalledTimes(1);
  });
  it('recovers a crash before a response by observing its request outside SQL', async () => {
    const f = setup();
    armed(f);
    expect(await f.recover().execute()).toBe(1);
    expect(f.native.observeRequest).toHaveBeenCalledTimes(1);
    expect(f.native.cancelRequest).not.toHaveBeenCalled();
    expect(f.native.start).not.toHaveBeenCalled();
    expect(f.descriptor.status).toBe('pending');
    expect(f.job.state).toBe('waiting');
    expect(f.job.lease_owner).toBeNull();
  });
  it('recovers an already completed request without dispatching login again', async () => {
    const f = setup();
    armed(f);
    f.native.observeRequest.mockResolvedValue({
      ...(await f.native.observeRequest()),
      state: 'completed',
    });
    expect(await f.recover().execute()).toBe(1);
    expect(f.execution.state).toBe('completed');
    expect(f.step.minimal_receipt).toMatchObject({
      resource_key: 'secure_flows',
      id: f.flowId,
      operation: 'connection_login',
    });
    expect(f.native.start).not.toHaveBeenCalled();
  });
  it.each(['expiry', 'revocation'])(
    'fences an uncertain start after %s using the native cancellation tombstone',
    async (variant) => {
      const f = setup();
      armed(f);
      const nativeRequest = structuredClone(f.descriptor.native_request);
      if (variant === 'expiry') f.descriptor.expires_at = f.now.toISOString();
      else
        f.authority.execute.mockRejectedValue(
          new ForbiddenException('nodia_ai:capability_denied'),
        );
      expect(await f.recover().execute()).toBe(1);
      expect(f.native.cancelRequest).toHaveBeenCalledWith(
        nativeRequest,
        f.identity.userId,
      );
      expect(f.native.cleanup).not.toHaveBeenCalled();
      expect(f.native.start).not.toHaveBeenCalled();
      expect(f.execution.state).toBe('failed');
      expect(f.step.minimal_receipt).toBeNull();
    },
  );
  it('keeps an unavailable cancellation proof unknown and does not release it as terminal', async () => {
    const f = setup();
    armed(f);
    f.descriptor.expires_at = f.now.toISOString();
    f.native.cancelRequest.mockRejectedValue(
      new ConflictException('ai_provider:login_outcome_unknown'),
    );
    expect(await f.recover().execute()).toBe(0);
    expect(f.execution.state).toBe('unknown');
    expect(f.step.minimal_receipt).toBeNull();
    expect(f.native.start).not.toHaveBeenCalled();
  });
  it('does not claim absence is terminal when a durable lookup is unavailable', async () => {
    const f = setup();
    armed(f);
    f.native.observeRequest.mockRejectedValue(
      new ConflictException('ai_provider:login_outcome_unknown'),
    );
    expect(await f.recover().execute()).toBe(0);
    expect(f.step.minimal_receipt).toBeNull();
    expect(f.native.cancelRequest).not.toHaveBeenCalled();
    expect(f.native.start).not.toHaveBeenCalled();
  });
  it('cleans a purged chat without a native reference and only then deletes its durable witness', async () => {
    const f = setup();
    armed(f);
    f.execution.conversation_id = null;
    f.execution.proposal_id = null;
    f.execution.state = 'unknown';
    f.job.state = 'unknown';
    f.job.execution_id = null;
    f.descriptor.status = 'unknown';
    f.store.jobs.mockResolvedValue([]);
    Object.assign(f.repo, { findOne: vi.fn(async () => f.job) });
    f.manager.query = vi.fn(async (sql: string) =>
      sql.includes('AS execution_id FROM nodia_ai_jobs')
        ? [{ execution_id: f.execution.id }]
        : sql.includes('SELECT id FROM nodia_ai_jobs')
          ? [{ id: f.job.id }]
          : [],
    ) as never;
    expect(await f.recover().execute()).toBe(1);
    expect(f.native.cancelRequest).toHaveBeenCalledTimes(1);
    const statements = f.manager.query.mock.calls.map(([sql]) => String(sql));
    expect(
      statements.findIndex((sql) =>
        sql.startsWith('DELETE FROM nodia_ai_jobs'),
      ),
    ).toBeLessThan(
      statements.indexOf('DELETE FROM nodia_ai_executions WHERE id=$1'),
    );
    expect(f.native.start).not.toHaveBeenCalled();
  });
  it('returns a committed human success even when acknowledgement is lost, then retries it without a login effect', async () => {
    const f = setup();
    f.native.start.mockImplementation(async () => ({
      ...(await f.native.observeRequest()),
      state: 'completed',
    }));
    f.native.acknowledgeRequest.mockRejectedValueOnce(
      new ConflictException('synthetic_lost_ack'),
    );
    const response = await f
      .manage()
      .execute(f.identity, f.execution.id, f.flowId, 'start', f.request());
    expect(response.flow.status).toBe('completed');
    expect(f.step.minimal_receipt?.resource_key).toBe('secure_flows');
    expect(f.descriptor.native_request?.request_id).toBe(
      f.step.native_request_key,
    );
    f.native.observeRequest.mockClear();
    expect(await f.recover().execute()).toBe(1);
    expect(f.native.acknowledgeRequest).toHaveBeenCalledTimes(2);
    expect(f.native.observeRequest).not.toHaveBeenCalled();
    expect(f.native.start).toHaveBeenCalledTimes(1);
    expect(f.descriptor.native_request).toBeNull();
  });
  it('keeps a purged terminal witness until native acknowledgement is confirmed', async () => {
    const f = setup();
    armed(f);
    f.execution.conversation_id = null;
    f.execution.proposal_id = null;
    f.execution.state = 'unknown';
    f.job.state = 'unknown';
    f.job.execution_id = null;
    f.descriptor.status = 'unknown';
    f.native.acknowledgeRequest.mockRejectedValueOnce(
      new ConflictException('synthetic_lost_ack'),
    );
    expect(await f.recover().execute()).toBe(1);
    expect(f.descriptor.status).toBe('expired');
    expect(f.job.state).toBe('unknown');
    expect(f.descriptor.native_request).not.toBeNull();
    expect(
      f.manager.query.mock.calls.some(([sql]) =>
        String(sql).startsWith('DELETE FROM nodia_ai_'),
      ),
    ).toBe(false);
    f.native.cancelRequest.mockClear();
    expect(await f.recover().execute()).toBe(1);
    expect(f.native.cancelRequest).not.toHaveBeenCalled();
    const sql = f.manager.query.mock.calls.map(([sql]) => String(sql));
    expect(
      sql.findIndex((sql) => sql.startsWith('DELETE FROM nodia_ai_jobs')),
    ).toBeGreaterThanOrEqual(0);
    expect(
      sql.findIndex((sql) => sql.startsWith('DELETE FROM nodia_ai_jobs')),
    ).toBeLessThan(sql.indexOf('DELETE FROM nodia_ai_executions WHERE id=$1'));
  });
  it('acknowledges a terminal receipt after authority revocation without authorizing another effect', async () => {
    const f = setup();
    armed(f);
    f.descriptor.status = 'completed';
    f.execution.state = 'completed';
    f.step.state = 'completed';
    f.step.minimal_receipt = {
      schema_version: 1,
      resource_key: 'secure_flows',
      id: f.flowId,
      operation: 'connection_login',
    };
    f.job.state = 'done';
    f.authority.execute.mockRejectedValue(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    expect(await f.recover().execute()).toBe(1);
    expect(f.authority.execute).not.toHaveBeenCalled();
    expect(f.native.acknowledgeRequest).toHaveBeenCalledTimes(1);
    expect(f.native.start).not.toHaveBeenCalled();
    expect(f.step.minimal_receipt.resource_key).toBe('secure_flows');
  });
});
