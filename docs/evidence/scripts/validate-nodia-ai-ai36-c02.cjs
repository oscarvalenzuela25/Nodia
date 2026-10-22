/* Offline consolidation only. No SQL, provider, migration or deployment is performed here. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
process.chdir(path.resolve(__dirname, "../../.."));
const mode = process.argv[2] ?? "--check";
assert(["--write", "--check"].includes(mode));
const output = "docs/evidence/nodia-ai-ai36-c02-validation.json";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const ref = (file) => ({ path: file, sha256: sha(file) });
const files = {
  unit: ".tmp/ai36-c02-server-final.json",
  gateway: ".tmp/ai36-c02-gateway-initial.json",
  productionTypes: ".tmp/ai36-c02-adapters-production-types.log",
  fixtureTypes: ".tmp/ai36-c02-server-fixture-types-final.log",
  lint: ".tmp/ai36-c02-server-lint-final.log",
  build: ".tmp/ai36-c02-server-build.log",
  audit: "docs/evidence/nodia-ai-ai36-c02-secure-contracts.json",
  sql: "docs/evidence/nodia-ai-ai36-c02-secure-sql-validation.json",
  sqlManifest: "docs/evidence/nodia-ai-ai36-c02-secure-sql-manifest.json",
  delta: "docs/evidence/nodia-ai-ai36-c02-catalog-delta.json",
};
const units = read(files.unit);
assert.equal(units.numFailedTests, 0);
assert.equal(units.numPendingTests, 0);
assert.equal(units.numPassedTests, units.numTotalTests);
assert(units.testResults.every((item) => item.status === "passed"));
const audit = read(files.audit);
assert.equal(audit.counts.candidate_prepare_secure_flow_contracts, 4);
assert.equal(audit.counts.compiled_secure_schema_pairs, 4);
assert.equal(audit.counts.C01_hashes_and_schema_bytes_compared_unchanged, 73);
assert.equal(audit.counts.published_prepare_secure_flow, 0);
assert.equal(audit.publication.changed, false);
for (const source of audit.sources)
  assert.equal(
    sha(source.path),
    source.sha256,
    `Candidate source drift: ${source.path}`,
  );
const sql = read(files.sql);
assert.equal(sql.status, "passed");
assert.equal(sql.checks, 31);
assert.equal(sql.http_requests, 25);
assert.equal(sql.actual_provider_generations, 0);
assert.equal(sql.candidate_deployed, false);
assert.equal(sql.production_publication, false);
assert.equal(sql.scanned_coordination_tables.length, 11);
assert.equal(sql.c01_regression.status, "passed");
assert.equal(sql.c01_regression.checks, 22);
assert.equal(sql.c01_regression.http_requests, 8);
for (const [file, digest] of Object.entries(sql.evidence_sha256))
  assert.equal(sha(file), digest, `SQL evidence drift: ${file}`);
const snapshot = read(files.sqlManifest);
let compiledCount = 0;
for (const [file, digest] of Object.entries(snapshot.files)) {
  if (!file.startsWith("dist/")) continue;
  assert.equal(
    sha(`nodia-server/${file}`),
    digest,
    `SQL compiled snapshot drift: ${file}`,
  );
  compiledCount++;
}
assert.equal(compiledCount, sql.compiled_outputs_verified);
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
const delta = read(files.delta);
assert.equal(delta.after_counts.handlerOperations, 217);
assert.equal(delta.after_counts.httpMethodPathPairs, 336);
assert.equal(delta.after_source_count, 854);
const pin = read("nodia-server/dist/nodia-ai/knowledge/manifest.json");
assert.equal(pin.release_id, audit.publication.compiled_release_id);
assert.equal(
  pin.release_id,
  "b4a790219b41687d2bc4ac7ad70f436d5b9a3aa83cbdfc812533a06f8027dc23",
);
const report = {
  stage: "AI-36-C02",
  status:
    "four_secure_candidate_contracts_adapters_verified_publication_pending",
  server_unit: {
    tests: units.numPassedTests,
    files: units.testResults.length,
    failed: 0,
    omitted: 0,
    max_workers: 2,
  },
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
    secure_candidates: 4,
    C01_candidates_unchanged: 73,
    all_preparation_candidates: 77,
    native_rules_reused: true,
    publication_added: 0,
    analyzer_and_six_common_helpers_pending: true,
  },
  sql: {
    C02_checks: sql.checks,
    C02_human_http_requests: sql.http_requests,
    C01_regression: sql.c01_regression,
    migrations: 29,
    compiled_outputs_verified: compiledCount,
    real_sql_human_channel_and_crypto: true,
    provider_transport: "synthetic",
    credential_marker_scan_tables: sql.scanned_coordination_tables,
  },
  own_logout: {
    resource: "nodia_sessions",
    mcp_required_module: "/tools/nodia-ai",
    native_destination_routes_and_actions: [],
    target_actor_and_session: "backend_authenticated_context_only",
    provider_administration_required: false,
  },
  publication: {
    release_id: pin.release_id,
    domain_reads: 67,
    fragments: 27,
    added: 0,
    readiness: false,
    selection_and_provider_acceptance_pending: true,
  },
  scope_unchanged: {
    tables: true,
    migrations: true,
    http_routes: true,
    ui: true,
    native_provider_adapters: true,
    C01_schema_bytes_and_contract_hashes: true,
  },
  source_inventory: {
    modules: 86,
    controllers: 46,
    handlers: 217,
    aliases: 336,
    source_hashes: 854,
  },
  evidence: Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, ref(file)]),
  ),
  historical_C01: ref("docs/evidence/nodia-ai-ai36-c01-validation.json"),
  preserved_fixture_corrections: [
    "Initial SQL fixture incorrectly required zero slot rows; a free row is legitimate. Final assertion checks no new slot and no occupied resource, without changing production.",
    "Structural hash comparison uses the same synthetic catalog version as C01, because catalog identity participates in a registry contract hash.",
    "A final SQL pass strengthens credential-marker checks across the explicitly enumerated model-facing persistence tables; earlier attempts remain separate evidence.",
  ],
  limitations: [
    "No real provider generation, account login, R2 operation, configured domain write, new publication or candidate deployment.",
    "Credential rejection is structural; this does not prove detection of semantic secrets pasted into free text or scanning of all storage.",
    "Human login uses a real native bridge with synthetic provider transport; SQL and encryption are real inside a disposable database.",
    "Client and V8 were not rerun. Historical Client 1773/228 and prior coverage retain their original scope.",
    "MCP preparation does not confirm or execute. Secure payloads and interaction descriptors belong exclusively to authenticated human endpoints.",
    "The current transport limit of 74 tools/131072 bytes and independent JSON/context ceilings remain unchanged.",
    "AI-36 stays open for C03/C04 and publication/provider acceptance; operational deployment remains separate.",
  ],
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (mode === "--write") fs.writeFileSync(output, serialized);
else
  assert.equal(
    fs.readFileSync(output, "utf8"),
    serialized,
    "AI36-C02 consolidation drift",
  );
console.log(
  JSON.stringify({
    stage: report.stage,
    mode,
    status: report.status,
    tests: units.numPassedTests,
    files: units.testResults.length,
    sql_checks: 31 + 22,
    compiled_outputs: compiledCount,
    publication_added: 0,
  }),
);
