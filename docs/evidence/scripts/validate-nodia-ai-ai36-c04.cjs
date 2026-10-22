/* Offline evidence consolidation. No network, SQL, provider, deployment or service operation. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
process.chdir(path.resolve(__dirname, "../../.."));
const mode = process.argv[2] ?? "--check";
assert(["--write", "--check"].includes(mode));
const output = "docs/evidence/nodia-ai-ai36-c04-validation.json";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const ref = (file) => ({ path: file, sha256: sha(file) });
const files = {
  unit: ".tmp/ai36-c04-server-final.json",
  gateway: ".tmp/ai36-c04-gateway-final.json",
  reads: ".tmp/ai36-c04-common-reads-final.json",
  preparations: ".tmp/ai36-c04-common-preparation-focused.json",
  productionTypes: ".tmp/ai36-c04-server-production-types.log",
  fixtureTypes: ".tmp/ai36-c04-server-fixture-types-final.log",
  lint: ".tmp/ai36-c04-server-lint-final.log",
  build: ".tmp/ai36-c04-server-build.log",
  contracts: "docs/evidence/nodia-ai-ai36-c04-common-contracts.json",
  sql: "docs/evidence/nodia-ai-ai36-c04-common-sql-validation.json",
  sqlManifest: "docs/evidence/nodia-ai-ai36-c04-common-sql-manifest.json",
  delta: "docs/evidence/nodia-ai-ai36-c04-catalog-delta.json",
  priorKnowledge:
    "docs/evidence/nodia-ai-ai36-c04-prior-knowledge-manifest.json",
};
function tests(file) {
  const data = read(file);
  assert.equal(data.numFailedTests, 0);
  assert.equal(data.numPendingTests, 0);
  assert.equal(data.numPassedTests, data.numTotalTests);
  assert(data.testResults.every((row) => row.status === "passed"));
  return {
    tests: data.numPassedTests,
    files: data.testResults.length,
    failed: 0,
    omitted: 0,
  };
}
const unit = tests(files.unit),
  gateway = tests(files.gateway),
  reads = tests(files.reads),
  preparations = tests(files.preparations);
assert.equal(unit.files, 230);
const completeSuite = read(files.unit);
for (const [suffix, count] of [
  [
    "nodia-ai-common-reads/use-case/build-nodia-ai-common-read-tools.use-case.spec.ts",
    20,
  ],
  [
    "nodia-ai-common-preparation/use-case/build-nodia-ai-common-preparation-tools.use-case.spec.ts",
    28,
  ],
]) {
  const entry = completeSuite.testResults.find((item) =>
    item.name.replaceAll("\\", "/").endsWith(suffix),
  );
  assert(entry, "Missing complete helper test file " + suffix);
  assert.equal(entry.assertionResults.length, count);
}
assert.equal(reads.tests, 20);
assert.equal(preparations.tests, 92);
const fixtureBaseline =
  "c5c7c21e659651d0d72bd544cb4adc6ddd4b8bf16e22738a16dbd91356126dc9";
assert.equal(sha(files.fixtureTypes), fixtureBaseline);
assert.equal(
  (fs.readFileSync(files.fixtureTypes, "utf8").match(/error TS\d+:/g) ?? [])
    .length,
  192,
);
assert.equal(fs.readFileSync(files.productionTypes, "utf8").trim(), "");
assert(!/error TS\d+:/.test(fs.readFileSync(files.build, "utf8")));
const lint = fs.readFileSync(files.lint, "utf8");
assert.equal((lint.match(/: warning /g) ?? []).length, 3);
assert(!/: error /.test(lint));
const contracts = read(files.contracts);
assert.equal(contracts.counts.candidate_common_helpers, 6);
assert.equal(contracts.common_helpers.length, 6);
assert.equal(contracts.counts.candidate_registrations_checked, 84);
assert.equal(contracts.counts.native_preparers, 77);
assert.equal(contracts.counts.preserved_C03_invoice_analysis, 1);
assert.equal(contracts.counts.published_domain_reads, 67);
assert.equal(
  contracts.common_helpers.filter((item) => item.kind === "read").length,
  4,
);
assert.equal(
  contracts.common_helpers.filter(
    (item) =>
      item.kind === "prepare_workflow" ||
      item.kind === "prepare_preference_change",
  ).length,
  2,
);
for (const source of contracts.sources)
  assert.equal(sha(source.path), source.sha256, source.path);
const sql = read(files.sql);
assert.equal(sql.status, "passed");
assert(sql.checks >= 35);
assert.equal(sql.actual_provider_generations, 0);
assert.equal(sql.storage_operations, 0);
assert.equal(sql.candidate_deployed, false);
assert.equal(sql.production_publication, false);
assert.equal(sql.services_restarted, false);
assert.equal(sql.disposable_containers_remaining, 0);
for (const [stage, count] of [
  ["c01", 22],
  ["c02", 31],
  ["c03", 39],
]) {
  assert.equal(sql.regressions[stage].status, "passed");
  assert.equal(sql.regressions[stage].checks, count);
  assert.equal(sql.regressions[stage].same_compiled_execution, true);
}
for (const source of sql.source_hashes)
  assert.equal(sha(source.path), source.sha256, source.path);
const snapshot = read(files.sqlManifest);
let compiledCount = 0;
for (const [file, digest] of Object.entries(snapshot.files)) {
  if (!file.startsWith("dist/")) continue;
  assert.equal(sha("nodia-server/" + file), digest, file);
  compiledCount++;
}
assert.equal(compiledCount, sql.compiled_outputs_verified);
const delta = read(files.delta);
assert.equal(delta.after_source_count, 866);
assert.equal(delta.after_counts.localModules, 89);
assert.equal(delta.after_counts.handlerOperations, 217);
assert.equal(delta.after_counts.httpMethodPathPairs, 336);
const pin = read("nodia-server/dist/nodia-ai/knowledge/manifest.json"),
  prior = read(files.priorKnowledge);
assert.equal(pin.release_id, contracts.publication.compiled_release_id);
assert.equal(
  pin.release_id,
  "e0af65be46d699fcc79ae12e5fd23206fed98e21c64e42058c1a9b58d10839fb",
);
assert.equal(
  prior.release_id,
  "41bf6ff92268d406776fd29f07f74871ae966740f14ec45accbfcffd9969a127",
);
const {
  release_id: priorRelease,
  contract_schema_sha256: priorSchema,
  ...priorPayload
} = prior;
const {
  release_id: currentRelease,
  contract_schema_sha256: currentSchema,
  ...currentPayload
} = pin;
assert.deepEqual(currentPayload, priorPayload);
assert.notEqual(currentSchema, priorSchema);
assert.notEqual(priorRelease, currentRelease);
assert.equal(pin.capability_contracts.length, 67);
assert.equal(pin.fragments.length, 27);
assert.equal(
  read("nodia-server/config/nodia-ai-knowledge.registry.json").source_paths
    .length,
  59,
);
const publicationSchema = read(
  "nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json",
);
assert.deepEqual(publicationSchema.$defs.Capability.properties.kind.enum, [
  "read",
  "prepare_change",
  "read_artifact",
  "analyze_attachment",
  "prepare_secure_flow",
  "prepare_workflow",
  "prepare_preference_change",
]);
const report = {
  stage: "AI-36-C04",
  status: "six_common_helper_contracts_adapters_verified_publication_pending",
  server_unit: { ...unit, max_workers: 2 },
  focused_gateway: gateway,
  focused_common_reads: reads,
  focused_common_preparations: preparations,
  quality: {
    build: "passed",
    production_types: "passed",
    lint_errors: 0,
    existing_lint_warnings: 3,
    global_fixture_types: {
      existing_errors: 192,
      existing_files: 48,
      added_errors: 0,
      unchanged_baseline_sha256: fixtureBaseline,
    },
  },
  contracts: {
    common_helpers: contracts.common_helpers.map((item) => ({
      tool_name: item.tool_name,
      kind: item.kind,
      published: false,
    })),
    preserved_prior_candidates: 78,
    all_candidates: 84,
    existing_preparers: 77,
    invoice_analyzer: 1,
    native_preference_operation_ports: 3,
    native_transaction_reused: true,
    model_can_confirm_or_execute: false,
    model_can_accept_preference: false,
    closed_publication_kind_enum: 7,
  },
  sql: {
    C04_checks: sql.checks,
    C04_human_HTTP_requests: sql.http_requests,
    regressions: sql.regressions,
    migrations: sql.migrations,
    compiled_outputs_verified: compiledCount,
    real_worker_gateway_receipts_and_human_channel: true,
    provider_transport: "synthetic",
    attachment_storage: "not_accessed_metadata_only",
    actual_provider_generations: 0,
    native_effects_after_human_confirmation: [
      "preference_create",
      "preference_update",
      "preference_delete",
      "supplier_create",
      "supplier_contact_create",
    ],
  },
  publication: {
    release_id: pin.release_id,
    previous_release_id: prior.release_id,
    release_change: "only_closed_publication_kind_schema_compatibility",
    source_paths: 59,
    excluded: 32,
    domain_reads: 67,
    fragments: 27,
    added_capabilities: 0,
    published_payload_beyond_schema_hash_unchanged: true,
    readiness: false,
    selective_publication_and_provider_acceptance_pending: true,
  },
  scope: {
    new_tables: 0,
    new_migrations: 0,
    new_HTTP_routes: 0,
    UI_changed: false,
    candidate_deployed: false,
    production_services_restarted: false,
    R2_operations: 0,
    Python_changed: false,
  },
  source_inventory: {
    modules: 89,
    controllers: 46,
    handlers: 217,
    aliases: 336,
    source_hashes: 866,
  },
  evidence: Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, ref(file)]),
  ),
  historical_C03: ref("docs/evidence/nodia-ai-ai36-c03-validation.json"),
  preserved_findings: [
    "First SQL attempt exposed an actual missing publication kind enum; fixture failure/source/manifest preserved and canonical schema extended explicitly without disabling validation.",
    "Final read verification rejects a foreign non-null execution reference while retaining an authorized preconfirmation null snapshot; final complete suite rerun after changes.",
  ],
  limitations: [
    "No real provider inference/account acceptance, R2, configured-domain write, new tool publication, service restart or candidate deployment.",
    "Synthetic publication in disposable SQL exists only for verification; native worker/gateway/confirmation and effects are real in that database.",
    "PublicProposal and ExecutionStatus are native public projections; public proposal hashes/result references do not grant confirmation or secure-interaction authority.",
    "Stored tool results are authorized snapshots; use a new callback for current status. Preferences remain actor-owned even for super_admin.",
    "Client, V8 and Python were not rerun because they are unchanged; their prior reports keep their historical scope.",
    "All84 candidates can compile structurally; this does not permit exposing them with67 reads under the unchanged74-tools/131072-byte catalog limit.",
    "AI-36 remains open for selective publication and capability/dependency acceptance; AI-37..40 keep their independent gates.",
  ],
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (mode === "--write") fs.writeFileSync(output, serialized);
else
  assert.equal(
    fs.readFileSync(output, "utf8"),
    serialized,
    "C04 consolidation drift",
  );
console.log(
  JSON.stringify({
    stage: report.stage,
    mode,
    status: report.status,
    server_tests: unit.tests,
    server_files: unit.files,
    SQL_checks: sql.checks + 92,
    compiled_outputs: compiledCount,
    common_helpers: 6,
    publication_added: 0,
  }),
);
