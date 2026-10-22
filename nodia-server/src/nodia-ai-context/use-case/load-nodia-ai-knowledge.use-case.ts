import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { createRequire } from 'node:module';
import {
  NODIA_AI_KNOWLEDGE_ROOT,
  NODIA_AI_KNOWLEDGE_PIN,
  NODIA_AI_KNOWLEDGE_SCHEMA,
  NODIA_AI_REGISTERED_CAPABILITIES,
} from '../types/knowledge.types.js';
import type {
  KnowledgePin,
  KnowledgeManifest,
  KnowledgeRegisteredCapability,
} from '../types/knowledge.types.js';
import { parseNodiaAiStrictJson } from '../strict-json.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';

export function canonicalKnowledge(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalKnowledge).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${canonicalKnowledge(item)}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
export const knowledgeHash = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');
const fail = (): never => {
  throw new Error('nodia_ai:knowledge_release_invalid');
};
function freezeKnowledge<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeKnowledge(child);
    Object.freeze(value);
  }
  return value;
}

/** Loads only compiled assets; authorization is checked before touching fragment bytes. */
@Injectable()
export class LoadNodiaAiKnowledgeUseCase {
  readonly manifest: Readonly<KnowledgeManifest>;
  private readonly root: string;
  private readonly cache = new Map<string, string>();
  private cachedBytes = 0;
  constructor(
    @Inject(NODIA_AI_KNOWLEDGE_ROOT) root: string,
    @Inject(NODIA_AI_KNOWLEDGE_PIN) pin: KnowledgePin,
    @Inject(NODIA_AI_KNOWLEDGE_SCHEMA) schema: Buffer,
    @Inject(NODIA_AI_REGISTERED_CAPABILITIES)
    registered: readonly KnowledgeRegisteredCapability[],
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {
    this.root = realpathSync(root);
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const addFormats = createRequire(import.meta.url)('ajv-formats') as (
      instance: Ajv2020,
    ) => void;
    addFormats(ajv);
    const contract: unknown = parseNodiaAiStrictJson(schema.toString('utf8'));
    ajv.addSchema(contract as object);
    const validate = ajv.getSchema(
      'https://nodia.local/schemas/knowledge-publication/1#/$defs/ReleaseManifest',
    );
    const raw = this.read('manifest.json', 4 * 1024 * 1024);
    // Strict parsing rejects duplicate keys first. Ajv's uniqueItems deep comparator
    // expects ordinary JSON objects, including when a release contains many sources.
    const strictCandidate = parseNodiaAiStrictJson(raw.toString('utf8'));
    const candidate: unknown = JSON.parse(JSON.stringify(strictCandidate));
    try {
      if (!validate || !validate(candidate)) fail();
    } catch {
      fail();
    }
    const manifest = candidate as KnowledgeManifest;
    const { release_id: releaseId, ...payload } = manifest;
    if (
      pin.schema_version !== 1 ||
      pin.release_id !== releaseId ||
      pin.catalog_release !== manifest.catalog_release ||
      pin.schema_sha256 !== knowledgeHash(schema) ||
      pin.schema_sha256 !== manifest.contract_schema_sha256 ||
      knowledgeHash(canonicalKnowledge(payload)) !== releaseId
    )
      fail();
    const identities = new Set<string>();
    for (const doc of manifest.documents) {
      if (identities.has(doc.document_id)) fail();
      identities.add(doc.document_id);
    }
    const capabilities = new Map(
      registered.map((item) => [item.capability_id, item]),
    );
    if (capabilities.size !== registered.length) fail();
    const published = new Set<string>();
    for (const item of manifest.capability_contracts) {
      if (published.has(item.capability_id)) fail();
      published.add(item.capability_id);
      const actual = capabilities.get(item.capability_id);
      // A published Markdown binding never registers an executable capability.
      if (
        !actual ||
        actual.revision !== item.revision ||
        actual.kind !== item.kind ||
        canonicalKnowledge([...actual.required_module_routes].sort()) !==
          canonicalKnowledge([...item.required_module_routes].sort()) ||
        actual.input_schema_sha256 !== item.input_schema.sha256 ||
        actual.output_schema_sha256 !== item.output_schema.sha256
      )
        fail();
    }
    if (published.size !== capabilities.size) fail();
    const fragmentIds = new Set<string>();
    for (const fragment of manifest.fragments) {
      const key = `${fragment.document_id}:${fragment.fragment_id}`;
      if (!identities.has(fragment.document_id) || fragmentIds.has(key)) fail();
      fragmentIds.add(key);
      for (const requirement of fragment.requires) {
        const actual = capabilities.get(requirement.capability_id);
        if (
          !published.has(requirement.capability_id) ||
          !actual ||
          canonicalKnowledge({
            capability_id: actual.capability_id,
            revision: actual.revision,
            input_schema_sha256: actual.input_schema_sha256,
            output_schema_sha256: actual.output_schema_sha256,
          }) !== canonicalKnowledge(requirement)
        )
          fail();
      }
    }
    this.manifest = freezeKnowledge(manifest);
  }
  index(moduleRoutes: readonly string[]) {
    const authorized = new Set(moduleRoutes);
    const selected = this.manifest.fragments.filter((fragment) =>
      fragment.required_module_routes.every((route) => authorized.has(route)),
    );
    if (selected.length > this.policy.results.json_collection_items)
      throw new Error('nodia_ai:context_limit');
    return selected.map((fragment) => ({
      id: `${fragment.document_id}:${fragment.fragment_id}`,
      purpose: fragment.purpose,
      sections: [...fragment.sections],
      sha256: fragment.sha256,
      document_revision: this.manifest.documents.find(
        (document) => document.document_id === fragment.document_id,
      )!.revision,
      byte_length: fragment.byte_length,
    }));
  }
  execute(
    moduleRoutes: readonly string[],
    fragmentIds?: readonly string[],
  ): {
    releaseId: string;
    catalogVersion: string;
    fragments: { id: string; sha256: string; text: string }[];
  } {
    const authorized = new Set(moduleRoutes);
    if (
      fragmentIds &&
      (fragmentIds.length > 8 ||
        new Set(fragmentIds).size !== fragmentIds.length ||
        fragmentIds.some(
          (id) => typeof id !== 'string' || Buffer.byteLength(id, 'utf8') > 256,
        ))
    )
      throw new Error('nodia_ai:invalid_knowledge_request');
    const allowed = this.manifest.fragments.filter((fragment) =>
      fragment.required_module_routes.every((route) => authorized.has(route)),
    );
    const selected = allowed.filter((fragment) =>
      fragmentIds
        ? fragmentIds.includes(
            `${fragment.document_id}:${fragment.fragment_id}`,
          )
        : fragment.purpose === 'product_summary',
    );
    if (fragmentIds && selected.length !== fragmentIds.length)
      throw new Error('nodia_ai:knowledge_not_available');
    const maximum = this.policy.results.assembled_context_utf8_bytes;
    if (
      selected.reduce((bytes, fragment) => bytes + fragment.byte_length, 0) >
      maximum
    )
      throw new Error('nodia_ai:context_limit');
    const fragments = selected.map((fragment) => {
      let text = this.cache.get(fragment.sha256);
      if (text === undefined) {
        const bytes = this.read(fragment.asset_path, fragment.byte_length);
        if (
          bytes.length !== fragment.byte_length ||
          knowledgeHash(bytes) !== fragment.sha256
        )
          fail();
        text = new TextDecoder('utf8', { fatal: true }).decode(bytes);
        if (this.cachedBytes + bytes.length > maximum) {
          this.cache.clear();
          this.cachedBytes = 0;
        }
        this.cache.set(fragment.sha256, text);
        this.cachedBytes += bytes.length;
      }
      return {
        id: `${fragment.document_id}:${fragment.fragment_id}`,
        sha256: fragment.sha256,
        text,
      };
    });
    return {
      releaseId: this.manifest.release_id,
      catalogVersion: this.manifest.catalog_release,
      fragments,
    };
  }
  private read(asset: string, maxBytes: number): Buffer {
    if (isAbsolute(asset) || asset.includes('\\')) fail();
    const target = resolve(this.root, asset);
    const local = relative(this.root, target);
    if (local.startsWith(`..${sep}`) || local === '..' || isAbsolute(local))
      fail();
    let current = this.root;
    for (const component of local.split(sep)) {
      current = join(current, component);
      if (lstatSync(current).isSymbolicLink()) fail();
    }
    const stat = lstatSync(target);
    if (!stat.isFile() || stat.size > maxBytes) fail();
    return readFileSync(target);
  }
}
