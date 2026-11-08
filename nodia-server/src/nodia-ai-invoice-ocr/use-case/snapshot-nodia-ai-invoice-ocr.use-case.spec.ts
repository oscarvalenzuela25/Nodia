import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { NodiaAiMessage } from '../../nodia-ai-conversation/entities/nodia-ai-message.entity.js';
import { NodiaAiMessagePart } from '../../nodia-ai-conversation/entities/nodia-ai-message-part.entity.js';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';
import { Business } from '../../business/entities/business.entity.js';
import { BusinessCollaborator } from '../../business/entities/business-collaborator.entity.js';
import { Provider } from '../../provider/entities/provider.entity.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import { SnapshotNodiaAiInvoiceOcrUseCase } from './snapshot-nodia-ai-invoice-ocr.use-case.js';
import { invoiceOcrRequestResult, ocrHash } from '../types/invoice-ocr-state.js';

function fixture() {
  const f = runtimeFixture(), claim = f.leased(), expires = new Date(Date.now() + 600000);
  f.run.state = 'running'; f.run.deadline_at = expires; f.conversation.expires_at = expires;
  f.run.selection_snapshot.mode = 'agentic';
  f.run.context_manifest = { configuration_generation: 'a'.repeat(64), session_generation: 'b'.repeat(32) };
  f.run.user_message_id = 'b3e5e6f3-6de9-4c27-8509-2b9d01acf5ed'; f.run.input_through_seq = '1';
  f.attempt.phase = 'dispatch_armed'; f.attempt.ended_at = null; f.attempt.stage_key = 'inference';
  f.attempt.selection_snapshot = f.run.selection_snapshot; f.attempt.runtime_resource_key = 'fixture-profile';
  const business = { id: 'e42c1020-9d88-4b46-9517-c73727a50c05', owner_id: '1' };
  const provider = { id: '7', business_id: business.id, tax: 0, fields: { code: { value: 'SKU' }, private_key: 'must not cross' } };
  const attachment = { id: '326a38de-e042-4b40-8305-b10239dde721', conversation_id: f.conversation.id, kind: 'image', state: 'ready', retention_epoch: '1', expires_at: expires, generation: '1', media_type: 'image/png', content_hash: 'c'.repeat(64), byte_count: '12', file_name: 'fixture.png', page_count: null };
  const message = { id: f.run.user_message_id, role: 'user', author_id: '1', status: 'sealed', seq: '1', source_scope_manifest: { schema_version: 1, module_routes: ['/business'] } };
  const part = { kind: 'image', text: null, attachment_id: attachment.id };
  const receipts = new Map<string, NodiaAiToolCall>();
  let collaborator = false;
  const find = vi.fn(async (entity: unknown, options: unknown) => {
    const where = (options as { where?: Record<string, unknown> })?.where ?? options as Record<string, unknown>;
    if (entity === NodiaAiRun) return where.id === f.run.id ? f.run : null;
    if (entity === NodiaAiJobAttempt) return where.id === f.attempt.id ? f.attempt : null;
    if (entity === NodiaAiJob) return f.job;
    if (entity === NodiaAiConversation) return f.conversation;
    if (entity === NodiaAiMessage) return where.id === message.id ? message : null;
    if (entity === NodiaAiMessagePart) return where.message_id === message.id && where.attachment_id === attachment.id ? part : null;
    if (entity === NodiaAiAttachment) return where.id === attachment.id ? attachment : null;
    if (entity === Business) return where.id === business.id ? business : null;
    if (entity === Provider) return where.id === provider.id && where.business_id === provider.business_id ? provider : null;
    if (entity === BusinessCollaborator) return collaborator ? { is_active: true } : null;
    if (entity === NodiaAiToolCall) return receipts.get(String(where.id)) ?? null;
    throw new Error('unexpected repository');
  });
  const query = vi.fn(async () => [] as { id: string }[]);
  const manager = { query, queryRunner: { isTransactionActive: true }, getRepository: (entity: unknown) => ({ findOneBy: (where: unknown) => find(entity, where), findOne: (options: unknown) => find(entity, options) }) } as unknown as EntityManager;
  const context = { manager, actor: { actorId: '1', isSuperAdmin: false, modules: [{ route: '/business' }] }, moduleRoutes: ['/business'], runId: f.run.id, conversationId: f.conversation.id, attemptId: f.attempt.id, toolCallId: 'a1990d09-5770-41bf-8c31-213596729fda' } as unknown as NodiaAiToolHandlerContext;
  const adapter = { verifyConfiguration: vi.fn(async () => {}) };
  const uc = new SnapshotNodiaAiInvoiceOcrUseCase(f.policy, adapter as never);
  const input = { action: 'prepare', business_id: business.id, attachment_id: attachment.id, compare_prices: true };
  async function prepare() {
    const snapshot = await uc.capture(input, context);
    const publicResult = invoiceOcrRequestResult(context.toolCallId!, snapshot);
    const receipt = Object.assign(new NodiaAiToolCall(), { id: context.toolCallId, run_id: f.run.id, conversation_id: f.conversation.id, tool_name: 'nodia_invoices_ocr', state: 'completed', arguments: input, public_result: publicResult, scope_manifest: { invoice_ocr_snapshot: snapshot, invoice_ocr_request_hash: ocrHash(publicResult) } });
    receipts.set(receipt.id, receipt); return receipt;
  }
  return { ...f, claim, uc, context, input, business, provider, attachment, message, part, find, query, adapter, receipts, prepare, setCollaborator: () => { collaborator = true; } };
}
describe('SnapshotNodiaAiInvoiceOcrUseCase', () => {
  it('keeps a ready original usable under the live chat after its upload-intent deadline', async () => {
    const f = fixture(), expiredUpload = new Date(Date.now() - 1000);
    f.attachment.expires_at = expiredUpload;
    const snapshot = await f.uc.capture(f.input, f.context);
    expect(snapshot.source_user_message_id).toBe(f.message.id);
    expect((snapshot.source as NodiaAiJsonObject).content_hash).toBe(f.attachment.content_hash);
    expect(f.attachment.expires_at).toBe(expiredUpload);
  });
  it('reads and compares a stored extraction after upload TTL without bypassing its real source revalidation or extending TTL', async () => {
    const f = fixture(), prep = await f.prepare(), requestId = '4b49e52d-7013-4df6-b872-26c891b2fa98';
    const input = { action: 'request', analysis_id: prep.id, provider_id: '7' };
    const snapshot = await f.uc.capture(input, { ...f.context, toolCallId: requestId });
    const publicResult = invoiceOcrRequestResult(requestId, snapshot);
    const stored = { extraction: { code: 'SYNTHETIC', total_amount: 0, data: { issue_date: null,
      items: [{ name: 'Synthetic row', code: 'SKU', quantity: 0, cost_price: 0, cost_price_tax: null }] } },
      comparison: null, comparison_observed_at: null };
    const receipt = Object.assign(new NodiaAiToolCall(), { id: requestId, run_id: f.run.id,
      conversation_id: f.conversation.id, tool_name: 'nodia_invoices_ocr', state: 'completed', arguments: input,
      public_result: publicResult, scope_manifest: { invoice_ocr_snapshot: snapshot, invoice_ocr_request_hash: ocrHash(publicResult),
        invoice_ocr_result: stored, invoice_ocr_result_hash: ocrHash(stored) } });
    prep.scope_manifest.invoice_ocr_consumed_by = requestId; f.receipts.set(requestId, receipt);
    f.attempt.phase = 'completed'; f.attempt.ended_at = new Date(); f.run.state = 'completed';
    const expiredUpload = new Date(Date.now() - 1000); f.attachment.expires_at = expiredUpload;
    f.adapter.verifyConfiguration.mockClear(); f.query.mockClear();
    const before = JSON.stringify(receipt.scope_manifest);
    const result = await f.uc.read(prep.id, f.context, true);
    expect(result.status).toBe('analyzed'); expect(result.provider_id).toBe('7');
    expect(result.extraction).toEqual(stored.extraction);
    expect((result.comparison as NodiaAiJsonObject[])[0].match).toBe('unmatched');
    expect(Number.isFinite(Date.parse(String(result.comparison_observed_at)))).toBe(true);
    expect(JSON.stringify(receipt.scope_manifest)).toBe(before);
    expect(f.attachment.expires_at).toBe(expiredUpload);
    expect(f.adapter.verifyConfiguration).not.toHaveBeenCalled();
  });
  it.each(['chat_expired', 'chat_inactive', 'chat_epoch', 'attachment_epoch', 'attachment_expired', 'attachment_uploading', 'source_owner'])('preserves %s rejection even with a ready-file upload deadline already past', async field => {
    const f = fixture(), prep = await f.prepare();
    f.attempt.phase = 'completed'; f.attempt.ended_at = new Date();
    f.attachment.expires_at = new Date(Date.now() - 1000);
    if (field === 'chat_expired') f.conversation.expires_at = new Date(Date.now() - 1);
    else if (field === 'chat_inactive') f.conversation.lifecycle = 'expired';
    else if (field === 'chat_epoch') f.conversation.retention_epoch = '2';
    else if (field === 'attachment_epoch') f.attachment.retention_epoch = '2';
    else if (field === 'attachment_expired') f.attachment.state = 'expired';
    else if (field === 'attachment_uploading') f.attachment.state = 'uploading';
    else f.message.author_id = '2';
    await expect(f.uc.read(prep.id, f.context, true)).rejects.toThrow('invoice_ocr_invalid');
  });
  it('prepares only current original metadata, without old native MIME proof or a supplier default', async () => {
    const f = fixture(), snapshot = await f.uc.capture(f.input, f.context);
    expect(snapshot.provider_id).toBeNull(); expect(snapshot.tax).toBeNull(); expect(snapshot.provider_fields).toBeNull();
    expect(snapshot.source_user_message_id).toBe(f.message.id);
    expect(invoiceOcrRequestResult(f.context.toolCallId!, snapshot).status).toBe('awaiting_supplier');
    expect(f.find.mock.calls.some(([entity]) => entity === Provider)).toBe(false);
  });
  it('allows explicit continuation from message2 only through its exact authorized preparation', async () => {
    const f = fixture(), prep = await f.prepare(); f.run.input_through_seq = '3'; f.run.user_message_id = 'new-current-user-message';
    const snapshot = await f.uc.capture({ action: 'request', analysis_id: prep.id, provider_id: '7' }, { ...f.context, toolCallId: 'new-request-id' });
    expect(snapshot.source_user_message_id).toBe(f.message.id); expect(snapshot.user_message_id).toBe('new-current-user-message');
    expect(snapshot.preparation_id).toBe(prep.id); expect(snapshot.tax).toBe(0);
    expect(snapshot.provider_fields).toEqual({ code: { value: 'SKU' } });
    expect(f.find.mock.calls.some(([entity, options]) => entity === NodiaAiToolCall && (options as { lock?: { mode: string } }).lock?.mode === 'pessimistic_write')).toBe(true);
  });
  it('rejects an old original without a preparation reference', async () => {
    const f = fixture(); f.run.input_through_seq = '3'; f.run.user_message_id = 'new-current-user-message';
    await expect(f.uc.capture(f.input, f.context)).rejects.toThrow('invoice_ocr_invalid');
  });
  it.each([undefined, null, '0', '999'])('requires a resolved commercial provider belonging to this business (%s)', async providerId => {
    const f = fixture(), prep = await f.prepare();
    await expect(f.uc.capture({ action: 'request', analysis_id: prep.id, ...(providerId === undefined ? {} : { provider_id: providerId }) }, f.context)).rejects.toThrow();
  });
  it('blocks a second request identity even when the first result is uncertain', async () => {
    const f = fixture(), prep = await f.prepare(); prep.scope_manifest.invoice_ocr_consumed_by = 'first-request-unknown';
    await expect(f.uc.capture({ action: 'request', analysis_id: prep.id, provider_id: '7' }, f.context)).rejects.toThrow('already_requested');
  });
  it('does not admit two OCR dispatch requests into one run', async () => {
    const f = fixture(), prep = await f.prepare(); f.query.mockResolvedValue([{ id: 'other-completed-request' }]);
    await expect(f.uc.capture({ action: 'request', analysis_id: prep.id, provider_id: '7' }, f.context)).rejects.toThrow('request_conflict');
  });
  it.each(['content_hash', 'generation', 'retention_epoch', 'state'])('rejects a changed original %s when continuing', async key => {
    const f = fixture(), prep = await f.prepare(); Reflect.set(f.attachment, key, key === 'state' ? 'rejected' : 'changed');
    await expect(f.uc.capture({ action: 'request', analysis_id: prep.id, provider_id: '7' }, f.context)).rejects.toThrow();
  });
  it('reauthorizes business access and accepts only active membership', async () => {
    const f = fixture(); f.business.owner_id = 'other';
    await expect(f.uc.capture(f.input, f.context)).rejects.toThrow('business_scope_not_allowed');
    f.setCollaborator(); expect((await f.uc.capture(f.input, f.context)).business_id).toBe(f.business.id);
  });
  it('rejects accepted text and oversized originals rather than treating them as OCR bytes', async () => {
    const f = fixture(); f.part.text = 'accepted' as never; await expect(f.uc.capture(f.input, f.context)).rejects.toThrow();
    f.part.text = null; f.attachment.byte_count = String(10 * 1024 * 1024 + 1); await expect(f.uc.capture(f.input, f.context)).rejects.toThrow();
  });
  it('rejects an original message whose source scope was revoked even for an explicit preparation ID', async () => {
    const f = fixture(), prep = await f.prepare(); f.message.source_scope_manifest.module_routes.push('/finance');
    await expect(f.uc.capture({ action: 'request', analysis_id: prep.id, provider_id: '7' }, f.context)).rejects.toThrow('invoice_ocr_invalid');
  });
  it('reads preparation after source completion without provider observation or a new dispatch', async () => {
    const f = fixture(), prep = await f.prepare(); f.attempt.phase = 'completed'; f.attempt.ended_at = new Date(); f.adapter.verifyConfiguration.mockClear();
    const result = await f.uc.read(prep.id, { ...f.context, toolCallId: 'new-read-receipt' });
    expect(result.status).toBe('awaiting_supplier'); expect(result.analysis_id).toBe(prep.id); expect(f.adapter.verifyConfiguration).not.toHaveBeenCalled();
  });
  it('compares already extracted prices on a later read without mutating or reinferring the extraction', async () => {
    const f = fixture(), prep = await f.prepare(), requestId = '4b49e52d-7013-4df6-b872-26c891b2fa98';
    const snapshot = { ...(prep.scope_manifest.invoice_ocr_snapshot as Record<string, never>), preparation_id: prep.id, provider_id: '7', compare_prices: false };
    const publicResult = invoiceOcrRequestResult(requestId, snapshot);
    const stored = { extraction: { code: 'F1', total_amount: 0, data: { issue_date: null, items: [{ name: 'fixture', code: 'SKU', cost_price: 0, cost_price_tax: null }] } }, comparison: null, comparison_observed_at: null };
    const receipt = Object.assign(new NodiaAiToolCall(), { id: requestId, conversation_id: f.conversation.id, tool_name: 'nodia_invoices_ocr', state: 'completed', public_result: publicResult,
      scope_manifest: { invoice_ocr_snapshot: snapshot, invoice_ocr_request_hash: ocrHash(publicResult), invoice_ocr_result: stored, invoice_ocr_result_hash: ocrHash(stored) } });
    prep.scope_manifest.invoice_ocr_consumed_by = requestId; f.receipts.set(requestId, receipt);
    const current = vi.spyOn(f.uc, 'current').mockImplementation(async row => row === prep ? prep.scope_manifest.invoice_ocr_snapshot as never : snapshot);
    f.query.mockResolvedValue([{ id: '9', code: 'SKU', cost_price: 100, cost_price_tax: 119 }] as never);
    const before = JSON.stringify(receipt.scope_manifest), startedAt = Date.now(), result = await f.uc.read(prep.id, f.context, true);
    expect(result.status).toBe('analyzed'); expect(result.compare_prices).toBe(true);
    expect(Date.parse(String(result.comparison_observed_at))).toBeGreaterThanOrEqual(startedAt);
    expect(Date.parse(String(result.comparison_observed_at))).toBeLessThanOrEqual(Date.now());
    expect((result.comparison as { net: { delta: number } }[])[0].net.delta).toBe(-100);
    expect(JSON.stringify(receipt.scope_manifest)).toBe(before); expect(f.query).toHaveBeenCalledOnce();
    expect(current).toHaveBeenNthCalledWith(1, prep, f.context, false); expect(current).toHaveBeenNthCalledWith(2, receipt, f.context, false);
    f.query.mockClear(); current.mockRejectedValue(new Error('business authority revoked'));
    await expect(f.uc.read(prep.id, f.context, true)).rejects.toThrow('authority revoked'); expect(f.query).not.toHaveBeenCalled();
  });
});

describe('private OCR context references', () => {
  async function referenceFixture() {
    const f = fixture(), prep = await f.prepare(); f.query.mockClear();
    const row = { analysis_id: prep.id, business_id: f.business.id, attachment_id: f.attachment.id,
      source_message_seq: '1', provider_id: null, state_hint: 'awaiting_supplier',
      preparation_result: prep.public_result, preparation_hash: prep.scope_manifest.invoice_ocr_request_hash,
      request_result: null, request_hash: null, extraction: { secret: 'must never enter context' } };
    f.query.mockResolvedValue([row] as never);
    return { ...f, row };
  }
  it('loads one bounded metadata projection with actor, scope and exact message-sequence parameters', async () => {
    const f = await referenceFixture();
    const result = await f.uc.loadReferences(f.context.manager, f.context.actor, f.conversation.id, '17');
    expect(f.query).toHaveBeenCalledOnce();
    const args = (f.query.mock.calls[0] as unknown as [string, unknown[]])[1];
    expect(args[0]).toBe(f.conversation.id); expect(args[1]).toBe(f.context.actor.actorId); expect(args[2]).toBe(false);
    expect(JSON.parse(String(args[6]))).toEqual(['/business']); expect(args[8]).toBe('17');
    expect(result).toEqual({ schema_version: 1, more: false, references: [{ analysis_id: f.row.analysis_id,
      business_id: f.business.id, attachment_id: f.attachment.id, source_message_seq: '1', provider_id: null, state_hint: 'awaiting_supplier' }] });
    expect(JSON.stringify(result)).not.toMatch(/extraction|secret|content_hash|provider_fields|model_id|preparation_hash/);
    expect(f.adapter.verifyConfiguration).toHaveBeenCalledTimes(1); // Only the fixture's initial prepare, never a reference load.
  });
  it('returns no references and performs no query without business scope', async () => {
    const f = await referenceFixture();
    expect(await f.uc.loadReferences(f.context.manager, { ...f.context.actor, modules: [] }, f.conversation.id, '2'))
      .toEqual({ schema_version: 1, references: [], more: false });
    expect(f.query).not.toHaveBeenCalled();
  });
  it.each(['0', '-1', '2 OR true', '9223372036854775808'])('rejects an invalid through-sequence %s without SQL', async throughSeq => {
    const f = await referenceFixture(); await expect(f.uc.loadReferences(f.context.manager, f.context.actor, f.conversation.id, throughSeq)).rejects.toThrow('context_invalid');
    expect(f.query).not.toHaveBeenCalled();
  });
  it('rejects corrupted reference receipt metadata instead of inventing recoverable IDs', async () => {
    const f = await referenceFixture(); f.row.preparation_hash = 'f'.repeat(64);
    await expect(f.uc.loadReferences(f.context.manager, f.context.actor, f.conversation.id, '2')).rejects.toThrow('invalid_persisted_state');
  });
  it('reports bounded truncation without fetching the remaining receipts', async () => {
    const f = await referenceFixture(), limit = Math.min(50, f.policy.results.list_default_rows, f.policy.results.json_collection_items);
    f.query.mockResolvedValue(Array.from({ length: limit + 1 }, () => f.row) as never);
    const result = await f.uc.loadReferences(f.context.manager, f.context.actor, f.conversation.id, '2');
    expect(result.references).toHaveLength(limit); expect(result.more).toBe(true); expect(f.query).toHaveBeenCalledOnce();
  });
  it('preserves stored-result or unknown hints without including an extraction or authorizing replay', async () => {
    const f = await referenceFixture(); f.row.state_hint = 'unknown'; f.row.provider_id = '7' as never;
    const result = await f.uc.loadReferences(f.context.manager, f.context.actor, f.conversation.id, '2');
    expect(result.references[0].state_hint).toBe('unknown'); expect(Object.keys(result.references[0])).toHaveLength(6);
  });
});
