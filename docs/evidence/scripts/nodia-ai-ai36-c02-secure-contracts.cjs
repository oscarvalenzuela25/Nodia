/* AI36-C02 offline evidence: actual native factories, closed schemas and candidate adapters.
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
const output = "docs/evidence/nodia-ai-ai36-c02-secure-contracts.json";
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
      "AI36-C02 offline evidence attempted a network/domain dependency",
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
  track("docs/evidence/scripts/nodia-ai-ai36-c02-secure-contracts.cjs");
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
  const { ComposeNodiaAiReadFamiliesUseCase } = await load(
    "nodia-ai-products/use-case/compose-nodia-ai-read-families.use-case",
  );
  // MCP hashes bind the catalog identity. Reuse the exact C01 synthetic catalog for byte/hash comparison.
  const registry = new NodiaAiToolRegistryUseCase(
    [...ordinaryFamilies, ...secureFamilies],
    "offline-ai36-c01-not-published",
  );
  assert.equal(registry.requirements().length, 77);
  const ordinaryCompatibility = [];
  for (const family of ordinaryFamilies)
    for (const registration of family.capabilities) {
      const tool = registry.get(registration.toolName);
      const old = oldByName.get(tool.toolName);
      assert(old, `unexpected ordinary contract ${tool.toolName}`);
      assert.equal(tool.kind, "prepare_change");
      assert.equal(
        tool.contractHash,
        old.mcp_contract_hash,
        `C01 MCP hash changed ${tool.toolName}`,
      );
      assert.equal(
        native.get(tool.toolName).contractHash,
        old.native_contract_hash,
      );
      for (const side of ["input", "output"]) {
        assert.equal(
          registration[`${side}Schema`].sha256,
          old[`${side}_schema`].sha256,
        );
        assert.equal(
          registration[`${side}Schema`].definition,
          old[`${side}_schema`].definition,
        );
        assert.equal(tool[`${side}SchemaRef`], old[`${side}_schema`].ref);
      }
      ordinaryCompatibility.push({
        tool_name: tool.toolName,
        mcp_contract_hash: tool.contractHash,
        input_source_sha256: registration.inputSchema.sha256,
        output_source_sha256: registration.outputSchema.sha256,
        compared_with_C01: true,
        unchanged: true,
      });
    }
  assert.equal(ordinaryCompatibility.length, 73);

  const catalogPath = "docs/mvp/nodia-ai-v1-tool-catalog.json";
  track(catalogPath);
  const planned = read(catalogPath).secureFlowTools;
  assert.equal(planned.length, 4);
  const capabilities = [];
  const forbiddenFields = [
    "secret",
    "api_key",
    "access_token",
    "refresh_token",
    "cookie",
    "password",
    "authorization",
    "code",
    "oauth_code",
    "device_code",
    "url",
    "login_url",
    "native_reference",
    "native_request",
    "actor_id",
    "user_id",
    "session_id",
    "schema_version",
    "command",
    "origins",
    "confirmed",
    "health_state",
  ];
  for (const family of secureFamilies)
    for (const registration of family.capabilities) {
      const port = native.get(registration.toolName);
      const tool = registry.get(registration.toolName);
      const plannedTool = planned.find((entry) => entry.name === tool.toolName);
      assert(port && plannedTool);
      assert.equal(tool.kind, "prepare_secure_flow");
      assert.equal(tool.toolName, tool.capabilityId);
      const ownLogout = port.kind === "nodia_logout";
      assert.deepEqual(
        port.moduleRoutes,
        ownLogout ? [] : ["/settings/ai-providers"],
      );
      assert.deepEqual(
        registration.requiredModuleRoutes,
        ownLogout ? ["/tools/nodia-ai"] : port.moduleRoutes,
      );
      assert.deepEqual(registration.actionKeys, port.actionKeys);
      assert.equal(
        tool.resourceKey,
        ownLogout ? "nodia_sessions" : "secure_flows",
      );
      assert.deepEqual(port.bindableFields, {});
      assert.deepEqual(port.outputKeys, {});
      assert.equal(typeof registration.handler, "function");
      assert.equal(typeof registration.verifyAuthority, "function");
      assert.equal(typeof registration.verifyResultAuthority, "function");
      assert.equal("external" in registration, false);
      assert.equal("executeConfirmed" in port, false);
      const input = compileNodiaAiToolSchema(registration.inputSchema);
      const result = compileNodiaAiToolSchema(registration.outputSchema);
      assert.equal(
        input.schema.$comment,
        `native_preparer:${port.contractHash};catalog:${port.catalogVersion}`,
      );
      assert(input.validate({ partial: {} }));
      assert(!input.validate({ partial: {}, actor_id: "1" }));
      assert(!input.validate({ partial: {}, confirmed: true }));
      const draftId = "00000000-0000-4000-8000-000000000001";
      assert(!input.validate({ partial: {}, draft_id: draftId }));
      assert(!input.validate({ partial: {}, expected_draft_revision: 1 }));
      assert(
        input.validate({
          partial: {},
          draft_id: draftId,
          expected_draft_revision: 1,
        }),
      );
      assert(!result.validate({}));
      for (const field of forbiddenFields) {
        assert(
          !input.validate({
            partial: { [field]: "synthetic-rejected-marker" },
          }),
          `${tool.toolName} allowed ${field}`,
        );
        assert(
          !input.validate({
            partial: {},
            [field]: "synthetic-rejected-marker",
          }),
          `${tool.toolName} envelope allowed ${field}`,
        );
      }
      const subset = new ComposeNodiaAiReadFamiliesUseCase().execute(
        secureFamilies,
        [tool.toolName],
      );
      assert.equal(
        new NodiaAiToolRegistryUseCase(
          subset,
          "offline-ai36-c01-not-published",
        ).get(tool.toolName).contractHash,
        tool.contractHash,
      );
      capabilities.push({
        tool_name: tool.toolName,
        kind: tool.kind,
        resource_key: tool.resourceKey,
        native_operation_kind: port.kind,
        native_contract_hash: port.contractHash,
        native_catalog_version: port.catalogVersion,
        mcp_contract_hash: tool.contractHash,
        native_module_routes: port.moduleRoutes,
        effective_mcp_module_routes: registration.requiredModuleRoutes,
        action_keys: port.actionKeys,
        planned_target_module: plannedTool.targetModuleRoute,
        own_session_baseline_metadata_only: ownLogout,
        input_schema: {
          definition: registration.inputSchema.definition,
          sha256: registration.inputSchema.sha256,
          ref: input.ref,
        },
        output_schema: {
          definition: registration.outputSchema.definition,
          sha256: registration.outputSchema.sha256,
          ref: result.ref,
        },
        native_preparer_bound: true,
        schema_pair_compiled_closed: true,
        explicit_forbidden_fields_rejected: forbiddenFields,
        publication_subset_hash_unchanged: true,
        invoked: false,
        published: false,
      });
    }
  assert.equal(capabilities.length, 4);
  const pinPath =
    "nodia-server/dist/nodia-ai-context/config/knowledge-pin.json";
  const manifestPath = "nodia-server/dist/nodia-ai/knowledge/manifest.json";
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
  assert.deepEqual(
    manifest.capability_contracts.map((tool) => tool.capability_id).sort(),
    previous.publication.actual_descriptor_names
      .filter(
        (tool) =>
          ![
            "nodia_capabilities_describe",
            "nodia_capabilities_search",
            "nodia_entities_search",
            "nodia_knowledge_get",
            "nodia_knowledge_index",
            "nodia_reports_describe",
            "nodia_reports_run",
          ].includes(tool),
      )
      .sort(),
  );
  const report = {
    schema_version: 1,
    stage: "AI-36-C02",
    status: "offline_closed_secure_contracts_verified_not_published",
    scope:
      "compiled_actual_native_ports_and_candidate_schemas_only_no_execution",
    baseline_C01_preserved: baseline,
    structural_comparison_catalog_version: "offline-ai36-c01-not-published",
    counts: {
      native_factories_and_single_preparer: groups.length,
      native_ports_including_secure: native.size,
      candidate_prepare_change_contracts: 73,
      candidate_prepare_secure_flow_contracts: capabilities.length,
      compiled_secure_schema_pairs: capabilities.length,
      C01_hashes_and_schema_bytes_compared_unchanged:
        ordinaryCompatibility.length,
      candidate_registry_contracts: registry.requirements().length,
      published_domain_reads: 67,
      published_prepare_change: 0,
      published_prepare_secure_flow: 0,
      published_fragments: manifest.fragments.length,
    },
    publication: {
      changed: false,
      compiled_release_id: pin.release_id,
      compiled_catalog_release: manifest.catalog_release,
    },
    own_session_resource_decision: {
      tool_name: "nodia_secure_flows_prepare_nodia_logout",
      native_module_routes_unchanged: [],
      resource_key: "nodia_sessions",
      effective_mcp_module_routes: ["/tools/nodia-ai"],
      reason:
        "Expose the native mandatory NodiaAI baseline without merging provider administration routes into own-session logout. No model-supplied actor/session or new native authority is accepted.",
      requires_binding_review_before_publication: true,
    },
    verification: {
      native_contract_hash_embedded: true,
      four_closed_input_output_schema_pairs_compiled: true,
      C01_73_MCP_hashes_and_schema_bytes_unchanged: true,
      publication_subset_hash_stable: true,
      native_module_routes_and_action_keys_preserved: true,
      database_connections: 0,
      http_calls: 0,
      provider_generations: 0,
      domain_effects: 0,
      network_disabled_by_guard: true,
      SQL_execution_verified_by_this_script: false,
      human_channel_interaction_verified_by_this_script: false,
      Gemini_acceptance_verified_by_this_script: false,
      approval_or_publication_granted: false,
    },
    limits: [
      "Schemas compile actual native preparers without invoking their SQL authority, snapshots or domain effects; separate tests own those execution claims.",
      "Secure preparation creates only an exact human proposal. API secrets, OAuth/device codes, login URLs and viewer data remain outside MCP arguments and results.",
      "Candidates remain unpublished. Exact human confirmation and authenticated secure interaction remain mandatory before effects.",
      "The C01 historical report is read-only. All 73 current candidate hashes and input/output schema source digests are compared against it.",
      "Current published knowledge remains 67 read capabilities and 27 fragments; no claim of live provider discovery or native account availability is made.",
    ],
    native_groups: groups,
    capabilities: capabilities.sort((a, b) =>
      a.tool_name.localeCompare(b.tool_name, "en"),
    ),
    preserved_C01_contracts: ordinaryCompatibility.sort((a, b) =>
      a.tool_name.localeCompare(b.tool_name, "en"),
    ),
    sources: [...sources.values()].sort((a, b) =>
      a.path.localeCompare(b.path, "en"),
    ),
  };
  assert.equal(
    sha(fs.readFileSync(baseline.path)),
    baseline.sha256,
    "historical C01 report was modified",
  );
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (mode === "--write") fs.writeFileSync(output, serialized);
  else
    assert.equal(
      fs.readFileSync(output, "utf8"),
      serialized,
      "AI36-C02 evidence stale: rebuild and explicitly run --write",
    );
  process.stdout.write(
    JSON.stringify({
      stage: report.stage,
      status: report.status,
      secure_candidates: capabilities.length,
      preserved_C01_contracts: ordinaryCompatibility.length,
      published_secure_flows: 0,
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
