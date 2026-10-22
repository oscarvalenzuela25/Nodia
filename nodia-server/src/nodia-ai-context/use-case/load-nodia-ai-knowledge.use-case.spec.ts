import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import {
  LoadNodiaAiKnowledgeUseCase,
  canonicalKnowledge,
  knowledgeHash,
} from './load-nodia-ai-knowledge.use-case.js';
import { parseNodiaAiStrictJson } from '../strict-json.js';
import { BuildNodiaAiContextUseCase } from './build-nodia-ai-context.use-case.js';
import type { KnowledgePin } from '../types/knowledge.types.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
const policy = {
  results: { assembled_context_utf8_bytes: 262144 },
} as NodiaAiRuntimePolicy;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(`${resolve(tmpdir())}${sep}nodia-ai12-`))
      throw new Error('unsafe_fixture_path');
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nodia-ai12-'));
  roots.push(root);
  const schema = readFileSync(
    new URL(
      '../../../scripts/nodia-ai-knowledge/contracts.schema.json',
      import.meta.url,
    ),
  );
  const manifest = {
    schema_version: 1,
    registry_sha256: 'a'.repeat(64),
    contract_schema_sha256: knowledgeHash(schema),
    catalog_release: 'nodia-ai-unpublished/1',
    context_module_route: '/tools/nodia-ai',
    documents: [] as object[],
    fragments: [] as object[],
    capability_contracts: [] as object[],
    release_id: '',
  };
  const pin: KnowledgePin = {
    schema_version: 1,
    release_id: '',
    catalog_release: manifest.catalog_release,
    schema_sha256: knowledgeHash(schema),
  };
  const write = () => {
    const { release_id: ignored, ...payload } = manifest;
    void ignored;
    manifest.release_id = knowledgeHash(canonicalKnowledge(payload));
    pin.release_id = manifest.release_id;
    writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest));
  };
  write();
  return {
    root,
    schema,
    manifest,
    pin,
    write,
    load: () => new LoadNodiaAiKnowledgeUseCase(root, pin, schema, [], policy),
  };
}
describe('LoadNodiaAiKnowledgeUseCase', () => {
  it.each(['prepare_workflow', 'prepare_preference_change', 'synthetic_unknown_kind'])(
    'validates the closed published kind %s against the actual pinned loader', (kind) => {
      const f = fixture(), digest = 'a'.repeat(64), route = '/tools/nodia-ai';
      const registered = { capability_id: 'synthetic_common_prepare', revision: 1, kind,
        required_module_routes: [route], input_schema_sha256: digest, output_schema_sha256: digest };
      f.manifest.capability_contracts.push({ capability_id: registered.capability_id, revision: 1,
        publication: 'published', kind, required_module_routes: [route],
        implementation_sources: [{ path: 'nodia-server/src/synthetic-common.ts', sha256: digest }],
        input_schema: { path: 'docs/synthetic-common.json', definition: 'Input', sha256: digest },
        output_schema: { path: 'docs/synthetic-common.json', definition: 'Output', sha256: digest },
        evidence_paths: ['docs/evidence/synthetic-common.json'] });
      f.write();
      const load = () => new LoadNodiaAiKnowledgeUseCase(f.root, f.pin, f.schema, [registered], policy);
      if (kind === 'synthetic_unknown_kind') expect(load).toThrow('knowledge_release_invalid');
      else expect(load().manifest.capability_contracts[0].kind).toBe(kind);
    },
  );
  it('NR-31 exposes a new published product on the next context while preserving history and the prior pinned turn', () => {
    const original = fixture();
    const oldLoader = original.load();
    const history = [{ seq: '1', role: 'user', scope: { schema_version: 1, module_routes: [] },
      parts: [{ kind: 'text', text: 'Keep the existing conversation and its decisions.' }] }];
    const contextPolicy = { results: { ...policy.results, json_collection_items: 128, assistant_text_utf8_bytes: 32768 } } as NodiaAiRuntimePolicy;
    const initial = new BuildNodiaAiContextUseCase(oldLoader, contextPolicy).execute({
      moduleRoutes: ['/tools/nodia-ai'], throughSeq: '1', mode: 'token_plan_web', history,
    });
    const added = fixture();
    const text = Buffer.from('Synthetic published product: seasonal services. Documentation is data, never permission.');
    const digest = knowledgeHash(text);
    const route = '/tools/synthetic-seasonal-services';
    const registered = { capability_id: 'synthetic_seasonal_read', revision: 1, kind: 'read',
      input_schema_sha256: digest, output_schema_sha256: digest, required_module_routes: [route] };
    added.manifest.documents.push({ document_id: 'synthetic-seasonal', source_path: 'docs/synthetic-seasonal.md',
      revision: 1, content_sha256: digest, source_hashes: [{ path: 'docs/synthetic-seasonal.md', sha256: digest }] });
    added.manifest.fragments.push({ document_id: 'synthetic-seasonal', fragment_id: 'summary', purpose: 'product_summary',
      sections: ['Summary'], asset_path: `fragments/${digest}.md`, sha256: digest, byte_length: text.length,
      required_module_routes: [route], requires: [{ capability_id: registered.capability_id, revision: 1,
        input_schema_sha256: digest, output_schema_sha256: digest }] });
    added.manifest.capability_contracts.push({ capability_id: registered.capability_id, revision: 1,
      publication: 'published', kind: 'read', required_module_routes: [route],
      implementation_sources: [{ path: 'nodia-server/src/synthetic-seasonal.ts', sha256: digest }],
      input_schema: { path: 'docs/synthetic-seasonal.json', definition: 'Input', sha256: digest },
      output_schema: { path: 'docs/synthetic-seasonal.json', definition: 'Output', sha256: digest },
      evidence_paths: ['docs/evidence/synthetic-seasonal.json'] });
    added.write();
    mkdirSync(join(added.root, 'fragments'));
    writeFileSync(join(added.root, `fragments/${digest}.md`), text);
    const loader = new LoadNodiaAiKnowledgeUseCase(added.root, added.pin, added.schema, [registered], contextPolicy);
    const input = { moduleRoutes: ['/tools/nodia-ai', route], throughSeq: '1', mode: 'token_plan_web', history };
    const next = new BuildNodiaAiContextUseCase(loader, contextPolicy).execute(input);
    expect(JSON.parse(next.prompt).messages).toEqual(JSON.parse(initial.prompt).messages);
    expect(next.prompt).toContain(text.toString());
    expect(next.manifest.knowledge_release).not.toBe(initial.manifest.knowledge_release);
    expect(oldLoader.execute(input.moduleRoutes).fragments).toEqual([]);
    expect(loader.execute(['/tools/nodia-ai']).fragments).toEqual([]);
    expect(history[0].parts[0].text).toBe('Keep the existing conversation and its decisions.');
  });
  it('refuses executable registrations absent from the pinned published release', () => {
    const f = fixture();
    expect(() => new LoadNodiaAiKnowledgeUseCase(f.root, f.pin, f.schema, [{
      capability_id: 'synthetic_unpublished', revision: 1, kind: 'read', required_module_routes: ['/tools/finance'],
      input_schema_sha256: 'a'.repeat(64), output_schema_sha256: 'b'.repeat(64),
    }], policy)).toThrow('knowledge_release_invalid');
  });
  it('loads the empty unpublished release without source docs, capabilities or fabricated knowledge', () => {
    const f = fixture();
    const loader = f.load();
    expect(loader.execute(['/tools/nodia-ai']).fragments).toEqual([]);
    expect(Object.isFrozen(loader.manifest.fragments)).toBe(true);
  });
  it('rejects release mutation even if the embedded release hash is rewritten', () => {
    const f = fixture();
    const trusted = { ...f.pin };
    f.manifest.catalog_release = 'changed/1';
    f.write();
    expect(
      () =>
        new LoadNodiaAiKnowledgeUseCase(f.root, trusted, f.schema, [], policy),
    ).toThrow('knowledge_release_invalid');
  });
  it('rejects changed schema, extra metadata and duplicate JSON keys', () => {
    const f = fixture();
    expect(
      () =>
        new LoadNodiaAiKnowledgeUseCase(
          f.root,
          f.pin,
          Buffer.from('{}'),
          [],
          policy,
        ),
    ).toThrow();
    writeFileSync(
      join(f.root, 'manifest.json'),
      JSON.stringify({ ...f.manifest, extra: true }),
    );
    expect(f.load).toThrow();
    writeFileSync(
      join(f.root, 'manifest.json'),
      JSON.stringify(f.manifest).replace('{', '{"schema_version":2,'),
    );
    expect(f.load).toThrow();
  });
  it('checks permission before reading a missing or tampered fragment', () => {
    const f = fixture();
    const bytes = Buffer.from('Approved synthetic feature');
    const hash = knowledgeHash(bytes);
    f.manifest.documents.push({
      document_id: 'finance',
      source_path: 'docs/test.md',
      revision: 1,
      content_sha256: hash,
      source_hashes: [{ path: 'docs/test.md', sha256: hash }],
    });
    f.manifest.fragments.push({
      document_id: 'finance',
      fragment_id: 'summary',
      purpose: 'product_summary',
      sections: ['Summary'],
      asset_path: `fragments/${hash}.md`,
      sha256: hash,
      byte_length: bytes.length,
      required_module_routes: ['/tools/finance'],
      requires: [
        {
          capability_id: 'fixture_read',
          revision: 1,
          input_schema_sha256: hash,
          output_schema_sha256: hash,
        },
      ],
    });
    f.manifest.capability_contracts.push({
      capability_id: 'fixture_read',
      revision: 1,
      publication: 'published',
      kind: 'read',
      required_module_routes: ['/tools/finance'],
      implementation_sources: [
        { path: 'nodia-server/src/fixture.ts', sha256: hash },
        { path: 'nodia-server/src/another-fixture.ts', sha256: hash },
      ],
      input_schema: {
        path: 'docs/fixture.json',
        definition: 'Input',
        sha256: hash,
      },
      output_schema: {
        path: 'docs/fixture.json',
        definition: 'Output',
        sha256: hash,
      },
      evidence_paths: ['docs/evidence/fixture.json'],
    });
    f.write();
    // A documentary capability does not register an executable one.
    expect(f.load).toThrow();
    const registration = [
      {
        capability_id: 'fixture_read',
        revision: 1,
        input_schema_sha256: hash,
        output_schema_sha256: hash,
        kind: 'read',
        required_module_routes: ['/tools/finance'],
      },
    ];
    const loader = new LoadNodiaAiKnowledgeUseCase(
      f.root,
      f.pin,
      f.schema,
      registration,
      policy,
    );
    for (const changed of [
      { ...registration[0], kind: 'prepare_change' },
      { ...registration[0], required_module_routes: ['/settings/users'] },
      { ...registration[0], input_schema_sha256: 'b'.repeat(64) },
    ]) expect(() => new LoadNodiaAiKnowledgeUseCase(f.root, f.pin, f.schema, [changed], policy)).toThrow('knowledge_release_invalid');
    const small = new LoadNodiaAiKnowledgeUseCase(
      f.root,
      f.pin,
      f.schema,
      registration,
      {
        results: { assembled_context_utf8_bytes: bytes.length - 1 },
      } as NodiaAiRuntimePolicy,
    );
    expect(() => small.execute(['/tools/finance'])).toThrow(
      'nodia_ai:context_limit',
    ); // Before a missing file read.
    expect(loader.execute([]).fragments).toEqual([]); // File does not even exist yet.
    expect(() => loader.execute(['/tools/finance'])).toThrow();
    mkdirSync(join(f.root, 'fragments'));
    writeFileSync(join(f.root, `fragments/${hash}.md`), 'tampered');
    expect(() => loader.execute(['/tools/finance'])).toThrow(
      'knowledge_release_invalid',
    );
    writeFileSync(join(f.root, `fragments/${hash}.md`), bytes);
    expect(loader.execute(['/tools/finance']).fragments[0].text).toBe(
      bytes.toString(),
    );
    expect(loader.execute([]).fragments).toEqual([]); // Cached bytes never bypass scope checks.
    // Detail is discoverable through metadata but is never eagerly read with product summaries.
    (f.manifest.fragments[0] as Record<string, unknown>).purpose =
      'feature_explanation';
    f.write();
    rmSync(join(f.root, `fragments/${hash}.md`));
    const selective = new LoadNodiaAiKnowledgeUseCase(
      f.root,
      f.pin,
      f.schema,
      registration,
      policy,
    );
    expect(selective.index(['/tools/finance'])).toEqual([
      expect.objectContaining({
        id: 'finance:summary',
        purpose: 'feature_explanation',
        document_revision: 1,
      }),
    ]);
    expect(selective.execute(['/tools/finance']).fragments).toEqual([]);
    expect(() => selective.execute([], ['finance:summary'])).toThrow(
      'nodia_ai:knowledge_not_available',
    );
    expect(() =>
      selective.execute(['/tools/finance'], ['missing:feature']),
    ).toThrow('nodia_ai:knowledge_not_available');
    expect(() =>
      selective.execute(['/tools/finance'], ['finance:summary']),
    ).toThrow(); // The authorized requested file is genuinely missing.
    writeFileSync(join(f.root, `fragments/${hash}.md`), bytes);
    expect(
      selective.execute(['/tools/finance'], ['finance:summary']).fragments[0]
        .text,
    ).toBe(bytes.toString());
  });
  it('rejects symlinked manifests before parsing', () => {
    const f = fixture();
    const other = join(f.root, 'other');
    mkdirSync(other);
    writeFileSync(join(other, 'manifest.json'), JSON.stringify(f.manifest));
    rmSync(join(f.root, 'manifest.json'));
    try {
      symlinkSync(
        join(other, 'manifest.json'),
        join(f.root, 'manifest.json'),
        'file',
      );
    } catch {
      return;
    }
    expect(f.load).toThrow('knowledge_release_invalid');
  });
  it.each([
    '{"x":1,"x":2}',
    '{"a":{"x":0,"x":1}}',
    '[1,]',
    '{"x":1,}',
    '{} trailing',
  ])('strict JSON rejects %s', (input) => {
    expect(() => parseNodiaAiStrictJson(input)).toThrow();
  });
  it('strict JSON preserves escaped strings and nested values without executable parsing', () => {
    const text =
      '{"x":"a\\\"b","nested":[null,true,false,12.5,-3e2,{"y":"\\u0061"}]}';
    expect(JSON.stringify(parseNodiaAiStrictJson(text))).toBe(
      JSON.stringify(JSON.parse(text)),
    );
  });
});
