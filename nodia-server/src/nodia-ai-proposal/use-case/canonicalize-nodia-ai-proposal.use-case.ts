import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { types } from 'node:util';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';

/** RFC 8785 JCS over JSON data, without calling getters, toJSON or coercions.
 * Domain validators remain responsible for money/identifier strings. */
@Injectable()
export class CanonicalizeNodiaAiProposalUseCase {
  constructor(
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  fromJson(text: string): string {
    if (Buffer.byteLength(text, 'utf8') > this.policy.admission.http_json_bytes)
      return this.invalid();
    try {
      return this.execute(parseNodiaAiStrictJson(text));
    } catch {
      return this.invalid();
    }
  }

  execute(value: unknown): string {
    const ancestors = new Set<object>();
    const chunks: string[] = [];
    let bytes = 0;
    const append = (text: string) => {
      bytes += Buffer.byteLength(text, 'utf8');
      if (bytes > this.policy.results.assembled_context_utf8_bytes)
        this.invalid();
      chunks.push(text);
    };
    const string = (text: string) => {
      // JSON.stringify would escape lone surrogates; JCS requires rejection.
      if (
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
          text,
        )
      )
        this.invalid();
      append(JSON.stringify(text));
    };
    const visit = (item: unknown, depth: number): void => {
      if (depth > this.policy.results.json_depth) this.invalid();
      if (item === null || typeof item === 'boolean') {
        append(JSON.stringify(item));
        return;
      }
      if (typeof item === 'string') {
        string(item);
        return;
      }
      if (typeof item === 'number' && Number.isFinite(item)) {
        append(JSON.stringify(item));
        return;
      }
      if (
        typeof item !== 'object' ||
        item === null ||
        types.isProxy(item) ||
        ancestors.has(item)
      )
        return this.invalid();
      const prototype: unknown = Object.getPrototypeOf(item);
      const array = Array.isArray(item);
      if (
        array
          ? prototype !== Array.prototype
          : prototype !== Object.prototype && prototype !== null
      )
        this.invalid();
      const descriptors = Object.getOwnPropertyDescriptors(item);
      const keys = Reflect.ownKeys(item);
      if (keys.some((key) => typeof key !== 'string')) this.invalid();
      const properties = Object.keys(descriptors).filter(
        (key) => !(array && key === 'length'),
      );
      if (properties.length > this.policy.results.json_collection_items)
        this.invalid();
      if (
        properties.some(
          (key) =>
            !descriptors[key].enumerable ||
            !Object.hasOwn(descriptors[key], 'value'),
        )
      )
        this.invalid();
      ancestors.add(item);
      if (array) {
        const length = descriptors.length.value as number;
        if (
          length !== properties.length ||
          properties.some((key, index) => key !== String(index))
        )
          this.invalid();
        append('[');
        properties.forEach((key, index) => {
          if (index) append(',');
          visit(descriptors[key].value, depth + 1);
        });
        append(']');
      } else {
        append('{');
        // Default JS sort compares raw UTF-16 code units, as required by JCS.
        properties.sort().forEach((key, index) => {
          if (index) append(',');
          string(key);
          append(':');
          visit(descriptors[key].value, depth + 1);
        });
        append('}');
      }
      ancestors.delete(item);
    };
    visit(value, 0);
    return chunks.join('');
  }

  private invalid(): never {
    throw new BadRequestException('nodia_ai:invalid_proposal');
  }
}
