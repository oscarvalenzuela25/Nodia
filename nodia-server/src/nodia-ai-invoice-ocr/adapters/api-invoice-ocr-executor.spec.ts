import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { ApiProviderService } from '../../common/ai/api-provider.service.js';
import type { ApiNodiaAiCredentialsService } from '../../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import type { ApiNodiaAiRuntimeService } from '../../nodia-ai-adapter/api-nodia-ai-runtime.service.js';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiApiRuntimeTerminalProof } from '../../nodia-ai-runtime/types/reconciliation.types.js';
import type { NodiaAiInvoiceOcrExecution } from '../types/invoice-ocr-port.js';
import { ApiInvoiceOcrExecutor } from './api-invoice-ocr-executor.js';

vi.mock('../../config/envs.config.js', () => ({ envs: {} }));

function setup() {
  const attemptId = randomUUID(), buffer = Buffer.from('synthetic-original');
  const config = { providerKey: 'openai' as const, connectionId: '1', keyId: '2',
    configurationGeneration: 'a'.repeat(64), sessionGeneration: 'b'.repeat(32), resourceKey: 'api-connection:' + 'c'.repeat(64) };
  const selection = { connection_id: '1', mode: 'api_key' as const, model_id: 'fixture-discovered-api-model', effort_id: null };
  const proof: NodiaAiApiRuntimeTerminalProof = { engine: 'api_key', attemptId, operationRef: attemptId,
    resourceKey: config.resourceKey, sessionGeneration: config.sessionGeneration,
    adapterIdentity: { providerKey: 'openai', contractVersion: 'nodia-ai-api-chat/1', connectionId: '1' },
    terminalProofId: randomUUID(), outcome: 'completed', localTransportClosed: true, remoteOutcome: 'completed', observedAt: new Date() };
  const credentials = { configuration: vi.fn().mockResolvedValue(config), secret: vi.fn().mockResolvedValue('synthetic-not-a-real-key') };
  const runtime = { start: vi.fn().mockResolvedValue(proof), reserveExchange: vi.fn().mockResolvedValue(undefined), finish: vi.fn().mockResolvedValue(proof) };
  const extraction = { code: 'fixture', total_amount: 0, issue_date: null, items: [], raw_data: { invoice_total: 0 } };
  const api = { extractInvoice: vi.fn().mockResolvedValue(extraction) };
  const source = { attachment_id: randomUUID(), kind: 'pdf' as const, media_type: 'application/pdf',
    byte_count: buffer.length, buffer, file_name: 'synthetic.pdf', content_hash: createHash('sha256').update(buffer).digest('hex') };
  const input = { claim: { attempt: { id: attemptId } }, assertLease: vi.fn().mockResolvedValue(undefined),
    input: { business_id: '1', provider_id: '2' }, sources: [source], commercial: { providerFields: null, tax: null },
    selection, observation: { resourceKey: config.resourceKey, configurationGeneration: config.configurationGeneration, sessionGeneration: config.sessionGeneration },
    deadlineAt: new Date(Date.now() + 30000), signal: new AbortController().signal } as unknown as NodiaAiInvoiceOcrExecution;
  const executor = new ApiInvoiceOcrExecutor(credentials as unknown as ApiNodiaAiCredentialsService,
    runtime as unknown as ApiNodiaAiRuntimeService, api as unknown as ApiProviderService);
  return { executor, credentials, runtime, api, extraction, input, source, config, proof };
}

describe('API invoice OCR through the common chat stage', () => {
  it('keeps exact model/key, unknown tax and genuine zero while returning the ordinary review draft', async () => {
    const f = setup();
    const result = await f.executor.execute(f.input, f.source);
    expect(result.extraction.business_id).toBe('1');
    expect(result.extraction.provider_id).toBe('2');
    expect(result.extraction.total_amount).toBe(0);
    expect(result.extraction.data.invoice_total).toBe(0);
    expect(result.terminalProof).toBe(f.proof);
    expect(f.api.extractInvoice).toHaveBeenCalledWith('openai', 'synthetic-not-a-real-key', 'fixture-discovered-api-model',
      f.source.buffer, 'application/pdf', undefined, null, expect.any(AbortSignal), undefined);
    expect(f.runtime.reserveExchange).toHaveBeenCalledTimes(1);
    expect(f.runtime.finish).toHaveBeenCalledWith(expect.objectContaining({ selection: f.input.selection }), 'completed');
  });
  it('does not dispatch when the observed configuration has changed', async () => {
    const f = setup(); f.credentials.configuration.mockResolvedValue({ ...f.config, sessionGeneration: 'd'.repeat(32) });
    await expect(f.executor.execute(f.input, f.source)).rejects.toMatchObject({ code: 'adapter_configuration_changed' });
    expect(f.runtime.start).not.toHaveBeenCalled(); expect(f.api.extractInvoice).not.toHaveBeenCalled();
  });
  it('cannot spend a request after the durable HTTP budget rejects it', async () => {
    const f = setup(); f.runtime.reserveExchange.mockRejectedValue(Error('nodia_ai:execution_limit'));
    await expect(f.executor.execute(f.input, f.source)).rejects.toBeInstanceOf(NodiaAiAdapterError);
    expect(f.api.extractInvoice).not.toHaveBeenCalled();
    expect(f.runtime.finish).toHaveBeenCalledWith(expect.anything(), 'unknown');
  });
  it('closes a failed HTTP attempt without retrying extraction', async () => {
    const f = setup(); f.api.extractInvoice.mockRejectedValue(Error('synthetic response lost'));
    await expect(f.executor.execute(f.input, f.source)).rejects.toMatchObject({ outcome: 'unknown' });
    expect(f.api.extractInvoice).toHaveBeenCalledTimes(1);
    expect(f.runtime.finish).toHaveBeenCalledTimes(1);
    expect(f.runtime.finish).toHaveBeenCalledWith(expect.anything(), 'unknown');
  });
  it('does not overwrite a completed local closure when its database receipt write is lost', async () => {
    const f = setup(); f.runtime.finish.mockRejectedValue(Error('synthetic database response lost'));
    await expect(f.executor.execute(f.input, f.source)).rejects.toMatchObject({ outcome: 'unknown' });
    expect(f.runtime.finish).toHaveBeenCalledTimes(1);
    expect(f.runtime.finish).toHaveBeenCalledWith(expect.anything(), 'completed');
    expect(f.api.extractInvoice).toHaveBeenCalledTimes(1);
  });
  it('does not restart OCR if configuration changes after the returned draft', async () => {
    const f = setup(); f.credentials.configuration.mockResolvedValueOnce(f.config).mockResolvedValue({ ...f.config, configurationGeneration: 'd'.repeat(64) });
    await expect(f.executor.execute(f.input, f.source)).rejects.toMatchObject({ code: 'adapter_configuration_changed', outcome: 'unknown' });
    expect(f.api.extractInvoice).toHaveBeenCalledTimes(1); expect(f.runtime.finish).toHaveBeenCalledTimes(1);
  });
});
