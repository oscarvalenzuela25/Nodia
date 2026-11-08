import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { NodiaAiAdapterError, NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { NodiaAiAdapterTransport } from '../../nodia-ai-adapter/nodia-ai-adapter.service.js';
import type { NodiaAiClaim } from '../../nodia-ai-runtime/types/worker.types.js';
import type { NodiaAiInvoiceOcrExecution } from '../types/invoice-ocr-port.js';
import { ProductsInvoiceOcrAdapter } from './products-invoice-ocr.adapter.js';
import type { ExecuteCodexInvoiceUseCase } from '../../ai-provider/use-case/execute-codex-invoice.use-case.js';

const attempt = 'f8f4bf3a-c3f1-4a3b-9fd1-dd4a592481ec';
const resource = `gemini-profile:${'a'.repeat(64)}`;
function fixture() {
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZGeQAAAAASUVORK5CYII=', 'base64');
  const input: NodiaAiInvoiceOcrExecution = {
    claim: { attempt: { id: attempt } } as unknown as NodiaAiClaim,
    input: { analysis_id: attempt, business_id: 'business', provider_id: '3',
      attachment_id: 'attachment', compare_prices: true },
    sources: [{ attachment_id: 'attachment', kind: 'image', media_type: 'image/png',
      byte_count: buffer.length, buffer, content_hash: createHash('sha256').update(buffer).digest('hex'), file_name: 'invoice.png' }],
    commercial: { providerFields: null, tax: null },
    selection: { connection_id: '2', mode: 'agentic', model_id: 'discovered-test-model', effort_id: null },
    observation: { available: true, observedAt: new Date(), source: 'gemini_live_session_and_catalog',
      resourceKey: resource, sessionGeneration: 'b'.repeat(32), configurationGeneration: 'c'.repeat(64),
      adapterContractVersion: 'nodia-ai-gemini-chat/1', supportsMcp: true },
    deadlineAt: new Date(Date.now() + 120000), signal: new AbortController().signal,
    assertLease: vi.fn().mockResolvedValue(undefined),
  };
  const reply = {
    extraction: { code: null, total_amount: 0, data: { issue_date: '', items: [{ name: 'P', quantity: 0, cost_price: 0 }] } },
    native: { attempt_id: attempt, resource_key: resource, session_generation: 'b'.repeat(32), operation_ref: attempt,
      terminal_proof_id: '09d4ba56-89b0-42bd-a99b-7eb228ea44a9', process_closed: true,
      outcome: 'completed', observed_at: new Date().toISOString() },
  };
  const request = vi.fn().mockResolvedValue(reply);
  const verifyConfiguration = vi.fn().mockResolvedValue(undefined);
  const adapter = new ProductsInvoiceOcrAdapter({ request } as unknown as NodiaAiAdapterTransport,
    { verifyConfiguration } as unknown as NodiaAiAdapterPort);
  return { input, reply, request, verifyConfiguration, adapter };
}

describe('Products OCR with durable chat identity', () => {
  it('uses the exact selected model, original hash and nullable tax/effort in one dispatch', async () => {
    const f = fixture();
    const result = await f.adapter.execute(f.input);
    expect(result.extraction).toMatchObject({ business_id: 'business', provider_id: '3',
      total_amount: 0, data: { items: [{ quantity: 0, cost_price: 0, cost_price_tax: null }] } });
    expect(result.terminalProof).toMatchObject({ attemptId: attempt, processClosed: true, outcome: 'completed' });
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.request.mock.calls[0]).toEqual(['/nodia-ai/agentic/invoice/turn', expect.objectContaining({
      model_id: f.input.selection.model_id, effort_id: null, tax: null,
      attachment: expect.objectContaining({ sha256: f.input.sources[0].content_hash }),
    }), expect.any(AbortSignal), true]);
  });
  it('rejects a source changed after the authorized snapshot before sending', async () => {
    const f = fixture();
    await expect(f.adapter.execute({ ...f.input, sources: [{ ...f.input.sources[0], content_hash: '0'.repeat(64) }] })).rejects.toThrow();
    expect(f.request).not.toHaveBeenCalled();
  });
  it('does not select a commercial supplier automatically', async () => {
    const f = fixture();
    await expect(f.adapter.execute({ ...f.input, input: { ...f.input.input, provider_id: null } })).rejects.toThrow('supplier_required');
    expect(f.request).not.toHaveBeenCalled();
  });
  it('rejects a closed proof for a different original attempt', async () => {
    const f = fixture(); f.reply.native.operation_ref = 'other';
    await expect(f.adapter.execute(f.input)).rejects.toThrow('adapter_terminal_proof_invalid');
  });
  it('never treats an abandoned attempt as a successful extraction', async () => {
    const f = fixture(); f.reply.native.outcome = 'abandoned_unknown';
    await expect(f.adapter.execute(f.input)).rejects.toThrow('adapter_invalid_reply');
  });
  it('classifies malformed extraction after dispatch as an uncertain result without retry', async () => {
    const f = fixture(); Reflect.set(f.reply.extraction.data, 'items', [{ name: 'P', cost_price: -1 }]);
    await expect(f.adapter.execute(f.input)).rejects.toMatchObject({ code: 'adapter_invalid_reply', outcome: 'unknown' });
    expect(f.request).toHaveBeenCalledOnce();
  });
  it('does not retry after an uncertain transport result', async () => {
    const f = fixture(), error = new NodiaAiAdapterError('adapter_transport_unavailable', 'unknown');
    f.request.mockRejectedValue(error);
    await expect(f.adapter.execute(f.input)).rejects.toBe(error);
    expect(f.request).toHaveBeenCalledOnce();
  });
  it('keeps a configuration change after OCR dispatched uncertain instead of claiming no dispatch', async () => {
    const f = fixture();
    f.verifyConfiguration.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new NodiaAiAdapterError('adapter_configuration_changed', 'not_dispatched'));
    await expect(f.adapter.execute(f.input)).rejects.toMatchObject({ code: 'adapter_configuration_changed', outcome: 'unknown' });
    expect(f.request).toHaveBeenCalledOnce();
  });
  it('pins original bytes and commercial settings before waiting for configuration verification', async () => {
    const f = fixture();
    let proceed!: () => void;
    f.verifyConfiguration.mockImplementationOnce(() => new Promise<void>(resolve => { proceed = resolve; }));
    const running = f.adapter.execute(f.input);
    f.input.sources[0].buffer.fill(0);
    Reflect.set(f.input.input, 'provider_id', '9');
    f.input.selection.model_id = 'changed-after-start';
    proceed();
    const result = await running;
    expect(result.extraction.provider_id).toBe('3');
    expect(f.request.mock.calls[0][1]).toMatchObject({ model_id: 'discovered-test-model', attachment: { sha256: f.input.sources[0].content_hash } });
  });
  it('fails explicitly for another provider instead of invoking Gemini as fallback', async () => {
    const f = fixture();
    await expect(f.adapter.execute({ ...f.input, observation: { ...f.input.observation,
      source: 'codex_live_session_and_catalog', adapterContractVersion: 'nodia-ai-codex-chat/1',
      adapterIdentity: { providerKey: 'openai', contractVersion: 'nodia-ai-codex-chat/1', connectionId: '2' },
    } })).rejects.toThrow('invoice_ocr_mode_unavailable');
    expect(f.request).not.toHaveBeenCalled();
  });
  it('rejects an expired deadline without starting OCR', async () => {
    const f = fixture();
    await expect(f.adapter.execute({ ...f.input, deadlineAt: new Date(0) })).rejects.toThrow('deadline_exceeded');
    expect(f.request).not.toHaveBeenCalled();
  });
  it('routes a bound Codex identity to its existing Products OCR without a Gemini request', async () => {
    const f = fixture();
    const adapterIdentity = { providerKey: 'openai', contractVersion: 'nodia-ai-codex-chat/1', connectionId: '2' } as const;
    const executeNative = vi.fn().mockResolvedValue({ extraction: { code: 'F', total_amount: 0,
      items: [{ name: 'P', code: null, quantity: 0, cost_price: 0 }] },
    terminalProof: { engine: 'agentic', attemptId: attempt, resourceKey: `codex-profile:${'d'.repeat(64)}`,
      sessionGeneration: 'b'.repeat(32), operationRef: attempt, adapterIdentity,
      terminalProofId: '09d4ba56-89b0-42bd-a99b-7eb228ea44a9', processClosed: true, outcome: 'completed', observedAt: new Date() } });
    const adapter = new ProductsInvoiceOcrAdapter({ request: f.request } as unknown as NodiaAiAdapterTransport,
      { verifyConfiguration: f.verifyConfiguration } as unknown as NodiaAiAdapterPort,
      { executeNative } as unknown as ExecuteCodexInvoiceUseCase);
    const result = await adapter.execute({ ...f.input,
      observation: { ...f.input.observation, source: 'codex_live_session_and_catalog', adapterIdentity,
        adapterContractVersion: 'nodia-ai-codex-chat/1',
        resourceKey: `codex-profile:${'d'.repeat(64)}` } });
    expect(result.extraction).toMatchObject({ total_amount: 0, data: { items: [{ cost_price: 0 }] } });
    expect(f.request).not.toHaveBeenCalled();
    expect(executeNative).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ effortId: null, tax: null,
      identity: expect.objectContaining({ adapterIdentity, attemptId: attempt }) }));
  });
});
