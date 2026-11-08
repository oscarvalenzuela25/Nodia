import { describe, expect, it, vi } from 'vitest';
import { NodiaAiReportRegistryUseCase } from './nodia-ai-report-registry.use-case.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { NODIA_AI_REPORT_SOURCES_VERSION } from '../config/report-sources.js';

const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
  policyEnvelope(),
);
const registry = new NodiaAiReportRegistryUseCase(policy);
describe('new report publication gates', () => {
  it('keeps native sale mappings private until the exact functional document is compiled and published', () => {
    expect(registry.get('business_sales').sourceKey).toBe('business_sales');
    expect(registry.isPublished('business_sales')).toBe(false);
    expect(() => registry.getPublished('business_sale_items')).toThrow(
      'nodia_ai:unsupported_semantics',
    );
    const published = new NodiaAiReportRegistryUseCase(policy, [
      'businesses.point-of-sale-and-sales',
    ]);
    expect(published.isPublished('business_sales')).toBe(true);
    expect(published.isPublished('business_sale_items')).toBe(true);
  });
});
const query = () => ({
  catalog_version: registry.catalogVersion,
  combine: 'separate',
  sources: [
    {
      source_key: 'business_products',
      alias: 'products',
      scope: {},
      measures: [
        { measure_key: 'records', aggregation: 'count', output_key: 'count' },
      ],
      filters: {
        all: [
          { field_key: 'stock', operator: 'gte', value: 0 },
          { field_key: 'is_active', operator: 'eq', value: false },
        ],
      },
    },
  ],
});

describe('NodiaAiReportRegistryUseCase', () => {
  it('exposes a versioned immutable whitelist without deriving ORM properties', () => {
    expect(registry.catalogVersion).toBe(NODIA_AI_REPORT_SOURCES_VERSION);
    expect(registry.catalogVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(registry.list()).toHaveLength(13);
    const source = registry.get('business_invoices');
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.fields)).toBe(true);
    expect(
      source.descriptor.fields.some((field) => field.field_key === 'data'),
    ).toBe(false);
    expect(
      source.descriptor.measures.find(
        (measure) => measure.measure_key === 'invoice_amount',
      ),
    ).toMatchObject({ supported: false, currency: null });
    expect(JSON.stringify(source.descriptor)).not.toMatch(
      /fromSql|expressionSql|SELECT|JOIN|total_amount/,
    );
    expect(() => registry.get('users')).toThrow(
      'nodia_ai:unsupported_semantics',
    );
    const copy = registry.list();
    copy.pop();
    expect(registry.list()).toHaveLength(13);
  });
  it('preserves zero and false and returns a detached JSON command', () => {
    const input = query();
    const result = registry.validate('query', input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    input.sources[0].alias = 'changed';
    expect((result.sources as { alias: string }[])[0].alias).toBe('products');
  });
  it.each([
    undefined,
    new Date(),
    new Map(),
    1n,
    Number.NaN,
    Infinity,
    () => 1,
  ])('rejects non-JSON input %s', (value) => {
    expect(() => registry.validate('describe', { module_keys: value })).toThrow(
      'nodia_ai:invalid_input',
    );
  });
  it('rejects an accessor without invoking it', () => {
    const getter = vi.fn(() => []);
    const value = Object.defineProperty({}, 'module_keys', {
      get: getter,
      enumerable: true,
    });
    expect(() => registry.validate('describe', value)).toThrow(
      'nodia_ai:invalid_input',
    );
    expect(getter).not.toHaveBeenCalled();
  });
  it('rejects cycles, symbol properties and non-enumerable payloads', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const symbol = { [Symbol('hidden')]: 'data' };
    const hidden = Object.defineProperty({}, 'module_keys', {
      value: [],
      enumerable: false,
    });
    for (const value of [cycle, symbol, hidden])
      expect(() => registry.validate('describe', value)).toThrow(
        'nodia_ai:invalid_input',
      );
  });
  it('rejects excessive depth, collection count and UTF-8 size before schema serialization', () => {
    let nested: unknown = false;
    for (let depth = 0; depth <= policy.results.json_depth; depth++)
      nested = { child: nested };
    expect(() => registry.validate('describe', nested)).toThrow(
      'nodia_ai:invalid_input',
    );
    expect(() =>
      registry.validate('describe', {
        module_keys: Array(policy.results.json_collection_items + 1).fill(
          'businesses',
        ),
      }),
    ).toThrow('nodia_ai:invalid_input');
    expect(() =>
      registry.validate('describe', {
        module_keys: ['é'.repeat(policy.results.tool_arguments_utf8_bytes)],
      }),
    ).toThrow('nodia_ai:invalid_input');
  });
  it.each(['sql', 'table', 'url', 'join'])(
    'rejects unregistered command property %s',
    (key) => {
      expect(() =>
        registry.validate('query', { ...query(), [key]: 'untrusted' }),
      ).toThrow('nodia_ai:invalid_input');
    },
  );
  it('does not coerce schema scalars or strip unknown nested properties', () => {
    expect(() =>
      registry.validate('query', { ...query(), page_limit: '10' }),
    ).toThrow('nodia_ai:invalid_input');
    const input = query();
    Object.assign(input.sources[0].scope, { user_id: '1' });
    expect(() => registry.validate('query', input)).toThrow(
      'nodia_ai:invalid_input',
    );
  });
});
