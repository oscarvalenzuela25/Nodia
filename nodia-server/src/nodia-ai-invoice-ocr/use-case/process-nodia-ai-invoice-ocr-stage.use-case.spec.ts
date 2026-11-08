import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { eventJournalFixture } from '../../nodia-ai-run/event-journal.fixture.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import type { NodiaAiStageContext } from '../../nodia-ai-runtime/types/worker.types.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import type { NodiaAiInvoiceOcrExecution } from '../types/invoice-ocr-port.js';
import { ProcessNodiaAiInvoiceOcrStageUseCase } from './process-nodia-ai-invoice-ocr-stage.use-case.js';
import { ocrHash } from '../types/invoice-ocr-state.js';

function fixture() {
  const f = runtimeFixture(), claim = f.leased(), buffer = Buffer.from('fixture bytes');
  const selection = { connection_id: '1', mode: 'agentic' as const, model_id: 'fixture-model', effort_id: null };
  const observation = { available: true, resourceKey: 'fixture-profile', configurationGeneration: 'a'.repeat(64), sessionGeneration: 'b'.repeat(32), source: 'gemini_live_session_and_catalog' as const };
  const sourceAttempt = { id: '4b49e52d-7013-4df6-b872-26c891b2fa98', job_id: claim.job.id, stage_key: 'inference', phase: 'completed', ended_at: new Date(), selection_snapshot: selection };
  const source = { attachment_id: '326a38de-e042-4b40-8305-b10239dde721', kind: 'image', media_type: 'image/png', byte_count: buffer.length, content_hash: createHash('sha256').update(buffer).digest('hex'), file_name: 'fixture.png' };
  const preparationId = 'b3e5e6f3-6de9-4c27-8509-2b9d01acf5ed';
  const snapshot = { preparation_id: preparationId, source_attempt_id: sourceAttempt.id, business_id: 'e42c1020-9d88-4b46-9517-c73727a50c05', provider_id: '7', tax: 0, provider_fields: { code: { value: 'sku' } }, compare_prices: true, selection, resource_key: observation.resourceKey, configuration_generation: observation.configurationGeneration, session_generation: observation.sessionGeneration, source };
  const receipt = Object.assign(new NodiaAiToolCall(), { id: 'a1990d09-5770-41bf-8c31-213596729fda', run_id: claim.run.id, conversation_id: claim.run.conversation_id, tool_name: 'nodia_invoices_ocr', state: 'completed', public_result: { status: 'requested', analysis_id: preparationId }, scope_manifest: { invoice_ocr_snapshot: snapshot } });
  claim.run.context_manifest.invoice_ocr_request = { schema_version: 1, analysis_id: preparationId, request_id: receipt.id, source_attempt_id: sourceAttempt.id };
  claim.job.stage_key = 'invoice_ocr';
  let acknowledgement = true;
  const journal = eventJournalFixture(f.run);
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    const event = journal.query(sql, args); if (event !== undefined) return event;
    if (sql.includes('dedup_key=$1')) return acknowledgement ? [{ id: 'ack-job' }] : [];
    if (sql.includes('FROM nodia_ai_runtime_slots')) return [{ resource_key: observation.resourceKey }];
    if (sql.includes('FROM products')) return [{ id: '9', code: 'SKU', cost_price: 100, cost_price_tax: 119 }];
    if (sql.includes('next_message_seq=next_message_seq+1')) return [{ seq: '3' }];
    return [];
  });
  const save = vi.fn(async (value: unknown) => value);
  const manager = { query, getRepository: (entity: unknown) => entity === NodiaAiJobAttempt ? { findOneBy: async () => sourceAttempt } : { findOneByOrFail: async () => receipt, findBy: async () => [receipt], save } } as unknown as EntityManager;
  const snapshots = { anchor: vi.fn(async () => receipt), current: vi.fn(async () => snapshot) };
  const authorize = { execute: vi.fn(async () => ({ modules: [{ route: '/business' }] })) };
  const adapter = { observe: vi.fn(async () => observation) };
  const attachments = { content: vi.fn(async () => ({ buffer, media_type: 'image/png' })), usageForAdmission: vi.fn(async () => ({ chat_bytes: '0', owner_bytes: '0' })) };
  const reserve = { execute: vi.fn(async () => ({ resourceKey: observation.resourceKey, operationRef: claim.attempt.id, fence: '1' })) };
  const release = { execute: vi.fn(async () => {}) };
  const cleanup = { execute: vi.fn(async () => { acknowledgement = false; }) };
  const proof = { engine: 'agentic' as const, attemptId: claim.attempt.id, operationRef: claim.attempt.id, resourceKey: observation.resourceKey, sessionGeneration: observation.sessionGeneration, terminalProofId: 'proof', processClosed: true as const, outcome: 'completed' as const, observedAt: new Date() };
  const port = { assertSupported: vi.fn(), execute: vi.fn(async (input: NodiaAiInvoiceOcrExecution) => ({ terminalProof: proof, extraction: { business_id: input.input.business_id, provider_id: input.input.provider_id, code: 'F1', total_amount: 0 as number | null, data: { items: [{ name: 'fixture', code: 'SKU', cost_price: 0, cost_price_tax: null }] } } })) };
  const context: NodiaAiStageContext = { signal: new AbortController().signal, checkpoint: async work => work(manager), armDispatch: vi.fn(async (_s, _r, validate) => { await validate?.(manager); return new Date(Date.now() + 120000); }) };
  const uc = new ProcessNodiaAiInvoiceOcrStageUseCase(snapshots as never, authorize as never, adapter as never, attachments as never, reserve as never, release as never, cleanup as never, port as never, f.policy);
  return { uc, claim, context, sourceAttempt, receipt, snapshot, observation, manager, query, snapshots, adapter, attachments, reserve, release, cleanup, port, journal, proof };
}
describe('ProcessNodiaAiInvoiceOcrStageUseCase', () => {
  it('ACKs before reserving, arms once and seals exact analysis with real zero/null values', async () => {
    const f = fixture(), before = Date.now(), result = await f.uc.execute(f.claim, f.context);
    expect(result.status).toBe('completed'); expect(f.cleanup.execute).toHaveBeenCalledOnce();
    expect(f.cleanup.execute.mock.invocationCallOrder[0]).toBeLessThan(f.reserve.execute.mock.invocationCallOrder[0]);
    expect(f.context.armDispatch).toHaveBeenCalledOnce(); expect(f.port.execute).toHaveBeenCalledOnce();
    const input = f.port.execute.mock.calls[0][0]; expect(input.commercial.tax).toBe(0); expect(input.sources[0].buffer.toString()).toBe('fixture bytes');
    expect(input.input.analysis_id).toBe(f.snapshot.preparation_id);
    await input.assertLease(new AbortController().signal);
    expect(f.query.mock.calls.some(([sql]) => sql.includes('FROM nodia_ai_runtime_slots'))).toBe(true);
    if (result.status === 'completed') await result.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledOnce(); expect(f.receipt.scope_manifest.invoice_ocr_result_hash).toBe(ocrHash(f.receipt.scope_manifest.invoice_ocr_result));
    const observed = Date.parse(String((f.receipt.scope_manifest.invoice_ocr_result as { comparison_observed_at: string }).comparison_observed_at));
    expect(observed).toBeGreaterThanOrEqual(before); expect(observed).toBeLessThanOrEqual(Date.now());
    expect(f.receipt.scope_manifest.invoice_ocr_attempt_id).toBe(f.claim.attempt.id);
    const saved = f.receipt.scope_manifest.invoice_ocr_result as { extraction: { total_amount: number; data: { issue_date: null } }; comparison: { net: { delta: number } }[] };
    expect(saved.extraction.total_amount).toBe(0); expect(saved.extraction.data.issue_date).toBeNull(); expect(saved.comparison[0].net.delta).toBe(-100);
    expect(f.journal.events).toHaveLength(1);
    expect(f.query.mock.calls.some(([sql]) => /INSERT INTO (products|invoices)|UPDATE products/.test(sql))).toBe(false);
  });
  it('never reserves while acknowledgement is pending', async () => {
    const f = fixture(); f.cleanup.execute.mockImplementation(async () => {});
    await expect(f.uc.execute(f.claim, f.context)).rejects.toMatchObject({ errorCode: 'nodia_ai:invoice_ocr_ack_pending', retryable: true });
    expect(f.reserve.execute).not.toHaveBeenCalled(); expect(f.port.execute).not.toHaveBeenCalled();
  });
  it.each(['phase', 'job', 'ended'])('rejects invalid planner %s before OCR', async field => {
    const f = fixture(); if (field === 'phase') f.sourceAttempt.phase = 'unknown'; if (field === 'job') f.sourceAttempt.job_id = 'other'; if (field === 'ended') f.sourceAttempt.ended_at = null as never;
    await expect(f.uc.execute(f.claim, f.context)).rejects.toThrow('invoice_ocr_invalid'); expect(f.cleanup.execute).not.toHaveBeenCalled(); expect(f.reserve.execute).not.toHaveBeenCalled();
  });
  it('rejects unsupported provider before reserve or arm', async () => {
    const f = fixture(); f.port.assertSupported.mockImplementation(() => { throw new Error('unsupported'); });
    await expect(f.uc.execute(f.claim, f.context)).rejects.toThrow('unsupported'); expect(f.reserve.execute).not.toHaveBeenCalled(); expect(f.context.armDispatch).not.toHaveBeenCalled();
  });
  it.each(['configurationGeneration', 'sessionGeneration', 'resourceKey'])('rejects changed observation %s', async key => {
    const f = fixture(); Reflect.set(f.observation, key, 'changed'); await expect(f.uc.execute(f.claim, f.context)).rejects.toThrow('eligibility_changed'); expect(f.reserve.execute).not.toHaveBeenCalled();
  });
  it('rejects changed original bytes before arming', async () => {
    const f = fixture(); f.attachments.content.mockResolvedValue({ buffer: Buffer.from('different'), media_type: 'image/png' });
    await expect(f.uc.execute(f.claim, f.context)).rejects.toThrow('source_changed'); expect(f.context.armDispatch).not.toHaveBeenCalled();
  });
  it('does not replay after an uncertain OCR call', async () => {
    const f = fixture(); f.port.execute.mockRejectedValue(new Error('uncertain'));
    await expect(f.uc.execute(f.claim, f.context)).rejects.toThrow('uncertain'); expect(f.port.execute).toHaveBeenCalledOnce(); expect(f.context.armDispatch).toHaveBeenCalledOnce(); expect(f.release.execute).not.toHaveBeenCalled();
  });
  it('uses the terminal proof to release a known-invalid extraction without saving assistant data', async () => {
    const f = fixture(); f.port.execute.mockResolvedValue({ terminalProof: f.proof, extraction: { business_id: 'different', provider_id: '7', code: 'x', total_amount: null, data: { items: [] } } });
    const result = await f.uc.execute(f.claim, f.context); expect(result.status).toBe('failed'); expect(result).toHaveProperty('terminalProof', f.proof);
    if (result.status === 'failed') await result.persist?.(f.manager); expect(f.release.execute).toHaveBeenCalledOnce(); expect(f.journal.events).toHaveLength(0);
  });
  it('refuses a second execution of stored OCR', async () => {
    const f = fixture(); f.receipt.scope_manifest.invoice_ocr_result = { extraction: {} };
    await expect(f.uc.execute(f.claim, f.context)).rejects.toThrow('request_conflict'); expect(f.port.execute).not.toHaveBeenCalled();
  });
  it('keeps a completed native proof when the combined private receipt exceeds its storage bound', async () => {
    const f = fixture(); f.receipt.scope_manifest.other_private_metadata = 'x'.repeat(65000);
    const result = await f.uc.execute(f.claim, f.context);
    expect(result).toMatchObject({ status: 'failed', terminalProof: f.proof, errorCode: 'nodia_ai:invoice_ocr_invalid_result' });
    if (result.status === 'failed') await result.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledOnce(); expect(f.journal.events).toHaveLength(0);
  });
  it('leaves comparison and its observation time unknown when comparison was not requested', async () => {
    const f = fixture(); f.snapshot.compare_prices = false;
    const result = await f.uc.execute(f.claim, f.context); expect(result.status).toBe('completed');
    if (result.status === 'completed') await result.persist?.(f.manager);
    expect(f.receipt.scope_manifest.invoice_ocr_result).toMatchObject({ comparison: null, comparison_observed_at: null });
    expect(f.query.mock.calls.some(([sql]) => sql.includes('FROM products'))).toBe(false);
  });
  it('reauthorizes in the lease callback', async () => {
    const f = fixture(); await f.uc.execute(f.claim, f.context); f.snapshots.current.mockRejectedValue(new Error('revoked'));
    await expect(f.port.execute.mock.calls[0][0].assertLease(new AbortController().signal)).rejects.toThrow('revoked');
  });
});
