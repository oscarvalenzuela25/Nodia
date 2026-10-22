/* AI-36-C01 offline structural evidence. Constructors/schema compilation only.
 * No endpoint, domain writer, SQL query, provider, login or cloud storage operation is invoked. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../..");
process.chdir(root);
const mode = process.argv[2] ?? "--check";
assert(["--write", "--check"].includes(mode), "use --write or --check");
const output = "docs/evidence/nodia-ai-ai36-c01-write-contracts.json";
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
    throw new Error(
      "AI36-C01 offline evidence attempted network or domain dependency invocation",
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
  track("docs/evidence/scripts/nodia-ai-ai36-c01-write-contracts.cjs");
  const baseline = track(
    "docs/evidence/nodia-ai-ai36-capability-coverage.json",
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
  const native = new Map(),
    groups = [];
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
  const preparers = [...native.values()].filter(
    (port) => !port.toolName.startsWith("nodia_secure_flows_"),
  );
  assert.equal(preparers.length, 73);

  const { loadNodiaAiWriteContracts } = await load(
    "nodia-ai-write-tools/types/write-tool-contract.types",
  );
  const bundles = loadNodiaAiWriteContracts();
  assert.equal(bundles.length, 3);
  for (const name of [
    "write-finance-business",
    "write-reservations",
    "write-core-provider",
  ]) {
    track(`nodia-server/src/nodia-ai-products/contracts/${name}.json`);
    track(`nodia-server/dist/nodia-ai-products/contracts/${name}.json`);
    assert.equal(
      sha(
        fs.readFileSync(
          `nodia-server/src/nodia-ai-products/contracts/${name}.json`,
        ),
      ),
      sha(
        fs.readFileSync(
          `nodia-server/dist/nodia-ai-products/contracts/${name}.json`,
        ),
      ),
      `stale compiled contract ${name}`,
    );
  }
  assert.deepEqual(
    bundles
      .flatMap((bundle) => bundle.tools.map((tool) => tool.tool_name))
      .sort(),
    preparers.map((port) => port.toolName).sort(),
  );
  const catalogPath = "docs/mvp/nodia-ai-v1-tool-catalog.json";
  track(catalogPath);
  const catalog = read(catalogPath);
  const planned = catalog.domainTools.filter(
    (tool) => tool.kind === "prepare_change",
  );
  assert.deepEqual(
    planned.map((tool) => tool.name).sort(),
    preparers.map((port) => port.toolName).sort(),
  );
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
    preparers,
    common,
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
  const { BuildNodiaAiWriteToolsUseCase } = await load(
    "nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case",
  );
  const writeFamilies = new BuildNodiaAiWriteToolsUseCase(
    dependency,
    dependency,
    validate,
    common,
    policy,
  ).execute(bundles);
  const { NodiaAiToolRegistryUseCase, compileNodiaAiToolSchema } = await load(
    "nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case",
  );
  const { ComposeNodiaAiPublishedFamiliesUseCase } = await load(
    "nodia-ai-tools/use-case/compose-nodia-ai-published-families.use-case",
  );
  const { ComposeNodiaAiReadFamiliesUseCase } = await load(
    "nodia-ai-products/use-case/compose-nodia-ai-read-families.use-case",
  );
  const candidateRegistry = new NodiaAiToolRegistryUseCase(
    writeFamilies,
    "offline-ai36-c01-not-published",
  );
  const capabilities = [];
  for (const family of writeFamilies)
    for (const registration of family.capabilities) {
      const port = native.get(registration.toolName);
      assert(port, `missing actual preparer ${registration.toolName}`);
      assert.equal(registration.kind, "prepare_change");
      assert.deepEqual(registration.requiredModuleRoutes, port.moduleRoutes);
      assert.deepEqual(registration.actionKeys, port.actionKeys);
      assert.equal(registration.toolName, registration.capabilityId);
      assert.equal(typeof registration.handler, "function");
      assert.equal(typeof registration.verifyAuthority, "function");
      assert.equal(typeof registration.verifyResultAuthority, "function");
      const input = compileNodiaAiToolSchema(registration.inputSchema),
        outputSchema = compileNodiaAiToolSchema(registration.outputSchema);
      assert.equal(
        input.schema.$comment,
        `native_preparer:${port.contractHash};catalog:${port.catalogVersion}`,
      );
      assert(
        input.validate({ partial: {} }),
        `${port.toolName} must allow clarification`,
      );
      assert(!input.validate({ partial: {}, actor_id: "1" }));
      assert(!input.validate({ partial: {}, confirmed: true }));
      assert(!input.validate({ partial: {}, draft_id: "a".repeat(26) }));
      assert(!outputSchema.validate({}));
      const registered = candidateRegistry.get(port.toolName);
      const plannedTool = planned.find((tool) => tool.name === port.toolName);
      const subset = new ComposeNodiaAiReadFamiliesUseCase().execute(
        writeFamilies,
        [port.toolName],
      );
      assert.equal(
        new NodiaAiToolRegistryUseCase(
          subset,
          "offline-ai36-c01-not-published",
        ).get(port.toolName).contractHash,
        registered.contractHash,
      );
      capabilities.push({
        tool_name: port.toolName,
        kind: registration.kind,
        native_contract_hash: port.contractHash,
        native_catalog_version: port.catalogVersion,
        mcp_contract_hash: registered.contractHash,
        module_routes: registration.requiredModuleRoutes,
        action_keys: registration.actionKeys,
        resource_key: registration.resourceKey,
        native_resource_key: port.resourceKey ?? null,
        planned_catalog_resource_key: plannedTool.resourceKey,
        planned_resource_metadata_matches:
          plannedTool.resourceKey === registration.resourceKey,
        input_schema: {
          definition: registration.inputSchema.definition,
          sha256: registration.inputSchema.sha256,
          ref: input.ref,
        },
        output_schema: {
          definition: registration.outputSchema.definition,
          sha256: registration.outputSchema.sha256,
          ref: outputSchema.ref,
        },
        native_preparer_bound: true,
        schema_pair_compiled_closed: true,
        publication_subset_hash_unchanged: true,
        invoked: false,
        published: false,
      });
    }
  assert.equal(capabilities.length, 73);

  const pinPath =
      "nodia-server/dist/nodia-ai-context/config/knowledge-pin.json",
    manifestPath = "nodia-server/dist/nodia-ai/knowledge/manifest.json";
  track(pinPath);
  track(manifestPath);
  const pin = read(pinPath),
    manifest = read(manifestPath);
  assert.equal(
    pin.release_id,
    "b4a790219b41687d2bc4ac7ad70f436d5b9a3aa83cbdfc812533a06f8027dc23",
  );
  assert.equal(manifest.release_id, pin.release_id);
  assert.equal(manifest.capability_contracts.length, 67);
  assert.equal(manifest.fragments.length, 27);
  assert.equal(manifest.documents.length, 27);
  assert(
    manifest.capability_contracts.every((tool) =>
      ["read", "read_artifact"].includes(tool.kind),
    ),
  );
  const readFamilies = [];
  for (const [file, name, args] of [
    [
      "finance/finance-read.family",
      "createNodiaAiFinanceReadFamily",
      [dependency],
    ],
    [
      "core-settings/core-settings-read.family",
      "createNodiaAiCoreSettingsReadFamily",
      [dependency],
    ],
    [
      "business/business-tool-family",
      "createNodiaAiBusinessToolFamily",
      [
        fs.readFileSync(
          "nodia-server/src/nodia-ai-products/contracts/business.schema.json",
          "utf8",
        ),
      ],
    ],
    [
      "ai-settings/ai-settings-read.family",
      "createNodiaAiAiSettingsReadFamily",
      [],
    ],
    [
      "external/external-read.family",
      "createNodiaAiExternalReadFamily",
      [dependency],
    ],
    ["artifacts/artifacts.family", "createNodiaAiArtifactsFamily", []],
  ])
    readFamilies.push((await load(`nodia-ai-products/${file}`))[name](...args));
  const { NodiaAiReservationsFamilyUseCase } = await load(
    "nodia-ai-products/reservations/use-case/nodia-ai-reservations-family.use-case",
  );
  readFamilies.push(
    new NodiaAiReservationsFamilyUseCase(
      ...Array(23).fill(dependency),
    ).family(),
  );
  const publishedFamilies = new ComposeNodiaAiReadFamiliesUseCase().execute(
    readFamilies,
    manifest.capability_contracts.map((tool) => tool.capability_id),
  );
  const publishedRegistry = new NodiaAiToolRegistryUseCase(
    publishedFamilies,
    manifest.catalog_release,
  );
  assert.equal(publishedRegistry.requirements().length, 67);
  for (const binding of manifest.capability_contracts) {
    const registration = publishedRegistry.findCapability(
      binding.capability_id,
    );
    assert(registration);
    assert.equal(registration.inputSchemaRef.split("#")[0].length > 0, true);
    for (const side of ["input", "output"])
      assert.equal(
        registration.requirement[`${side}_schema_sha256`],
        binding[`${side}_schema`].sha256,
      );
  }
  const composed = new ComposeNodiaAiPublishedFamiliesUseCase().execute(
    publishedFamilies,
    writeFamilies,
  );
  const structuralAll = new NodiaAiToolRegistryUseCase(
    composed,
    manifest.catalog_release,
  );
  assert.equal(structuralAll.requirements().length, 140);
  for (const tool of publishedRegistry.list([
    ...new Set(
      publishedFamilies.flatMap((family) =>
        family.modules.map((module) => module.route),
      ),
    ),
  ]))
    assert.equal(
      structuralAll.get(tool.toolName).contractHash,
      tool.contractHash,
      `read contract changed ${tool.toolName}`,
    );
  const { NodiaAiReportToolsUseCase } = await load(
    "nodia-ai-tools/use-case/nodia-ai-report-tools.use-case",
  );
  const reports = new NodiaAiReportToolsUseCase(
    dependency,
    dependency,
    dependency,
  );
  const { DiscoverNodiaAiToolsUseCase } = await load(
    "nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case",
  );
  const discoverySource =
    "nodia-server/dist/nodia-ai-tools/config/common-schema.json";
  track(discoverySource);
  const discovery = new DiscoverNodiaAiToolsUseCase(
    publishedRegistry,
    dependency,
    dependency,
    fs.readFileSync(discoverySource, "utf8"),
    policy,
    reports,
  );
  const { NODIA_AI_KNOWLEDGE_TOOLS } = await load(
    "nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case",
  );
  const {
    NODIA_AI_MCP_CATALOG_LIMITS,
    nodiaAiMcpCatalogUtf8Bytes,
    isNodiaAiMcpToolDescriptorValid,
  } = await load("nodia-ai-adapter/types/nodia-ai-adapter.types");
  const routes = [
    ...new Set(
      publishedFamilies.flatMap((family) =>
        family.modules.map((module) => module.route),
      ),
    ),
  ];
  const technical = [...NODIA_AI_KNOWLEDGE_TOOLS, ...discovery.descriptors()];
  const actualDescriptors = [
    ...technical,
    ...publishedRegistry
      .list(routes)
      .map((tool) => ({
        name: tool.toolName,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
  ];
  assert.equal(technical.length, 7);
  assert.equal(actualDescriptors.length, 74);
  assert(actualDescriptors.every(isNodiaAiMcpToolDescriptorValid));
  assert.equal(NODIA_AI_MCP_CATALOG_LIMITS.tools, 74);
  assert(
    nodiaAiMcpCatalogUtf8Bytes(actualDescriptors) <=
      NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes,
  );
  const allCandidateDescriptors =
    structuralAll.requirements().length + technical.length;
  assert.equal(allCandidateDescriptors, 147);
  const report = {
    schema_version: 1,
    stage: "AI-36-C01",
    status: "offline_structural_contracts_verified_not_published",
    scope:
      "compiled_actual_native_ports_and_closed_candidate_schemas_only_no_execution",
    baseline_audit_preserved: baseline,
    counts: {
      native_factories_and_single_preparer: groups.length,
      native_ports_including_secure: native.size,
      excluded_prepare_secure_flow_ports: native.size - preparers.length,
      candidate_prepare_change_contracts: capabilities.length,
      compiled_schema_pairs: capabilities.length,
      composed_domain_contracts_not_published:
        structuralAll.requirements().length,
      published_domain_reads: 67,
      published_writers: 0,
      published_fragments: manifest.fragments.length,
      actual_technical_descriptors: technical.length,
      actual_mcp_descriptors: actualDescriptors.length,
    },
    publication: {
      changed: false,
      compiled_release_id: pin.release_id,
      compiled_catalog_release: manifest.catalog_release,
      actual_descriptor_names: actualDescriptors
        .map((tool) => tool.name)
        .sort(),
      descriptor_utf8_bytes: nodiaAiMcpCatalogUtf8Bytes(actualDescriptors),
    },
    unchanged_limits: {
      json_collection_items: policy.results.json_collection_items,
      assembled_context_utf8_bytes: policy.results.assembled_context_utf8_bytes,
      mcp_catalog_tools: NODIA_AI_MCP_CATALOG_LIMITS.tools,
      mcp_catalog_utf8_bytes: NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes,
      all_reads_plus_candidates_plus_technical: allCandidateDescriptors,
      all_candidates_exceed_current_catalog_and_collection_ceiling:
        allCandidateDescriptors > policy.results.json_collection_items &&
        allCandidateDescriptors > NODIA_AI_MCP_CATALOG_LIMITS.tools,
      publication_requires_bounded_selection_review: true,
    },
    planned_resource_metadata_differences_requiring_publication_review:
      capabilities
        .filter((tool) => !tool.planned_resource_metadata_matches)
        .map((tool) => ({
          tool_name: tool.tool_name,
          planned_resource_key: tool.planned_catalog_resource_key,
          native_adapter_resource_key: tool.resource_key,
        })),
    verification: {
      actual_native_port_binding: true,
      closed_input_output_schema_compilation: true,
      native_contract_hash_embedded: true,
      publication_subset_hash_stable: true,
      read_contract_hashes_unchanged_when_composed: true,
      database_connections: 0,
      http_calls: 0,
      provider_generations: 0,
      domain_effects: 0,
      network_disabled_by_guard: true,
      sql_execution_verified_by_this_script: false,
      gemini_acceptance_verified_by_this_script: false,
      approval_or_publication_granted: false,
    },
    limits: [
      "Constructing a native port and compiling a closed schema do not execute or validate its SQL authorization, domain rules or recovery.",
      "Structured schema checks are supplemented by native DTO/decoder validation for semantic, byte-size and cross-field rules.",
      "MCP candidates remain unpublished. Exact human confirmation and native receipts are still required before any effect.",
      "Separate disposable SQL evidence owns execution checks; this report neither reruns it nor claims account acceptance.",
    ],
    native_groups: groups,
    capabilities: capabilities.sort((a, b) =>
      a.tool_name.localeCompare(b.tool_name, "en"),
    ),
    sources: [...sources.values()].sort((a, b) =>
      a.path.localeCompare(b.path, "en"),
    ),
  };
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (mode === "--write") fs.writeFileSync(output, serialized);
  else
    assert.equal(
      fs.readFileSync(output, "utf8"),
      serialized,
      "AI36-C01 evidence stale: rebuild and run --write explicitly",
    );
  assert.equal(
    sha(fs.readFileSync(baseline.path)),
    baseline.sha256,
    "historical audit was modified",
  );
  process.stdout.write(
    JSON.stringify({
      stage: report.stage,
      status: report.status,
      candidates: 73,
      published_writers: 0,
      actual_mcp_descriptors: 74,
      release_id: pin.release_id,
      mode,
      output,
      elapsed_ms: Math.round(performance.now() - started),
    }) + "\n",
  );
}
main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
