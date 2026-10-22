// Test-only synthetic publication of actual candidate ports. This never edits repository approvals or the configured database.
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value !== null && typeof value === 'object'
      ? `{${Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
          .join(',')}}`
      : JSON.stringify(value);

export async function createAi15PublicationFixture(families) {
  const root = mkdtempSync(join(tmpdir(), 'nodia-ai15-publication-'));
  const schema = readFileSync(
    new URL(
      '../scripts/nodia-ai-knowledge/contracts.schema.json',
      import.meta.url,
    ),
  );
  const tools = families.flatMap((family) => family.capabilities);
  const fragment = Buffer.from(
    'Synthetic AI-15 integration publication. Actual domain ports, synthetic records and approval only.',
  );
  const fragmentHash = hash(fragment);
  const payload = {
    schema_version: 1,
    registry_sha256: hash('synthetic-ai15-only'),
    contract_schema_sha256: hash(schema),
    catalog_release: 'synthetic-ai15/1',
    context_module_route: '/tools/nodia-ai',
    documents: [
      {
        document_id: 'synthetic-ai15',
        source_path: 'docs/synthetic-ai15.md',
        revision: 1,
        content_sha256: fragmentHash,
        source_hashes: [
          {
            path: 'nodia-server/test/nodia-ai-ai15.fixture.mjs',
            sha256: fragmentHash,
          },
        ],
      },
    ],
    // A knowledge fragment can require at most 64 exact capabilities. Split the
    // synthetic publication, preserving the existing production schema ceiling.
    fragments: Array.from(
      { length: Math.ceil(tools.length / 64) },
      (_, index) => ({
        document_id: 'synthetic-ai15',
        fragment_id: `summary-${index + 1}`,
        purpose: 'product_summary',
        sections: ['Synthetic'],
        asset_path: `fragments/${fragmentHash}.md`,
        sha256: fragmentHash,
        byte_length: fragment.length,
        required_module_routes: [
          ...new Set(
            families.flatMap((family) =>
              family.modules.map((module) => module.route),
            ),
          ),
        ],
        requires: tools.slice(index * 64, (index + 1) * 64).map((tool) => ({
          capability_id: tool.capabilityId,
          revision: tool.revision,
          input_schema_sha256: tool.inputSchema.sha256,
          output_schema_sha256: tool.outputSchema.sha256,
        })),
      }),
    ),
    capability_contracts: tools.map((tool) => ({
      capability_id: tool.capabilityId,
      revision: tool.revision,
      publication: 'published',
      kind: tool.kind,
      required_module_routes: tool.requiredModuleRoutes,
      implementation_sources: [
        {
          path: 'nodia-server/test/nodia-ai-ai15.fixture.mjs',
          sha256: hash(
            readFileSync(
              new URL('./nodia-ai-ai15.fixture.mjs', import.meta.url),
            ),
          ),
        },
      ],
      input_schema: {
        path: 'docs/synthetic-fixture.json',
        definition: tool.inputSchema.definition,
        sha256: tool.inputSchema.sha256,
      },
      output_schema: {
        path: 'docs/synthetic-fixture.json',
        definition: tool.outputSchema.definition,
        sha256: tool.outputSchema.sha256,
      },
      evidence_paths: ['nodia-server/test/nodia-ai-ai15.integration.mjs'],
    })),
  };
  const manifest = { ...payload, release_id: hash(canonical(payload)) };
  mkdirSync(join(root, 'fragments'));
  writeFileSync(join(root, 'fragments', `${fragmentHash}.md`), fragment);
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest));
  const pin = {
    schema_version: 1,
    release_id: manifest.release_id,
    catalog_release: manifest.catalog_release,
    schema_sha256: hash(schema),
  };
  const tokens =
    await import('../dist/nodia-ai-context/types/knowledge.types.js');
  const registryTokens =
    await import('../dist/nodia-ai-tools/types/tool-registry.types.js');
  const selectionModule =
    await import('../dist/nodia-ai-tools/use-case/select-nodia-ai-turn-tools.use-case.js');
  // Select exactly this isolated publication, under the production selector's
  // closed metadata validation, current-authority intersection and byte limits.
  const selectionProfiles = selectionModule.loadNodiaAiToolSelectionProfiles(
    JSON.stringify({
      schema_version: 1,
      default_profile_id: 'published_reads',
      technical_tool_names:
        selectionModule.loadNodiaAiToolSelectionProfiles().technical_tool_names,
      profiles: [
        {
          profile_id: 'published_reads',
          revision: 1,
          capability_ids: tools.map((tool) => tool.capabilityId),
          required_capability_ids: [],
        },
      ],
    }),
  );
  const selector = new selectionModule.SelectNodiaAiTurnToolsUseCase();
  return {
    catalogVersion: manifest.catalog_release,
    override(builder) {
      builder.overrideProvider(tokens.NODIA_AI_KNOWLEDGE_ROOT).useValue(root);
      builder.overrideProvider(tokens.NODIA_AI_KNOWLEDGE_PIN).useValue(pin);
      builder
        .overrideProvider(tokens.NODIA_AI_KNOWLEDGE_SCHEMA)
        .useValue(schema);
      builder
        .overrideProvider(registryTokens.NODIA_AI_TOOL_FAMILIES)
        .useValue(families);
      builder
        .overrideProvider(registryTokens.NODIA_AI_CAPABILITIES_CATALOG_VERSION)
        .useValue(manifest.catalog_release);
      builder
        .overrideProvider(selectionModule.SelectNodiaAiTurnToolsUseCase)
        .useValue({
          execute: (input) => selector.execute(input, selectionProfiles),
        });
      return builder;
    },
    close() {
      const actual = realpathSync(root),
        allowed = `${resolve(tmpdir())}${sep}nodia-ai15-publication-`;
      if (!actual.startsWith(allowed))
        throw new Error('Unsafe fixture cleanup path');
      rmSync(actual, { recursive: true, force: true });
    },
  };
}
