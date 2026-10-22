// Offline projection through frozen production builders. No DB, account or handler execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const server = path.join(root, 'nodia-server');
const require = createRequire(path.join(server, 'package.json'));
const sha = value => createHash('sha256').update(value).digest('hex');
const frozen = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/nodia-ai-ai36-c05-live-attempt08-manifest.json')));
const retained = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/nodia-ai-ai36-c05-r02-case-attempt01-preferences-case-report.json')));
for (const [name, digest] of Object.entries(frozen.files)) assert.equal(sha(fs.readFileSync(path.join(server, name))), digest, name);
process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
const forbidden = () => { throw Error('Offline catalog control forbids network and native operations'); };
globalThis.fetch = forbidden;
for (const [module, methods] of [['node:net', ['connect', 'createConnection']], ['node:http', ['request', 'get']], ['node:https', ['request', 'get']], ['node:tls', ['connect']]])
  for (const method of methods) require(module)[method] = forbidden;
syncBuiltinESMExports();
require('reflect-metadata');
const dependency = new Proxy({}, { get: forbidden });
const imported = {};
const load = async relative => {
  const file = 'dist/' + relative + '.js';
  imported[file] = sha(fs.readFileSync(path.join(server, file)));
  return import(pathToFileURL(path.join(server, file)).href);
};
const { ValidateNodiaAiRuntimePolicyUseCase } = await load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case');
const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(JSON.parse(fs.readFileSync(path.join(server, 'dist/nodia-ai-runtime/config/runtime-policy.json'))));
const common = fs.readFileSync(path.join(server, 'dist/nodia-ai-tools/config/common-schema.json'), 'utf8');
const { BuildNodiaAiPreferenceOperationsUseCase } = await load('nodia-ai-preference/use-case/build-nodia-ai-preference-operations.use-case');
const { CanonicalizeNodiaAiProposalUseCase } = await load('nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case');
const { ValidateNodiaAiProposalUseCase } = await load('nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case');
const validation = new ValidateNodiaAiProposalUseCase(new BuildNodiaAiPreferenceOperationsUseCase(dependency, dependency).operations,
  common, policy, new CanonicalizeNodiaAiProposalUseCase(policy));
const { BuildNodiaAiCommonReadToolsUseCase } = await load('nodia-ai-common-reads/use-case/build-nodia-ai-common-read-tools.use-case');
const { BuildNodiaAiCommonPreparationToolsUseCase } = await load('nodia-ai-common-preparation/use-case/build-nodia-ai-common-preparation-tools.use-case');
const { NodiaAiToolRegistryUseCase, compileNodiaAiToolSchema } = await load('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case');
const { DiscoverNodiaAiToolsUseCase } = await load('nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case');
const { NodiaAiReportToolsUseCase } = await load('nodia-ai-tools/use-case/nodia-ai-report-tools.use-case');
const { NODIA_AI_KNOWLEDGE_TOOLS } = await load('nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case');
const { nodiaAiMcpCatalogUtf8Bytes } = await load('nodia-ai-adapter/types/nodia-ai-adapter.types');
const catalogVersion = retained.publication.catalog_release;
const registry = new NodiaAiToolRegistryUseCase([], catalogVersion);
const reportTools = new NodiaAiReportToolsUseCase(dependency, dependency, dependency);
const discovery = new DiscoverNodiaAiToolsUseCase(registry, dependency, dependency, common, policy, reportTools);
const families = [
  ...new BuildNodiaAiCommonReadToolsUseCase(dependency, dependency, dependency, dependency).execute(),
  ...new BuildNodiaAiCommonPreparationToolsUseCase(dependency, dependency, dependency, validation, common, policy).execute(),
];
const selectedNames = ['nodia_preferences_list', 'nodia_preferences_prepare'];
const capabilities = families.flatMap(family => family.capabilities).filter(tool => selectedNames.includes(tool.toolName));
assert.deepEqual(capabilities.map(tool => tool.toolName), selectedNames);
const tools = [...NODIA_AI_KNOWLEDGE_TOOLS, ...discovery.descriptors(), ...capabilities.map(tool => ({
  name: tool.toolName, description: tool.description, inputSchema: compileNodiaAiToolSchema(tool.inputSchema).schema,
}))];
const generation = retained.turns[0].generations.find(item => item.phase === 'execution');
assert.equal(tools.length, 9);
assert.equal(sha(JSON.stringify(tools)), generation.selected_catalog_sha256);
const compactWireBytes = nodiaAiMcpCatalogUtf8Bytes(tools);
const nativeCatalogBytes = retained.turns[0].measurements.at(-1).catalogUtf8Bytes;
assert.equal(nativeCatalogBytes, 21873);
const Ajv2020 = require('ajv/dist/2020.js').Ajv2020;
const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false });
require('ajv-formats')(ajv);
const validArguments = {
  nodia_preferences_list: {},
  nodia_preferences_prepare: { operation: 'create', partial: { scope_key: 'finance', scope: {}, key: 'expense_category_id', value: '1' } },
};
for (const name of selectedNames) assert.equal(ajv.compile(tools.find(tool => tool.name === name).inputSchema)(validArguments[name]), true, name);
const output = path.join(root, 'docs/evidence/nodia-ai-ai36-c05-preferences-catalog-control.json');
fs.writeFileSync(output, JSON.stringify({ schema_version: 1, scope: 'offline_exact_frozen_production_descriptor_projection_no_execution',
  status: 'passed', catalog_sha256: sha(JSON.stringify(tools)), native_catalog_utf8_bytes: nativeCatalogBytes,
  compact_wire_catalog_utf8_bytes: compactWireBytes, tools,
  valid_synthetic_arguments: validArguments, imported_compiled_sha256: imported,
  all_frozen_packet_files_verified: Object.keys(frozen.files).length,
  retained_case_report_sha256: sha(fs.readFileSync(path.join(root, 'docs/evidence/nodia-ai-ai36-c05-r02-case-attempt01-preferences-case-report.json'))),
  source_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  configured_database_reads: 0, native_operations: 0, provider_requests: 0, business_effects: 0,
  schemas_validated_by_production_compiler: true, synthetic_arguments_validated_by_Ajv: true }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'passed', tools: tools.length, compact_wire_catalog_utf8_bytes: compactWireBytes,
  expected_native_catalog_utf8_bytes: nativeCatalogBytes, catalog_sha256: sha(JSON.stringify(tools)), output }));
