import { describe, expect, it } from 'vitest';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { DecodeNodiaAiWriteJsonUseCase } from './decode-nodia-ai-write-json.use-case.js';

const decode = new DecodeNodiaAiWriteJsonUseCase();
describe('DecodeNodiaAiWriteJsonUseCase', () => {
  it('decodes explicitly typed roots, preserving null, false, zero, empty strings and nested collections', () => {
    expect(decode.execute({ kind: 'null' }, 128)).toBeNull();
    expect(decode.execute({ kind: 'boolean', value: false }, 128)).toBe(false);
    expect(decode.execute({ kind: 'number', value: 0 }, 128)).toBe(0);
    expect(decode.execute({ kind: 'string', value: '' }, 128)).toBe('');
    const wire: NodiaAiJsonObject = {
      kind: 'object',
      fields: [
        { key: 'enabled', value: { kind: 'boolean', value: false } },
        {
          key: 'items',
          value: {
            kind: 'array',
            items: [
              { kind: 'null' },
              { kind: 'number', value: 0 },
              { kind: 'string', value: '9223372036854775807' },
            ],
          },
        },
      ],
    };
    const before = structuredClone(wire);
    expect(decode.execute(wire, 128)).toEqual({
      enabled: false,
      items: [null, 0, '9223372036854775807'],
    });
    expect(wire).toEqual(before);
  });
  it.each([
    null,
    [],
    'text',
    1,
    true,
    {},
    { kind: 'unknown', value: 1 },
    { kind: 'null', value: null },
    { kind: 'string', value: null },
    { kind: 'number', value: '1' },
    { kind: 'boolean', value: 0 },
    { kind: 'number', value: Number.NaN },
    { kind: 'number', value: Number.POSITIVE_INFINITY },
    { kind: 'array', items: {} },
    { kind: 'object', fields: {} },
    { kind: 'string', value: 'text', sql: 'SELECT 1' },
  ])('rejects malformed or untagged input %#', (value) => {
    expect(() => decode.execute(value as NodiaAiJsonValue, 128)).toThrow(
      'nodia_ai:invalid_tool_input',
    );
  });
  it('rejects duplicate object keys and malformed fields instead of silently replacing values', () => {
    const value = { kind: 'string', value: 'first' };
    for (const fields of [
      [
        { key: 'x', value },
        { key: 'x', value },
      ],
      [{ key: 'x' }],
      [{ key: 1, value }],
      [{ key: 'x', value, extra: true }],
      [null],
      [[]],
    ])
      expect(() => decode.execute({ kind: 'object', fields }, 128)).toThrow(
        'nodia_ai:invalid_tool_input',
      );
  });
  it('treats prototype names as inert JSON data without modifying Object.prototype', () => {
    const before = Object.getOwnPropertyDescriptors(Object.prototype);
    const result = decode.execute(
      {
        kind: 'object',
        fields: [
          {
            key: '__proto__',
            value: {
              kind: 'object',
              fields: [
                { key: 'polluted', value: { kind: 'boolean', value: true } },
              ],
            },
          },
          { key: 'constructor', value: { kind: 'string', value: 'data' } },
          { key: 'prototype', value: { kind: 'null' } },
        ],
      },
      128,
    );
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(JSON.parse(JSON.stringify(result))).toEqual(
      JSON.parse(
        '{"__proto__":{"polluted":true},"constructor":"data","prototype":null}',
      ),
    );
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(before);
  });
  it('enforces collection and depth limits at every nested value', () => {
    expect(
      decode.execute(
        {
          kind: 'array',
          items: Array.from({ length: 128 }, () => ({ kind: 'null' })),
        },
        128,
      ),
    ).toHaveLength(128);
    expect(() =>
      decode.execute(
        {
          kind: 'array',
          items: Array.from({ length: 129 }, () => ({ kind: 'null' })),
        },
        128,
      ),
    ).toThrow('nodia_ai:invalid_tool_input');
    expect(() =>
      decode.execute(
        {
          kind: 'object',
          fields: Array.from({ length: 129 }, (_, i) => ({
            key: String(i),
            value: { kind: 'null' },
          })),
        },
        128,
      ),
    ).toThrow('nodia_ai:invalid_tool_input');
    let nested: NodiaAiJsonValue = { kind: 'null' };
    for (let depth = 0; depth < 8; depth++)
      nested = { kind: 'array', items: [nested] };
    expect(() => decode.execute(nested, 128)).not.toThrow();
    expect(() =>
      decode.execute({ kind: 'array', items: [nested] }, 128),
    ).toThrow('nodia_ai:invalid_tool_input');
    expect(() =>
      decode.execute(
        {
          kind: 'object',
          fields: [
            {
              key: 'nested',
              value: {
                kind: 'array',
                items: [{ kind: 'null' }, { kind: 'null' }],
              },
            },
          ],
        },
        1,
      ),
    ).toThrow('nodia_ai:invalid_tool_input');
  });
});
