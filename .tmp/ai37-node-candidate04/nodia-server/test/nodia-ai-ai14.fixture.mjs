// Synthetic publication exclusively inside a disposable integration fixture. No real approval or business tool registration.
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

export async function createAi14PublicationFixture() {
  const root = mkdtempSync(join(tmpdir(), 'nodia-ai14-publication-'));
  const schema = readFileSync(
    new URL(
      '../scripts/nodia-ai-knowledge/contracts.schema.json',
      import.meta.url,
    ),
  );
  const common = readFileSync(
    new URL(
      '../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
      import.meta.url,
    ),
    'utf8',
  );
  const sourceJson = JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://nodia.local/ai14/synthetic-user',
    $defs: {
      Input: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' } },
        required: ['id'],
      },
      Output: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' }, label: { type: 'string' } },
        required: ['id', 'label'],
      },
      Empty: { type: 'object', additionalProperties: false, properties: {} },
    },
  });
  const ref = (definition, source = sourceJson) => ({
    sourceJson: source,
    definition,
    sha256: hash(source),
  });
  const counters = { handlers: 0, authorities: 0, resolvers: 0 };
  const controls = {
    invalidOutput: false,
    wrongResource: false,
    oversizedId: false,
    uncertainUnique: false,
  };
  const readName = 'nodia_ai14_synthetic_user_read',
    resolveName = 'nodia_ai14_synthetic_users_resolve',
    prepareName = 'nodia_ai14_synthetic_prepare';
  const requiredModuleRoutes = ['/tools/ai14-fixture'];
  const verifyAuthority = async (input, context) => {
    counters.authorities++;
    const id = input.id ?? input.scope?.subject_user_id;
    if (id) {
      const [target] = await context.manager.query(
        'SELECT is_active FROM users WHERE id=$1',
        [id],
      );
      if (!target?.is_active) throw new Error('nodia_ai:capability_denied');
    }
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new Error('fixture requires the actual checkpoint transaction');
  };
  const base = {
    revision: 1,
    publication: 'published',
    moduleKey: 'ai14_fixture',
    resourceKey: 'ai14_users',
    operationKey: 'read',
    descriptionKey: 'synthetic:read',
    description: 'Synthetic integration fixture only.',
    requiredModuleRoutes,
    actionKeys: ['ai14:read'],
    effectKey: 'read',
    verifyAuthority,
  };
  const family = {
    familyKey: 'synthetic-ai14',
    modules: [
      {
        key: 'ai14_fixture',
        route: requiredModuleRoutes[0],
        label: 'Synthetic integration fixture',
      },
    ],
    resources: [
      {
        key: 'ai14_users',
        label: 'Synthetic fixture users',
        requiredModuleRoutes,
        resolveCapabilityId: resolveName,
      },
    ],
    capabilities: [
      {
        ...base,
        capabilityId: readName,
        toolName: readName,
        kind: 'read',
        inputSchema: ref('Input'),
        outputSchema: ref('Output'),
        handler: async (input, context) => {
          counters.handlers++;
          const [row] = await context.manager.query(
            'SELECT id,name FROM users WHERE id=$1',
            [input.id],
          );
          const result = { id: row.id, label: row.name };
          if (controls.invalidOutput) result.secret = 'synthetic-private-value';
          return result;
        },
      },
      {
        ...base,
        capabilityId: resolveName,
        toolName: resolveName,
        kind: 'read',
        inputSchema: ref('EntitySearchInput', common),
        outputSchema: ref('EntityCandidates', common),
        handler: async (input, context) => {
          counters.resolvers++;
          const rows = await context.manager.query(
            'SELECT id,name FROM users WHERE is_active=true AND ($1::text IS NULL OR id=$1::bigint) AND name ILIKE $2 ORDER BY id LIMIT 5',
            [input.scope.subject_user_id ?? null, `%${input.term}%`],
          );
          const candidates = rows.map((row) => ({
            resource_key: controls.wrongResource
              ? 'wrong_resource'
              : input.resource_key,
            id: controls.oversizedId ? '9223372036854775808' : row.id,
            label: row.name,
          }));
          return {
            status: controls.uncertainUnique
              ? 'unique'
              : rows.length === 1
                ? 'unique'
                : rows.length === 0
                  ? 'empty'
                  : 'ambiguous',
            candidates,
            next_cursor: controls.uncertainUnique
              ? 'synthetic-more-results'
              : null,
          };
        },
      },
      {
        ...base,
        capabilityId: prepareName,
        toolName: prepareName,
        kind: 'prepare_change',
        inputSchema: ref('Empty'),
        outputSchema: ref('Empty'),
        effectKey: 'create',
        handler: async () => {
          throw new Error('Unimplemented preparation must never execute');
        },
      },
    ],
  };
  const capability_contracts = family.capabilities.map((tool) => ({
    capability_id: tool.capabilityId,
    revision: tool.revision,
    publication: 'published',
    kind: tool.kind,
    required_module_routes: tool.requiredModuleRoutes,
    implementation_sources: [
      {
        path: 'nodia-server/test/nodia-ai-ai14.fixture.mjs',
        sha256: hash(
          readFileSync(new URL('./nodia-ai-ai14.fixture.mjs', import.meta.url)),
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
    evidence_paths: ['nodia-server/test/nodia-ai-ai14.integration.mjs'],
  }));
  const fragment = Buffer.from(
    'Synthetic integration publication only. This file never approves a real Nodia product.',
  );
  const fragmentHash = hash(fragment);
  const payload = {
    schema_version: 1,
    registry_sha256: hash('synthetic-ai14-registry-only'),
    contract_schema_sha256: hash(schema),
    catalog_release: 'synthetic-ai14/1',
    context_module_route: '/tools/nodia-ai',
    documents: [
      {
        document_id: 'synthetic-ai14',
        source_path: 'docs/synthetic-ai14.md',
        revision: 1,
        content_sha256: fragmentHash,
        source_hashes: [
          {
            path: 'nodia-server/test/nodia-ai-ai14.fixture.mjs',
            sha256: fragmentHash,
          },
        ],
      },
    ],
    fragments: [
      {
        document_id: 'synthetic-ai14',
        fragment_id: 'summary',
        purpose: 'product_summary',
        sections: ['Synthetic'],
        asset_path: `fragments/${fragmentHash}.md`,
        sha256: fragmentHash,
        byte_length: fragment.length,
        required_module_routes: requiredModuleRoutes,
        requires: family.capabilities.map((tool) => ({
          capability_id: tool.capabilityId,
          revision: tool.revision,
          input_schema_sha256: tool.inputSchema.sha256,
          output_schema_sha256: tool.outputSchema.sha256,
        })),
      },
    ],
    capability_contracts,
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
  // Synthetic publication owns an equally explicit synthetic selection profile.
  // Reuse the real selector's closed validation and limits; never bypass them.
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
          capability_ids: family.capabilities.map((tool) => tool.capabilityId),
          required_capability_ids: [],
        },
      ],
    }),
  );
  const selector = new selectionModule.SelectNodiaAiTurnToolsUseCase();
  return {
    root,
    family,
    counters,
    controls,
    readName,
    resolveName,
    prepareName,
    catalogVersion: manifest.catalog_release,
    override(builder) {
      builder.overrideProvider(tokens.NODIA_AI_KNOWLEDGE_ROOT).useValue(root);
      builder.overrideProvider(tokens.NODIA_AI_KNOWLEDGE_PIN).useValue(pin);
      builder
        .overrideProvider(tokens.NODIA_AI_KNOWLEDGE_SCHEMA)
        .useValue(schema);
      builder
        .overrideProvider(registryTokens.NODIA_AI_TOOL_FAMILIES)
        .useValue([family]);
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
        allowed = `${resolve(tmpdir())}${sep}nodia-ai14-publication-`;
      if (!actual.startsWith(allowed))
        throw new Error('Unsafe fixture cleanup path');
      rmSync(actual, { recursive: true, force: true });
    },
  };
}
