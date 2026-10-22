/* Read-only provenance comparison; never refreshes the historical endpoint inventory. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
process.chdir(path.resolve(__dirname, "../../.."));
const output = "docs/evidence/nodia-ai-ai36-c05-r01-source-delta.json";
const mode = process.argv[2];
assert(["--write", "--check"].includes(mode));
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const ref = (file) => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const inventoryPath = "docs/mvp/nodia-ai-current-endpoints.json";
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const baselineDelta = JSON.parse(
  fs.readFileSync("docs/evidence/nodia-ai-ai36-c05-catalog-delta.json", "utf8"),
);
assert.equal(ref(inventoryPath).sha256, baselineDelta.after_inventory_sha256);
assert.equal(inventory.sourceChecksums.length, 869);
const changed = inventory.sourceChecksums
  .flatMap((item) => {
    const actual = ref(item.file).sha256;
    return actual === item.sha256
      ? []
      : [{ path: item.file, before_sha256: item.sha256, after_sha256: actual }];
  })
  .sort((a, b) => a.path.localeCompare(b.path));
assert.deepEqual(
  changed.map((item) => item.path),
  [
    "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
    "nodia-server/src/nodia-ai-runtime/types/worker.types.ts",
    "nodia-server/src/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.ts",
  ],
);
const checker = "docs/evidence/scripts/reconcile-nodia-ai-ai36-c05-catalog.cjs";
const result = spawnSync(process.execPath, [checker, "--check"], {
  encoding: "utf8",
});
assert.equal(result.error, undefined);
assert.equal(
  result.status,
  1,
  "historical source checks must report the expected runtime drift",
);
assert(result.stderr.includes("AssertionError"));
const evidence = {
  schema_version: 1,
  stage: "AI-36-C05-R01",
  scope:
    "exact_source_hash_delta_against_frozen_catalog_not_new_AST_inventory_acceptance",
  historical_inventory: ref(inventoryPath),
  baseline_catalog_delta: ref(
    "docs/evidence/nodia-ai-ai36-c05-catalog-delta.json",
  ),
  source_count: 869,
  changed_sources: changed,
  counts_retained_from_historical_inventory: inventory.counts,
  route_and_module_source_files_changed: false,
  route_count_interpretation:
    "Historical route/module counts are retained because only the three listed runtime files changed; this is not a refreshed AST inventory or a passing legacy source-hash check.",
  legacy_readonly_check: {
    source: ref(checker),
    arguments: ["--check"],
    exit_code: result.status,
    stdout_sha256: sha(result.stdout),
    stderr_sha256: sha(result.stderr),
    classification: "expected_stale_runtime_source_hashes",
    passed: false,
  },
  original_inventory_rewritten: false,
  provider_generations: 0,
  services_restarted: false,
  source: ref("docs/evidence/scripts/nodia-ai-ai36-c05-r01-source-delta.cjs"),
};
const bytes = JSON.stringify(evidence, null, 2) + "\n";
if (mode === "--write") {
  assert(!fs.existsSync(output));
  fs.writeFileSync(output, bytes);
} else assert.equal(fs.readFileSync(output, "utf8"), bytes);
console.log(
  JSON.stringify({
    stage: evidence.stage,
    mode,
    source_count: 869,
    changed_sources: 3,
    legacy_check: "expected_failure_preserved",
  }),
);
