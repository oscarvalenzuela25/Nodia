import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiExecutionService } from '../../nodia-ai-execution/nodia-ai-execution.service.js';
import type { NodiaAiExecutionClaim } from '../../nodia-ai-execution/types/execution-claim.types.js';
import type { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import type { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { StageNodiaAiInvoiceAttachmentUseCase } from './stage-nodia-ai-invoice-attachment.use-case.js';

const sourceBusiness = '11111111-1111-4111-8111-111111111111';
const destination = '22222222-2222-4222-8222-222222222222';
const stepId = '33333333-3333-4333-8333-333333333333';
const bytes = Buffer.from('%PDF-1.7\nSynthetic legacy invoice');
const policy = JSON.parse(
  readFileSync(
    new URL(
      '../../nodia-ai-runtime/config/runtime-policy.json',
      import.meta.url,
    ),
    'utf8',
  ),
).policy as NodiaAiRuntimePolicy;
function fixture() {
  let transactionActive = false;
  const now = new Date(),
    expiry = new Date(now.getTime() + 60000);
  const target = {
    id: '7',
    business_id: sourceBusiness,
    path_storage: `invoices/${sourceBusiness}/receipt.pdf`,
  };
  const source = {
    id: stepId,
    tool_name: 'nodia_invoices_prepare_update',
    contract_hash: 'a'.repeat(64),
    scope: { business_id: sourceBusiness },
    command_template: {
      schema_version: 1,
      business_id: sourceBusiness,
      id: '7',
      command: { business_id: destination },
      origins: { business_id: 'user' },
    },
    preconditions: { target, destination_business_id: destination },
    public_step: { depends_on: [] },
    output_bindings: [],
  };
  const step = {
    id: stepId,
    source_step_id: stepId,
    tool_name: source.tool_name,
    state: 'running',
    minimal_receipt: null,
    dispatched_at: null,
    completed_at: null,
    lease_fence: '1',
    recovery_descriptor: null as NodiaAiJsonObject | null,
  };
  const execution = {
    state: 'running',
    actor_id: '1',
    retention_epoch: '1',
    proposal_hash: 'b'.repeat(64),
    minimal_scope: {},
    revision: 1,
  };
  const job = {
    id: 'job',
    state: 'leased',
    lease_owner: 'worker',
    fence: '1',
    stage_key: 'execution_step',
    stage_seq: 1,
    lease_until: expiry,
    deadline_at: expiry,
    recovery_descriptor: null,
  };
  const claim = {
    executionId: 'execution',
    jobId: 'job',
    workerId: 'worker',
    fence: '1',
    attemptId: 'attempt',
    identity: { userId: '1', sessionId: 'session' },
    toolName: source.tool_name,
  } as NodiaAiExecutionClaim;
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM nodia_ai_job_attempts')) return [{ id: 'attempt' }];
    if (sql.startsWith('UPDATE nodia_ai_execution_steps'))
      step.recovery_descriptor = structuredClone(
        params[1],
      ) as NodiaAiJsonObject;
    return [];
  });
  const manager = { query } as unknown as EntityManager;
  const store = {
    transaction: async <T>(work: (m: EntityManager) => Promise<T>) => {
      transactionActive = true;
      try {
        return await work(manager);
      } finally {
        transactionActive = false;
      }
    },
    jobs: async () => [job],
    execution: async () => execution,
    steps: async () => [step],
    now: async () => now,
    grants: async () => [
      {
        revoked_at: null,
        expires_at: expiry,
        actor_id: '1',
        session_public_id: 'session',
        command_set_hash: execution.proposal_hash,
        allowed_operations: [source.tool_name],
        allowed_modules: ['/tools/business'],
        allowed_scope: {},
        policy_version: policy.policyVersion,
      },
    ],
    confirmedBySession: async () => true,
    sessionExpiry: async () => expiry,
  } as unknown as NodiaAiExecutionService;
  const verify = vi.fn(async () => {});
  const proposals = {
    equal: isDeepStrictEqual,
    preparer: () => ({
      moduleRoutes: ['/tools/business'],
      verifyPreconditions: verify,
    }),
  } as unknown as ValidateNodiaAiProposalUseCase;
  const status = {
    authorize: async () => ({
      steps: [source],
      actor: { actorId: '1', sessionId: 'session' },
      chat: { id: 'chat', retention_epoch: '1', active_job_id: 'job' },
      revision: { state: 'confirmed' },
      context: { manager },
    }),
    project: async () => {},
  } as unknown as GetNodiaAiExecutionUseCase;
  const storage = {
    get: vi.fn(async (_key: string, _max: number, signal: AbortSignal) => {
      expect(transactionActive).toBe(false);
      signal.throwIfAborted();
      return bytes;
    }),
    put: vi.fn(
      async (
        _key: string,
        path: string,
        _mime: string,
        signal: AbortSignal,
      ) => {
        expect(transactionActive).toBe(false);
        expect(step.recovery_descriptor?.status).toBe('preparing');
        signal.throwIfAborted();
        expect(await readFile(path)).toEqual(bytes);
      },
    ),
    delete: vi.fn(async () => {}),
  };
  return {
    useCase: new StageNodiaAiInvoiceAttachmentUseCase(
      store,
      status,
      proposals,
      storage,
      policy,
    ),
    claim,
    source,
    step,
    job,
    query,
    storage,
    verify,
  };
}
describe('StageNodiaAiInvoiceAttachmentUseCase legacy file copy', () => {
  it('copies the existing file outside SQL after a durable intent and records actual metadata', async () => {
    const f = fixture();
    await f.useCase.execute(f.claim, new AbortController().signal);
    const key = `invoices/${destination}/nodia-ai-${stepId}-1-legacy.pdf`;
    expect(f.storage.get).toHaveBeenCalledWith(
      f.source.preconditions.target.path_storage,
      10485760,
      expect.any(AbortSignal),
    );
    expect(f.storage.put).toHaveBeenCalledWith(
      key,
      expect.any(String),
      'application/pdf',
      expect.any(AbortSignal),
    );
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO invoice_uploads'),
      [key],
    );
    expect(f.step.recovery_descriptor).toMatchObject({
      schema_version: 2,
      status: 'ready',
      attachment_id: null,
      source_storage_key: f.source.preconditions.target.path_storage,
      byte_count: String(bytes.length),
      content_hash: createHash('sha256').update(bytes).digest('hex'),
    });
    expect(f.verify).toHaveBeenCalledTimes(2);
    const path = f.storage.put.mock.calls[0][1];
    await expect(readFile(path)).rejects.toThrow();
    await f.useCase.execute(f.claim, new AbortController().signal);
    expect(f.storage.put).toHaveBeenCalledTimes(1);
    expect(f.storage.get).toHaveBeenCalledTimes(1);
    expect(f.storage.delete).not.toHaveBeenCalled();
  });
  it('retains the same-business file without an upload intent or storage operation', async () => {
    const f = fixture();
    f.source.preconditions.destination_business_id = sourceBusiness;
    await f.useCase.execute(f.claim, new AbortController().signal);
    expect(f.storage.get).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE/u.test(sql)),
    ).toBe(false);
  });
  it('preserves uncertainty after a lost PUT acknowledgement and never automatically repeats the generation', async () => {
    const f = fixture();
    f.storage.put.mockRejectedValueOnce(new Error('lost acknowledgement'));
    await expect(
      f.useCase.execute(f.claim, new AbortController().signal),
    ).rejects.toThrow('lost acknowledgement');
    expect(f.step.recovery_descriptor?.status).toBe('preparing');
    await expect(
      f.useCase.execute(f.claim, new AbortController().signal),
    ).rejects.toThrow('invoice_attachment_not_staged');
    expect(f.storage.get).toHaveBeenCalledTimes(1);
    expect(f.storage.put).toHaveBeenCalledTimes(1);
    expect(f.storage.delete).not.toHaveBeenCalled();
  });
  it.each([Buffer.from('not PDF'), Buffer.alloc(10485761), Buffer.alloc(0)])(
    'rejects bad signature, excess or empty content before PUT (%#)',
    async (buffer) => {
      const f = fixture();
      f.storage.get.mockResolvedValueOnce(buffer);
      await expect(
        f.useCase.execute(f.claim, new AbortController().signal),
      ).rejects.toThrow();
      expect(f.storage.put).not.toHaveBeenCalled();
      expect(f.step.recovery_descriptor?.status).toBe('preparing');
    },
  );
  it('revalidates preconditions after I/O and leaves cleanup ownership independent on revocation', async () => {
    const f = fixture();
    f.verify
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce(new Error('preconditions changed'));
    await expect(
      f.useCase.execute(f.claim, new AbortController().signal),
    ).rejects.toThrow('preconditions changed');
    expect(f.storage.put).toHaveBeenCalledTimes(1);
    expect(f.step.recovery_descriptor?.status).toBe('preparing');
    expect(f.storage.delete).not.toHaveBeenCalled();
  });
  it('does not read or upload after cancellation', async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      f.useCase.execute(f.claim, controller.signal),
    ).rejects.toThrow();
    expect(f.storage.get).not.toHaveBeenCalled();
    expect(f.storage.put).not.toHaveBeenCalled();
  });
});
