import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { BuildNodiaAiInvoiceOcrToolUseCase, invoiceOcrAuthorityFingerprint } from './build-nodia-ai-invoice-ocr-tool.use-case.js';
import { invoiceOcrRequestResult, ocrHash } from '../types/invoice-ocr-state.js';

function fixture(request = false) {
  const id = 'a1990d09-5770-41bf-8c31-213596729fda', preparationId = 'b3e5e6f3-6de9-4c27-8509-2b9d01acf5ed';
  const snapshot: NodiaAiJsonObject = { preparation_id: request ? preparationId : null, business_id: 'e42c1020-9d88-4b46-9517-c73727a50c05', provider_id: request ? '7' : null, compare_prices: true,
    selection: { connection_id: '1', mode: 'agentic', model_id: 'fixture-model', effort_id: null },
    provider_fields: { secret: 'must stay private' }, tax: request ? 0 : null,
    source: { attachment_id: '326a38de-e042-4b40-8305-b10239dde721', kind: 'image', media_type: 'image/png', byte_count: 12, content_hash: 'a'.repeat(64), file_name: 'private-name' } };
  const input: NodiaAiJsonObject = request ? { action: 'request', analysis_id: preparationId, provider_id: '7' } : { action: 'prepare', business_id: snapshot.business_id, attachment_id: (snapshot.source as NodiaAiJsonObject).attachment_id, compare_prices: true };
  const prep = Object.assign(new NodiaAiToolCall(), { id: preparationId, scope_manifest: {} });
  const receipt = Object.assign(new NodiaAiToolCall(), { id, tool_name: 'nodia_invoices_ocr', state: 'validated', arguments: input, scope_manifest: {} });
  const save = vi.fn(async (row: unknown) => row);
  const snapshots = { capture: vi.fn(async () => snapshot), preparation: vi.fn(async () => prep), anchor: vi.fn(async () => receipt), current: vi.fn(async () => snapshot), read: vi.fn(async (): Promise<NodiaAiJsonObject> => ({ status: 'awaiting_supplier' })) };
  const context = { attemptId: 'fixture-attempt', toolCallId: id, runId: 'fixture-run', conversationId: 'fixture-chat', manager: { getRepository: () => ({ findOneBy: async () => receipt, save }) } } as unknown as NodiaAiToolHandlerContext;
  const tool = new BuildNodiaAiInvoiceOcrToolUseCase(snapshots as never).execute()[0].capabilities[0];
  return { tool, context, input, prep, receipt, snapshots, snapshot, save };
}
function comparisonResult(f: ReturnType<typeof fixture>): NodiaAiJsonObject {
  return { ...invoiceOcrRequestResult(f.receipt.id, f.snapshot), status: 'analyzed',
    comparison_observed_at: '2026-10-26T05:00:00.000Z',
    extraction: { code: 'SYNTHETIC-OCR', total_amount: 0, data: { issue_date: null,
      items: [{ name: 'Synthetic row', code: 'SYNTHETIC-0', quantity: 0, packages: null, units_per_package: null,
        cost_price: 0, cost_price_tax: null, unit_price: null, total_price: 0 }] } },
    comparison: [{ index: 0, code: 'SYNTHETIC-0', name: 'Synthetic row', product_id: '17', match: 'unique',
      net: { previous: 5, current: 0, delta: -5, percent: -100, direction: 'down' },
      gross: { previous: null, current: null, delta: null, percent: null, direction: 'unknown' } }] };
}

describe('BuildNodiaAiInvoiceOcrToolUseCase', () => {
  it('accepts unchanged comparison data across 1ms revalidation reads and returns the initial observation time', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-26T05:00:00.000Z'));
      const f = fixture(true);
      const input = { action: 'read', analysis_id: f.prep.id, compare_prices: true };
      f.snapshots.read.mockImplementation(async () => ({
        ...comparisonResult(f), comparison_observed_at: new Date().toISOString(),
      }));
      const operation = await f.tool.external!.prepare(input, f.context);
      vi.advanceTimersByTime(1);
      await operation.verify(f.context);
      const result = await operation.execute(new AbortController().signal);
      vi.advanceTimersByTime(1);
      await f.tool.verifyResultAuthority!(input, result, f.context);
      expect(result.comparison_observed_at).toBe('2026-10-26T05:00:00.000Z');
      expect((result.extraction as NodiaAiJsonObject).total_amount).toBe(0);
      expect(f.snapshots.read).toHaveBeenCalledTimes(3);
      expect(f.save).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it.each(['price', 'provider', 'analysis', 'business', 'extraction', 'source', 'selection'])('rejects changed %s during comparison revalidation and result authority', async field => {
    const f = fixture(true), initial = comparisonResult(f);
    const input = { action: 'read', analysis_id: f.prep.id, compare_prices: true };
    f.snapshots.read.mockResolvedValue(initial);
    const operation = await f.tool.external!.prepare(input, f.context);
    const result = await operation.execute(new AbortController().signal);
    const changed: NodiaAiJsonObject = { ...initial, comparison_observed_at: '2026-10-26T05:00:00.001Z' };
    if (field === 'price') {
      const rows = initial.comparison as NodiaAiJsonObject[];
      changed.comparison = [{ ...rows[0], net: { ...(rows[0].net as NodiaAiJsonObject), current: 1, delta: -4, percent: -80 } }];
    } else if (field === 'provider') changed.provider_id = '8';
    else if (field === 'analysis') changed.analysis_id = f.receipt.id;
    else if (field === 'business') changed.business_id = f.receipt.id;
    else if (field === 'extraction') changed.extraction = { ...(initial.extraction as NodiaAiJsonObject), total_amount: 1 };
    else if (field === 'source') changed.source = { ...(initial.source as NodiaAiJsonObject), byte_count: 13 };
    else changed.selection = { ...(initial.selection as NodiaAiJsonObject), model_id: 'different-synthetic-model' };
    f.snapshots.read.mockResolvedValue(changed);
    await expect(operation.verify(f.context)).rejects.toThrow('request_conflict');
    await expect(f.tool.verifyResultAuthority!(input, result, f.context)).rejects.toThrow('invalid_tool_output');
    expect(result.comparison_observed_at).toBe(initial.comparison_observed_at);
    expect(f.save).not.toHaveBeenCalled();
  });
  it('retains strict observation-time checks for read without a fresh comparison', async () => {
    const f = fixture(true), initial = { ...comparisonResult(f), compare_prices: false };
    const input = { action: 'read', analysis_id: f.prep.id, compare_prices: false };
    f.snapshots.read.mockResolvedValue(initial);
    const operation = await f.tool.external!.prepare(input, f.context);
    const result = await operation.execute(new AbortController().signal);
    f.snapshots.read.mockResolvedValue({ ...initial, comparison_observed_at: '2026-10-26T05:00:00.001Z' });
    await expect(operation.verify(f.context)).rejects.toThrow('request_conflict');
    await expect(f.tool.verifyResultAuthority!(input, result, f.context)).rejects.toThrow('invalid_tool_output');
  });
  it('excludes only the fresh read top-level clock while preserving source hashes, nested fields and other actions', () => {
    const input = { action: 'read', compare_prices: true };
    const initial = { comparison_observed_at: '2026-10-26T05:00:00.000Z',
      source: { content_hash: 'a'.repeat(64), comparison_observed_at: 'nested-data' }, cost: 0, unknown: null };
    const later = { ...initial, comparison_observed_at: '2026-10-26T05:00:00.001Z' };
    expect(invoiceOcrAuthorityFingerprint(input, initial)).toBe(invoiceOcrAuthorityFingerprint(input, later));
    for (const changed of [{ ...later, cost: null }, { ...later, unknown: 0 },
      { ...later, source: { ...initial.source, content_hash: 'b'.repeat(64) } },
      { ...later, source: { ...initial.source, comparison_observed_at: 'other-nested-data' } }])
      expect(invoiceOcrAuthorityFingerprint(input, initial)).not.toBe(invoiceOcrAuthorityFingerprint(input, changed));
    for (const strict of [{ action: 'prepare', compare_prices: true }, { action: 'request', compare_prices: true },
      { action: 'read', compare_prices: false }, { action: 'read' }])
      expect(invoiceOcrAuthorityFingerprint(strict, initial)).not.toBe(invoiceOcrAuthorityFingerprint(strict, later));
    expect(initial.comparison_observed_at).toBe('2026-10-26T05:00:00.000Z');
  });
  it('prepares a durable supplier question without exposing original/config/commercial private fields', async () => {
    const f = fixture(), operation = await f.tool.external!.prepare(f.input, f.context);
    const result = await operation.execute(new AbortController().signal);
    expect(result.status).toBe('awaiting_supplier'); expect(result.analysis_id).toBe(f.context.toolCallId); expect(result.provider_id).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/must stay private|private-name|content_hash|provider_fields|tax/);
    expect(f.save).not.toHaveBeenCalled();
    await operation.verify(f.context); await f.tool.verifyResultAuthority!(f.input, result, f.context);
    expect(f.receipt.scope_manifest.invoice_ocr_request_hash).toBe(ocrHash(result));
    expect(f.receipt.scope_manifest.invoice_ocr_snapshot).toEqual(f.snapshot);
    expect(f.prep.scope_manifest.invoice_ocr_consumed_by).toBeUndefined();
  });
  it('binds stable analysis ID and atomically consumes its preparation for one request ID', async () => {
    const f = fixture(true), operation = await f.tool.external!.prepare(f.input, f.context);
    const result = await operation.execute(new AbortController().signal);
    expect(result.status).toBe('requested'); expect(result.analysis_id).toBe(f.prep.id); expect(result.request_id).toBe(f.receipt.id);
    await f.tool.verifyResultAuthority!(f.input, result, f.context);
    expect(f.prep.scope_manifest.invoice_ocr_consumed_by).toBe(f.receipt.id);
    expect(f.snapshots.preparation).toHaveBeenCalledWith(f.prep.id, f.context, true);
  });
  it('rejects a second consumer under the preparation lock', async () => {
    const f = fixture(true), operation = await f.tool.external!.prepare(f.input, f.context), result = await operation.execute(new AbortController().signal);
    f.prep.scope_manifest.invoice_ocr_consumed_by = 'other-request';
    await expect(f.tool.verifyResultAuthority!(f.input, result, f.context)).rejects.toThrow('already_requested'); expect(f.save).not.toHaveBeenCalled();
  });
  it.each([{ action: 'request', analysis_id: 'a1990d09-5770-41bf-8c31-213596729fda' }, { action: 'request', analysis_id: 'a1990d09-5770-41bf-8c31-213596729fda', provider_id: null }, { action: 'prepare', business_id: 'e42c1020-9d88-4b46-9517-c73727a50c05', attachment_id: '326a38de-e042-4b40-8305-b10239dde721', provider_id: '7' }])('rejects implicit or misplaced supplier input %#', async input => {
    const f = fixture(); await expect(f.tool.external!.prepare(input as unknown as NodiaAiJsonObject, f.context)).rejects.toThrow('invalid_tool_input'); expect(f.snapshots.capture).not.toHaveBeenCalled();
  });
  it('rejects a changed snapshot between prepare and local verification', async () => {
    const f = fixture(), operation = await f.tool.external!.prepare(f.input, f.context);
    f.snapshots.capture.mockResolvedValue({ ...f.snapshot, tax: 99 });
    await expect(operation.verify(f.context)).rejects.toThrow('request_conflict'); expect(f.save).not.toHaveBeenCalled();
  });
  it('does not execute even the pure external step after cancellation', async () => {
    const f = fixture(), operation = await f.tool.external!.prepare(f.input, f.context), abort = new AbortController(); abort.abort();
    await expect(operation.execute(abort.signal)).rejects.toThrow(); expect(f.save).not.toHaveBeenCalled();
  });
});
