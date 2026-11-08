import { describe, expect, it } from 'vitest';
import { invoiceOcrDiscoveryHint } from './invoice-ocr-discovery-hint.js';
import { BuildNodiaAiContextUseCase } from '../use-case/build-nodia-ai-context.use-case.js';
import type { LoadNodiaAiKnowledgeUseCase } from '../use-case/load-nodia-ai-knowledge.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';

const ids = [
  'nodia_invoices_ocr',
  'nodia_businesses_list',
  'nodia_providers_list',
  'nodia_providers_get',
];
const fixture = () => ({
  schema_version: 1,
  catalog_version: 'synthetic-public-catalog/27',
  catalog_hash: 'a'.repeat(64),
  selection_required: true,
  modules: [
    {
      module_key: 'businesses',
      resources: [
        {
          resource_key: 'synthetic',
          capabilities: ids.map((id) => ({
            capability_id: id,
            tool_name: id,
            kind: id === 'nodia_invoices_ocr' ? 'prepare_workflow' : 'read',
            description: 'Synthetic public metadata.',
          })),
        },
      ],
    },
  ],
});
const hint = (index: unknown) =>
  invoiceOcrDiscoveryHint({
    capabilityIndex: index,
    phase: 'discovery',
    hasInvoiceOcrReferences: true,
  });
const recovery = (state_hint = 'awaiting_supplier') => ({
  schema_version: 1,
  more: false,
  references: [
    {
      analysis_id: '11111111-1111-4111-8111-111111111111',
      business_id: '22222222-2222-4222-8222-222222222222',
      attachment_id: '33333333-3333-4333-8333-333333333333',
      source_message_seq: '1',
      provider_id: null as string | null,
      state_hint,
    },
  ],
});

describe('invoiceOcrDiscoveryHint', () => {
  it('uses the current version/hash without granting execution', () => {
    const index = fixture();
    index.catalog_version = 'another-dynamic-release/99';
    expect(hint(index)).toEqual({
      schema_version: 1,
      purpose: 'invoice_ocr_discovery_metadata_only',
      selection_tool: 'nodia_capabilities_select',
      catalog_version: index.catalog_version,
      catalog_hash: index.catalog_hash,
      candidate_capability_ids: ids,
      grants_execution: false,
    });
  });
  it.each(['execution', 'selection_requested', undefined, null])(
    'omits metadata outside discovery (%s)',
    (phase) => {
      expect(
        invoiceOcrDiscoveryHint({
          capabilityIndex: fixture(),
          phase,
          hasInvoiceOcrReferences: true,
        }),
      ).toBeUndefined();
    },
  );
  it('requires both OCR references and the current index', () => {
    expect(
      invoiceOcrDiscoveryHint({
        capabilityIndex: fixture(),
        phase: 'discovery',
        hasInvoiceOcrReferences: false,
      }),
    ).toBeUndefined();
    expect(hint(undefined)).toBeUndefined();
    expect(hint(null)).toBeUndefined();
  });
  it.each(['awaiting_supplier', 'stored_result'])(
    'supports reauthorized %s follow-ups without a new attachment or exposing reference IDs',
    (state) => {
      const refs = recovery(state),
        before = JSON.stringify(refs);
      if (state === 'stored_result') refs.references[0].provider_id = '7';
      const stable = JSON.stringify(refs);
      const result = invoiceOcrDiscoveryHint({
        capabilityIndex: fixture(),
        phase: 'discovery',
        hasInvoiceOcrReferences: false,
        recoveryInvoiceOcrReferences: refs,
      });
      expect(result).toEqual(hint(fixture()));
      expect(JSON.stringify(refs)).toBe(stable);
      for (const value of [
        refs.references[0].analysis_id,
        refs.references[0].business_id,
        refs.references[0].attachment_id,
      ])
        expect(JSON.stringify(result)).not.toContain(value);
      expect(before).toContain(state);
    },
  );
  it.each(['unknown', 'failed', 'cancelled', 'requested'])(
    'does not suggest a new OCR path for only %s references',
    (state) => {
      expect(
        invoiceOcrDiscoveryHint({
          capabilityIndex: fixture(),
          phase: 'discovery',
          hasInvoiceOcrReferences: false,
          recoveryInvoiceOcrReferences: recovery(state),
        }),
      ).toBeUndefined();
    },
  );
  it('does not choose among multiple compatible references or enable absent capabilities', () => {
    const refs = recovery();
    refs.references.push({
      ...refs.references[0],
      analysis_id: '44444444-4444-4444-8444-444444444444',
    });
    expect(
      invoiceOcrDiscoveryHint({
        capabilityIndex: fixture(),
        phase: 'discovery',
        hasInvoiceOcrReferences: false,
        recoveryInvoiceOcrReferences: refs,
      }),
    ).toEqual(hint(fixture()));
    const missing = fixture();
    missing.modules[0].resources[0].capabilities.pop();
    expect(
      invoiceOcrDiscoveryHint({
        capabilityIndex: missing,
        phase: 'discovery',
        hasInvoiceOcrReferences: false,
        recoveryInvoiceOcrReferences: refs,
      }),
    ).toBeUndefined();
  });
  it('omits malformed, duplicate and oversized recovery projections', () => {
    const badProvider = recovery();
    badProvider.references[0].provider_id = '0';
    const duplicate = recovery();
    duplicate.references.push({ ...duplicate.references[0] });
    for (const refs of [
      null,
      { ...recovery(), extra: true },
      badProvider,
      duplicate,
      { ...recovery(), references: Array(51).fill(recovery().references[0]) },
    ]) {
      expect(
        invoiceOcrDiscoveryHint({
          capabilityIndex: fixture(),
          phase: 'discovery',
          hasInvoiceOcrReferences: false,
          recoveryInvoiceOcrReferences: refs,
        }),
      ).toBeUndefined();
    }
  });
  it.each(ids)('does not advertise absent or revoked capability %s', (id) => {
    const index = fixture();
    index.modules[0].resources[0].capabilities =
      index.modules[0].resources[0].capabilities.filter(
        (v) => v.capability_id !== id,
      );
    expect(hint(index)).toBeUndefined();
  });
  it('rejects ambiguous IDs, tool names and grouping paths', () => {
    const id = fixture();
    id.modules[0].resources[0].capabilities.push({
      ...id.modules[0].resources[0].capabilities[0],
      tool_name: 'nodia_other_tool',
    });
    expect(hint(id)).toBeUndefined();
    const tool = fixture();
    tool.modules[0].resources[0].capabilities[1].tool_name = ids[0];
    expect(hint(tool)).toBeUndefined();
    const module = fixture();
    module.modules.push(structuredClone(module.modules[0]));
    expect(hint(module)).toBeUndefined();
    const resource = fixture();
    resource.modules[0].resources.push(
      structuredClone(resource.modules[0].resources[0]),
    );
    expect(hint(resource)).toBeUndefined();
  });
  it.each([
    (v: ReturnType<typeof fixture>) => ({ ...v, catalog_version: '' }),
    (v: ReturnType<typeof fixture>) => ({ ...v, catalog_hash: 'invalid' }),
    (v: ReturnType<typeof fixture>) => ({ ...v, selection_required: false }),
    (v: ReturnType<typeof fixture>) => ({
      ...v,
      extra: 'not part of the contract',
    }),
    (v: ReturnType<typeof fixture>) => ({
      ...v,
      modules: [{ module_key: 'businesses', resources: 'invalid' }],
    }),
  ])('omits malformed metadata instead of partial candidates', (change) => {
    expect(hint(change(fixture()))).toBeUndefined();
  });
  it('preserves a frozen index and does not share returned candidate arrays', () => {
    const index = fixture(),
      before = JSON.stringify(index);
    for (const c of index.modules[0].resources[0].capabilities)
      Object.freeze(c);
    Object.freeze(index.modules[0].resources[0].capabilities);
    Object.freeze(index.modules[0].resources[0]);
    Object.freeze(index.modules[0].resources);
    Object.freeze(index.modules[0]);
    Object.freeze(index.modules);
    Object.freeze(index);
    const first = hint(index)!;
    (first.candidate_capability_ids as string[]).pop();
    expect(hint(index)?.candidate_capability_ids).toEqual(ids);
    expect(JSON.stringify(index)).toBe(before);
  });
  it('integrates metadata while preserving the entire index and unrelated capabilities byte for byte', () => {
    const index = fixture();
    index.modules[0].resources[0].capabilities.push({
      capability_id: 'nodia_other_read',
      tool_name: 'nodia_other_read',
      kind: 'read',
      description: 'Synthetic unrelated capability remains available.',
    });
    const bytes = JSON.stringify(index);
    const knowledge = {
      index: () => [],
      execute: () => ({
        releaseId: 'b'.repeat(64),
        catalogVersion: index.catalog_version,
        fragments: [],
      }),
    } as unknown as LoadNodiaAiKnowledgeUseCase;
    const policy = {
      results: {
        assembled_context_utf8_bytes: 262144,
        assistant_text_utf8_bytes: 32768,
        json_collection_items: 128,
      },
      budget: { tool_calls_per_run: 12 },
    } as NodiaAiRuntimePolicy;
    const input = {
      moduleRoutes: [],
      history: [
        {
          seq: '1',
          role: 'user',
          scope: { schema_version: 1, module_routes: [] },
          parts: [
            {
              kind: 'image',
              text: null,
              attachment_id: 'synthetic-attachment',
            },
          ],
        },
      ],
      throughSeq: '1',
      mode: 'agentic',
      invoiceOcrReferenceIds: ['synthetic-attachment'],
      capabilityIndex: index,
      toolSelection: {
        schema_version: 1,
        phase: 'discovery',
        catalog_hash: index.catalog_hash,
      },
    };
    const result = new BuildNodiaAiContextUseCase(knowledge, policy).execute(
        input,
      ),
      prompt = JSON.parse(result.prompt);
    expect(prompt.invoice_ocr_discovery_hint).toEqual(hint(index));
    expect(JSON.stringify(prompt.capability_index)).toBe(bytes);
    expect(JSON.stringify(index)).toBe(bytes);
    expect(prompt.instructions).toContain(
      'no una selección, permiso ni ejecución',
    );
    expect(result.manifest.context_bytes).toBe(
      Buffer.byteLength(result.prompt),
    );
    const api = JSON.parse(
      new BuildNodiaAiContextUseCase(knowledge, policy).execute({
        ...input,
        mode: 'api_key',
      }).prompt,
    );
    expect(api.invoice_ocr_discovery_hint).toEqual(hint(index));
    expect(JSON.stringify(api.capability_index)).toBe(bytes);
    const followup = {
      ...input,
      history: [],
      invoiceOcrReferenceIds: [],
      recoveryRefs: { invoice_ocr_references: recovery('stored_result') },
    };
    const next = JSON.parse(
      new BuildNodiaAiContextUseCase(knowledge, policy).execute(followup)
        .prompt,
    );
    expect(next.invoice_ocr_discovery_hint).toEqual(hint(index));
    expect(next.recovery_refs).toEqual(followup.recoveryRefs);
  });
});
