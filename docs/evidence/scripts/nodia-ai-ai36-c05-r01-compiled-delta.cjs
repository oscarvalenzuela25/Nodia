/* Offline build provenance only. Existing publication builders perform contract checks.
 * No provider, SQL, application handler, configuration or historical artifact mutation. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
process.chdir(path.resolve(__dirname, "../../.."));
const output = "docs/evidence/nodia-ai-ai36-c05-r01-compiled-delta.json";
const source = "docs/evidence/scripts/nodia-ai-ai36-c05-r01-compiled-delta.cjs";
const mode = process.argv[2];
assert(["--write", "--check"].includes(mode));
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const ref = (file) => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const baselinePath =
  "docs/evidence/nodia-ai-ai36-c05-live-attempt07-manifest.json";
const receiptPath = "docs/evidence/nodia-ai-ai36-c05-live-attempt07.json";
const publicationPath =
  "docs/evidence/nodia-ai-ai36-c05-publication-validation.json";
const publisher =
  "docs/evidence/scripts/nodia-ai-ai36-c05-publication-build.cjs";
const baseline = read(baselinePath),
  receipt = read(receiptPath),
  publication = read(publicationPath);
assert.equal(ref(baselinePath).sha256, receipt.manifest_sha256);
const baselineFiles = Object.fromEntries(
  Object.entries(baseline.files).filter(
    ([file]) => file.startsWith("dist/") && /\.(js|json|md)$/.test(file),
  ),
);
assert.equal(Object.keys(baselineFiles).length, 971);
const currentFiles = {};
function walk(directory) {
  for (const name of fs.readdirSync(directory).sort()) {
    const file = path.posix.join(directory, name),
      stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), "compiled symlinks are not admitted");
    if (stat.isDirectory()) walk(file);
    else if (/\.(js|json|md)$/.test(file))
      currentFiles[file.slice("nodia-server/".length)] = ref(file).sha256;
  }
}
walk("nodia-server/dist");
assert.deepEqual(
  Object.keys(currentFiles).sort(),
  Object.keys(baselineFiles).sort(),
);
const changed = Object.keys(baselineFiles)
  .sort()
  .flatMap((file) =>
    baselineFiles[file] === currentFiles[file]
      ? []
      : [
          {
            path: file,
            before_sha256: baselineFiles[file],
            after_sha256: currentFiles[file],
          },
        ],
  );
assert(
  changed.length > 0,
  "capture the corrected build, not its unchanged predecessor",
);
const permittedChanges = new Set([
  "dist/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.js",
  "dist/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.js",
  "dist/nodia-ai-runtime/types/worker.types.js",
]);
assert(
  changed.every((item) => permittedChanges.has(item.path)),
  "review any additional executable delta before capture",
);
const manifestPath = "nodia-server/dist/nodia-ai/knowledge/manifest.json",
  manifest = read(manifestPath);
assert.equal(
  ref(manifestPath).sha256,
  baseline.files["dist/nodia-ai/knowledge/manifest.json"],
);
assert.equal(manifest.release_id, baseline.knowledge_release);
assert.equal(manifest.release_id, publication.compiled_publication.release_id);
const prior = read(publication.prior_registry.path);
assert.equal(
  ref(publication.prior_registry.path).sha256,
  publication.prior_registry.sha256,
);
assert.deepEqual(
  manifest.capability_contracts,
  [...prior.capabilities, ...publication.new_capabilities].sort((a, b) =>
    a.capability_id.localeCompare(b.capability_id),
  ),
);
assert.equal(manifest.capability_contracts.length, 74);
const factoryInputs = publication.compiled_factory_inputs.map((item) => {
  assert.equal(
    ref(item.path).sha256,
    item.sha256,
    "compiled factory changed: " + item.path,
  );
  return item;
});
const stdout = execFileSync(process.execPath, [publisher, "--check"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const checked = JSON.parse(stdout.trim());
assert.equal(checked.release, manifest.release_id);
assert.equal(checked.counts.published_capabilities, 74);
const observed = read("docs/evidence/nodia-ai-ai36-c05-live-attempt03.json")
  .assertion_result.per_capability;
const declaredHashes = [
  ...publication.historical_receipt_hashes_preserved.map((item) => ({
    capability_id: item.capability_id,
    contract_hash: item.contract_hash,
    origin: publicationPath,
  })),
  ...publication.new_capabilities.map((item) => ({
    capability_id: item.capability_id,
    contract_hash: observed[item.capability_id].contract_hash,
    origin: "docs/evidence/nodia-ai-ai36-c05-live-attempt03.json",
  })),
].sort((a, b) => a.capability_id.localeCompare(b.capability_id));
assert.equal(
  new Set(declaredHashes.map((item) => item.capability_id)).size,
  74,
);
assert(
  declaredHashes.every((item) => /^[a-f0-9]{64}$/.test(item.contract_hash)),
);
const report = {
  schema_version: 1,
  stage: "AI-36-C05-R01",
  scope:
    "offline_exact_build_delta_contract_compatibility_not_new_provider_acceptance",
  baseline_manifest: ref(baselinePath),
  baseline_receipt: ref(receiptPath),
  release_id: manifest.release_id,
  publication: ref(publicationPath),
  compiled_knowledge_manifest: ref(manifestPath),
  compiled_executable_file_count: Object.keys(currentFiles).length,
  current_files: currentFiles,
  changed_files: changed,
  capability_contracts: manifest.capability_contracts,
  capability_contract_count: 74,
  declared_native_contract_hashes: declaredHashes,
  declared_native_hash_sources: [
    ref(publicationPath),
    ref("docs/evidence/nodia-ai-ai36-c05-live-attempt03.json"),
  ],
  compiled_factory_inputs_preserved: factoryInputs,
  publication_builder_check: {
    source: ref(publisher),
    command: [process.execPath, publisher, "--check"],
    exit_code: 0,
    stdout_sha256: sha(stdout),
    result: checked,
  },
  compatibility_basis:
    "All74 published capability records and compiled knowledge manifest are identical; all retained compiled factory inputs are identical; the existing real publication builder check succeeds. Native hashes are retained declarations, not a second registry composition implemented by this script.",
  provider_generations: 0,
  SQL_operations: 0,
  services_restarted: false,
  configuration_changed: false,
  historical_artifacts_changed: false,
  current_provider_acceptance_claimed: false,
  source: ref(source),
};
const bytes = JSON.stringify(report, null, 2) + "\n";
if (mode === "--write") {
  assert(!fs.existsSync(output), "never replace a frozen build delta");
  fs.writeFileSync(output, bytes);
} else assert.equal(fs.readFileSync(output, "utf8"), bytes);
console.log(
  JSON.stringify({
    stage: report.stage,
    mode,
    changed_files: changed.length,
    compiled_files: 971,
    capability_contracts: 74,
    release_id: report.release_id,
  }),
);
