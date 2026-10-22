import { readFileSync } from 'node:fs';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { CanonicalizeNodiaAiProposalUseCase } from './canonicalize-nodia-ai-proposal.use-case.js';

const policy = JSON.parse(
  readFileSync(
    new URL(
      '../../nodia-ai-runtime/config/runtime-policy.json',
      import.meta.url,
    ),
    'utf8',
  ),
).policy as NodiaAiRuntimePolicy;
const canonical = new CanonicalizeNodiaAiProposalUseCase(policy);

describe('proposal JCS integrity (RFC 8785)', () => {
  it('rejects proxies before executing object reflection traps', () => {
    const trap = vi.fn(() => Object.prototype);
    expect(() =>
      canonical.execute(new Proxy({}, { getPrototypeOf: trap })),
    ).toThrow('nodia_ai:invalid_proposal');
    expect(trap).not.toHaveBeenCalled();
  });
  it('sorts UTF-16 property names recursively without sorting arrays or normalizing Unicode', () => {
    const value = {
      '\u20ac': 'euro',
      '\r': 'return',
      '\ufb33': 'hebrew',
      '1': 'one',
      '\ud83d\ude00': 'emoji',
      '\u0080': 'control',
      '\u00f6': 'latin',
    };
    expect(canonical.execute(value)).toBe(
      '{"\\r":"return","1":"one","\u0080":"control","\u00f6":"latin","\u20ac":"euro","\ud83d\ude00":"emoji","\ufb33":"hebrew"}',
    );
    expect(
      canonical.execute({ z: [{ b: 1, a: 2 }, 0], a: '\u0065\u0301' }),
    ).toBe('{"a":"é","z":[{"a":2,"b":1},0]}');
    expect(canonical.execute({ '2': 2, '10': 10 })).toBe('{"10":10,"2":2}');
  });

  // RFC 8785 Appendix B: input is the exact IEEE-754 bit pattern, not a parsed decimal approximation.
  it.each([
    ['0000000000000000', '0'],
    ['8000000000000000', '0'],
    ['0000000000000001', '5e-324'],
    ['8000000000000001', '-5e-324'],
    ['7fefffffffffffff', '1.7976931348623157e+308'],
    ['ffefffffffffffff', '-1.7976931348623157e+308'],
    ['4340000000000000', '9007199254740992'],
    ['c340000000000000', '-9007199254740992'],
    ['4430000000000000', '295147905179352830000'],
    ['44b52d02c7e14af5', '9.999999999999997e+22'],
    ['44b52d02c7e14af6', '1e+23'],
    ['44b52d02c7e14af7', '1.0000000000000001e+23'],
    ['444b1ae4d6e2ef4e', '999999999999999700000'],
    ['444b1ae4d6e2ef4f', '999999999999999900000'],
    ['444b1ae4d6e2ef50', '1e+21'],
    ['3eb0c6f7a0b5ed8c', '9.999999999999997e-7'],
    ['3eb0c6f7a0b5ed8d', '0.000001'],
    ['41b3de4355555553', '333333333.3333332'],
    ['41b3de4355555554', '333333333.33333325'],
    ['41b3de4355555555', '333333333.3333333'],
    ['41b3de4355555556', '333333333.3333334'],
    ['41b3de4355555557', '333333333.33333343'],
    ['becbf647612f3696', '-0.0000033333333333333333'],
    ['43143ff3c1cb0959', '1424953923781206.2'],
  ])('serializes IEEE754 %s as %s', (hex, output) => {
    expect(canonical.execute(Buffer.from(hex, 'hex').readDoubleBE())).toBe(
      output,
    );
  });

  it('escapes control characters and preserves bigint/amount/date strings exactly', () => {
    expect(
      canonical.execute({
        x: '\u000f\n"\\/',
        amount: '9223372036854775807',
        date: '2026-10-16T00:00:00Z',
      }),
    ).toBe(
      '{"amount":"9223372036854775807","date":"2026-10-16T00:00:00Z","x":"\\u000f\\n\\"\\\\/"}',
    );
  });

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1n,
    new Date(),
    () => 1,
    Symbol('x'),
    '\ud800',
    '\udc00',
    { ['\udfff']: 1 },
    { x: undefined },
    [undefined],
    Array(1),
  ])('rejects non-JSON or invalid Unicode value %#', (value) => {
    expect(() => canonical.execute(value)).toThrow('nodia_ai:invalid_proposal');
  });

  it('rejects cycles, accessors, hidden properties, symbols, augmented arrays and toJSON without executing code', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const getter = vi.fn(() => 'secret');
    const toJSON = vi.fn(() => 'changed');
    for (const value of [
      cycle,
      Object.defineProperty({}, 'x', { enumerable: true, get: getter }),
      Object.defineProperty({}, 'x', { value: 1 }),
      { [Symbol('x')]: 1 },
      Object.assign([1], { x: 2 }),
      { toJSON },
    ])
      expect(() => canonical.execute(value)).toThrow(
        'nodia_ai:invalid_proposal',
      );
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('rejects duplicate raw keys including escaped aliases and nonfinite JSON numbers', () => {
    for (const raw of [
      '{"a":1,"a":2}',
      '{"a":1,"\\u0061":2}',
      '{"x":1e999}',
      '{"x":1} trailing',
    ])
      expect(() => canonical.fromJson(raw)).toThrow(
        'nodia_ai:invalid_proposal',
      );
    expect(canonical.fromJson('{"__proto__":{"x":1},"a":false}')).toBe(
      '{"__proto__":{"x":1},"a":false}',
    );
  });

  it('applies existing runtime byte, depth and cardinality limits without mutating data', () => {
    const object = Object.freeze({ z: Object.freeze([false, null, 0]), a: '' });
    expect(canonical.execute(object)).toBe('{"a":"","z":[false,null,0]}');
    expect(() =>
      canonical.execute(
        Array.from(
          { length: policy.results.json_collection_items + 1 },
          () => 0,
        ),
      ),
    ).toThrow();
    expect(() =>
      canonical.execute(
        'x'.repeat(policy.results.assembled_context_utf8_bytes),
      ),
    ).toThrow();
    expect(() =>
      canonical.fromJson(' '.repeat(policy.admission.http_json_bytes + 1)),
    ).toThrow();
    let deep: unknown = 0;
    for (let i = 0; i <= policy.results.json_depth; i++) deep = { deep };
    expect(() => canonical.execute(deep)).toThrow();
  });
});
