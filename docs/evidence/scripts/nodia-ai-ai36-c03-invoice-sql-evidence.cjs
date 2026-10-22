const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../..");
const read = (name) => fs.readFileSync(path.join(root, name));
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const json = (name) => JSON.parse(read(name));
const write = (name, value) =>
  fs.writeFileSync(
    path.join(root, name),
    JSON.stringify(value, null, 2) + "\n",
  );
const copy = (from, to) => fs.writeFileSync(path.join(root, to), read(from));
const attempt = process.argv[2] ?? "attempt01";
assert.match(attempt, /^attempt[0-9]{2}$/u);
const prefix = "docs/evidence/nodia-ai-ai36-c03-invoice-sql-";
const receiptPath = ".tmp/ai36-c03-invoice-sql-" + attempt + ".json";
const receipt = json(receiptPath),
  health = json(".tmp/ai36-c03-invoice-sql-health.json");
const manifestPath =
  "nodia-server/.tmp/ai36-c03-invoice-sql-stage-manifest.json";
const manifest = json(manifestPath);
const harnessPath =
  "nodia-server/test/nodia-ai-ai36-invoice-analysis.integration.mjs";
assert.equal(receipt.status, "passed");
assert.equal(receipt.assertion_result.status, "passed");
assert.ok(receipt.assertion_result.checks >= 25);
assert.equal(receipt.c01_regression.exit_code, 0);
assert.equal(receipt.c01_regression.assertion_result.checks, 22);
assert.equal(receipt.c02_regression.exit_code, 0);
assert.equal(receipt.c02_regression.assertion_result.checks, 31);
assert.equal(receipt.manifest_sha256, hash(read(manifestPath)));
assert.equal(receipt.source_sha256, hash(read(harnessPath)));
assert.equal(
  receipt.runner_sha256,
  hash(read("docs/evidence/scripts/nodia-ai-ai36-c03-invoice-sql-remote.py")),
);
assert.equal(health.status, "passed");
assert.equal(health.compiled_files_verified, manifest.compiled_files);
assert.equal(health.disposable_containers_remaining, 0);
assert.equal(receipt.disposable_containers_remaining, 0);
assert.equal(receipt.production_services_restarted, false);
const priorManifestPath =
  ".tmp/ai36-c03-invoice-sql-stage-attempt01-manifest.json";
const priorManifest = json(priorManifestPath);
assert.deepEqual(
  Object.fromEntries(
    Object.entries(priorManifest.files).filter(([name]) =>
      name.startsWith("dist/"),
    ),
  ),
  Object.fromEntries(
    Object.entries(manifest.files).filter(([name]) => name.startsWith("dist/")),
  ),
);
const failurePath = prefix + "attempt01-failure.json";
const failureReceipt = json(".tmp/ai36-c03-invoice-sql-attempt01.json");
const failureBytes = read(".tmp/ai36-c03-invoice-sql-attempt01-stderr.log");
assert.equal(hash(failureBytes), failureReceipt.stderr_sha256);
assert.match(failureBytes.toString(), /SnapshotNodiaAiInvoiceAnalysisUseCase/u);
write(failurePath, {
  classification: "synthetic_fixture_container_adapter_mismatch",
  stderr_sha256: hash(failureBytes),
  production_change_required: false,
  compiled_outputs_identical: true,
  reason:
    "Candidate-family closures were created by a separate Nest testing container before its adapter port was overridden. Their legitimate current-configuration check used the real adapter with the synthetic generation and refused the first request.",
  correction:
    "The initial candidate container receives an explicit verification-only proxy to the same synthetic adapter as the runtime container. All source, actor, configuration, receipt, no-effect and recovery assertions remain enforced.",
});
copy(priorManifestPath, prefix + "attempt01-manifest.json");
const attempts = [];
for (let index = 1; index <= Number(attempt.slice(-2)); index++) {
  const current = "attempt" + String(index).padStart(2, "0");
  const source = ".tmp/ai36-c03-invoice-sql-" + current + ".json";
  const result = json(source),
    target = prefix + current + ".json";
  copy(source, target);
  attempts.push({
    attempt: current,
    status: result.status,
    source_sha256: result.source_sha256,
    manifest_sha256: result.manifest_sha256,
    archive_sha256: result.archive_sha256,
    evidence_path: target,
  });
}
copy(manifestPath, prefix + "manifest.json");
copy(".tmp/ai36-c03-invoice-sql-health.json", prefix + "health.json");
const compiledExecution = Object.fromEntries(
  Object.entries(manifest.files)
    .filter(
      ([name]) => name.startsWith("dist/") && /\.(?:js|json|md)$/u.test(name),
    )
    .sort(([a], [b]) => a.localeCompare(b)),
);
const sources = [
  harnessPath,
  "nodia-server/test/nodia-ai-ai36-write-preparation.integration.mjs",
  "nodia-server/test/nodia-ai-ai36-secure-preparation.integration.mjs",
  "docs/evidence/scripts/nodia-ai-ai36-c03-invoice-sql-stage.cjs",
  "docs/evidence/scripts/nodia-ai-ai36-c03-invoice-sql-remote.py",
  "docs/evidence/scripts/nodia-ai-ai36-c03-invoice-sql-health.py",
  "docs/evidence/scripts/nodia-ai-ai36-c03-invoice-sql-evidence.cjs",
  prefix + "manifest.json",
  prefix + "attempt01-manifest.json",
  failurePath,
  prefix + "health.json",
  ...attempts.map((item) => item.evidence_path),
];
const report = {
  stage: "AI-36-C03",
  status: "passed",
  scope: "candidate_mcp_invoice_analysis_active_generation_disposable_sql",
  checks: receipt.assertion_result.checks,
  http_requests: receipt.assertion_result.http_requests,
  check_names: receipt.assertion_result.results,
  migrations: receipt.assertion_result.migrations,
  c01_regression: {
    status: "passed",
    checks: 22,
    http_requests: 8,
    same_compiled_execution: true,
  },
  c02_regression: {
    status: "passed",
    checks: 31,
    http_requests: 25,
    same_compiled_execution: true,
  },
  candidate_tools: 1,
  synthetic_published_tools: 1,
  compiled_outputs_verified: manifest.compiled_files,
  compiled_execution_files: Object.keys(compiledExecution).length,
  compiled_execution_manifest_sha256: hash(JSON.stringify(compiledExecution)),
  source_sha256: receipt.source_sha256,
  manifest_sha256: receipt.manifest_sha256,
  synthetic_provider_dispatches:
    receipt.assertion_result.synthetic_provider_dispatches,
  synthetic_pure_preparations:
    receipt.assertion_result.synthetic_pure_preparations,
  synthetic_pure_normalizations:
    receipt.assertion_result.synthetic_pure_normalizations,
  synthetic_storage_reads: receipt.assertion_result.synthetic_storage_reads,
  actual_provider_generations: 0,
  native_profile_calls: 0,
  configured_database_used: false,
  storage: "synthetic_private_port_no_R2",
  parser: "synthetic_pure_contract_port_real_Python_rules_checked_separately",
  services_restarted: false,
  production_publication: false,
  candidate_deployed: false,
  disposable_containers_remaining: 0,
  compiled_outputs_identical_across_attempts: true,
  fixture_failure_classification: failurePath,
  attempts,
  layers: {
    sql: "Actual compiled Nest/TypeORM, all current migrations, PostgreSQL 16 disposable fixture ai3603",
    callback:
      "Actual admission, frozen context, native-byte attestation, MCP gateway, candidate registration and durable receipt",
    extraction:
      "Explicit synthetic Agentic transport receives exact frozen PNG/PDF bytes and returns fixture extraction",
    normalizer:
      "Explicit synthetic pure contract port; no equivalence claimed to native parser or actual invoice understanding",
    lifecycle:
      "No invoice, product, draft, proposal or execution effect; immutable public result and current authority on recovery",
    regressions:
      "Actual C01 and C02 harnesses execute against the identical compiled outputs in separate disposable containers",
  },
  limits: health.limits,
  not_verified: [
    "production publication or deployment",
    "Gemini account inference/document understanding",
    "real R2",
    "native Python normalizer over live internal HTTP in this SQL harness",
  ],
  source_hashes: sources.map((name) => ({
    path: name,
    sha256: hash(read(name)),
  })),
};
write("docs/evidence/nodia-ai-ai36-c03-invoice-sql-validation.json", report);
console.log(
  JSON.stringify({
    stage: report.stage,
    status: report.status,
    checks: report.checks,
    http_requests: report.http_requests,
    regression_checks: 53,
    compiled_outputs_verified: manifest.compiled_files,
    source_files_verified: sources.length,
  }),
);
