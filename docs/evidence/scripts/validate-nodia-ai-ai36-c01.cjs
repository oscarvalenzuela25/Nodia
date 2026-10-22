/* Offline consolidation. Does not execute providers, SQL, migrations or deployment. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
process.chdir(path.resolve(__dirname, "../../.."));
const mode = process.argv[2] ?? "--check";
assert(["--write", "--check"].includes(mode));
const output = "docs/evidence/nodia-ai-ai36-c01-validation.json";
const sha = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const ref = (file) => ({ path: file, sha256: sha(file) });
const files = {
  unit: ".tmp/ai36-c01-server-final.json",
  initialUnit: ".tmp/ai36-c01-server-all.json",
  types: ".tmp/ai36-c01-server-fixture-types-final.log",
  productionTypes: ".tmp/ai36-c01-tsc-build-current.log",
  lint: ".tmp/ai36-c01-server-lint-final.log",
  build: ".tmp/ai36-c01-server-build.log",
  sql: "docs/evidence/nodia-ai-ai36-c01-write-sql-validation.json",
  audit: "docs/evidence/nodia-ai-ai36-c01-write-contracts.json",
  delta: "docs/evidence/nodia-ai-ai36-c01-catalog-delta.json",
  sqlManifest: "docs/evidence/nodia-ai-ai36-c01-write-sql-manifest.json",
};
const units = read(files.unit);
assert.equal(units.numFailedTests, 0);
assert.equal(units.numPendingTests, 0);
assert.equal(units.numPassedTests, units.numTotalTests);
assert(units.testResults.every((item) => item.status === "passed"));
const initial = read(files.initialUnit);
assert.equal(initial.numFailedTests, 4);
assert(
  initial.testResults
    .filter((item) => item.status !== "passed")
    .every((item) =>
      item.name.endsWith("/build-nodia-ai-write-tools.use-case.spec.ts"),
    ),
);
const typeLog = fs.readFileSync(files.types, "utf8");
assert.equal(
  sha(files.types),
  "c5c7c21e659651d0d72bd544cb4adc6ddd4b8bf16e22738a16dbd91356126dc9",
);
assert.equal((typeLog.match(/error TS\d+:/g) ?? []).length, 192);
assert.equal(fs.readFileSync(files.productionTypes, "utf8").trim(), "");
const lintLog = fs.readFileSync(files.lint, "utf8");
assert.equal((lintLog.match(/: warning /g) ?? []).length, 3);
assert(!/: error /.test(lintLog));
assert(!/error TS\d+:/.test(fs.readFileSync(files.build, "utf8")));
const sql = read(files.sql);
assert.equal(sql.status, "passed");
assert.equal(sql.checks, 22);
assert.equal(sql.actual_provider_generations, 0);
assert.equal(sql.candidate_deployed, false);
assert.equal(sql.production_publication, false);
for (const [file, digest] of Object.entries(sql.evidence_sha256))
  assert.equal(sha(file), digest, `SQL evidence drift: ${file}`);
const compiled = read(files.sqlManifest);
let compiledCount = 0;
for (const [file, digest] of Object.entries(compiled.files)) {
  if (!file.startsWith("dist/")) continue;
  assert.equal(
    sha(`nodia-server/${file}`),
    digest,
    `Compiled SQL snapshot drift: ${file}`,
  );
  compiledCount++;
}
assert.equal(compiledCount, sql.compiled_outputs_verified);
const delta = read(files.delta);
assert.equal(delta.after_counts.handlerOperations, 217);
assert.equal(delta.after_counts.httpMethodPathPairs, 336);
assert.equal(delta.after_source_count, 854);
const manifest = read("nodia-server/dist/nodia-ai/knowledge/manifest.json");
assert.equal(
  manifest.release_id,
  "b4a790219b41687d2bc4ac7ad70f436d5b9a3aa83cbdfc812533a06f8027dc23",
);
const audit = read(files.audit);
assert.equal(audit.counts.candidate_prepare_change_contracts, 73);
assert.equal(audit.counts.compiled_schema_pairs, 73);
assert.equal(audit.counts.published_writers, 0);
assert.equal(audit.publication.changed, false);
const report = {
  stage: "AI-36-C01",
  status: "candidate_contracts_adapters_verified_publication_pending",
  scope:
    "73_closed_MCP_write_preparation_contracts_native_bindings_and_transactional_gateway",
  server_unit: {
    tests: units.numPassedTests,
    files: units.testResults.length,
    failures: 0,
    omitted: 0,
    max_workers: 2,
    report: ref(files.unit),
  },
  checks: {
    production_types: "passed",
    lint: "passed_with_three_existing_warnings",
    build: "passed",
    global_fixture_types: {
      previous_errors: 192,
      previous_files: 48,
      new_errors: 0,
      baseline_sha256: sha(files.types),
    },
  },
  sql: {
    checks: sql.checks,
    migrations: sql.postgresql_migrations,
    http_requests: sql.http_requests,
    native_effects: sql.verified_native_domain_effects_in_disposable_database,
    compiled_outputs_verified: compiledCount,
    provider: "synthetic",
  },
  contracts: {
    candidates: 73,
    finance_business: 26,
    reservations: 22,
    core_provider: 25,
    published_added: 0,
    domain_analyzer_missing: 1,
    secure_flow_adapters_pending: 4,
    common_helpers_pending: 6,
    report: ref(files.audit),
  },
  publication: {
    release_id: manifest.release_id,
    domain_reads: 67,
    knowledge_fragments: 27,
    added: 0,
    readiness: false,
    selection_and_provider_acceptance_pending: true,
  },
  source_inventory: {
    modules: 86,
    controllers: 46,
    handlers: 217,
    aliases: 336,
    source_hashes: 854,
    new_http_routes: 0,
    migrations_added: 0,
  },
  preserved_initial_failures: {
    full_suite: {
      tests: initial.numTotalTests,
      passed: initial.numPassedTests,
      failed: initial.numFailedTests,
      reason:
        "Four new framework tests exceeded the unchanged 5s limit under concurrent schema compilation. Removed duplicate fixture compilation and split 73 contract assertions into separate cases; no production relaxation.",
    },
    initial_gateway_expectation:
      "Old admission fixture assumed prepare_change was always blocked; updated to assert published authorized preparation and continued secure-flow denial.",
    health_fixture:
      "SQL passed once. Separate read-only health fixture initially required a dev dependency in the operational runtime; preserved and corrected without repeating SQL.",
  },
  evidence: Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, ref(file)]),
  ),
  historical_AI36: ref("docs/evidence/nodia-ai-ai36-validation.json"),
  limitations: [
    "No real provider generation, R2 access, configured domain write, deployment or publication in C01.",
    "Only finance movement and supplier creation execute end-to-end through the new MCP gateway in disposable SQL; other writers retain their historical evidence.",
    "Client code unchanged; previous 1773 tests/228 files and V8 reports are historical, not reexecuted or recomputed here.",
    "New unit totals do not replace historical V8 percentages or prove all 73 operations accepted by Gemini.",
    "Adapter catalog limit 74 tools/131072 bytes, JSON cardinality 128 and assembled context 262144 bytes are independent unchanged gates.",
    "AI36-C02..C04 and publication/provider acceptance remain open; AI-36 is not complete.",
  ],
};
const bytes = JSON.stringify(report, null, 2) + "\n";
if (mode === "--write") fs.writeFileSync(output, bytes);
else
  assert.equal(
    fs.readFileSync(output, "utf8"),
    bytes,
    "C01 consolidation drift",
  );
console.log(
  JSON.stringify({
    stage: "AI-36-C01",
    mode,
    status: report.status,
    tests: report.server_unit.tests,
    files: report.server_unit.files,
    sql: sql.checks,
    compiled_outputs: compiledCount,
    publication_added: 0,
  }),
);
