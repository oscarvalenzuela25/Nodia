import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileNodiaAiToolSchema } from '../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';

const sourceJson = readFileSync(
  new URL('./contracts/invoice-ocr.json', import.meta.url),
  'utf8',
);
const { validate } = compileNodiaAiToolSchema({
  sourceJson,
  definition: 'InvoiceOcrResult',
  sha256: createHash('sha256').update(sourceJson).digest('hex'),
});
function result(mode: string, status: string) {
  const base = {
    status,
    analysis_id: 'b3e5e6f3-6de9-4c27-8509-2b9d01acf5ed',
    business_id: 'e42c1020-9d88-4b46-9517-c73727a50c05',
    provider_id: status === 'awaiting_supplier' ? null : '7',
    attachment_id: '326a38de-e042-4b40-8305-b10239dde721',
    compare_prices: false,
    review_required: true,
    comparison_observed_at: null,
    selection: {
      connection_id: '9007199254740993',
      mode,
      model_id: 'fixture-discovered-model',
      effort_id: null,
    },
    source: {
      attachment_id: '326a38de-e042-4b40-8305-b10239dde721',
      kind: 'pdf',
      media_type: 'application/pdf',
      byte_count: 43102,
    },
    ...(status !== 'awaiting_supplier'
      ? { request_id: 'a1990d09-5770-41bf-8c31-213596729fda' }
      : {}),
    ...(status === 'analyzed'
      ? {
          extraction: {
            code: 'SYNTHETIC',
            total_amount: 0,
            data: {
              issue_date: null,
              items: [
                {
                  name: 'Synthetic zero and unknown',
                  code: 'SYNTHETIC-0',
                  quantity: 0,
                  packages: null,
                  units_per_package: null,
                  cost_price: null,
                  cost_price_tax: null,
                  unit_price: 0,
                  total_price: 0,
                },
              ],
            },
          },
          comparison: null,
        }
      : {}),
  };
  return base;
}

describe('conversational OCR closed output modes', () => {
  it.each(['awaiting_supplier', 'requested', 'analyzed'])(
    'accepts both current modes in the actual %s output schema',
    (status) => {
      for (const mode of ['agentic', 'api_key'])
        expect(validate(result(mode, status))).toBe(true);
    },
  );
  it.each(['token_plan_web', 'token_plan_agentic', 'api', '', null])(
    'rejects retired or invented modes in every output variant (%s)',
    (mode) => {
      for (const status of ['awaiting_supplier', 'requested', 'analyzed']) {
        const value = result('api_key', status);
        value.selection.mode = mode as string;
        expect(validate(value)).toBe(false);
      }
    },
  );
  it('keeps nested selection/source and outer fields closed without exposing credentials', () => {
    const value = result('api_key', 'analyzed');
    for (const invalid of [
      { ...value, secret: 'synthetic' },
      { ...value, selection: { ...value.selection, api_key: 'synthetic' } },
      { ...value, source: { ...value.source, content_base64: 'synthetic' } },
    ])
      expect(validate(invalid)).toBe(false);
    expect(validate(value)).toBe(true);
    expect(value.extraction!.total_amount).toBe(0);
    expect(value.extraction!.data.items[0].cost_price).toBeNull();
  });
});
