import { Injectable, Inject, Optional } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import {
  NODIA_AI_REPORT_SOURCES,
  NODIA_AI_REPORT_SOURCES_VERSION,
} from '../config/report-sources.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiReportQueryError } from './compile-nodia-ai-report.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
export const NODIA_AI_PUBLISHED_REPORT_DOCUMENTS = Symbol(
  'NODIA_AI_PUBLISHED_REPORT_DOCUMENTS',
);

/** An explicit logical catalog; never an ORM/schema/endpoint introspector. */
@Injectable()
export class NodiaAiReportRegistryUseCase {
  readonly catalogVersion = NODIA_AI_REPORT_SOURCES_VERSION;
  private readonly sources = new Map(
    NODIA_AI_REPORT_SOURCES.map((source) => [source.sourceKey, source]),
  );
  private readonly validators: Record<'query' | 'describe', ValidateFunction>;
  constructor(
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Optional()
    @Inject(NODIA_AI_PUBLISHED_REPORT_DOCUMENTS)
    private readonly publishedDocuments: readonly string[] = [],
  ) {
    const schema = JSON.parse(
      readFileSync(
        new URL(
          '../../nodia-ai-tools/config/common-schema.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as NodiaAiJsonObject;
    const ajv = new Ajv2020({
      strict: true,
      allErrors: false,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
    });
    const formats = createRequire(import.meta.url)('ajv-formats') as (
      instance: Ajv2020,
    ) => void;
    formats(ajv);
    ajv.addSchema(schema);
    const query = ajv.getSchema(`${schema.$id}#/$defs/ReportQueryInput`);
    const describe = ajv.getSchema(`${schema.$id}#/$defs/ReportDescribeInput`);
    if (
      !query ||
      !describe ||
      this.sources.size !== NODIA_AI_REPORT_SOURCES.length
    )
      throw new Error('nodia_ai:report_registry_invalid');
    this.validators = { query, describe };
  }
  list() {
    return [...this.sources.values()];
  }
  isPublished(key: string) {
    const source = this.get(key);
    return (
      source.publicationDocumentId === undefined ||
      this.publishedDocuments.includes(source.publicationDocumentId)
    );
  }
  getPublished(key: string) {
    if (!this.isPublished(key))
      throw new NodiaAiReportQueryError('unsupported_semantics', 'source_key');
    return this.get(key);
  }
  get(key: string) {
    const source = this.sources.get(key);
    if (!source)
      throw new NodiaAiReportQueryError('unsupported_semantics', 'source_key');
    return source;
  }
  validate(kind: 'query' | 'describe', value: unknown): NodiaAiJsonObject {
    // Bound before AJV/serialization; reject accessors, cycles and non-JSON instances.
    let bytes = 0;
    const seen = new Set<object>();
    const inspect = (node: unknown, depth: number): void => {
      if (bytes > this.policy.results.tool_arguments_utf8_bytes) this.invalid();
      if (depth > this.policy.results.json_depth) this.invalid();
      if (node === null || typeof node === 'boolean') {
        bytes += 5;
        return;
      }
      if (typeof node === 'number') {
        if (!Number.isFinite(node)) this.invalid();
        bytes += 24;
        return;
      }
      if (typeof node === 'string') {
        bytes += Buffer.byteLength(node, 'utf8');
        if (bytes > this.policy.results.tool_arguments_utf8_bytes)
          this.invalid();
        return;
      }
      if (!node || typeof node !== 'object' || seen.has(node)) this.invalid();
      seen.add(node);
      if (
        !Array.isArray(node) &&
        Object.getPrototypeOf(node) !== Object.prototype
      )
        this.invalid();
      const descriptors = Object.getOwnPropertyDescriptors(node);
      const entries = Object.entries(descriptors).filter(
        ([key]) => !Array.isArray(node) || key !== 'length',
      );
      if (
        entries.length > this.policy.results.json_collection_items ||
        Object.getOwnPropertySymbols(node).length
      )
        this.invalid();
      for (const [key, descriptor] of entries) {
        if (!('value' in descriptor) || !descriptor.enumerable) this.invalid();
        bytes += Buffer.byteLength(key, 'utf8');
        if (bytes > this.policy.results.tool_arguments_utf8_bytes)
          this.invalid();
        inspect(descriptor.value, depth + 1);
      }
      seen.delete(node);
    };
    inspect(value, 0);
    if (!this.validators[kind](value)) this.invalid();
    const encoded = JSON.stringify(value);
    if (
      Buffer.byteLength(encoded, 'utf8') >
      this.policy.results.tool_arguments_utf8_bytes
    )
      this.invalid();
    return JSON.parse(encoded) as NodiaAiJsonObject;
  }
  private invalid(): never {
    throw new NodiaAiReportQueryError('invalid_input', 'report');
  }
}
