/* Offline AI-36 traceability audit. Never opens a DB, HTTP listener or provider session.
 * Compiles actual read registrations and instantiates actual internal operation builders.
 * A closed schema, source mention or passing delegation test is not execution evidence. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../..");
process.chdir(root);
const mode = process.argv[2] ?? "--check";
assert(["--write", "--check"].includes(mode));
const requireReady = process.argv.includes("--require-ready");
const output = "docs/evidence/nodia-ai-ai36-capability-coverage.json";
const inventoryPath = "docs/mvp/nodia-ai-current-endpoints.json";
const catalogPath = "docs/mvp/nodia-ai-v1-tool-catalog.json";
const manifestPath = "nodia-server/dist/nodia-ai/knowledge/manifest.json";
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const source = (file) => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const walk = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${directory}/${entry.name}`)
        : [`${directory}/${entry.name}`],
    );
const fail = (message) => {
  throw new Error(message);
};
const unique = (items, label) => {
  const keys = items.map((item) => item.operationId ?? item.name);
  assert.equal(new Set(keys).size, keys.length, `duplicate ${label}`);
};
function validateMappings(inventory, catalog) {
  const handlers = inventory.controllers.flatMap(
    (controller) => controller.operations,
  );
  const tools = [
    ...catalog.domainTools,
    ...catalog.commonTools,
    ...catalog.secureFlowTools,
  ];
  unique(handlers, "handler");
  unique(tools, "candidate");
  unique(catalog.handlerCoverage, "coverage handler");
  const index = new Map(
    handlers.map((handler) => [handler.operationId, handler]),
  );
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const mapping of catalog.handlerCoverage) {
    assert(
      index.has(mapping.operationId),
      `orphan baseline handler ${mapping.operationId}`,
    );
    for (const name of mapping.toolNames) {
      assert(byName.has(name), `orphan candidate ${name}`);
      assert(
        byName.get(name).sourceHandlerIds.includes(mapping.operationId),
        `non reciprocal mapping ${mapping.operationId}/${name}`,
      );
    }
  }
  for (const tool of [...catalog.domainTools, ...catalog.secureFlowTools])
    for (const id of tool.sourceHandlerIds) {
      const handler = index.get(id);
      assert(handler, `missing handler ${id}`);
      assert(
        catalog.handlerCoverage.some(
          (mapping) =>
            mapping.operationId === id && mapping.toolNames.includes(tool.name),
        ),
        `missing candidate coverage ${id}/${tool.name}`,
      );
      const binding = tool.backendBindings?.find(
        (item) => item.operationId === id,
      );
      if (binding) {
        assert.equal(binding.httpMethod, handler.method, `method drift ${id}`);
        assert.deepEqual(binding.httpPaths, handler.paths, `alias drift ${id}`);
      }
    }
  const base = new Set(catalog.handlerCoverage.map((item) => item.operationId));
  const added = handlers.filter((handler) => !base.has(handler.operationId));
  for (const handler of added)
    assert(
      handler.paths.every((route) => route.startsWith("/api/v1/nodia-ai/")),
      `unmapped domain addition ${handler.operationId}`,
    );
  return { handlers, tools, index, base, added };
}
function negativeChecks(inventory, catalog) {
  const cases = [
    ["missing backend handler", (i) => i.controllers[0].operations.shift()],
    ["orphan candidate", (_i, c) => c.domainTools.shift()],
    [
      "missing reciprocal handler coverage",
      (_i, c) => (c.handlerCoverage[0].toolNames = []),
    ],
    [
      "drifted HTTP alias",
      (_i, c) =>
        c.domainTools[0].backendBindings[0].httpPaths.push("/arbitrary"),
    ],
    ["duplicate candidate", (_i, c) => c.domainTools.push(c.domainTools[0])],
    [
      "unmapped domain addition",
      (i) =>
        i.controllers[0].operations.push({
          operationId: "Synthetic.unmapped",
          method: "POST",
          paths: ["/api/v1/synthetic"],
        }),
    ],
  ];
  return cases.map(([name, change]) => {
    const i = structuredClone(inventory),
      c = structuredClone(catalog);
    change(i, c);
    assert.throws(() => validateMappings(i, c), undefined, name);
    return { name, rejected: true };
  });
}
function verifyActualRoutes(inventory) {
  const ts = require(path.join(root, "nodia-server/node_modules/typescript"));
  const decorators = (node) =>
    ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
  const literal = (node) =>
    !node
      ? [""]
      : ts.isStringLiteralLike(node)
        ? [node.text]
        : ts.isArrayLiteralExpression(node)
          ? node.elements.flatMap(literal)
          : fail("nonliteral route");
  const routes = [];
  for (const file of walk("nodia-server/src").filter((file) =>
    file.endsWith(".controller.ts"),
  )) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const c of sf.statements.filter(ts.isClassDeclaration)) {
      const controller = decorators(c).find(
        (d) =>
          ts.isCallExpression(d.expression) &&
          d.expression.expression.getText(sf) === "Controller",
      )?.expression;
      if (!controller) continue;
      for (const method of c.members.filter(ts.isMethodDeclaration))
        for (const decorator of decorators(method)) {
          const call = decorator.expression;
          if (
            !ts.isCallExpression(call) ||
            ![
              "Get",
              "Post",
              "Put",
              "Patch",
              "Delete",
              "Options",
              "Head",
            ].includes(call.expression.getText(sf))
          )
            continue;
          routes.push({
            operationId: `${c.name.text}.${method.name.getText(sf)}`,
            method: call.expression.getText(sf).toUpperCase(),
            paths: literal(controller.arguments[0]).flatMap((base) =>
              literal(call.arguments[0]).map((route) =>
                `/api/v1/${base}/${route}`
                  .replace(/\/+/g, "/")
                  .replace(/\/$/, ""),
              ),
            ),
          });
        }
    }
  }
  const expected = inventory.controllers
    .flatMap((controller) => controller.operations)
    .map(({ operationId, method, paths }) => ({ operationId, method, paths }));
  const sort = (list) =>
    list.sort((a, b) => a.operationId.localeCompare(b.operationId));
  assert.deepEqual(
    sort(routes),
    sort(expected),
    "live AST must match snapshot routes, including aliases",
  );
  return routes;
}
const builderGroups = [
  [
    "finance-catalog",
    "BuildNodiaAiFinanceCatalogOperationsUseCase",
    "AI-21",
    "docs/evidence/nodia-ai-ai21-postgres-integration.json",
  ],
  [
    "finance-ledger",
    "BuildNodiaAiFinanceLedgerOperationsUseCase",
    "AI-21",
    "docs/evidence/nodia-ai-ai21-postgres-integration.json",
  ],
  [
    "business-catalog",
    "BuildNodiaAiBusinessCatalogOperationsUseCase",
    "AI-22",
    "docs/evidence/nodia-ai-ai22-postgres-integration.json",
  ],
  [
    "supplier-operations",
    "BuildNodiaAiSupplierOperationsUseCase",
    "AI-22",
    "docs/evidence/nodia-ai-ai22-postgres-integration.json",
  ],
  [
    "invoice-operations",
    "BuildNodiaAiInvoiceOperationsUseCase",
    "AI-22",
    "docs/evidence/nodia-ai-ai22-postgres-integration.json",
  ],
  [
    "rental-configuration",
    "BuildNodiaAiRentalConfigurationOperationsUseCase",
    "AI-24",
    "docs/evidence/nodia-ai-ai24-postgresql.json",
  ],
  [
    "rental-reservation",
    "BuildNodiaAiRentalReservationOperationsUseCase",
    "AI-25",
    "docs/evidence/nodia-ai-ai25-postgresql.json",
  ],
  [
    "rental-money",
    "BuildNodiaAiRentalMoneyOperationsUseCase",
    "AI-26",
    "docs/evidence/nodia-ai-ai26-postgresql.json",
  ],
  [
    "rental-operations",
    "BuildNodiaAiRentalOperationsUseCase",
    "AI-26",
    "docs/evidence/nodia-ai-ai26-postgresql.json",
  ],
  [
    "core-operations",
    "BuildNodiaAiCoreOperationsUseCase",
    "AI-27",
    "docs/evidence/nodia-ai-ai27-postgresql.json",
  ],
  [
    "provider-operations",
    "BuildNodiaAiProviderOperationsUseCase",
    "AI-28",
    "docs/evidence/nodia-ai-ai28-postgresql.json",
  ],
  [
    "secure-preparation",
    "BuildNodiaAiSecureOperationsUseCase",
    "AI-29",
    "docs/evidence/nodia-ai-ai29-postgresql.json",
  ],
];
async function main() {
  process.env.DOTENV_CONFIG_PATH =
    process.platform === "win32" ? "NUL" : "/dev/null";
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_STORAGE = "memory";
  // Fail closed if a registration constructor ever tries I/O. No actual handler is invoked.
  const forbidden = () =>
    fail("AI36 offline audit attempted network or dependency invocation");
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
  const compiledArtifacts = new Map();
  const load = async (file) => {
    const artifactPath = `nodia-server/dist/${file}.js`;
    compiledArtifacts.set(artifactPath, source(artifactPath));
    return import(pathToFileURL(path.join(root, artifactPath)).href);
  };
  const inventory = read(inventoryPath),
    catalog = read(catalogPath),
    manifest = read(manifestPath);
  const mapping = validateMappings(inventory, catalog);
  const actualRoutes = verifyActualRoutes(inventory);
  assert.equal(
    inventory.sourceChecksums.length,
    new Set(inventory.sourceChecksums.map((item) => item.file)).size,
  );
  const currentSources = inventory.sourceChecksums.map((item) => {
    assert.equal(
      sha(fs.readFileSync(item.file)),
      item.sha256,
      `source drift ${item.file}`,
    );
    return item;
  });
  const ops = new Map(),
    groups = [];
  for (const [group, className, stage, evidence] of builderGroups) {
    const directory = `nodia-server/src/nodia-ai-${group}/use-case`;
    const file = walk(directory).find((file) =>
      /\/build-[^/]+\.use-case\.ts$/.test(file),
    );
    assert(file, `missing builder ${group}`);
    const compiled = file.replace("nodia-server/src/", "").replace(/\.ts$/, "");
    const Class = (await load(compiled))[className];
    const instance = new Class(...Array(35).fill(dependency));
    groups.push({
      group,
      stage,
      operation_count: instance.operations.length,
      source: source(file),
      evidence: source(evidence),
      actual_operations: instance.operations
        .map((operation) => operation.toolName)
        .sort(),
    });
    for (const operation of instance.operations) {
      assert(
        !ops.has(operation.toolName),
        `duplicate internal operation ${operation.toolName}`,
      );
      assert(
        /^[a-f0-9]{64}$/.test(operation.contractHash),
        `unversioned internal operation ${operation.toolName}`,
      );
      assert.equal(
        typeof operation.prepare,
        "function",
        `missing preparer ${operation.toolName}`,
      );
      assert.equal(typeof operation.verifyAuthority, "function");
      assert.equal(typeof operation.verifyPreconditions, "function");
      ops.set(operation.toolName, { operation, group, stage, file, evidence });
    }
  }
  const financeCreateFile =
    "nodia-server/src/nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.ts";
  const { PrepareNodiaAiFinanceMovementUseCase } = await load(
    financeCreateFile.replace("nodia-server/src/", "").replace(/\.ts$/, ""),
  );
  const movement = new PrepareNodiaAiFinanceMovementUseCase(dependency);
  ops.set(movement.toolName, {
    operation: movement,
    group: "finance-movement-create",
    stage: "AI-19..21",
    file: financeCreateFile,
    evidence: "docs/evidence/nodia-ai-ai21-postgres-integration.json",
  });
  const families = [];
  const familySources = [];
  for (const [file, exportName, args] of [
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
  ]) {
    families.push(
      (await load(`nodia-ai-products/${file}`))[exportName](...args),
    );
    familySources.push(source(`nodia-server/src/nodia-ai-products/${file}.ts`));
  }
  const rentalFile =
    "nodia-ai-products/reservations/use-case/nodia-ai-reservations-family.use-case";
  const { NodiaAiReservationsFamilyUseCase } = await load(rentalFile);
  families.push(
    new NodiaAiReservationsFamilyUseCase(
      ...Array(23).fill(dependency),
    ).family(),
  );
  familySources.push(source(`nodia-server/src/${rentalFile}.ts`));
  const { compileNodiaAiToolSchema } = await load(
    "nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case",
  );
  const registrations = new Map();
  for (const family of families)
    for (const registration of family.capabilities) {
      assert(
        !registrations.has(registration.toolName),
        `duplicate read registration ${registration.toolName}`,
      );
      compileNodiaAiToolSchema(registration.inputSchema);
      compileNodiaAiToolSchema(registration.outputSchema);
      assert.equal(typeof registration.verifyAuthority, "function");
      assert.equal(
        typeof registration.handler === "function" ||
          typeof registration.prepareExternal === "function",
        true,
        `missing executable read ${registration.toolName}`,
      );
      registrations.set(registration.toolName, {
        registration,
        family: family.familyKey,
      });
    }
  const published = new Map(
    manifest.capability_contracts.map((binding) => [
      binding.capability_id,
      binding,
    ]),
  );
  assert.equal(
    registrations.size,
    published.size,
    "actual family registrations must match compiled publication",
  );
  for (const [name, { registration }] of registrations) {
    const binding = published.get(name);
    assert(binding, `unpublished family export ${name}`);
    assert.equal(registration.capabilityId, name, `capability identity ${name}`);
    assert.equal(registration.revision, binding.revision, `revision drift ${name}`);
    assert.equal(registration.kind, binding.kind, `kind drift ${name}`);
    assert.equal(registration.publication, "published", `unpublished family ${name}`);
    assert.equal(binding.publication, "published", `unpublished binding ${name}`);
    assert.deepEqual(
      registration.requiredModuleRoutes,
      binding.required_module_routes,
    );
    for (const [side, reference] of [
      ["input", registration.inputSchema],
      ["output", registration.outputSchema],
    ]) {
      assert.equal(
        reference.definition,
        binding[`${side}_schema`].definition,
        `${name}/${side}`,
      );
      assert.equal(
        reference.sha256,
        binding[`${side}_schema`].sha256,
        `${name}/${side} hash`,
      );
      assert.equal(
        sha(fs.readFileSync(binding[`${side}_schema`].path)),
        reference.sha256,
      );
    }
  }
  const evidenceFor = (entry, tool) => {
    const data = read(entry.evidence),
      result = data.result ?? data;
    const secure = {
      nodia_secure_flows_prepare_api_key_create: "api_key_create",
      nodia_secure_flows_prepare_api_key_update: "api_key_update",
      nodia_secure_flows_prepare_connection_login: "connection_login",
      nodia_secure_flows_prepare_nodia_logout: "nodia_logout",
      nodia_api_keys_prepare_delete: "api_key_delete",
      nodia_ai_providers_prepare_codex_logout: "codex_logout",
      nodia_ai_providers_prepare_gemini_web_logout: "gemini_web_logout",
      nodia_ai_providers_prepare_sync_models: "sync_models",
    };
    const expected =
      entry.group === "secure-preparation"
        ? secure[tool.name]
        : `${(entry.operation.resourceKey ?? tool.resourceKey).replace(/^finance_/, "")}/${entry.operation.operation ?? tool.name.split("_prepare_")[1]}`;
    assert(
      result.exercised_operations.includes(expected),
      `no actual historical exercised-operation record ${tool.name}: ${expected}`,
    );
    return {
      ...source(entry.evidence),
      recorded_operation: expected,
      scope: data.scope ?? result.scope,
      evidence_layer:
        entry.group === "secure-preparation"
          ? "disposable_sql_http_worker_native_login_simulated"
          : "disposable_sql_http_worker_real_native_writer",
      reexecuted_by_this_offline_audit: false,
    };
  };
  const commonSchemaPath = "docs/mvp/nodia-ai-v1-common-contracts.schema.json";
  const common = read(commonSchemaPath);
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
  const discovery = new DiscoverNodiaAiToolsUseCase(
    { catalogVersion: manifest.catalog_release },
    dependency,
    dependency,
    fs.readFileSync(commonSchemaPath, "utf8"),
    dependency,
    reports,
  );
  const technicalDescriptors = discovery.descriptors();
  assert.equal(
    new Set(technicalDescriptors.map((item) => item.name)).size,
    technicalDescriptors.length,
    "duplicate actual technical descriptor",
  );
  assert.deepEqual(
    technicalDescriptors.map((item) => item.name).sort(),
    [
      "nodia_capabilities_search",
      "nodia_capabilities_describe",
      "nodia_entities_search",
      "nodia_reports_describe",
      "nodia_reports_run",
    ].sort(),
  );
  const commonRoutes = {
    nodia_proposals_get: [
      "NodiaAiProposalController.detail",
      "human_http_only",
    ],
    nodia_operations_get: [
      "NodiaAiOperationController.detail",
      "human_http_only",
    ],
    nodia_workflows_prepare: [
      "nodia-server/src/nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case.ts",
      "internal_port_only",
    ],
    nodia_attachments_describe: [
      "NodiaAiAttachmentController.get",
      "human_http_only",
    ],
    nodia_preferences_list: [
      "NodiaAiPreferenceController.page",
      "human_http_only",
    ],
    nodia_preferences_prepare: [
      "nodia-server/src/nodia-ai-preference/use-case/build-nodia-ai-preference-operations.use-case.ts",
      "internal_port_only",
    ],
  };
  const candidates = mapping.tools.map((tool) => {
    const bindings = (tool.sourceHandlerIds ?? []).map((id) => {
      const handler = mapping.index.get(id);
      return {
        operation_id: id,
        aliases: handler.paths.map((route) => `${handler.method} ${route}`),
        controller: inventory.controllers.find((controller) =>
          controller.operations.includes(handler),
        ).file,
        inputs: handler.inputs.map((input) => ({
          type: input.type,
          references: input.references,
        })),
        native_delegates: handler.calls,
      };
    });
    const base = {
      name: tool.name,
      cohort: catalog.domainTools.includes(tool)
        ? "domain"
        : catalog.secureFlowTools.includes(tool)
          ? "secure_flow"
          : "common",
      kind: tool.kind,
      endpoint_bindings: bindings,
      catalog_claim: tool.publication,
    };
    if (registrations.has(tool.name)) {
      const { registration, family } = registrations.get(tool.name),
        binding = published.get(tool.name);
      return {
        ...base,
        classification: ["published", "verified"],
        implementation: {
          status: "registered_read",
          family,
          handler_sources: binding.implementation_sources,
        },
        publication: {
          status: "published_domain_read",
          release: manifest.catalog_release,
        },
        contracts: {
          input: binding.input_schema,
          output: binding.output_schema,
          runtime_compiled: true,
          projection: "closed_output_schema_and_actual_reader",
        },
        authority: {
          required_module_routes: registration.requiredModuleRoutes,
          action_keys: registration.actionKeys,
          verify_before_execution: true,
          reauthorization:
            typeof registration.verifyResultAuthority === "function"
              ? "registered_result_authority"
              : "gateway_current_authority",
        },
        effect: {
          kind: "read",
          effect_key: registration.effectKey,
          isolation: registration.readIsolation ?? null,
        },
        guarantee: {
          schema_and_registration_verified_now: true,
          real_sql_and_dependency_execution:
            "historical_family_evidence_separate_from_registration",
          per_capability_live_provider_acceptance: null,
        },
        evidence: binding.evidence_paths.map((file) => source(file)),
        acceptance: {
          status: "not_proven_for_every_provider_dependency_combination",
          missing: ["not_all_67_tools_have_individual_real_Gemini_acceptance"],
        },
      };
    }
    if (ops.has(tool.name)) {
      const entry = ops.get(tool.name),
        operation = entry.operation;
      const receipt =
        entry.group === "secure-preparation"
          ? "SecureFlowReceipt"
          : tool.resourceKey?.startsWith("finance_")
            ? "FinancialEffectReceipt"
            : tool.resourceKey?.startsWith("rental_")
              ? "RentalEffectReceipt"
              : ["core-operations"].includes(entry.group)
                ? "CoreEffectReceipt"
                : entry.group === "provider-operations"
                  ? "AiProviderEffectReceipt"
                  : "BusinessEffectReceipt";
      assert(common.$defs[receipt], `missing receipt ${receipt}`);
      return {
        ...base,
        classification: ["verified", "blocked"],
        implementation: {
          status:
            entry.group === "secure-preparation"
              ? "internal_secure_preparer"
              : "internal_preparer_and_effect",
          source: source(entry.file),
          contract_hash: operation.contractHash,
          stage: entry.stage,
        },
        publication: {
          status: "not_published",
          reason: "no_explicit_reviewed_MCP_writer_binding",
        },
        contracts: {
          input: {
            validation:
              "closed_internal_decoder_and_native_DTO_not_MCP_JSON_schema",
            native_DTO_sources: bindings.flatMap((binding) =>
              binding.inputs.flatMap((input) => input.references),
            ),
          },
          output: {
            schema_path: commonSchemaPath,
            preparation: "PreparationResult",
            receipt,
            keys: operation.outputKeys ?? null,
            review_fields: operation.reviewFields ?? [],
          },
          runtime_MCP_schema_compiled: false,
        },
        authority: {
          required_module_routes: operation.moduleRoutes,
          action_keys: operation.actionKeys,
          verify_before_execution: true,
          material_preconditions: true,
        },
        effect: {
          kind: tool.kind,
          operation: tool.impact ?? null,
          native_writer_exposed: false,
          confirmation: "exact_revision_hash_authenticated_human_button",
          recovery: "atomic_receipt_or_secure_flow_protocol",
        },
        guarantee: {
          actual_registered_internal_port: true,
          recorded_native_execution: true,
          per_capability_live_Gemini_write_acceptance: false,
        },
        evidence: [evidenceFor(entry, tool)],
        acceptance: {
          status:
            "internal_guarantees_verified_MCP_publication_and_E2E_pending",
          missing: [
            "reviewed_closed_MCP_input_output_schema",
            "explicit_publication_binding",
            "actual_Gemini_preparation_to_human_confirmation_effect_receipt",
          ],
        },
      };
    }
    if (tool.kind === "analyze_attachment")
      return {
        ...base,
        classification: ["blocked"],
        implementation: {
          status: "candidate_without_NodiaAI_analyzer_registration",
          native_OCR_and_AI32_attachment_interpretation_are_not_equivalent: true,
        },
        publication: { status: "not_published" },
        contracts: {
          input: null,
          output: null,
          runtime_MCP_schema_compiled: false,
        },
        authority: {
          target_module_route: tool.targetModuleRoute,
          require_action: tool.requireAction,
        },
        effect: {
          kind: "analyze_attachment",
          requires_observed_provider_modalities_and_external_effect_policy: true,
        },
        guarantee: { actual_registered_port: false },
        evidence: [],
        acceptance: {
          status: "missing_capability_adapter",
          missing: [
            "typed_NodiaAI_invoice_analyzer_port",
            "closed_analyze_input_output_schema",
            "OCR_semantics_and_attachment_lifecycle_parity",
            "external_cost_and_human_decision_contract",
            "reviewed_publication_and_real_provider_acceptance",
          ],
        },
      };
    assert(
      base.cohort === "common",
      `orphan unimplemented domain capability ${tool.name}`,
    );
    assert(
      common.$defs[tool.inputContractRef],
      `missing helper input ${tool.name}`,
    );
    assert(
      common.$defs[tool.outputContractRef],
      `missing helper output ${tool.name}`,
    );
    const isDiscovery = [
      "nodia_capabilities_search",
      "nodia_capabilities_describe",
      "nodia_entities_search",
    ].includes(tool.name);
    const isReport = ["nodia_reports_describe", "nodia_reports_run"].includes(
      tool.name,
    );
    const alternative = commonRoutes[tool.name];
    assert(
      isDiscovery || isReport || alternative,
      `unmapped common helper ${tool.name}`,
    );
    if (alternative?.[0].endsWith(".ts")) assert(fs.existsSync(alternative[0]));
    else if (alternative)
      assert(
        mapping.index.has(alternative[0]),
        `missing actual human route ${alternative[0]}`,
      );
    return {
      ...base,
      classification: [
        "auxiliary",
        ...(isDiscovery || isReport ? ["published"] : ["blocked"]),
      ],
      implementation: {
        status:
          isDiscovery || isReport ? "MCP_technical_helper" : alternative[1],
        exact_candidate_name_registered: technicalDescriptors.some(
          (item) => item.name === tool.name,
        ),
        actual_entry:
          alternative?.[0] ??
          (isReport
            ? "nodia-server/src/nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.ts"
            : "nodia-server/src/nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case.ts"),
        equivalence: "explicit_semantic_mapping_not_automatic_alias",
      },
      publication: {
        status:
          isDiscovery || isReport
            ? "published_technical_helper_separate_from_67_domain_reads"
            : "not_published_under_candidate_name",
      },
      contracts: {
        input: { path: commonSchemaPath, definition: tool.inputContractRef },
        output:
          isReport && tool.name === "nodia_reports_run"
            ? {
                path: "nodia-server/src/nodia-ai-reports/config/report-composition.schema.json",
                definition: "$root",
                candidate_output_is_historical: tool.outputContractRef,
              }
            : { path: commonSchemaPath, definition: tool.outputContractRef },
        actual_descriptor_compiled: technicalDescriptors.some(
          (item) => item.name === tool.name,
        ),
        candidate_schema_does_not_prove_executable_binding: true,
      },
      authority: {
        authenticated_conversation_and_current_destination_authority: true,
      },
      effect: { kind: tool.kind },
      guarantee: { capability_level_acceptance_complete: false },
      evidence: [],
      acceptance: {
        status:
          isDiscovery || isReport
            ? "technical_helper_separate_from_domain_coverage"
            : "candidate_MCP_binding_pending_human_or_internal_path_implemented",
        missing:
          isDiscovery || isReport
            ? []
            : ["candidate_name_MCP_adapter_and_explicit_publication"],
      },
    };
  });
  const usedInternal = new Set(
    candidates
      .filter(
        (row) =>
          row.implementation.actual_registered_internal_port ||
          row.guarantee?.actual_registered_internal_port,
      )
      .map((row) => row.name),
  );
  for (const name of ops.keys())
    assert(usedInternal.has(name), `orphan actual internal operation ${name}`);
  const handlerMatrix = mapping.handlers.map((handler) => {
    const baseline = catalog.handlerCoverage.find(
      (item) => item.operationId === handler.operationId,
    );
    return {
      operation_id: handler.operationId,
      cohort: baseline ? "baseline_177" : "added_NodiaAI_coordination",
      aliases: handler.paths.map((route) => `${handler.method} ${route}`),
      classification:
        !baseline || baseline.treatment === "coordinator_internal"
          ? "auxiliary"
          : ["deferred_bulk", "infrastructure_only"].includes(
                baseline.treatment,
              )
            ? "excluded"
            : "capability_bound",
      treatment: baseline?.treatment ?? "auxiliary_coordination",
      capability_names: baseline?.toolNames ?? [],
      reason: baseline?.reason ?? null,
      capability_states: (baseline?.toolNames ?? []).map((name) => ({
        name,
        classification: candidates.find((row) => row.name === name)
          .classification,
      })),
    };
  });
  const pending = candidates
    .filter((row) => row.classification.includes("blocked"))
    .map((row) => ({
      name: row.name,
      status: row.acceptance.status,
      missing: row.acceptance.missing,
    }));
  const actions = [
    {
      code: "AI36-C01",
      affected: candidates
        .filter(
          (row) => row.cohort === "domain" && row.kind === "prepare_change",
        )
        .map((row) => row.name),
      required:
        "Define and test exact MCP input/output schemas and adapters for the 73 internal preparers; preserve native validation, authority, exact preview and receipt recovery. Then review explicit publication separately.",
    },
    {
      code: "AI36-C02",
      affected: candidates
        .filter((row) => row.cohort === "secure_flow")
        .map((row) => row.name),
      required:
        "Define exact secure-flow MCP preparation adapters and schemas; secrets/login remain exclusively in the authenticated human channel. Review publication separately.",
    },
    {
      code: "AI36-C03",
      affected: ["nodia_invoices_analyze"],
      required:
        "Implement the explicit invoice-analysis adapter and its closed contracts, parity, costs and lifecycle; do not equate native OCR or attachment transcription with this candidate.",
    },
    {
      code: "AI36-C04",
      affected: candidates
        .filter(
          (row) =>
            row.cohort === "common" && row.classification.includes("blocked"),
        )
        .map((row) => row.name),
      required:
        "Resolve six candidate helper MCP bindings against existing human/internal implementations, with exact contracts and fixtures; do not infer aliases from similar semantics.",
    },
    {
      code: "AI36-C05",
      affected: catalog.domainTools.map((tool) => tool.name),
      required:
        "Complete independent per-capability/dependency/provider acceptance and NR-01..34 coverage; historical family SQL and schema compilation alone do not close v1.",
    },
  ];
  const report = {
    schema_version: 1,
    stage: "AI-36",
    status: "traceability_verified_acceptance_pending",
    readiness: false,
    scope:
      "offline_current_AST_actual_registration_schema_compilation_and_historical_structured_evidence_not_new_SQL_or_Gemini_execution",
    sources: [
      source(inventoryPath),
      source(catalogPath),
      source(manifestPath),
      source(commonSchemaPath),
    ],
    counts: {
      current_handlers: mapping.handlers.length,
      current_aliases: actualRoutes.flatMap((item) => item.paths).length,
      baseline_handlers: mapping.base.size,
      added_coordination_handlers: mapping.added.length,
      tracked_source_hashes: currentSources.length,
      candidate_names: candidates.length,
      domain_candidates: catalog.domainTools.length,
      internal_preparers_including_secure: ops.size,
      actual_read_registrations: registrations.size,
      published_domain_reads: published.size,
      actual_technical_helpers: technicalDescriptors.length,
      common_candidates: catalog.commonTools.length,
      secure_flow_candidates: catalog.secureFlowTools.length,
      blocked_candidates: pending.length,
      domain_missing_closed_MCP_contract_and_binding:
        catalog.domainTools.length - registrations.size,
      excluded_bulk_handlers: catalog.handlerCoverage.filter(
        (item) => item.treatment === "deferred_bulk",
      ).length,
    },
    verification: {
      mapping_and_alias_integrity: "passed",
      every_domain_candidate_classified: true,
      compiled_read_schema_pairs: registrations.size,
      actual_internal_port_enumeration: true,
      historical_execution_evidence_explicitly_matched: ops.size,
      source_hashes_verified: currentSources.length,
      network_calls: 0,
      database_connections: 0,
      provider_generations: 0,
      negative_fixtures: negativeChecks(inventory, catalog),
      acceptance_gate: "pending",
    },
    family_sources: familySources,
    internal_groups: groups,
    handlers: handlerMatrix,
    capabilities: candidates,
    pending_acceptance: pending,
    actions,
    limitations: [
      "A source, schema, test count, publication flag or delegation mock is not real capability acceptance.",
      "Historical evidence is referenced with hashes and recorded exercised-operation identity; these SQL/provider suites were not rerun by this offline script.",
      "67 domain readers and five technical helpers are distinct from internal preparers and secure human flows.",
      "No writer or invoice analyzer is published by this audit. API mode is a later stage; Web remains conversational and Agentic is the MCP path.",
      "Independent live capability/dependency/mode acceptance, NR scenarios and rollout remain separate gates.",
    ],
  };
  report.compiled_artifacts = [...compiledArtifacts.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  report.verification.production_build_provenance =
    "Compiled hashes recorded; root AI36 build validation must establish correspondence to the current source. This audit does not infer correspondence from filenames.";
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (mode === "--write") fs.writeFileSync(output, serialized);
  else
    assert.equal(
      fs.readFileSync(output, "utf8"),
      serialized,
      "stale AI36 capability evidence; regenerate after source review",
    );
  console.log(
    JSON.stringify({
      status: report.status,
      counts: report.counts,
      structural_integrity: "passed",
      acceptance: "pending",
      output,
    }),
  );
  if (requireReady && !report.readiness) process.exitCode = 2;
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
