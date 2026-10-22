/* Offline C05 evidence consolidation. Reads immutable test/attempt receipts only.
 * No application imports, network, SQL, provider calls, approval or deployment. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
process.chdir(path.resolve(__dirname, "../../.."));
const mode = process.argv[2] ?? "--check";
assert(
  ["--write", "--check", "--dry-run"].includes(mode),
  "use --write, --check or --dry-run",
);
const output = "docs/evidence/nodia-ai-ai36-c05-validation.json";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const ref = (file) => ({ path: file, sha256: digest(fs.readFileSync(file)) });
const exists = (file) => fs.existsSync(file);
const files = {
  unit: ".tmp/ai36-c05-server-final3.json",
  processRuntime: ".tmp/ai36-c05-process-runtime-final3.json",
  discoveryIndex: ".tmp/ai36-c05-discovery-index-final.json",
  selectionIntermediate: ".tmp/ai36-c05-selection-final.json",
  observation: ".tmp/ai36-c05-selection-observation.json",
  productionTypes: ".tmp/ai36-c05-production-types-final3.log",
  fixtureTypes: ".tmp/ai36-c05-fixture-types-final3.log",
  fixtureBaseline: ".tmp/ai36-c04-server-fixture-types-final.log",
  lint: ".tmp/ai36-c05-lint-final3.log",
  build: ".tmp/ai36-c05-build-final3.log",
  publication: "docs/evidence/nodia-ai-ai36-c05-publication-validation.json",
  delta: "docs/evidence/nodia-ai-ai36-c05-catalog-delta.json",
  inventory: "docs/mvp/nodia-ai-current-endpoints.json",
  coordination: "docs/mvp/nodia-ai-v1-coordination-api.json",
  registry: "nodia-server/config/nodia-ai-knowledge.registry.json",
  manifest: "nodia-server/dist/nodia-ai/knowledge/manifest.json",
  pin: "nodia-server/dist/nodia-ai-context/config/knowledge-pin.json",
  policy: "nodia-server/dist/nodia-ai-runtime/config/runtime-policy.json",
  profiles:
    "nodia-server/src/nodia-ai-tools/config/tool-selection-profiles.json",
  bridgeControl: "docs/evidence/nodia-ai-ai36-c05-native-bridge-control.json",
};
for (const file of Object.values(files))
  assert(exists(file), "final QA evidence missing: " + file);
function tests(file, requireSuccess = true) {
  const report = read(file);
  const summary = {
    ...ref(file),
    tests: report.numTotalTests,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    omitted: report.numPendingTests,
    todo: report.numTodoTests,
    files: report.testResults.length,
    failed_files: report.testResults
      .filter((row) => row.status !== "passed")
      .map((row) => ({
        file: row.name.replaceAll("\\", "/").split("/nodia-server/").at(-1),
        failed: row.assertionResults.filter((test) => test.status === "failed")
          .length,
      })),
  };
  assert(Number.isSafeInteger(summary.tests) && summary.tests >= 0);
  if (requireSuccess) {
    assert.equal(report.success, true, file);
    assert.equal(summary.failed, 0, file);
    assert.equal(summary.omitted, 0, file);
    assert.equal(summary.todo, 0, file);
    assert.equal(summary.passed, summary.tests, file);
    assert(
      report.testResults.every((row) => row.status === "passed"),
      file,
    );
  }
  return summary;
}
const unit = tests(files.unit),
  processRuntime = tests(files.processRuntime),
  discoveryIndex = tests(files.discoveryIndex),
  selectionIntermediate = tests(files.selectionIntermediate),
  observation = tests(files.observation);
assert.equal(processRuntime.tests, 110);
assert.equal(processRuntime.files, 2);
assert.equal(discoveryIndex.tests, 75);
assert.equal(discoveryIndex.files, 2);
assert.equal(selectionIntermediate.tests, 205);
assert.equal(selectionIntermediate.files, 8);
assert.equal(observation.tests, 41);
assert.equal(observation.files, 1);
const semanticFixture = (file) =>
  fs
    .readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\(\d+,\d+\): error TS/g, "(<line>,<column>): error TS");
const fixtureText = fs.readFileSync(files.fixtureTypes, "utf8");
const fixtureErrors = (fixtureText.match(/error TS\d+:/g) ?? []).length;
const fixtureFiles = new Set(
  [...fixtureText.matchAll(/^(.+?)\(\d+,\d+\): error TS/gm)].map(
    (row) => row[1],
  ),
).size;
const semanticHash = digest(semanticFixture(files.fixtureTypes));
assert.equal(fixtureErrors, 192);
assert.equal(fixtureFiles, 48);
assert.equal(
  semanticFixture(files.fixtureTypes),
  semanticFixture(files.fixtureBaseline),
);
assert.equal(
  semanticHash,
  "bb66ca2330e1910236bc58539cf1af47787393c4dd807ce4b549afcd62036aed",
);
assert.equal(fs.readFileSync(files.productionTypes, "utf8").trim(), "");
const lintText = fs.readFileSync(files.lint, "utf8");
assert.equal((lintText.match(/: warning /g) ?? []).length, 3);
assert(!/: error /.test(lintText));
const buildText = fs.readFileSync(files.build, "utf8");
assert(!/error TS\d+:|SyntaxError:|ERR!/i.test(buildText));
const buildRecords = buildText
  .split(/\r?\n/)
  .filter((line) => line.startsWith("{"))
  .map((line) => JSON.parse(line));
const manifest = read(files.manifest),
  pin = read(files.pin),
  registry = read(files.registry),
  publication = read(files.publication);
const release =
  "bde4090377b15d8519c9e001a758cf24e70ee3d54bff93ea67fb5dce1fb0a134";
for (const value of [
  manifest.release_id,
  pin.release_id,
  publication.compiled_publication.release_id,
])
  assert.equal(value, release);
assert.equal(manifest.catalog_release, "nodia-ai-ai15-reads/1");
assert.equal(registry.capabilities.length, 74);
assert.equal(registry.source_paths.length, 59);
assert.equal(manifest.documents.length, 31);
assert.equal(manifest.fragments.length, 31);
assert.equal(manifest.capability_contracts.length, 74);
assert(
  buildRecords.some(
    (item) =>
      item.task === "AI-06" &&
      item.mode === "build" &&
      item.releaseId === release &&
      item.sources === 59 &&
      item.excluded === 28 &&
      item.documents === 31 &&
      item.fragments === 31,
  ),
);
assert(
  buildRecords.some(
    (item) =>
      item.task === "AI-12" &&
      item.release === release &&
      item.published_documents === 31,
  ),
);
assert.equal(publication.counts.newly_published_capabilities, 7);
assert.equal(publication.counts.remaining_unpublished_candidates, 77);
assert.equal(publication.historical_receipt_hashes_preserved.length, 67);
assert.equal(publication.approved_prior_contents_preserved.length, 27);
assert.equal(publication.acceptance_matrix.length, 151);
const newIds = publication.new_capabilities
  .map((item) => item.capability_id)
  .sort();
assert.equal(new Set(newIds).size, 7);
assert(newIds.includes("nodia_finance_movements_prepare_create"));
const delta = read(files.delta);
assert.equal(delta.after_counts.localModules, 89);
assert.equal(delta.after_counts.registeredControllers, 46);
assert.equal(delta.after_counts.handlerOperations, 217);
assert.equal(delta.after_counts.httpMethodPathPairs, 336);
assert.equal(delta.after_source_count, 869);
assert.equal(delta.after_inventory_sha256, ref(files.inventory).sha256);
assert.equal(delta.after_coordination_sha256, ref(files.coordination).sha256);
assert.equal(delta.coordination_routes, 41);
assert.equal(delta.database_migration_count, 29);
assert.deepEqual(delta.http_request_dto_additions, []);
const inventory = read(files.inventory);
assert.equal(inventory.sourceChecksums.length, 869);
for (const item of inventory.sourceChecksums)
  assert.equal(ref(item.file).sha256, item.sha256, item.file);
for (const [file, expected] of Object.entries(
  delta.preserved_shared_schema_hashes,
))
  assert.equal(ref(file).sha256, expected, file);
const policy = read(files.policy).policy;
assert.equal(policy.results.json_collection_items, 128);
assert.equal(policy.results.assembled_context_utf8_bytes, 262144);
assert.equal(policy.budget.provider_dispatches_per_run, 3);
assert.equal(policy.budget.delegations_per_run, 1);
assert.equal(policy.retry.uncertain_dispatch_retries, 0);
const profiles = read(files.profiles);
assert.equal(profiles.default_profile_id, "automatic_discovery");
assert.equal(profiles.technical_tool_names.length, 7);
assert.equal(
  profiles.profiles.find((item) => item.profile_id === "automatic_discovery")
    .capability_ids.length,
  0,
);
assert.equal(
  profiles.profiles.find((item) => item.profile_id === "finance_assistance")
    .capability_ids.length,
  18,
);

const nonnegative = (value) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const numeric = (value) => (nonnegative(value) ? value : null);
const bridgeControl = read(files.bridgeControl);
assert.equal(bridgeControl.stage, "AI-36-C05");
for (const entry of [bridgeControl.script, ...bridgeControl.local_imports])
  assert.equal(ref(entry.path).sha256, entry.sha256);
assert.equal(bridgeControl.result.state, "completed");
assert.equal(bridgeControl.result.real_cli_or_provider_requests, 0);
assert.equal(
  bridgeControl.result.operational_profiles_or_services_accessed,
  false,
);
assert.equal(bridgeControl.boundaries.real_cli_or_provider_acceptance, false);
assert.equal(
  bridgeControl.boundaries.production_services_started_or_restarted,
  false,
);
assert.equal(bridgeControl.boundaries.production_data_accessed, false);
function attempts(kind) {
  const names = fs
    .readdirSync("docs/evidence")
    .filter((name) =>
      new RegExp(
        "^nodia-ai-ai36-c05-" + kind + "-attempt[0-9]{2}\\.json$",
      ).test(name),
    )
    .sort();
  return names.map((name) => {
    const file = "docs/evidence/" + name,
      receipt = read(file),
      result = receipt.assertion_result;
    assert.equal(receipt.stage, "AI-36-C05");
    if (kind === "selection") {
      assert.equal(receipt.actual_provider_generations, 0);
      assert.equal(receipt.configured_database_used, false);
      assert.equal(receipt.storage_operations, 0);
      if (result?.actual_provider_generations !== undefined)
        assert.equal(result.actual_provider_generations, 0);
    }
    const ownManifest = file.replace(/\.json$/, "-manifest.json");
    assert(exists(ownManifest), "attempt manifest missing: " + ownManifest);
    assert.equal(ref(ownManifest).sha256, receipt.manifest_sha256);
    const snapshot = read(ownManifest);
    assert.equal(snapshot.compiled_files, receipt.compiled_files_verified);
    const logs = {};
    for (const side of ["stdout", "stderr"]) {
      const log = file.replace(/\.json$/, "-" + side + ".log");
      if (exists(log)) {
        assert.equal(ref(log).sha256, receipt[side + "_sha256"]);
        logs[side] = ref(log);
      }
    }
    const checks =
      result && Array.isArray(result.checks)
        ? result.checks.length
        : numeric(result?.checks);
    const checkNames =
      result && Array.isArray(result.checks)
        ? result.checks
        : (result?.check_names ?? []);
    if (checks !== null && checkNames.length)
      assert.equal(checks, checkNames.length, file);
    const passed =
      receipt.status === "passed" &&
      receipt.exit_code === 0 &&
      !receipt.timeout &&
      result?.status === "passed";
    if (receipt.status === "passed")
      assert(
        passed,
        "outer pass lacks inner completed assertion receipt: " + file,
      );
    if (passed) {
      assert.equal(snapshot.knowledge_release, release);
      assert.equal(receipt.disposable_containers_remaining, 0);
      assert.equal(receipt.services_restarted, false);
      if (kind === "selection") {
        assert.equal(result.production_bundle_capabilities, 74);
        assert.equal(result.knowledge_release, release);
        assert.equal(receipt.synthetic_publication_override, false);
        assert.equal(result.synthetic_publication_override, false);
        assert.equal(result.actual_provider_generations, 0);
        assert.equal(result.storage_operations, 0);
      } else {
        assert.equal(receipt.operational_runtime_unchanged, true);
        assert.deepEqual(
          receipt.operational_runtime_before,
          receipt.operational_runtime_after,
        );
        assert.equal(receipt.physical_UI_accepted, false);
        assert.equal(receipt.productive_acceptance, false);
        assert.equal(result.synthetic_publication_override, false);
        assert.equal(result.synthetic_provider_transport, false);
        assert.equal(result.configured_sql_read_only, true);
        assert.equal(result.operational_database_writes, 0);
        assert.equal(result.automatic_inference_retries, 0);
        assert.equal(result.unresolved_native_or_proof_state, false);
      }
    }
    return {
      file,
      receipt,
      result,
      snapshot,
      summary: {
        ...ref(file),
        manifest: ref(ownManifest),
        logs,
        attempt: receipt.attempt,
        outer_status: receipt.status,
        assertion_status: result?.status ?? null,
        verified_pass: passed,
        exit_code: receipt.exit_code,
        timeout: receipt.timeout,
        completed_checks: checks,
        check_names: checkNames,
        compiled_files_verified: receipt.compiled_files_verified,
        knowledge_release: snapshot.knowledge_release,
        started_at_utc: receipt.started_at_utc,
        completed_at_utc: receipt.completed_at_utc,
        actual_provider_generations: numeric(
          result?.actual_provider_generations ??
            receipt.actual_provider_generations,
        ),
        provider_dispatch_attempts: numeric(result?.provider_dispatch_attempts),
        synthetic_provider_dispatches: numeric(
          result?.synthetic_provider_dispatches,
        ),
        failure_category:
          result?.failure_category ??
          result?.failure?.name ??
          (receipt.status === "failed"
            ? "harness_or_preassertion_failure"
            : null),
        disposable_containers_remaining: numeric(
          receipt.disposable_containers_remaining,
        ),
        operational_runtime_unchanged:
          receipt.operational_runtime_unchanged ?? null,
        unresolved_native_or_proof_state:
          result?.unresolved_native_or_proof_state ?? null,
      },
    };
  });
}
const sqlAttempts = attempts("selection"),
  liveAttempts = attempts("live");
const supplementaryNativeEvidence = liveAttempts.map((attempt) => {
  const paths = [
    "interpretation",
    "native-source",
    "native-diagnostics",
    "quiescence",
  ]
    .map((suffix) => attempt.file.replace(/\.json$/, "-" + suffix + ".json"))
    .filter(exists);
  const documents = paths.map((file) => ({ file, document: read(file) }));
  for (const { document } of documents) {
    assert.equal(document.stage, "AI-36-C05");
    assert.equal(document.services_restarted, false);
    if (document.provider_requests !== undefined)
      assert.equal(document.provider_requests, 0);
    if (document.provider_requests_for_this_inspection !== undefined)
      assert.equal(document.provider_requests_for_this_inspection, 0);
    if (document.sessions_or_profiles_read !== undefined)
      assert.equal(document.sessions_or_profiles_read, false);
    for (const [name, expected] of Object.entries(
      document.source_artifacts_sha256 ?? {},
    )) {
      assert.equal(path.basename(name), name);
      assert.equal(
        ref("docs/evidence/" + name).sha256,
        expected,
        "supplementary native source hash drift: " + name,
      );
    }
    if (
      document.scope === "post_disposable_live_read_only_operational_quiescence"
    ) {
      assert.equal(document.status, "passed");
      for (const field of [
        "pending_jobs",
        "open_attempts",
        "retained_slots",
        "configured_SQL_writes",
        "storage_operations",
      ])
        assert.equal(document[field], 0);
    }
  }
  const interpretation = documents.find(({ file }) =>
    file.endsWith("-interpretation.json"),
  )?.document;
  const diagnostics = documents.find(({ file }) =>
    file.endsWith("-native-diagnostics.json"),
  )?.document;
  const source = documents.find(({ file }) =>
    file.endsWith("-native-source.json"),
  )?.document;
  if (interpretation && diagnostics)
    assert.deepEqual(
      interpretation.observed_native,
      diagnostics.diagnostics.find(
        (item) => item.attempt_id === interpretation.execution_attempt_id,
      ),
    );
  if (interpretation && source)
    assert.deepEqual(interpretation.native_container, source.container);
  return {
    attempt: attempt.receipt.attempt,
    evidence: paths.map(ref),
    scope: "read_only_retained_observations_not_completed_turn_acceptance",
    interpretation: interpretation
      ? {
          observed_at_utc: interpretation.observed_at_utc,
          derived_at_utc: interpretation.derived_at_utc ?? null,
          source_observed_at_utc: interpretation.source_observed_at_utc ?? null,
          conclusion: interpretation.conclusion,
          correction: interpretation.correction,
          observed_confirmed: interpretation.observed_confirmed,
          not_retained_after_cleanup: interpretation.not_retained_after_cleanup,
          retention_limits: interpretation.retention_limits,
        }
      : null,
    native_image: source?.container.image ?? null,
    verified_native_source_version: source?.source_version ?? null,
    local_or_productive_acceptance_added: false,
  };
});
function finalAttempt(items) {
  if (!items.length) return { status: "pending", checks: null, evidence: null };
  const last = items.at(-1);
  return {
    status: last.summary.verified_pass ? "passed" : "failed_or_incomplete",
    checks: last.summary.completed_checks,
    evidence: ref(last.file),
    earlier_failures: items
      .slice(0, -1)
      .filter((item) => !item.summary.verified_pass).length,
  };
}
const sqlFinal = finalAttempt(sqlAttempts),
  liveFinal = finalAttempt(liveAttempts);
const sqlLast = sqlAttempts.at(-1)?.result;
// A later deliberate build does not rewrite earlier passing or failing cohorts.
// Only the most recent closed attempt of each layer must match the delivered build.
const latestForCurrentBuild = [sqlAttempts.at(-1), liveAttempts.at(-1)].filter(
  Boolean,
);
const currentCompiledProofs = latestForCurrentBuild.map((item) => {
  const hashes = Object.entries(item.snapshot.files).filter(([file]) =>
    file.startsWith("dist/"),
  );
  const changed = hashes
    .filter(
      ([file, expected]) =>
        !exists("nodia-server/" + file) ||
        ref("nodia-server/" + file).sha256 !== expected,
    )
    .map(([file]) => file);
  const executableChanged = changed.filter((file) =>
    /\.(?:js|json|md)$/.test(file),
  );
  assert.equal(
    executableChanged.length,
    0,
    "latest layer attempt differs from current executable build: " + item.file,
  );
  return {
    attempt: item.receipt.attempt,
    status: item.summary.outer_status,
    scope: item.receipt.scope,
    files: hashes.length,
    executable_files_matched: hashes.filter(([file]) =>
      /\.(?:js|json|md)$/.test(file),
    ).length,
    changed_non_executable_files: changed,
    manifest: ref(item.file.replace(/\.json$/, "-manifest.json")),
  };
});
function observedGenerations(items, field) {
  const values = items.map((item) => item.summary[field]);
  return {
    observed_total: values
      .filter((value) => value !== null)
      .reduce((sum, value) => sum + value, 0),
    complete_for_all_recorded_attempts: values.every((value) => value !== null),
    unknown_attempts: items
      .filter((_item, index) => values[index] === null)
      .map((item) => item.receipt.attempt),
  };
}
const perCapability = publication.acceptance_matrix.map((row) => {
  const observations = liveAttempts.flatMap((item) => {
    const observed = item.result?.per_capability?.[row.capability_id];
    if (!observed) return [];
    const completedTurns = (
      Array.isArray(item.result.turns) ? item.result.turns : []
    )
      .filter(
        (turn) =>
          turn.state === "completed" &&
          Array.isArray(turn.generations) &&
          turn.generations.length > 0 &&
          turn.generations.every(
            (generation) => generation.terminal_proof_received === true,
          ) &&
          Array.isArray(turn.receipts) &&
          turn.receipts.some(
            (receipt) => receipt.tool_name === row.capability_id,
          ),
      )
      .map((turn) => turn.label);
    return [
      {
        evidence: ref(item.file),
        overall_attempt_passed: item.summary.verified_pass,
        completed_turns_with_terminal_proofs_and_durable_callback_receipts:
          completedTurns,
        actual_callbacks: numeric(observed.actual_callbacks),
        successful_callbacks: numeric(observed.successful_callbacks),
        selected_in_real_generation:
          typeof observed.selected_in_real_generation === "boolean"
            ? observed.selected_in_real_generation
            : null,
        selection: item.result.selection ?? null,
      },
    ];
  });
  const accepted = observations.some(
    (item) =>
      item.successful_callbacks > 0 &&
      (item.overall_attempt_passed ||
        item.completed_turns_with_terminal_proofs_and_durable_callback_receipts
          .length > 0),
  );
  return {
    capability_id: row.capability_id,
    publication: row.publication,
    internal_contract_evidence: row.contract_and_adapter.evidence_path,
    current_SQL_layer:
      sqlFinal.status === "passed" && newIds.includes(row.capability_id)
        ? {
            status:
              "first_lot_native_gateway_and_receipts_verified_with_synthetic_transport",
            evidence: sqlFinal.evidence,
          }
        : null,
    historical_evidence_does_not_prove_current_acceptance: true,
    real_callback_status: accepted
      ? "verified_in_recorded_laboratory_attempt"
      : observations.some((item) => item.successful_callbacks > 0)
        ? "successful_callback_observed_in_incomplete_attempt"
        : "pending",
    current_real_observations: observations,
    complete_semantic_acceptance: false,
    productive_acceptance: false,
    remaining:
      row.publication.status === "not_published"
        ? [
            "publication_and_binding",
            "bounded_selection",
            "real_provider_callback",
            "dependency_and_environment_scenarios",
            "AI38_productive_acceptance",
          ]
        : accepted
          ? [
              "remaining_semantic_dependency_and_environment_scenarios",
              "physical_UI_acceptance",
              "AI38_productive_acceptance",
            ]
          : [
              "real_provider_callback_and_receipt_for_this_capability",
              "dependency_and_environment_scenarios",
              "AI38_productive_acceptance",
            ],
  };
});
const intermediateUnit = [
  ".tmp/ai36-c05-server-full.json",
  ".tmp/ai36-c05-server-final.json",
  ".tmp/ai36-c05-server-final2.json",
]
  .filter(exists)
  .map((file) => ({
    ...tests(file, false),
    status: "preserved_intermediate_not_final_acceptance",
    classification: file.endsWith("server-full.json")
      ? "108_fixture_TDZ_failures_and_two_Web_prompt_projection_expectations"
      : file.endsWith("server-final2.json")
        ? "previous_complete_suite_before_compact_authorized_catalog_index"
        : "earlier_complete_suite_before_final_SQL_and_internal_profile_cleanup",
  }));
const liveLast = liveAttempts.at(-1)?.result;
const report = {
  schema_version: 1,
  stage: "AI-36-C05",
  status:
    sqlFinal.status === "passed" && liveFinal.status === "passed"
      ? "selective_publication_and_staged_discovery_verified_in_laboratory_AI36_still_open"
      : "selective_publication_local_QA_verified_SQL_or_real_acceptance_partial",
  scope:
    "offline_consolidation_of_distinct_publication_unit_compiled_SQL_and_real_provider_receipts",
  server_unit: { ...unit, max_workers: 2 },
  focused_process_runtime: {
    ...processRuntime,
    scope:
      "110_passed_with_bounded_authorized_discovery_metadata_index_provenance_checks",
  },
  focused_discovery_index: {
    ...discoveryIndex,
    scope:
      "47_provider_flow_and_28_context_builder_tests_for_complete_bounded_authorized_catalog_metadata_index_without_grant_activation",
  },
  focused_selection_intermediate: {
    ...selectionIntermediate,
    scope:
      "205_passed_before_removing_two_unwanted_HTTP_profile_tests_not_summed_into_final_suite",
  },
  focused_observation: observation,
  quality: {
    build: "complete_final_build_chain_verified",
    production_types: "passed",
    lint_errors: 0,
    existing_lint_warnings: 3,
    global_fixture_types: {
      existing_errors: fixtureErrors,
      existing_files: fixtureFiles,
      added_errors: 0,
      comparison: "CRLF_to_LF_then_error_source_coordinates_replaced_only",
      normalized_semantic_sha256: semanticHash,
      raw_final: ref(files.fixtureTypes),
      raw_C04_baseline: ref(files.fixtureBaseline),
    },
  },
  publication: {
    release_id: release,
    catalog_release: manifest.catalog_release,
    preserved_reads: 67,
    new_capabilities: newIds,
    global_capabilities: 74,
    documents: 31,
    fragments: 31,
    source_paths: 59,
    excluded: 28,
    preserved_prior_content_hashes: 27,
    preserved_prior_MCP_receipt_hashes: 67,
    unpublished_candidates: 77,
  },
  staged_selection: {
    default: "automatic_discovery",
    discovery_technical_descriptors: 8,
    execution_technical_descriptors: 7,
    selectable_capability_IDs: { minimum: 1, maximum: 67, unique: true },
    catalog_tools: 74,
    catalog_utf8_bytes: 131072,
    json_cardinality: 128,
    sql_grant_cardinality: 128,
    assembled_context_utf8_bytes: 262144,
    accumulated_provider_generations: 3,
    delegations: 1,
    compaction_consumes_same_generation_budget: true,
    automatic_uncertain_retries: 0,
    activation:
      "terminal_proof_ACK_then_local_stage_replaces_validated_allowlist_within_frozen_modules_scope_and_current_permissions",
    selection_tool_absent_during_execution: true,
    explicit_profiles:
      "programmatic_internal_backend_WeakSet_options_only_no_public_HTTP_field_or_UI_profile_selector",
    finance_assistance_profile_capabilities: 18,
    initial_catalog_index: {
      scope:
        "complete_current_published_and_actor_authorized_metadata_grouped_by_module_and_resource",
      schemas_or_handlers_included: false,
      capability_grant_activated_by_metadata: false,
      current_catalog_hash_and_context_source_provenance_revalidated: true,
      cumulative_tool_calls_budget_unchanged: 12,
    },
  },
  SQL: {
    ...sqlFinal,
    transport: "synthetic",
    publication: "actual_compiled_production_bundle_no_synthetic_override",
    attempts: sqlAttempts.map((item) => item.summary),
    checks_not_summed_across_attempts: true,
    actual_provider_generations: 0,
    synthetic_provider_dispatches_last_attempt: numeric(
      sqlLast?.synthetic_provider_dispatches,
    ),
    synthetic_terminal_ACKs_last_attempt: numeric(
      sqlLast?.synthetic_proof_ACKs,
    ),
    synthetic_failed_ACKs_last_attempt: numeric(sqlLast?.synthetic_failed_ACKs),
    operator_HTTP_requests_last_attempt: numeric(sqlLast?.http_requests),
    scenarios_last_attempt: Array.isArray(sqlLast?.scenarios)
      ? sqlLast.scenarios.map((item) => ({
          name: item.name,
          final_state: item.final_state ?? null,
          error_code: item.error_code ?? null,
          provider_dispatches_used: numeric(item.provider_dispatches_used),
          delegations_used: numeric(item.delegations_used),
          tool_calls_used: numeric(item.tool_calls_used),
          final_selection_phase: item.final_selection_phase ?? null,
        }))
      : null,
  },
  real_provider: {
    ...liveFinal,
    attempts: liveAttempts.map((item) => item.summary),
    supplementary_native_evidence: supplementaryNativeEvidence,
    actual_generations: observedGenerations(
      liveAttempts,
      "actual_provider_generations",
    ),
    dispatch_attempts: observedGenerations(
      liveAttempts,
      "provider_dispatch_attempts",
    ),
    generation_count_scope: liveLast?.generation_count_scope ?? null,
    selection: liveLast?.selection ?? null,
    natural_language_scope: liveLast?.natural_language_scope ?? null,
    human_confirmation_layer: liveLast?.human_confirmation_layer ?? null,
    physical_UI_accepted: false,
    productive_acceptance: false,
    proof_ACKs_last_attempt: Array.isArray(liveLast?.native_terminal_ACKs)
      ? liveLast.native_terminal_ACKs.length
      : null,
    operator_HTTP_confirmations_last_attempt: Array.isArray(
      liveLast?.human_confirmations,
    )
      ? liveLast.human_confirmations.length
      : null,
    configured_database:
      "read_only_public_connection_configuration_and_quiet_checks_only",
    business_effects:
      "synthetic_disposable_PostgreSQL_after_separate_exact_operator_HTTP_confirmation",
    no_all_capability_acceptance_claim: true,
  },
  supplementary_offline_bridge_control: {
    evidence: ref(files.bridgeControl),
    scope: bridgeControl.scope,
    source_imports_hashes_verified: bridgeControl.local_imports.length,
    script_hash_verified: true,
    result: bridgeControl.result,
    boundaries: bridgeControl.boundaries,
    limitations: bridgeControl.limitations,
    productive_or_real_provider_acceptance_added: false,
  },
  capability_acceptance: {
    rows: perCapability,
    real_callback_verified_capabilities: perCapability.filter(
      (item) =>
        item.real_callback_status === "verified_in_recorded_laboratory_attempt",
    ).length,
    total_registrable_capabilities: 151,
    complete_semantic_or_productive_acceptance_claimed: false,
  },
  final_compiled_provenance: currentCompiledProofs,
  historical_compiled_provenance: [
    ...sqlAttempts.slice(0, -1),
    ...liveAttempts.slice(0, -1),
  ].map((item) => ({
    evidence: ref(item.file),
    manifest: ref(item.file.replace(/\.json$/, "-manifest.json")),
    status: item.summary.outer_status,
    knowledge_release: item.snapshot.knowledge_release,
    compiled_files: item.snapshot.compiled_files,
    comparison:
      "immutable_historical_cohort_not_claimed_identical_to_later_deliberate_build",
  })),
  source_inventory: {
    modules: 89,
    controllers: 46,
    handlers: 217,
    aliases: 336,
    source_hashes: 869,
    coordination_routes: 41,
    total_migrations: 29,
    new_tables: 0,
    new_migrations: 0,
    new_HTTP_routes: 0,
  },
  task_scope: {
    candidate_operationally_deployed: false,
    operational_services_restarted: false,
    UI_changed: false,
    application_Python_changed: false,
    R2_operations: 0,
    evidence_python_harnesses_are_not_application_changes: true,
    operational_provider_configuration_read_only: true,
  },
  preserved_intermediate_evidence: intermediateUnit,
  preserved_findings: [
    "The early complete suite is retained:108 fixture temporal-dead-zone failures and two Web prompt projection expectations were corrected before final validation.",
    "The first SQL attempt failed before assertions; the second retained four checks then exposed PostgreSQL JSON operator precedence in delegated continuation. Parenthesized operands require the final rebuilt SQL acceptance; failures are not overwritten or presented as provider timeouts.",
    "Two public HTTP profile-field tests and their DTO extension were removed; the unchanged strict HTTP contract is preserved and profiles remain programmatic internal backend options.",
    "The first real-provider cohort completed a finance preparation callback but exhausted the unchanged12-call cumulative budget before closing its turn. Its unknown outcome was reconciled without replay. A later deliberate build adds the complete bounded authorized catalog metadata index; the first cohort remains historical and its callback is not completed-turn acceptance.",
    "Full fixture typechecking retains192 prior errors in48files. Only line/column offsets and CRLF are normalized for the semantic comparison; production typechecking is independently clean.",
  ],
  limitations: [
    "First-lot publication is seven capabilities, not all84 candidates or151 registrable capabilities. AI36 remains open with77 unpublished candidates.",
    "Unit tests, SQL with synthetic transport, real-provider callbacks, exact operator HTTP confirmation, physical UI and productive acceptance are separate evidence layers.",
    "A successful callback in an incomplete attempt is recorded as an observation, not full turn acceptance. Earlier failures remain linked.",
    "Actual generation counters represent accepted native MCP start requests; they do not measure tokens, billing or undisclosed internal provider inference.",
    "Retained native diagnostics and their correction are supplementary observations. Repeated tool step_update events do not establish unique invocations; the missing CLI terminal in LIVE02 has no verified root cause, including malformed JSON, quota, a second hung call or exhausted tool budget.",
    "Directed synthetic prompts with exact tool names and known IDs do not prove unrestricted natural-language quality or every semantic scenario for a capability.",
    "Client, V8, Python application suites and R2 were not rerun for this Node/publication change; historical reports keep their original scope.",
    "No automatic inference replay is used to resolve uncertainty; retained native state must be explicitly reconciled before cleanup.",
  ],
  evidence: Object.fromEntries(
    Object.entries(files).map(([key, file]) => [key, ref(file)]),
  ),
  reproducible_consolidator: ref(
    "docs/evidence/scripts/validate-nodia-ai-ai36-c05.cjs",
  ),
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (mode === "--write") fs.writeFileSync(output, serialized);
else if (mode === "--check")
  assert.equal(
    fs.readFileSync(output, "utf8"),
    serialized,
    "C05 consolidation drift",
  );
console.log(
  JSON.stringify({
    stage: report.stage,
    mode,
    status: report.status,
    server_tests: unit.tests,
    server_files: unit.files,
    SQL_status: sqlFinal.status,
    SQL_checks: sqlFinal.checks,
    live_status: liveFinal.status,
    real_callback_capabilities:
      report.capability_acceptance.real_callback_verified_capabilities,
    AI36_open: true,
  }),
);
