/* Add only the remaining C01 preparations. No DB, network, provider or domain call. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../..");
process.chdir(root);
const mode = process.argv[2] ?? "--check";
assert(["--author", "--check"].includes(mode));
const prefix = "docs/evidence/nodia-ai-ai36-c05-write-publication-r02";
const registryPath = "nodia-server/config/nodia-ai-knowledge.registry.json";
const authorization = prefix + "-authorization.md",
  baselinePath = prefix + "-baseline.json",
  reportPath = prefix + "-validation.json";
const fm = require("../../../nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8")),
  json = (v) => JSON.stringify(v, null, 2) + "\n";
const entry = (p) => ({ path: p, sha256: sha(fs.readFileSync(p)) });
const write = (p, b) =>
  mode === "--author"
    ? fs.writeFileSync(p, b)
    : assert.equal(fs.readFileSync(p, "utf8"), b, "artifact drift: " + p);
const specs = [
  [
    "personal-finance/features/confirmed-movement-effect.md",
    [
      "finance_categories",
      "finance_category_groups",
      "finance_movements",
      "finance_obligations",
    ],
    "Finanzas: preparaciones adicionales publicadas en AI36-C05",
    "finance-catalog",
    "finance-ledger",
  ],
  [
    "businesses/features/confirmed-business-effects.md",
    [
      "businesses",
      "products",
      "product_logs",
      "providers",
      "provider_contacts",
      "invoices",
    ],
    "Negocios: preparaciones publicadas en AI36-C05",
    "business-catalog",
    "supplier-operations",
    "invoice-operations",
  ],
  [
    "reservations/features/confirmed-configuration.md",
    [
      "rental_properties",
      "rental_collaborators",
      "rental_cancellation_policies",
    ],
    "Reservas: configuración publicada en AI36-C05",
    "rental-configuration",
  ],
  [
    "reservations/features/confirmed-reservation-lifecycle.md",
    ["rental_reservations"],
    "Reservas: ciclo de vida publicado en AI36-C05",
    "rental-reservation",
  ],
  [
    "reservations/features/confirmed-money.md",
    ["rental_payments", "rental_expenses"],
    "Reservas: operaciones monetarias publicadas en AI36-C05",
    "rental-money",
  ],
  [
    "reservations/features/confirmed-occupancy-preparation.md",
    ["rental_blocks", "rental_turnovers"],
    "Reservas: ocupación y preparación publicadas en AI36-C05",
    "rental-operations",
  ],
  [
    "general-settings/features/confirmed-administration.md",
    [
      "users",
      "roles",
      "actions",
      "business_actions",
      "modules",
      "module_groups",
    ],
    "Core: administración publicada en AI36-C05",
    "core-operations",
  ],
  [
    "general-settings/features/confirmed-ai-configuration.md",
    ["ai_providers", "ai_provider_catalog", "ai_api_keys"],
    "IA: administración no secreta publicada en AI36-C05",
    "provider-operations",
    "secure-preparation",
  ],
].map(([p, resources, section, ...groups]) => ({
  path: "docs/nodia-ai/knowledge/" + p,
  resources,
  section,
  groups,
}));
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
  process.env.DOTENV_CONFIG_PATH =
    process.platform === "win32" ? "NUL" : "/dev/null";
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_STORAGE = "memory";
  const forbidden = () => {
    throw Error("publication_domain_or_network_access_forbidden");
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
  const dependency = new Proxy({}, { get: forbidden });
  const sources = new Map(),
    load = async (p) => {
      for (const f of [
        "nodia-server/src/" + p + ".ts",
        "nodia-server/dist/" + p + ".js",
      ])
        sources.set(f, entry(f));
      return import(
        pathToFileURL(path.join(root, "nodia-server/dist", p + ".js")).href
      );
    };
  if (!fs.existsSync(baselinePath)) {
    assert.equal(mode, "--author");
    const registry = read(registryPath);
    assert.equal(registry.capabilities.length, 74);
    assert.equal(registry.bindings.length, 31);
    const docs = registry.source_paths.map((p) => {
      const d = fm.parseDocument(fs.readFileSync(p, "utf8"));
      return {
        path: p,
        metadata: d.metadata,
        body_bytes: Buffer.byteLength(d.body),
        body_sha256: sha(d.body),
        content_sha256: fm.contentHash(d.metadata, d.body),
      };
    });
    fs.writeFileSync(
      baselinePath,
      json({ schema_version: 1, registry, documents: docs }),
    );
  }
  const baseline = read(baselinePath),
    prior = baseline.registry;
  assert.equal(prior.capabilities.length, 74);
  const { ValidateNodiaAiRuntimePolicyUseCase } = await load(
    "nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case",
  );
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    read("nodia-server/dist/nodia-ai-runtime/config/runtime-policy.json"),
  );
  const native = [];
  for (const [group, name, file] of builders) {
    const C = (await load(`nodia-ai-${group}/use-case/${file}`))[name];
    native.push(...Reflect.construct(C, Array(35).fill(dependency)).operations);
  }
  const { PrepareNodiaAiFinanceMovementUseCase } = await load(
    "nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case",
  );
  native.push(new PrepareNodiaAiFinanceMovementUseCase(dependency));
  assert.equal(native.length, 77);
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
  const families = new BuildNodiaAiWriteToolsUseCase(
    dependency,
    dependency,
    validate,
    common,
    policy,
  ).execute();
  const oldIds = new Set(prior.capabilities.map((c) => c.capability_id));
  const tools = families
    .flatMap((f) => f.capabilities)
    .filter((t) => !oldIds.has(t.capabilityId))
    .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  assert.equal(tools.length, 72);
  assert(tools.every((t) => t.kind === "prepare_change"));
  assert.equal(new Set(tools.map((t) => t.capabilityId)).size, 72);
  const excluded = [
    "nodia_secure_flows_prepare_api_key_create",
    "nodia_secure_flows_prepare_api_key_update",
    "nodia_secure_flows_prepare_connection_login",
    "nodia_secure_flows_prepare_nodia_logout",
    "nodia_invoices_analyze",
  ];
  assert(!tools.some((t) => excluded.includes(t.toolName)));
  const { compileNodiaAiToolSchema } = await load(
    "nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case",
  );
  const schemaFiles = new Map(),
    newCapabilities = tools.map((t) => {
      const doc = specs.find((d) => d.resources.includes(t.resourceKey));
      assert(doc, "unbound resource " + t.resourceKey);
      const bundle = JSON.parse(t.inputSchema.sourceJson).$id;
      assert.equal(bundle, JSON.parse(t.outputSchema.sourceJson).$id);
      const priorSchema = prior.capabilities
        .flatMap((c) => [c.input_schema, c.output_schema])
        .find(
          (s) => JSON.parse(fs.readFileSync(s.path, "utf8")).$id === bundle,
        );
      if (priorSchema)
        assert.equal(
          fs.readFileSync(priorSchema.path, "utf8"),
          t.inputSchema.sourceJson,
          "shared historical schema changed",
        );
      const schemaPath =
        priorSchema?.path ??
        prefix +
          "-" +
          (bundle.includes("write-reservations")
            ? "reservations"
            : "core-provider") +
          ".schema.json";
      for (const s of [t.inputSchema, t.outputSchema]) {
        compileNodiaAiToolSchema(s);
        assert(
          !schemaFiles.has(schemaPath) ||
            schemaFiles.get(schemaPath) === s.sourceJson,
        );
        schemaFiles.set(schemaPath, s.sourceJson);
      }
      const implementations = [
        "nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
        ...doc.groups.map(
          (g) =>
            "nodia-ai-" +
            g +
            "/use-case/" +
            builders.find((b) => b[0] === g)[2] +
            ".ts",
        ),
      ];
      return {
        capability_id: t.capabilityId,
        revision: t.revision,
        publication: "published",
        kind: t.kind,
        required_module_routes: [...t.requiredModuleRoutes],
        implementation_sources: implementations.map((p) =>
          entry("nodia-server/src/" + p),
        ),
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
          "docs/evidence/nodia-ai-ai36-c01-validation.json",
          reportPath,
        ],
      };
    });
  for (const [p, b] of schemaFiles)
    if (p.startsWith(prefix)) write(p, b);
    else assert.equal(fs.readFileSync(p, "utf8"), b);
  const authorizationText =
    "# Autorización específica: preparaciones C01 adicionales en AI36-C05\n\nInstrucción humana exacta del2026-10-24:\n\n> Me parece bien, sigamos con lo pendiente de AI-36/C05 para habilitar la creación, edición y eliminación de datos de los módulos desde NodiaAI. Usa subagentes donde se pueda.\n\nNo se atribuye una revisión humana línea por línea.\n\nSe publica únicamente el lote exacto de72 preparadores C01 enumerado abajo y las ocho secciones mínimas enlazadas en la validación. No se aprueban especificaciones, ADR ni apartados históricos completos. Se conserva el primer lote74 y sus bindings; no se publica ningún flujo C02 de credenciales/login ni el analizador C03. El agente realiza la revisión técnica bajo esta instrucción específica, conforme al precedente C05.\n\n" +
    tools.map((t) => "- `" + t.capabilityId + "`").join("\n") +
    "\n\nPreparar guarda borradores/propuestas, nunca autoriza ni ejecuta el efecto comercial. El botón humano confirma la revisión y hash exactos; módulos, acciones, referencias, reglas nativas y scope se revalidan. Borrado sólo existe donde el backend lo implementa: no traducir cancelar/anular/desactivar en DELETE ni habilitar bulk/importación. No se ingresa SQL, secretos ni códigos de login al modelo. Las operaciones administrativas IA aquí enumeradas reciben sólo identidades o configuración no secreta y siguen el canal de ejecución nativo existente.\n\nSelección por etapas: máximo67 capacidades seleccionadas más siete técnicos,74 herramientas/131072 bytes por generación, JSON128 por colección y contexto262144 bytes. La publicación global146 no implica enviarlas juntas ni que cualquier selección67 quepa por bytes. Despliegue, inferencia, efectos y aceptación por capacidad/entorno permanecen pendientes de recibos reales; esta publicación no los acredita.\n";
  write(authorization, authorizationText);
  const sections = [];
  for (const doc of specs) {
    const selected = newCapabilities.filter((t) =>
      doc.resources.includes(
        tools.find((x) => x.capabilityId === t.capability_id).resourceKey,
      ),
    );
    assert(selected.length);
    const old = baseline.documents.find((d) => d.path === doc.path),
      parsed = fm.parseDocument(fs.readFileSync(doc.path, "utf8"));
    assert(old);
    if (
      mode === "--author" &&
      parsed.metadata.approval?.reference !== authorization
    ) {
      assert.equal(
        fm.contentHash(parsed.metadata, parsed.body),
        old.content_sha256,
        "document changed during publication",
      );
      parsed.metadata.revision++;
      parsed.metadata.document_status = "approved";
      parsed.metadata.integration_status = "published";
      parsed.metadata.implementation.status = "partial";
      parsed.metadata.implementation.notes =
        "AI36-C05 publica sólo la sección adicional enumerada bajo autorización humana específica; los apartados previos conservan su fecha y alcance. Contratos internos y publicación no prueban despliegue, inferencia o aceptación productiva.";
      for (const i of selected.flatMap((c) => c.implementation_sources))
        if (!parsed.metadata.sources.some((s) => s.path === i.path))
          parsed.metadata.sources.push({
            path: i.path,
            kind: "implementation",
          });
      parsed.metadata.verification.checked_on = "2026-10-24";
      parsed.metadata.verification.evidence_paths = [
        ...new Set([
          ...parsed.metadata.verification.evidence_paths,
          "docs/evidence/nodia-ai-ai36-c01-validation.json",
          reportPath,
        ]),
      ];
      parsed.metadata.verification.notes =
        "Publicación offline con builders nativos y schemas cerrados. El fragmento adicional es el único alcance nuevo; no equivale a cuenta real ni a una aceptación de todos sus efectos.";
      const details = doc.resources.includes("ai_providers")
        ? " Configurar no acredita disponibilidad. Eliminar una clave usa sólo su identidad, nunca su secreto. Logout/sync son comandos explícitos separados: no fallback, login automático ni cambio de proveedor/modelo inferido. Los cuatro flujos seguros de credenciales/login C02 siguen fuera."
        : doc.path.includes("reservations/")
          ? " Confirmar/iniciar/completar/cancelar, pagar/anular y aprobar preparación conservan sus reglas y permisos nativos. No son eliminaciones físicas ni revierten automáticamente dinero u ocupación."
          : doc.path.includes("businesses/")
            ? " No existe borrado físico de negocios, productos, logs, proveedores, contactos o facturas en estos preparadores. Actividad y set_active conservan su semántica; no simular DELETE. Archivos de factura sólo usan referencias acreditadas y el protocolo de adjuntos existente."
            : doc.path.includes("general-settings/")
              ? " Los cambios de usuarios, roles, acciones, módulos y asignaciones conservan autoridad Core, reglas de último administrador y precondiciones actuales. Una propuesta no concede su propia autoridad."
              : " Categorías, grupos, movimientos y obligaciones conservan dueño autorizado, referencias, estados y restricciones financieras. No inventar importes, categoría ni estado pagado; preguntar por mínimos ausentes.";
      parsed.body +=
        (parsed.body.endsWith("\n") ? "\n" : "\n\n") +
        "## " +
        doc.section +
        "\n\nEste fragmento añade sólo estas preparaciones publicadas:\n\n" +
        selected.map((c) => "- `" + c.capability_id + "`").join("\n") +
        "\n\nCada herramienta recibe un partial cerrado, devuelve mínimos faltantes o propuesta revisable y permite continuar sólo con draft_id/revisión CAS exactos. No aplica el cambio de dominio. Consulta las referencias reales; nunca inventes IDs o enlaces. Sólo el botón humano sobre revisión/hash exactos admite la ejecución y su recibo nativo. No se aceptan SQL, comandos arbitrarios, secretos ni bulk/importación." +
        details +
        "\n\nEl backend exige NodiaAI y cada módulo/acción de destino vigentes, reautoriza al ejecutar y conserva recuperación/idempotencia. Publicación, selección del intento, disponibilidad, despliegue y aceptación real son estados distintos. Los apartados anteriores son históricos y no amplían este lote.\n";
      parsed.metadata.approval = {
        reference: authorization,
        revision: parsed.metadata.revision,
        content_sha256: fm.contentHash(parsed.metadata, parsed.body),
      };
      fs.writeFileSync(
        doc.path,
        fm.serializeDocument(parsed.metadata, parsed.body),
      );
    }
    // This previously excluded draft linked two directories, which the real compiler rejects.
    // Resolve only those links; reversing these exact substitutions must recover its old body hash.
    const directoryLinks = doc.path.endsWith(
      "/confirmed-reservation-lifecycle.md",
    )
      ? [
          [
            "../../../../../nodia-server/src/rental-reservation/dto/",
            "../../../../../nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts",
          ],
          [
            "../../../../../nodia-server/src/rental-reservation/use-case/",
            "../../../../../nodia-server/src/rental-reservation/use-case/create-rental-reservation.use-case.ts",
          ],
        ]
      : [];
    for (const [from, to] of directoryLinks)
      if (parsed.body.includes("](" + from + ")")) {
        assert.equal(mode, "--author");
        assert.equal(old.metadata.document_status, "draft");
        parsed.body = parsed.body.replace("](" + from + ")", "](" + to + ")");
        parsed.metadata.approval.content_sha256 = fm.contentHash(
          parsed.metadata,
          parsed.body,
        );
        fs.writeFileSync(
          doc.path,
          fm.serializeDocument(parsed.metadata, parsed.body),
        );
      }
    const inverseBody = directoryLinks.reduce(
      (body, [from, to]) => body.replace("](" + to + ")", "](" + from + ")"),
      parsed.body,
    );
    assert.equal(
      sha(Buffer.from(inverseBody).subarray(0, old.body_bytes)),
      old.body_sha256,
      "historical body changed",
    );
    assert.equal(parsed.metadata.approval.reference, authorization);
    assert.equal(
      parsed.metadata.approval.content_sha256,
      fm.contentHash(parsed.metadata, parsed.body),
    );
    sections.push({
      document_id: parsed.metadata.document_id,
      path: doc.path,
      revision: parsed.metadata.revision,
      section: doc.section,
      content_sha256: parsed.metadata.approval.content_sha256,
      ids: selected.map((c) => c.capability_id),
    });
  }
  for (const old of baseline.documents)
    if (!specs.some((d) => d.path === old.path)) {
      const d = fm.parseDocument(fs.readFileSync(old.path, "utf8"));
      assert.equal(
        fm.contentHash(d.metadata, d.body),
        old.content_sha256,
        "unrelated document changed",
      );
    }
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
        oldIds.has(c.capability_id) ||
        newCapabilities.some((n) => n.capability_id === c.capability_id),
    ),
    "later publication exists",
  );
  const wanted = {
    ...prior,
    capabilities: [...prior.capabilities, ...newCapabilities].sort((a, b) =>
      a.capability_id.localeCompare(b.capability_id),
    ),
    bindings: [
      ...prior.bindings,
      ...sections.map((s) => ({
        document_id: s.document_id,
        fragment_id: "ai36-c05-c01-writes",
        purpose: "feature_explanation",
        sections: [s.section],
        requires: newCapabilities
          .filter((c) => s.ids.includes(c.capability_id))
          .map((c) => ({
            capability_id: c.capability_id,
            revision: c.revision,
            input_schema_sha256: c.input_schema.sha256,
            output_schema_sha256: c.output_schema.sha256,
          })),
        required_module_routes: [
          ...new Set(
            newCapabilities
              .filter((c) => s.ids.includes(c.capability_id))
              .flatMap((c) => c.required_module_routes),
          ),
        ].sort(),
      })),
    ].sort(
      (a, b) =>
        a.document_id.localeCompare(b.document_id) ||
        a.fragment_id.localeCompare(b.fragment_id),
    ),
  };
  assert.equal(wanted.capabilities.length, 146);
  write(registryPath, json(wanted));
  // The compiler checks evidence file existence; the final report is replaced only after all checks pass.
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
  assert.equal(compiled.manifest.capability_contracts.length, 146);
  assert.equal(compiled.manifest.fragments.length, 39);
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
    const descriptor = {
      name: t.toolName,
      description: t.description,
      inputSchema: compileNodiaAiToolSchema(t.inputSchema).schema,
    };
    const descriptors = [...technical, descriptor],
      bytes = nodiaAiMcpCatalogUtf8Bytes(descriptors);
    assert(descriptors.every(isNodiaAiMcpToolDescriptorValid));
    assert(
      descriptors.length <= NODIA_AI_MCP_CATALOG_LIMITS.tools &&
        bytes <= NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes,
      "candidate cannot fit with technical descriptors " + t.toolName,
    );
    return {
      capability_id: t.capabilityId,
      descriptors: descriptors.length,
      catalog_utf8_bytes: bytes,
    };
  });
  const report = {
    schema_version: 1,
    stage: "AI36-C05-C01-write-publication-r02",
    status:
      "source_publication_validated_offline_not_deployed_or_provider_accepted",
    authorization: entry(authorization),
    baseline: entry(baselinePath),
    counts: {
      prior_published: 74,
      added_prepare_change: 72,
      published: 146,
      fragments: 39,
      excluded_secure_flows: 4,
      excluded_analysis: 1,
    },
    preserved: {
      prior_capabilities_exact: true,
      prior_bindings_exact: true,
      approved_prior_content_exact: true,
      prior_draft_body_restorable_via_two_link_fixes: true,
      draft_link_fixes: [{ path: specs[3].path, links: 2 }],
      unrelated_documents_exact: true,
      catalog_release: prior.catalog_release,
    },
    new_capabilities: newCapabilities,
    sections,
    generated_schemas: [...schemaFiles.keys()].map(entry),
    individual_catalog_measurements: measured,
    max_individual_catalog: measured.reduce((a, b) =>
      a.catalog_utf8_bytes > b.catalog_utf8_bytes ? a : b,
    ),
    limits: {
      per_generation_tools: 74,
      catalog_utf8_bytes: 131072,
      selected_capabilities: 67,
      json_items_per_collection: 128,
      grant_operations: 128,
      context_utf8_bytes: 262144,
      any_67_preparers_fit_not_assumed: true,
    },
    remaining_unpublished: excluded,
    compiled: {
      release_id: compiled.manifest.release_id,
      counts: compiled.counts,
    },
    factory_sources: [...sources.values()],
    AI_provider_calls: 0,
    SQL_calls: 0,
    domain_calls: 0,
    limitations: [
      "Offline compiler and constructor verification do not certify each business effect, deployment or inference.",
      "Every actual selected set still requires its exact size/context check before dispatch; no truncation or limit increase.",
    ],
  };
  write(reportPath, json(report));
  console.log(
    json({
      status: report.status,
      published: 146,
      added: 72,
      fragments: 39,
      max_individual_catalog: report.max_individual_catalog,
      release_id: report.compiled.release_id,
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
