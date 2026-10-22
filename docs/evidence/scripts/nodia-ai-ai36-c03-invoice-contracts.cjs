/* AI36-C03 offline evidence: actual native factories, closed schemas and candidate adapters.
 * No SQL, endpoint, native account, channel interaction or provider generation is invoked. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../..");
process.chdir(root);
const mode = process.argv[2] ?? "--check";
assert(["--write", "--check"].includes(mode), "use --write or --check");
const output = "docs/evidence/nodia-ai-ai36-c03-invoice-contracts.json";
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sources = new Map();
function track(file) {
  const entry = { path: file, sha256: sha(fs.readFileSync(file)) };
  sources.set(file, entry);
  return entry;
}
const sourceClass = (group, file) => `nodia-ai-${group}/use-case/${file}`;
const builders = [
  [
    "finance-catalog",
    "BuildNodiaAiFinanceCatalogOperationsUseCase",
    "build-nodia-ai-finance-catalog-operations.use-case",
  ],
  [
    "finance-ledger",
    "BuildNodiaAiFinanceLedgerOperationsUseCase",
    "build-nodia-ai-finance-ledger-operations.use-case",
  ],
  [
    "business-catalog",
    "BuildNodiaAiBusinessCatalogOperationsUseCase",
    "build-nodia-ai-business-catalog-operations.use-case",
  ],
  [
    "supplier-operations",
    "BuildNodiaAiSupplierOperationsUseCase",
    "build-nodia-ai-supplier-operations.use-case",
  ],
  [
    "invoice-operations",
    "BuildNodiaAiInvoiceOperationsUseCase",
    "build-nodia-ai-invoice-operations.use-case",
  ],
  [
    "rental-configuration",
    "BuildNodiaAiRentalConfigurationOperationsUseCase",
    "build-nodia-ai-rental-configuration-operations.use-case",
  ],
  [
    "rental-reservation",
    "BuildNodiaAiRentalReservationOperationsUseCase",
    "build-nodia-ai-rental-reservation-operations.use-case",
  ],
  [
    "rental-money",
    "BuildNodiaAiRentalMoneyOperationsUseCase",
    "build-nodia-ai-rental-money-operations.use-case",
  ],
  [
    "rental-operations",
    "BuildNodiaAiRentalOperationsUseCase",
    "build-nodia-ai-rental-operations.use-case",
  ],
  [
    "core-operations",
    "BuildNodiaAiCoreOperationsUseCase",
    "build-nodia-ai-core-operations.use-case",
  ],
  [
    "provider-operations",
    "BuildNodiaAiProviderOperationsUseCase",
    "build-nodia-ai-provider-operations.use-case",
  ],
  [
    "secure-preparation",
    "BuildNodiaAiSecureOperationsUseCase",
    "build-nodia-ai-secure-operations.use-case",
  ],
];

async function main() {
  const started = performance.now();
  process.env.DOTENV_CONFIG_PATH =
    process.platform === "win32" ? "NUL" : "/dev/null";
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_STORAGE = "memory";
  const forbidden = () => {
    throw Error(
      "AI36-C03 offline evidence attempted a network/domain dependency",
    );
  };
  globalThis.fetch = forbidden;
  for (const [name, methods] of [
    ["node:net", ["connect", "createConnection"]],
    ["node:http", ["request", "get"]],
    ["node:https", ["request", "get"]],
    ["node:tls", ["connect"]],
  ])
    for (const method of methods) require(name)[method] = forbidden;
  require("node:module").syncBuiltinESMExports();
  const dependency = new Proxy({}, { get: forbidden });
  const load = async (relative) => {
    track(`nodia-server/src/${relative}.ts`);
    const file = `nodia-server/dist/${relative}.js`;
    track(file);
    return import(pathToFileURL(path.join(root, file)).href);
  };
  track("docs/evidence/scripts/nodia-ai-ai36-c03-invoice-contracts.cjs");
  const baseline = track(
    "docs/evidence/nodia-ai-ai36-c01-write-contracts.json",
  );
  const previous = read(baseline.path);
  assert.equal(previous.capabilities.length, 73);
  const oldByName = new Map(
    previous.capabilities.map((tool) => [tool.tool_name, tool]),
  );

  const policyPath =
    "nodia-server/dist/nodia-ai-runtime/config/runtime-policy.json";
  track(policyPath);
  const { ValidateNodiaAiRuntimePolicyUseCase } = await load(
    "nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case",
  );
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    read(policyPath),
  );
  assert.equal(policy.results.json_collection_items, 128);
  assert.equal(policy.results.assembled_context_utf8_bytes, 262144);
  const native = new Map();
  const groups = [];
  for (const [group, name, file] of builders) {
    const Class = (await load(sourceClass(group, file)))[name];
    const operations = Reflect.construct(
      Class,
      Array(35).fill(dependency),
    ).operations;
    groups.push({ group, native_ports: operations.length });
    for (const port of operations) {
      assert(
        !native.has(port.toolName),
        `duplicate native port ${port.toolName}`,
      );
      native.set(port.toolName, port);
    }
  }
  const { PrepareNodiaAiFinanceMovementUseCase } = await load(
    "nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case",
  );
  const movement = new PrepareNodiaAiFinanceMovementUseCase(dependency);
  assert(!native.has(movement.toolName));
  native.set(movement.toolName, movement);
  groups.push({ group: "finance-movement-create", native_ports: 1 });
  assert.equal(native.size, 77);

  const { loadNodiaAiWriteContracts, loadNodiaAiSecureContracts } = await load(
    "nodia-ai-write-tools/types/write-tool-contract.types",
  );
  const ordinaryBundles = loadNodiaAiWriteContracts();
  const secureBundles = loadNodiaAiSecureContracts();
  assert.equal(ordinaryBundles.length, 3);
  assert.equal(secureBundles.length, 1);
  for (const name of [
    "write-finance-business",
    "write-reservations",
    "write-core-provider",
    "secure-flows",
  ]) {
    const source = track(
      `nodia-server/src/nodia-ai-products/contracts/${name}.json`,
    );
    const compiled = track(
      `nodia-server/dist/nodia-ai-products/contracts/${name}.json`,
    );
    assert.equal(
      source.sha256,
      compiled.sha256,
      `stale compiled schema ${name}`,
    );
  }
  const commonPath = "docs/mvp/nodia-ai-v1-common-contracts.schema.json";
  track(commonPath);
  const common = fs.readFileSync(commonPath, "utf8");
  const { CanonicalizeNodiaAiProposalUseCase } = await load(
    "nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case",
  );
  const { ValidateNodiaAiProposalUseCase } = await load(
    "nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case",
  );
  const validate = new ValidateNodiaAiProposalUseCase(
    [...native.values()],
    common,
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
  const { BuildNodiaAiWriteToolsUseCase } = await load(
    "nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case",
  );
  const build = new BuildNodiaAiWriteToolsUseCase(
    dependency,
    dependency,
    validate,
    common,
    policy,
  );
  const ordinaryFamilies = build.execute(ordinaryBundles);
  const secureFamilies = build.execute(secureBundles);
  const { NodiaAiToolRegistryUseCase, compileNodiaAiToolSchema } = await load(
    "nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case",
  );
  // MCP hashes bind the catalog identity. Reuse the exact C01 synthetic catalog for byte/hash comparison.
  const registry = new NodiaAiToolRegistryUseCase(
    [...ordinaryFamilies, ...secureFamilies],
    "offline-ai36-c01-not-published",
  );
  assert.equal(registry.requirements().length, 77);
  const baselineC02 = track('docs/evidence/nodia-ai-ai36-c02-secure-contracts.json');
  const previousC02 = read(baselineC02.path);
  assert.equal(previousC02.structural_comparison_catalog_version, 'offline-ai36-c01-not-published');
  const priorSecure = new Map(previousC02.capabilities.map((tool) => [tool.tool_name, tool]));
  const priorOrdinaryC02 = new Map(previousC02.preserved_C01_contracts.map((tool) => [tool.tool_name, tool]));
  const preserved = [];
  for (const family of [...ordinaryFamilies, ...secureFamilies])
    for (const registration of family.capabilities) {
      const tool = registry.get(registration.toolName);
      const ordinary = oldByName.get(tool.toolName);
      const old = ordinary ?? priorSecure.get(tool.toolName);
      assert(old, `missing historical contract ${tool.toolName}`);
      assert.equal(tool.contractHash, old.mcp_contract_hash, `MCP hash changed ${tool.toolName}`);
      assert.equal(native.get(tool.toolName).contractHash, old.native_contract_hash);
      if (ordinary) {
        const priorC02 = priorOrdinaryC02.get(tool.toolName);
        assert(priorC02);
        assert.equal(tool.contractHash, priorC02.mcp_contract_hash);
        assert.equal(registration.inputSchema.sha256, priorC02.input_source_sha256);
        assert.equal(registration.outputSchema.sha256, priorC02.output_source_sha256);
      }
      for (const side of ['input', 'output']) {
        assert.equal(registration[`${side}Schema`].sha256, old[`${side}_schema`].sha256);
        assert.equal(registration[`${side}Schema`].definition, old[`${side}_schema`].definition);
        assert.equal(tool[`${side}SchemaRef`], old[`${side}_schema`].ref);
      }
      preserved.push({
        tool_name: tool.toolName,
        kind: tool.kind,
        native_contract_hash: native.get(tool.toolName).contractHash,
        mcp_contract_hash: tool.contractHash,
        input_schema: { definition: registration.inputSchema.definition, sha256: registration.inputSchema.sha256, ref: tool.inputSchemaRef },
        output_schema: { definition: registration.outputSchema.definition, sha256: registration.outputSchema.sha256, ref: tool.outputSchemaRef },
        compared_with_C01_and_C02: true,
        unchanged: true,
      });
    }
  assert.equal(preserved.length, 77);
  const { SnapshotNodiaAiInvoiceAnalysisUseCase } = await load('nodia-ai-invoice-analysis/use-case/snapshot-nodia-ai-invoice-analysis.use-case');
  const { BuildNodiaAiInvoiceAnalysisToolUseCase } = await load('nodia-ai-invoice-analysis/use-case/build-nodia-ai-invoice-analysis-tool.use-case');
  const { NodiaAiInvoiceAnalysisModule, NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES } = await load('nodia-ai-invoice-analysis/nodia-ai-invoice-analysis.module');
  await load('nodia-ai-invoice-analysis/adapters/http-nodia-ai-invoice-analysis-contract');
  await load('nodia-ai-invoice-analysis/types/invoice-analysis-contract.types');
  const snapshots = new SnapshotNodiaAiInvoiceAnalysisUseCase(policy, dependency);
  const invoiceFamilies = new BuildNodiaAiInvoiceAnalysisToolUseCase(dependency, snapshots).execute();
  const invoiceRegistry = new NodiaAiToolRegistryUseCase(invoiceFamilies, 'offline-ai36-c01-not-published');
  assert.equal(invoiceFamilies.length, 1);
  assert.equal(invoiceRegistry.requirements().length, 1);
  const registration = invoiceFamilies[0].capabilities[0];
  const tool = invoiceRegistry.get('nodia_invoices_analyze');
  assert(tool);
  assert.equal(tool.kind, 'analyze_attachment');
  assert.equal(tool.capabilityId, 'nodia_invoices_analyze');
  assert.equal(tool.resourceKey, 'invoices');
  assert.deepEqual(tool.requiredModuleRoutes, ['/tools/business']);
  assert.deepEqual(tool.actionKeys, []);
  assert.equal(typeof registration.external.prepare, 'function');
  assert.equal(typeof registration.verifyAuthority, 'function');
  assert.equal(typeof registration.verifyResultAuthority, 'function');
  assert.equal(typeof registration.handler, 'function');
  const input = compileNodiaAiToolSchema(registration.inputSchema);
  const result = compileNodiaAiToolSchema(registration.outputSchema);
  const schemaPath = track('nodia-server/src/nodia-ai-products/contracts/invoice-analysis.json');
  const compiledSchema = track('nodia-server/dist/nodia-ai-products/contracts/invoice-analysis.json');
  assert.equal(schemaPath.sha256, compiledSchema.sha256);
  const empty = NodiaAiInvoiceAnalysisModule.forPublication([]);
  assert.equal(empty.imports, undefined);
  assert.equal(empty.providers.length, 1);
  assert.equal(empty.providers[0].provide, NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES);
  assert.deepEqual(empty.providers[0].useValue, []);
  assert.equal(empty.providers[0].useFactory, undefined);
  assert.equal(empty.providers[0].inject, undefined);
  assert.throws(() => NodiaAiInvoiceAnalysisModule.forPublication(['unregistered_tool']));

  const uuid = '00000000-0000-4000-8000-000000000001';
  const prepare = { action: 'prepare', business_id: uuid, attachment_id: uuid };
  const extraction = {
    code: null, total_amount: 0,
    data: { issue_date: '', items: [{ name: 'Synthetic audit item', code: null, quantity: 0,
      packages: null, units_per_package: null, cost_price: null, cost_price_tax: null,
      unit_price: null, total_price: null }] },
  };
  const complete = { action: 'complete', analysis_id: uuid, extraction };
  assert(input.validate(prepare));
  assert(input.validate({ ...prepare, provider_id: '9223372036854775807' }));
  assert(input.validate(complete));
  assert(!input.validate({ ...prepare, extraction }));
  assert(!input.validate({ ...complete, business_id: uuid }));
  assert(!input.validate({ ...complete, attachment_id: uuid }));
  assert(!input.validate({ action: 'complete', analysis_id: uuid }));
  assert(!input.validate({ action: 'prepare', attachment_id: uuid }));
  const forbiddenInputFields = ['url', 'file_url', 'storage_key', 'path', 'content_base64', 'actor_id',
    'user_id', 'session_id', 'connection_id', 'mode', 'model_id', 'effort_id', 'selection',
    'provider_fields', 'tax', 'confirmed', 'native_request', 'attempt_id', 'run_id',
    'content_hash', 'source_hash', 'generation', 'retention_epoch', 'configuration_generation', 'session_generation'];
  for (const field of forbiddenInputFields) {
    assert(!input.validate({ ...prepare, [field]: 'synthetic-rejected-marker' }), field);
    assert(!input.validate({ ...complete, [field]: 'synthetic-rejected-marker' }), field);
  }
  const shared = { analysis_id: uuid, review_required: true,
    extraction_source: 'active_agentic_generation', business_id: uuid, provider_id: null,
    attachment_id: uuid, source: { attachment_id: uuid, kind: 'pdf', media_type: 'application/pdf', byte_count: 100 },
    selection: { connection_id: '1', mode: 'token_plan_agentic', model_id: 'synthetic-audit-model', effort_id: null } };
  const prepared = { status: 'prepared', ...shared, instructions: 'Synthetic offline instructions' };
  const analyzed = { status: 'analyzed', ...shared, extraction };
  assert(result.validate(prepared));
  assert(result.validate(analyzed));
  assert(!result.validate({ ...prepared, extraction }));
  assert(!result.validate({ ...analyzed, instructions: 'mixed' }));
  assert(!result.validate({ ...analyzed, review_required: false }));
  assert(!result.validate({ ...analyzed, extraction_source: 'legacy_ocr' }));
  const forbiddenOutputFields = ['storage_key', 'generation', 'retention_epoch', 'content_hash', 'source_hash',
    'configuration_generation', 'session_generation', 'attempt_id', 'run_id', 'native_reference', 'provider_fields', 'tax'];
  for (const field of forbiddenOutputFields) {
    assert(!result.validate({ ...analyzed, [field]: 'synthetic-private-marker' }), field);
    assert(!result.validate({ ...analyzed, source: { ...shared.source, [field]: 'synthetic-private-marker' } }), field);
  }
  const tooMany = structuredClone(complete);
  tooMany.extraction.data.items = Array.from({ length: 101 }, () => extraction.data.items[0]);
  assert(!input.validate(tooMany));
  const pinPath = 'nodia-server/dist/nodia-ai-context/config/knowledge-pin.json';
  const manifestPath = 'nodia-server/dist/nodia-ai/knowledge/manifest.json';
  track(pinPath);
  track(manifestPath);
  const pin = read(pinPath), manifest = read(manifestPath);
  assert.equal(manifest.release_id, pin.release_id);
  assert.equal(manifest.catalog_release, previousC02.publication.compiled_catalog_release);
  assert.equal(manifest.capability_contracts.length, 67);
  assert.equal(manifest.fragments.length, 27);
  assert.equal(manifest.documents.length, 27);
  assert(manifest.capability_contracts.every((entry) => ['read', 'read_artifact'].includes(entry.kind)));
  assert(!manifest.capability_contracts.some((entry) => entry.capability_id === tool.capabilityId));
  const publishedNames = previous.publication.actual_descriptor_names.filter((name) => ![
    'nodia_capabilities_describe', 'nodia_capabilities_search', 'nodia_entities_search',
    'nodia_knowledge_get', 'nodia_knowledge_index', 'nodia_reports_describe', 'nodia_reports_run',
  ].includes(name)).sort();
  assert.deepEqual(manifest.capability_contracts.map((entry) => entry.capability_id).sort(), publishedNames);
  track('nodia-gemini-microservice/invoice_mcp_contract.py');
  track('nodia-gemini-microservice/invoice_parser.py');
  track('nodia-gemini-microservice/schemas.py');
  const report = {
    schema_version: 1,
    stage: 'AI-36-C03',
    status: 'offline_closed_invoice_analysis_contract_verified_not_published',
    scope: 'actual_candidate_factories_and_closed_schemas_only_no_DB_HTTP_or_generation',
    baseline_C01_preserved: baseline,
    baseline_C02_preserved: baselineC02,
    structural_comparison_catalog_version: 'offline-ai36-c01-not-published',
    counts: { native_factories_and_single_preparer: groups.length, native_preparers: 77,
      preserved_C01_prepare_change: 73, preserved_C02_prepare_secure_flow: 4,
      candidate_invoice_analysis: 1, candidate_registrations_checked: 78,
      published_domain_reads: 67, published_invoice_analysis: 0, published_fragments: 27 },
    publication: { capabilities_changed: false, compiled_release_id: pin.release_id,
      compiled_catalog_release: manifest.catalog_release,
      compiled_release_changed_since_C02: pin.release_id !== previousC02.publication.compiled_release_id,
      publication_not_granted: true },
    verification: { two_closed_action_shapes: true, closed_source_projection: true,
      model_actor_URL_and_private_hash_inputs_rejected: true, private_source_hashes_rejected_from_output: true,
      review_required_and_active_generation_source: true, max_items_100: true,
      default_module_no_imports_or_external_factories: true,
      preparer_77_hashes_native_hashes_schema_refs_and_bytes_unchanged: true,
      network_guard_active: true, database_connections: 0, http_calls: 0, provider_generations: 0,
      actual_handler_or_snapshot_execution: false, SQL_acceptance: false, Gemini_acceptance: false },
    invoice_candidate: { tool_name: tool.toolName, kind: tool.kind, resource_key: tool.resourceKey,
      required_module_routes: tool.requiredModuleRoutes, action_keys: tool.actionKeys,
      mcp_contract_hash: tool.contractHash, input_schema: { definition: registration.inputSchema.definition,
        sha256: registration.inputSchema.sha256, ref: input.ref },
      output_schema: { definition: registration.outputSchema.definition,
        sha256: registration.outputSchema.sha256, ref: result.ref },
      external_prepare_execute_verify: true, input_actions: ['prepare', 'complete'],
      native_contract_port_version: 'nodia-ai-invoice-analysis/1', invoked: false, published: false,
      explicit_forbidden_input_fields: forbiddenInputFields,
      explicit_forbidden_output_fields: forbiddenOutputFields },
    preserved_preparer_contracts: preserved.sort((a, b) => a.tool_name.localeCompare(b.tool_name, 'en')),
    limits: [
      'This evidence constructs real factories and compiles actual schemas, but never invokes their SQL/profile/HTTP dependencies.',
      'Invoice extraction belongs to the active Agentic generation. No second OCR dispatch, provider selection, invoice creation or human confirmation occurs here.',
      'Candidate schema readiness is separate from publication, account availability, native attachment acceptance and full SQL/worker verification.',
      'All 77 previous preparer MCP/native hashes and schema references/source bytes are compared using the same structural catalog identity.',
      'Published capability names remain the historical 67 reads and 27 fragments; a changed registry pin does not publish this draft candidate.',
    ],
    sources: [...sources.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')),
  };
  for (const historical of [baseline, baselineC02])
    assert.equal(sha(fs.readFileSync(historical.path)), historical.sha256, 'historical report modified');
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (mode === '--write') fs.writeFileSync(output, serialized);
  else assert.equal(fs.readFileSync(output, 'utf8'), serialized, 'AI36-C03 contract evidence stale; rebuild and explicitly --write');
  process.stdout.write(JSON.stringify({ stage: report.stage, status: report.status,
    invoice_candidates: 1, preserved_preparers: preserved.length, published_invoice_analysis: 0,
    release_id: pin.release_id, mode, output, elapsed_ms: Math.round(performance.now() - started) }) + '\n');
}
main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
