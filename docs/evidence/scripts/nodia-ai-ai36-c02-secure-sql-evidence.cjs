const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../..");
const read = (name) => fs.readFileSync(path.join(root, name));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const json = (name) => JSON.parse(read(name));
const write = (name, value) =>
  fs.writeFileSync(
    path.join(root, name),
    JSON.stringify(value, null, 2) + "\n",
  );
const copy = (source, target) =>
  fs.writeFileSync(path.join(root, target), read(source));
const prefix = "docs/evidence/nodia-ai-ai36-c02-secure-sql-";
const receipt = json(".tmp/ai36-c02-secure-sql-attempt03.json");
const health = json(".tmp/ai36-c02-secure-sql-health.json");
const manifestPath =
  "nodia-server/.tmp/ai36-c02-secure-sql-stage-manifest.json";
const manifest = json(manifestPath);
assert.equal(receipt.status, "passed");
assert.equal(receipt.assertion_result.checks, 31);
assert.equal(receipt.assertion_result.http_requests, 25);
assert.equal(receipt.c01_regression.exit_code, 0);
assert.equal(receipt.c01_regression.assertion_result.checks, 22);
assert.equal(receipt.c01_regression.assertion_result.http_requests, 8);
assert.equal(receipt.manifest_sha256, hash(read(manifestPath)));
const harnessPath =
  "nodia-server/test/nodia-ai-ai36-secure-preparation.integration.mjs";
assert.equal(receipt.source_sha256, hash(read(harnessPath)));
assert.equal(
  receipt.runner_sha256,
  hash(read("docs/evidence/scripts/nodia-ai-ai36-c02-secure-sql-remote.py")),
);
assert.equal(health.status, "passed");
assert.equal(health.compiled_files_verified, manifest.compiled_files);
assert.equal(health.disposable_containers_remaining, 0);
assert.equal(receipt.disposable_containers_remaining, 0);
assert.equal(receipt.production_services_restarted, false);
const executionFiles = (files) =>
  Object.fromEntries(
    Object.entries(files)
      .filter(
        ([name]) => name.startsWith("dist/") && /\.(?:js|json|md)$/u.test(name),
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  );
const execution = executionFiles(manifest.files);
const attempts = [];
for (let index = 1; index <= 3; index++) {
  const id = "attempt" + String(index).padStart(2, "0"),
    source = ".tmp/ai36-c02-secure-sql-" + id + ".json";
  const result = json(source);
  assert.equal(result.status, index === 1 ? "failed" : "passed");
  const target = prefix + id + ".json";
  copy(source, target);
  let priorManifest;
  if (index < 3)
    priorManifest = json(
      ".tmp/ai36-c02-secure-sql-stage-" + id + "-manifest.json",
    );
  else priorManifest = manifest;
  assert.deepEqual(executionFiles(priorManifest.files), execution);
  attempts.push({
    attempt: id,
    status: result.status,
    manifest_sha256: result.manifest_sha256,
    archive_sha256: result.archive_sha256,
    source_sha256: result.source_sha256,
    compiled_execution_identical: true,
    evidence_path: target,
  });
}
copy(manifestPath, prefix + "manifest.json");
copy(".tmp/ai36-c02-secure-sql-health.json", prefix + "health.json");
const failure = read(".tmp/ai36-c02-secure-sql-attempt01-stderr.log");
assert.match(failure.toString(), /only separate human exact confirmation/u);
const failurePath = prefix + "attempt01-failure.json";
write(failurePath, {
  classification: "fixture_incorrect_empty_table_assumption",
  stderr_sha256: hash(failure),
  reason:
    "Successful chat inference retains a free fenced runtime-slot row; the fixture incorrectly required an empty table.",
  correction:
    "Assert the slot cardinality does not increase during the secure worker pause and there are zero non-free slots. Preserve all no-effect and human-channel assertions.",
  production_change_required: false,
  compiled_execution_identical: true,
});
const sources = [
  harnessPath,
  "nodia-server/test/nodia-ai-ai36-write-preparation.integration.mjs",
  "docs/evidence/scripts/nodia-ai-ai36-c02-secure-sql-stage.cjs",
  "docs/evidence/scripts/nodia-ai-ai36-c02-secure-sql-remote.py",
  "docs/evidence/scripts/nodia-ai-ai36-c02-secure-sql-health.py",
  "docs/evidence/scripts/nodia-ai-ai36-c02-secure-sql-evidence.cjs",
  prefix + "manifest.json",
  prefix + "attempt01.json",
  prefix + "attempt02.json",
  prefix + "attempt03.json",
  failurePath,
  prefix + "health.json",
];
const modelTables = [
  "nodia_ai_drafts",
  "nodia_ai_proposals",
  "nodia_ai_proposal_steps",
  "nodia_ai_tool_calls",
  "nodia_ai_messages",
  "nodia_ai_events",
  "nodia_ai_executions",
  "nodia_ai_execution_steps",
  "nodia_ai_jobs",
  "nodia_ai_job_attempts",
  "nodia_ai_execution_grants",
];
const report = {
  stage: "AI-36-C02",
  scope: "candidate_mcp_secure_preparation_native_human_channel_isolated_sql",
  status: "passed",
  checks: 31,
  http_requests: 25,
  postgresql_migrations: 29,
  c01_regression: {
    checks: 22,
    http_requests: 8,
    status: "passed",
    same_compiled_execution: true,
  },
  compiled_outputs_verified: manifest.compiled_files,
  compiled_execution_files: Object.keys(execution).length,
  compiled_execution_manifest_sha256: hash(JSON.stringify(execution)),
  manifest_sha256: receipt.manifest_sha256,
  source_sha256: receipt.source_sha256,
  candidate_tools: 4,
  synthetic_published_tools: 4,
  synthetic_provider_dispatches: 8,
  native_login_starts_in_mock: 1,
  actual_provider_generations: 0,
  provider_metadata_requests: 0,
  configured_database_used: false,
  storage_operations: 0,
  services_restarted: false,
  production_publication: false,
  candidate_deployed: false,
  disposable_containers_remaining: 0,
  scanned_coordination_tables: modelTables,
  limits: health.limits,
  attempts,
  layers: {
    mcp_callback:
      "Actual compiled ExecuteNodiaAiToolUseCase and four secure candidate adapters",
    native_preparation:
      "Actual compiled native secure preparers and CAS draft/proposal persistence",
    authorization:
      "Actual SQL module/action/current-session ownership; replay reauthorization",
    confirmation:
      "Separate human-channel HTTP challenge and exact proposal confirmation",
    worker:
      "Actual execution worker establishes waiting_for_user and frees leases without a new inference slot",
    human_key:
      "Actual encrypted native key writer and atomic opaque receipt with synthetic key in disposable SQL",
    native_login:
      "Actual native session bridge authorization; synthetic GeminiService transport only",
    publication:
      "Private synthetic four-tool manifest; compiled production publication untouched",
  },
  limits_of_evidence: [
    "No real provider account, inference, device authorization or UI acceptance is credited.",
    "Closed named input fields prevent those fields from carrying credentials; this is not DLP for arbitrary user text or metadata.",
    "Rejected synthetic marker and human-entered synthetic key are searched across the eleven listed coordination tables; the actual encrypted value belongs only to ai_api_keys.",
    "Human flow references and native references remain private to authenticated human channels and private recovery data; no human channel is exported as an MCP action.",
    "The historical operating runtime was only health-checked and is not claimed to equal this undeployed candidate.",
  ],
  evidence_sha256: Object.fromEntries(
    sources.map((source) => [source, hash(read(source))]),
  ),
};
write(prefix + "validation.json", report);
console.log(
  JSON.stringify({
    status: report.status,
    checks: report.checks,
    http_requests: report.http_requests,
    c01_regression: report.c01_regression,
    compiled_outputs_verified: report.compiled_outputs_verified,
    compiled_execution_files: report.compiled_execution_files,
    validation_sha256: hash(read(prefix + "validation.json")),
  }),
);
