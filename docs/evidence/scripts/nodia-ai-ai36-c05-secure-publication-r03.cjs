/* Four safe preparations only. Credential/login actions remain in the human channel. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../..");
process.chdir(root);
const mode = process.argv[2] ?? "--check";
assert(["--author", "--check"].includes(mode));
const prefix = "docs/evidence/nodia-ai-ai36-c05-secure-publication-r03";
const previous = "docs/evidence/nodia-ai-ai36-c05-write-publication-r02";
const registryPath = "nodia-server/config/nodia-ai-knowledge.registry.json";
const authorization = prefix + "-authorization.md",
  baselinePath = prefix + "-baseline.json",
  reportPath = prefix + "-validation.json",
  schemaPath = prefix + "-secure.schema.json";
const docPath =
  "docs/nodia-ai/knowledge/general-settings/features/secure-ai-interaction.md";
const fm = require("../../../nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8")),
  json = (v) => JSON.stringify(v, null, 2) + "\n";
const entry = (p) => ({ path: p, sha256: sha(fs.readFileSync(p)) });
const write = (p, b) =>
  mode === "--author"
    ? fs.writeFileSync(p, b)
    : assert.equal(fs.readFileSync(p, "utf8"), b, "artifact drift: " + p);
const ids = [
  "nodia_secure_flows_prepare_api_key_create",
  "nodia_secure_flows_prepare_api_key_update",
  "nodia_secure_flows_prepare_connection_login",
  "nodia_secure_flows_prepare_nodia_logout",
].sort();
const sections = [
  {
    fragment: "ai36-c05-secure-ai",
    title: "Preparación segura IA publicada en AI36-C05",
    ids: ids.filter((i) => !i.endsWith("_nodia_logout")),
    routes: ["/settings/ai-providers"],
    text: "Estas herramientas preparan alta o reemplazo de una clave en el formulario seguro existente, o un login de la conexión y modo explícitos. Exigen NodiaAI, el módulo Ajustes de proveedores IA y la acción ai:manage vigentes. No introduzcas en el chat claves, contraseñas, cookies, tokens, códigos OAuth, URLs de login ni payloads nativos. El contrato no admite campos de secretos, códigos ni payloads nativos; no se afirma detección de secretos pegados en campos públicos. La preparación sólo devuelve datos públicos y una propuesta; nunca autentica, cambia la clave ni acredita disponibilidad. Después de la confirmación humana exacta, la app abre el canal seguro y conserva su timeout, ownership y recuperación nativos. Una autenticación no prueba inferencia; no inventes un modelo o fallback.",
  },
  {
    fragment: "ai36-c05-own-logout",
    title: "Preparación de logout propio publicada en AI36-C05",
    ids: ["nodia_secure_flows_prepare_nodia_logout"],
    routes: ["/tools/nodia-ai"],
    text: "Esta herramienta prepara exclusivamente cerrar la sesión Nodia del actor actual. No recibe un user_id/session_id ni permite nominar otra sesión, aunque el actor sea super_admin. Exige el acceso basal NodiaAI; no requiere el módulo administrativo de proveedores ni ai:manage. La propuesta no cierra sesión. Sólo la confirmación y el canal humano nativo pueden completarlo; conserva las reglas de expiración y reautorización. No confundir este logout propio con cerrar Codex/Gemini o revocar sesiones ajenas.",
  },
];
async function main() {
  process.env.DOTENV_CONFIG_PATH =
    process.platform === "win32" ? "NUL" : "/dev/null";
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_STORAGE = "memory";
  const forbidden = () => {
    throw Error("secure_publication_network_or_domain_access_forbidden");
  };
  globalThis.fetch = forbidden;
  for (const [n, methods] of [
    ["node:net", ["connect", "createConnection"]],
    ["node:http", ["request", "get"]],
    ["node:https", ["request", "get"]],
    ["node:tls", ["connect"]],
  ])
    for (const method of methods) require(n)[method] = forbidden;
  require("node:module").syncBuiltinESMExports();
  const dependency = new Proxy({}, { get: forbidden }),
    sources = new Map();
  const load = async (p) => {
    for (const f of [
      "nodia-server/src/" + p + ".ts",
      "nodia-server/dist/" + p + ".js",
    ])
      sources.set(f, entry(f));
    return import(
      pathToFileURL(path.join(root, "nodia-server/dist", p + ".js")).href
    );
  };
  const previousReport = read(previous + "-validation.json");
  assert.equal(previousReport.counts.published, 146);
  assert.equal(
    previousReport.status,
    "source_publication_validated_offline_not_deployed_or_provider_accepted",
  );
  if (!fs.existsSync(baselinePath)) {
    assert.equal(mode, "--author");
    const registry = read(registryPath);
    assert.equal(registry.capabilities.length, 146);
    assert.equal(registry.bindings.length, 39);
    const doc = fm.parseDocument(fs.readFileSync(docPath, "utf8"));
    assert.equal(doc.metadata.document_status, "draft");
    fs.writeFileSync(
      baselinePath,
      json({
        schema_version: 1,
        registry,
        document: {
          metadata: doc.metadata,
          body_bytes: Buffer.byteLength(doc.body),
          body_sha256: sha(doc.body),
          content_sha256: fm.contentHash(doc.metadata, doc.body),
        },
        previous_publication: [
          entry(previous + "-baseline.json"),
          entry(previous + "-validation.json"),
          entry(
            "docs/evidence/scripts/nodia-ai-ai36-c05-write-publication-r02.cjs",
          ),
        ],
      }),
    );
  }
  const baseline = read(baselinePath),
    prior = baseline.registry;
  assert.equal(prior.capabilities.length, 146);
  for (const e of baseline.previous_publication)
    assert.equal(entry(e.path).sha256, e.sha256, "historical R02 changed");
  const original = read(previous + "-baseline.json").registry;
  assert.equal(original.capabilities.length, 74);
  for (const c of original.capabilities)
    assert.deepEqual(
      prior.capabilities.find((x) => x.capability_id === c.capability_id),
      c,
    );
  const { ValidateNodiaAiRuntimePolicyUseCase } = await load(
    "nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case",
  );
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    read("nodia-server/dist/nodia-ai-runtime/config/runtime-policy.json"),
  );
  const { BuildNodiaAiSecureOperationsUseCase } = await load(
    "nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case",
  );
  const native = Reflect.construct(
    BuildNodiaAiSecureOperationsUseCase,
    Array(35).fill(dependency),
  ).operations;
  assert.equal(native.length, 8);
  const common = fs.readFileSync(
    "docs/mvp/nodia-ai-v1-common-contracts.schema.json",
    "utf8",
  );
  const { CanonicalizeNodiaAiProposalUseCase } = await load(
    "nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case",
  );
  const { ValidateNodiaAiProposalUseCase } = await load(
    "nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case",
  );
  const validate = new ValidateNodiaAiProposalUseCase(
    native,
    common,
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
  const { BuildNodiaAiWriteToolsUseCase } = await load(
    "nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case",
  );
  const { loadNodiaAiSecureContracts } = await load(
    "nodia-ai-write-tools/types/write-tool-contract.types",
  );
  const families = new BuildNodiaAiWriteToolsUseCase(
    dependency,
    dependency,
    validate,
    common,
    policy,
  ).execute(loadNodiaAiSecureContracts());
  const tools = families
    .flatMap((f) => f.capabilities)
    .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  assert.deepEqual(
    tools.map((t) => t.capabilityId),
    ids,
  );
  assert(tools.every((t) => t.kind === "prepare_secure_flow"));
  const { compileNodiaAiToolSchema } = await load(
    "nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case",
  );
  const schemaSource = tools[0].inputSchema.sourceJson;
  for (const t of tools)
    for (const s of [t.inputSchema, t.outputSchema]) {
      assert.equal(s.sourceJson, schemaSource);
      compileNodiaAiToolSchema(s);
    }
  write(schemaPath, schemaSource);
  const implementation = [
    "nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
    "nodia-server/src/nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.ts",
  ];
  const caps = tools.map((t) => ({
    capability_id: t.capabilityId,
    revision: t.revision,
    publication: "published",
    kind: t.kind,
    required_module_routes: [...t.requiredModuleRoutes],
    implementation_sources: implementation.map(entry),
    input_schema: {
      path: schemaPath,
      definition: t.inputSchema.definition,
      sha256: t.inputSchema.sha256,
    },
    output_schema: {
      path: schemaPath,
      definition: t.outputSchema.definition,
      sha256: t.outputSchema.sha256,
    },
    evidence_paths: [
      "docs/evidence/nodia-ai-ai36-c02-validation.json",
      reportPath,
    ],
  }));
  const logout = tools.find((t) => t.toolName.endsWith("_nodia_logout"));
  assert.deepEqual(logout.requiredModuleRoutes, ["/tools/nodia-ai"]);
  assert.deepEqual(logout.actionKeys, []);
  assert.equal(logout.resourceKey, "nodia_sessions");
  for (const t of tools.filter((t) => t !== logout)) {
    assert.deepEqual(t.requiredModuleRoutes, ["/settings/ai-providers"]);
    assert(t.actionKeys.includes("ai:manage"));
  }
  write(
    authorization,
    "# Autorización específica: cuatro preparaciones seguras C02 en AI36-C05\n\nInstrucción humana exacta del2026-10-24:\n\n> Me parece bien, sigamos con lo pendiente de AI-36/C05 para habilitar la creación, edición y eliminación de datos de los módulos desde NodiaAI. Usa subagentes donde se pueda.\n\nInterpretación técnica acotada: el CRUD de credenciales sólo se prepara desde NodiaAI; el alta/reemplazo siguen en el formulario seguro humano existente. El lote C02 de cuatro preparadores está implementado y se añade como sucesor del lote72 C01. Se conserva la publicación146 y sólo se añaden estos cuatro contratos y dos fragmentos separados de una ficha. No es aprobación general de documentación/ADR, revisión humana línea por línea, permiso de iniciar un login real ni aceptación de SDK, cuenta o inferencia.\n\n" +
      ids.map((i) => "- `" + i + "`").join("\n") +
      "\n\nNingún secreto, código de login, cookie, token, comando nativo ni identidad de actor/sesión forma parte de los argumentos del modelo. Preparar no ejecuta; revisión/hash, confirmación y canal humano son obligatorios. Logout propio sólo requiere NodiaAI, sin heredar rutas o acciones administrativas. Las capacidades seleccionadas siguen acotadas a67 más siete técnicos y74/131072 bytes por generación; la publicación global150 no se envía junta. El analizador C03 queda sin publicar.\n",
  );
  const parsed = fm.parseDocument(fs.readFileSync(docPath, "utf8"));
  if (
    mode === "--author" &&
    parsed.metadata.approval?.reference !== authorization
  ) {
    assert.equal(
      fm.contentHash(parsed.metadata, parsed.body),
      baseline.document.content_sha256,
      "secure feature changed during authoring",
    );
    parsed.metadata.revision++;
    parsed.metadata.document_status = "approved";
    parsed.metadata.integration_status = "published";
    parsed.metadata.implementation.status = "partial";
    parsed.metadata.implementation.notes =
      "AI36-C05 publica sólo dos fragmentos mínimos y cuatro preparadores C02 bajo autorización humana específica. Secretos/login/confirmación permanecen humanos. No acredita ejecución real de esos flujos, SDK ni inferencia.";
    for (const p of implementation)
      if (!parsed.metadata.sources.some((s) => s.path === p))
        parsed.metadata.sources.push({ path: p, kind: "implementation" });
    parsed.metadata.verification.checked_on = "2026-10-24";
    parsed.metadata.verification.evidence_paths = [
      ...new Set([
        ...parsed.metadata.verification.evidence_paths,
        "docs/evidence/nodia-ai-ai36-c02-validation.json",
        reportPath,
      ]),
    ];
    parsed.metadata.verification.notes =
      "Builders nativos, contrato seguro cerrado y publicación offline. Evidencia SQL histórica C02 separada; aceptación actual del canal humano/entorno requiere recibos propios. Los apartados previos mantienen su alcance histórico.";
    for (const s of sections)
      parsed.body +=
        (parsed.body.endsWith("\n") ? "\n" : "\n\n") +
        "## " +
        s.title +
        "\n\n" +
        s.ids.map((i) => "- `" + i + "`").join("\n") +
        "\n\n" +
        s.text +
        "\n\nEl modelo puede completar mínimos públicos y continuar sólo con draft_id/revisión CAS exactos. Preparar no confirma ni ejecuta; la disponibilidad se comprueba por el consumidor real y no se deduce de publicar este fragmento.\n";
    parsed.metadata.approval = {
      reference: authorization,
      revision: parsed.metadata.revision,
      content_sha256: fm.contentHash(parsed.metadata, parsed.body),
    };
    fs.writeFileSync(
      docPath,
      fm.serializeDocument(parsed.metadata, parsed.body),
    );
  }
  assert.equal(
    sha(Buffer.from(parsed.body).subarray(0, baseline.document.body_bytes)),
    baseline.document.body_sha256,
  );
  assert.equal(parsed.metadata.approval.reference, authorization);
  assert.equal(
    parsed.metadata.approval.content_sha256,
    fm.contentHash(parsed.metadata, parsed.body),
  );
  const current = read(registryPath);
  for (const c of prior.capabilities)
    assert.deepEqual(
      current.capabilities.find((x) => x.capability_id === c.capability_id),
      c,
    );
  for (const b of prior.bindings)
    assert.deepEqual(
      current.bindings.find(
        (x) =>
          x.document_id === b.document_id && x.fragment_id === b.fragment_id,
      ),
      b,
    );
  assert(
    current.capabilities.every(
      (c) =>
        prior.capabilities.some((p) => p.capability_id === c.capability_id) ||
        ids.includes(c.capability_id),
    ),
  );
  const bindings = sections.map((s) => ({
    document_id: parsed.metadata.document_id,
    fragment_id: s.fragment,
    purpose: "feature_explanation",
    sections: [s.title],
    requires: caps
      .filter((c) => s.ids.includes(c.capability_id))
      .map((c) => ({
        capability_id: c.capability_id,
        revision: c.revision,
        input_schema_sha256: c.input_schema.sha256,
        output_schema_sha256: c.output_schema.sha256,
      })),
    required_module_routes: s.routes,
  }));
  const wanted = {
    ...prior,
    capabilities: [...prior.capabilities, ...caps].sort((a, b) =>
      a.capability_id.localeCompare(b.capability_id),
    ),
    bindings: [...prior.bindings, ...bindings].sort(
      (a, b) =>
        a.document_id.localeCompare(b.document_id) ||
        a.fragment_id.localeCompare(b.fragment_id),
    ),
  };
  assert.equal(wanted.capabilities.length, 150);
  assert(
    !wanted.capabilities.some(
      (c) => c.capability_id === "nodia_invoices_analyze",
    ),
  );
  write(registryPath, json(wanted));
  if (mode === "--author" && !fs.existsSync(reportPath))
    fs.writeFileSync(
      reportPath,
      json({
        schema_version: 1,
        status: "publication_authoring_in_progress_not_acceptance",
      }),
    );
  const { compileKnowledge } = await import(
    pathToFileURL(
      path.join(root, "nodia-server/scripts/nodia-ai-knowledge/compiler.mjs"),
    ).href
  );
  const compiled = compileKnowledge(root);
  assert.equal(compiled.manifest.capability_contracts.length, 150);
  assert.equal(compiled.manifest.fragments.length, 41);
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
  const discover = new DiscoverNodiaAiToolsUseCase(
    { catalogVersion: prior.catalog_release },
    dependency,
    dependency,
    fs.readFileSync(
      "nodia-server/src/nodia-ai-tools/config/common-schema.json",
      "utf8",
    ),
    policy,
    reports,
  );
  const { NODIA_AI_KNOWLEDGE_TOOLS } = await load(
    "nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case",
  );
  const technical = [...NODIA_AI_KNOWLEDGE_TOOLS, ...discover.descriptors()];
  assert.equal(technical.length, 7);
  const {
    nodiaAiMcpCatalogUtf8Bytes,
    NODIA_AI_MCP_CATALOG_LIMITS,
    isNodiaAiMcpToolDescriptorValid,
  } = await load("nodia-ai-adapter/types/nodia-ai-adapter.types");
  const measured = tools.map((t) => {
    const descriptors = [
        ...technical,
        {
          name: t.toolName,
          description: t.description,
          inputSchema: compileNodiaAiToolSchema(t.inputSchema).schema,
        },
      ],
      bytes = nodiaAiMcpCatalogUtf8Bytes(descriptors);
    assert(descriptors.every(isNodiaAiMcpToolDescriptorValid));
    assert(
      descriptors.length <= NODIA_AI_MCP_CATALOG_LIMITS.tools &&
        bytes <= NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes,
    );
    return {
      capability_id: t.capabilityId,
      descriptors: descriptors.length,
      catalog_utf8_bytes: bytes,
    };
  });
  const report = {
    schema_version: 1,
    stage: "AI36-C05-C02-secure-publication-r03",
    status:
      "source_publication_validated_offline_not_deployed_or_provider_accepted",
    authorization: entry(authorization),
    baseline: entry(baselinePath),
    previous_publication: baseline.previous_publication,
    counts: {
      original_published: 74,
      prior_C01_additions: 72,
      new_C02: 4,
      published: 150,
      fragments: 41,
      remaining_unpublished: 1,
    },
    preserved: {
      original74_exact: true,
      prior146_exact: true,
      prior39_bindings_exact: true,
      prior_secure_body_exact: true,
      R02_report_historical_146_not_reexecuted_or_rewritten: true,
    },
    new_capabilities: caps,
    bindings,
    generated_schema: entry(schemaPath),
    individual_catalog_measurements: measured,
    max_individual_catalog: measured.reduce((a, b) =>
      a.catalog_utf8_bytes > b.catalog_utf8_bytes ? a : b,
    ),
    scope: {
      credential_input_and_login_stay_human: true,
      own_logout_has_no_admin_route_or_action: true,
      analyzer_unpublished: true,
      no_general_documentary_approval: true,
    },
    limits: {
      selected_capabilities: 67,
      technical: 7,
      per_generation_tools: 74,
      catalog_utf8_bytes: 131072,
      json_per_collection: 128,
      context_utf8_bytes: 262144,
      any_67_fit_not_assumed: true,
    },
    compiled: {
      release_id: compiled.manifest.release_id,
      counts: compiled.counts,
    },
    factory_sources: [...sources.values()],
    AI_provider_calls: 0,
    SQL_calls: 0,
    domain_calls: 0,
    secure_native_executions: 0,
    limitations: [
      "Source publication and historical SQL do not prove current human login, API-key flow, SDK behavior or provider inference.",
      "Every selected set still requires exact schema/context budgeting before dispatch.",
    ],
  };
  write(reportPath, json(report));
  console.log(
    json({
      status: report.status,
      published: 150,
      added: 4,
      fragments: 41,
      max_individual_catalog: report.max_individual_catalog,
      release_id: report.compiled.release_id,
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
