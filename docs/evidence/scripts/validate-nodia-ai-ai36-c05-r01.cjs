/* C05-R01 offline acceptance gate. No application imports, SQL, network or inference.
 * Historical C05 files stay immutable. New cohorts are explicit, never discovered. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
process.chdir(path.resolve(__dirname, "../../.."));
const inputsPath = "docs/evidence/nodia-ai-ai36-c05-r01-inputs.json";
const outputPath = "docs/evidence/nodia-ai-ai36-c05-r01-validation.json";
const mode = process.argv[2] ?? "--check";
assert(
  [
    "--check",
    "--write",
    "--dry-run",
    "--self-test",
    "--check-historical",
  ].includes(mode),
);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const reference = (file) => ({
  path: file,
  sha256: hash(fs.readFileSync(file)),
});
const hashPattern = /^[a-f0-9]{64}$/;
const string = (value) => typeof value === "string" && value.length > 0;
const number = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : null;
const requiredSemantics = {
  nodia_finance_movements_prepare_create: [
    "finance_preview_exact",
    "finance_no_effect_before_confirmation",
    "finance_exact_effect_once_after_confirmation",
    "finance_atomic_receipt",
  ],
  nodia_proposals_get: ["proposal_exact_revision_hash"],
  nodia_operations_get: ["operation_exact_execution_completed"],
  nodia_attachments_describe: ["attachment_exact_closed_metadata"],
  nodia_preferences_list: ["preferences_excludes_unaccepted"],
  nodia_preferences_prepare: [
    "preference_draft_exact",
    "preference_unaccepted_before_confirmation",
    "preference_exact_effect_once_after_confirmation",
    "preference_atomic_receipt",
  ],
  nodia_workflows_prepare: [
    "workflow_exact_ordered_steps",
    "workflow_no_effect_before_confirmation",
    "workflow_exact_effects_once_after_confirmation",
    "workflow_native_step_receipts",
  ],
};
const independentCaseTools = {
  reads: ["nodia_operations_get", "nodia_attachments_describe"],
  preferences: ["nodia_preferences_prepare", "nodia_preferences_list"],
  finance: ["nodia_finance_movements_prepare_create"],
  workflow: ["nodia_workflows_prepare"],
};

function verifyReference(item) {
  assert(string(item?.path) && hashPattern.test(item.sha256));
  assert.equal(
    reference(item.path).sha256,
    item.sha256,
    "evidence changed: " + item.path,
  );
  return item;
}
function collectReferences(value, found = new Map()) {
  if (!value || typeof value !== "object") return found;
  if (string(value.path) && hashPattern.test(value.sha256 ?? ""))
    found.set(value.path, value);
  for (const child of Object.values(value)) collectReferences(child, found);
  return found;
}
function historical(inputs) {
  verifyReference(inputs.historical_report);
  verifyReference(inputs.historical_consolidator);
  const report = read(inputs.historical_report.path);
  assert.deepEqual(
    report.reproducible_consolidator,
    inputs.historical_consolidator,
  );
  const immutable = [...collectReferences(report).values()].filter(
    (item) =>
      item.path.startsWith("docs/evidence/") || item.path.startsWith(".tmp/"),
  );
  immutable.forEach(verifyReference);
  assert.equal(
    report.capability_acceptance.real_callback_verified_capabilities,
    0,
  );
  assert.equal(report.real_provider.actual_generations.observed_total, 4);
  return {
    evidence: inputs.historical_report,
    consolidator: inputs.historical_consolidator,
    immutable_references_verified: immutable.length,
    scope:
      "immutable_report_receipts_QA_snapshots_and_original_consolidator_not_current_operational_acceptance",
    mutable_working_tree_references:
      "historical_hashes_retained_not_claimed_current",
  };
}

function validAcknowledgement(result, generation) {
  return (
    generation.terminal_proof_received === true &&
    generation.terminal_proof_outcome === "completed" &&
    generation.process_closed === true &&
    hashPattern.test(generation.terminal_proof_sha256 ?? "") &&
    (result.native_terminal_ACKs ?? []).some(
      (ack) =>
        ack.attempt_id === generation.attempt_id &&
        ack.terminal_proof_sha256 === generation.terminal_proof_sha256 &&
        string(ack.acknowledged_at_utc),
    )
  );
}
function linkedReceipt(
  turn,
  generation,
  callback,
  capability,
  contractHash,
  strictBindings,
) {
  if (
    callback.name !== capability ||
    callback.status !== "completed" ||
    !string(callback.call_id) ||
    !hashPattern.test(callback.result_sha256 ?? "") ||
    callback.durable_receipt?.state !== "completed" ||
    !string(callback.durable_receipt.receipt_id) ||
    !hashPattern.test(callback.durable_receipt.result_sha256 ?? "")
  )
    return null;
  if (
    Object.hasOwn(callback, "observed_attempt_id") &&
    callback.observed_attempt_id !== generation.attempt_id
  )
    return null;
  if (
    strictBindings &&
    (callback.observed_attempt_id !== generation.attempt_id ||
      callback.durable_receipt.run_id !== turn.run_id ||
      callback.durable_receipt.adapter_call_id !== callback.call_id)
  )
    return null;
  if (!(generation.selected_tool_names ?? []).includes(capability)) return null;
  if (
    (turn.callbacks ?? []).filter(
      (item) =>
        item.name === callback.name &&
        item.call_id === callback.call_id &&
        item.status === callback.status &&
        (!strictBindings ||
          item.observed_attempt_id === generation.attempt_id) &&
        item.durable_receipt?.receipt_id ===
          callback.durable_receipt.receipt_id &&
        item.durable_receipt?.result_sha256 ===
          callback.durable_receipt.result_sha256,
    ).length !== 1
  )
    return null;
  const receipts = (turn.receipts ?? []).filter(
    (item) =>
      item.receipt_id === callback.durable_receipt.receipt_id &&
      item.tool_name === capability &&
      item.state === "completed" &&
      (!strictBindings ||
        (item.run_id === turn.run_id &&
          item.adapter_call_id === callback.call_id)) &&
      (!Object.hasOwn(item, "run_id") || item.run_id === turn.run_id) &&
      (!Object.hasOwn(item, "adapter_call_id") ||
        item.adapter_call_id === callback.call_id) &&
      item.result_sha256 === callback.durable_receipt.result_sha256 &&
      hashPattern.test(item.contract_hash ?? "") &&
      (!contractHash || item.contract_hash === contractHash),
  );
  return receipts.length === 1 ? receipts[0] : null;
}
function qualifyingTurns(result, capability, bindingPolicy) {
  const strictBindings =
    bindingPolicy === "explicit_sql_run_call_and_observed_generation";
  const observed = result.per_capability?.[capability];
  if (
    !observed ||
    observed.selected_in_real_generation !== true ||
    !(number(observed.successful_callbacks) > 0) ||
    !hashPattern.test(observed.contract_hash ?? "")
  )
    return [];
  if (
    result.synthetic_provider_transport !== false ||
    result.synthetic_publication_override !== false ||
    result.unresolved_native_or_proof_state !== false
  )
    return [];
  return (result.turns ?? []).flatMap((turn) => {
    if (
      turn.state !== "completed" ||
      !string(turn.run_id) ||
      !Array.isArray(turn.generations) ||
      turn.generations.length === 0 ||
      !turn.generations.every((generation) =>
        validAcknowledgement(result, generation),
      )
    )
      return [];
    const discovery = turn.generations.find(
      (generation) => generation.phase === "discovery",
    );
    if (
      !discovery ||
      !(discovery.callbacks ?? []).some((callback) =>
        linkedReceipt(
          turn,
          discovery,
          callback,
          "nodia_capabilities_select",
          null,
          strictBindings,
        ),
      )
    )
      return [];
    const linked = turn.generations
      .filter(
        (generation) =>
          generation.phase === "execution" &&
          generation.discovery_ACK_completed_before_dispatch === true,
      )
      .flatMap((generation) =>
        (generation.callbacks ?? []).flatMap((callback) => {
          const receipt = linkedReceipt(
            turn,
            generation,
            callback,
            capability,
            observed.contract_hash,
            strictBindings,
          );
          return receipt
            ? [
                {
                  callback_call_id: callback.call_id,
                  receipt_id: receipt.receipt_id,
                  contract_hash: receipt.contract_hash,
                  result_sha256: receipt.result_sha256,
                  attempt_id: generation.attempt_id,
                  observed_generation_binding: Object.hasOwn(
                    callback,
                    "observed_attempt_id",
                  )
                    ? "retained_adapter_observation_checked"
                    : "frozen_producer_callback_placement",
                  SQL_run_and_adapter_call_binding:
                    Object.hasOwn(receipt, "run_id") &&
                    Object.hasOwn(receipt, "adapter_call_id")
                      ? "explicit_retained_columns_checked"
                      : "producer_query_filters_run_and_adapter_call_columns_not_retained_in_this_projection",
                },
              ]
            : [];
        }),
      );
    return linked.length
      ? [
          {
            label: turn.label,
            run_id: turn.run_id,
            linked_callbacks: linked,
            acknowledged_generations: turn.generations.map((item) => ({
              attempt_id: item.attempt_id,
              terminal_proof_sha256: item.terminal_proof_sha256,
            })),
          },
        ]
      : [];
  });
}
function semantics(result, capability) {
  const actual = result.per_capability?.[capability]?.semantic_assertions ?? [];
  const expected = requiredSemantics[capability];
  return {
    required: expected,
    checks: expected.map((id) => {
      const rows = actual.filter((item) => item.id === id);
      return {
        id,
        passed:
          rows.length === 1 &&
          rows[0].passed === true &&
          Object.hasOwn(rows[0], "expected") &&
          Object.hasOwn(rows[0], "observed") &&
          isDeepStrictEqual(rows[0].expected, rows[0].observed),
        evidence: rows.length === 1 ? rows[0] : null,
      };
    }),
  };
}
function evaluate(
  result,
  capability,
  bindingPolicy = "explicit_sql_run_call_and_observed_generation",
) {
  const turns = qualifyingTurns(result, capability, bindingPolicy),
    semantic = semantics(result, capability);
  const effectful = [
    "nodia_finance_movements_prepare_create",
    "nodia_preferences_prepare",
    "nodia_workflows_prepare",
  ].includes(capability);
  const confirmations = (result.human_confirmations ?? []).filter(
    (item) =>
      string(item.proposal_id) &&
      Number.isSafeInteger(item.revision) &&
      item.revision > 0 &&
      hashPattern.test(item.proposal_hash ?? "") &&
      string(item.execution_id) &&
      item.duplicate_confirmation_same_execution === true &&
      item.purpose !== "bootstrap_fixture_not_capability_acceptance" &&
      (!result.independent_case || item.purpose === "capability_acceptance") &&
      item.layer === "operator_HTTP_fixture_actor_not_UI",
  );
  const identityCheck =
    result.per_capability?.nodia_proposals_get?.semantic_assertions?.find(
      (item) =>
        item.id === "proposal_exact_revision_hash" &&
        item.passed === true &&
        isDeepStrictEqual(item.expected, item.observed),
    );
  const financeProposalIdentity =
    capability === "nodia_finance_movements_prepare_create"
      ? identityCheck?.observed
      : null;
  const financeIdentityConfirmed = financeProposalIdentity
    ? confirmations.some(
        (item) =>
          item.proposal_id === financeProposalIdentity.proposal_id &&
          item.revision === financeProposalIdentity.revision &&
          item.proposal_hash === financeProposalIdentity.hash,
      )
    : null;
  const humanConfirmed =
    !effectful ||
    (confirmations.length > 0 && financeIdentityConfirmed !== false);
  return {
    capability_id: capability,
    receipt_binding_policy: bindingPolicy,
    qualifying_completed_turns: turns,
    real_callback_and_terminal_protocol_verified: turns.length > 0,
    semantic_assertions: semantic,
    valid_operator_confirmation_recorded_where_required: humanConfirmed,
    human_confirmation_binding: effectful
      ? {
          valid_operator_records: confirmations,
          finance_public_proposal_identity_correlated: financeIdentityConfirmed,
          preparation_callback_to_proposal_and_effect:
            "validated_by_frozen_producer_and_same_cohort_SQL_semantic_assertions_not_independently_reconstructed_from_callback_hashes",
        }
      : null,
    representative_real_E2E_verified:
      turns.length > 0 &&
      semantic.checks.every((item) => item.passed) &&
      humanConfirmed,
    complete_semantic_or_productive_acceptance: false,
  };
}

function cohortProvenance(item, receipt, manifest, lookup = reference) {
  const provenance = item.compiled_provenance;
  assert(provenance, "cohort compiled provenance must be explicit");
  assert(
    ["frozen_cohort_manifest", "current_compiled"].includes(provenance.mode),
    "invalid compiled provenance mode",
  );
  const manifestPath = item.receipt.path.replace(/\.json$/, "-manifest.json");
  assert.equal(provenance.manifest?.path, manifestPath);
  assert(hashPattern.test(provenance.manifest?.sha256 ?? ""));
  assert.equal(lookup(manifestPath).sha256, provenance.manifest.sha256);
  assert.equal(receipt.manifest_sha256, provenance.manifest.sha256);
  assert(string(item.producer_harness_path));
  assert(hashPattern.test(provenance.producer_harness_sha256 ?? ""));
  assert.equal(
    manifest.files[item.producer_harness_path],
    provenance.producer_harness_sha256,
    "frozen producer must belong to the exact cohort manifest",
  );
  assert.equal(receipt.harness_sha256, provenance.producer_harness_sha256);
  assert(hashPattern.test(provenance.archive_sha256 ?? ""));
  assert.equal(receipt.archive_sha256, provenance.archive_sha256);
  const caseFixturePath =
    "test/nodia-ai-ai36-c05-independent-cases.fixture.mjs";
  if (receipt.case_id !== undefined) {
    assert(Object.hasOwn(independentCaseTools, receipt.case_id));
    assert(hashPattern.test(receipt.case_fixture_sha256 ?? ""));
    assert.equal(manifest.files[caseFixturePath], receipt.case_fixture_sha256);
  }
  const files = Object.entries(manifest.files).filter(
    ([file]) => file.startsWith("dist/") && /\.(js|json|md)$/.test(file),
  );
  assert(files.length > 0);
  for (const [, digest] of files) assert(hashPattern.test(digest));
  if (provenance.mode === "current_compiled") {
    for (const [file, digest] of files)
      assert.equal(
        lookup("nodia-server/" + file).sha256,
        digest,
        "candidate build changed: " + file,
      );
    assert.equal(
      lookup("nodia-server/" + item.producer_harness_path).sha256,
      provenance.producer_harness_sha256,
      "current producer differs from the executed producer",
    );
    if (receipt.case_id !== undefined)
      assert.equal(
        lookup("nodia-server/" + caseFixturePath).sha256,
        receipt.case_fixture_sha256,
      );
  }
  return {
    mode: provenance.mode,
    manifest: provenance.manifest,
    producer_harness_sha256: provenance.producer_harness_sha256,
    archive_sha256: provenance.archive_sha256,
    independent_case_fixture:
      receipt.case_id === undefined
        ? null
        : {
            archive_member: caseFixturePath,
            sha256: receipt.case_fixture_sha256,
          },
    compiled_executable_files: files.length,
    current_compiled_provenance_checked: provenance.mode === "current_compiled",
    archive_byte_verification:
      "recorded_by_frozen_remote_producer_not_repeated_from_retained_archive_bytes",
  };
}

function provenanceSelfTest() {
  const digest = "a".repeat(64),
    producer = "b".repeat(64),
    archive = "c".repeat(64);
  const item = {
    receipt: { path: "fixture.json" },
    producer_harness_path: "test/producer.mjs",
    compiled_provenance: {
      mode: "frozen_cohort_manifest",
      manifest: { path: "fixture-manifest.json", sha256: digest },
      producer_harness_sha256: producer,
      archive_sha256: archive,
    },
  };
  const receipt = {
    manifest_sha256: digest,
    harness_sha256: producer,
    archive_sha256: archive,
  };
  const manifest = {
    files: { "test/producer.mjs": producer, "dist/app.js": digest },
  };
  const lookup = (file) => ({
    path: file,
    sha256: file.endsWith("producer.mjs") ? producer : digest,
  });
  cohortProvenance(item, receipt, manifest, lookup);
  const current = structuredClone(item);
  current.compiled_provenance.mode = "current_compiled";
  cohortProvenance(current, receipt, manifest, lookup);
  const attacks = {
    missing_provenance: (i) => {
      delete i.compiled_provenance;
    },
    missing_manifest_reference: (i) => {
      delete i.compiled_provenance.manifest;
    },
    unrelated_manifest_path: (i) => {
      i.compiled_provenance.manifest.path = "other-manifest.json";
    },
    changed_manifest_hash: (i) => {
      i.compiled_provenance.manifest.sha256 = archive;
    },
    changed_receipt_manifest: (_i, r) => {
      r.manifest_sha256 = archive;
    },
    missing_producer_digest: (i) => {
      delete i.compiled_provenance.producer_harness_sha256;
    },
    unrelated_producer_member: (i) => {
      i.producer_harness_path = "test/other.mjs";
    },
    changed_producer_manifest: (_i, _r, m) => {
      m.files["test/producer.mjs"] = archive;
    },
    changed_producer_receipt: (_i, r) => {
      r.harness_sha256 = archive;
    },
    changed_archive_receipt: (_i, r) => {
      r.archive_sha256 = digest;
    },
    empty_compiled_manifest: (_i, _r, m) => {
      delete m.files["dist/app.js"];
    },
  };
  for (const [name, mutate] of Object.entries(attacks)) {
    const i = structuredClone(item),
      r = structuredClone(receipt),
      m = structuredClone(manifest);
    mutate(i, r, m);
    assert.throws(() => cohortProvenance(i, r, m, lookup), name);
  }
  assert.throws(
    () =>
      cohortProvenance(current, receipt, manifest, (file) => ({
        ...lookup(file),
        sha256: archive,
      })),
    "current files must still match",
  );
  return {
    positive_fixtures: 2,
    negative_fixtures: [...Object.keys(attacks), "current_compiled_drift"],
  };
}

function selfTest() {
  const capability = "nodia_finance_movements_prepare_create",
    contractHash = "a".repeat(64);
  const makeCallback = (name, id) => ({
    name,
    call_id: "fixture-call-" + id,
    status: "completed",
    result_sha256: "b".repeat(64),
    durable_receipt: {
      receipt_id: id,
      state: "completed",
      result_sha256: "c".repeat(64),
    },
  });
  const selection = makeCallback("nodia_capabilities_select", "fixture-select"),
    callback = makeCallback(capability, "fixture-business");
  selection.observed_attempt_id = "fixture-discovery";
  callback.observed_attempt_id = "fixture-execution";
  for (const value of [selection, callback]) {
    value.durable_receipt.run_id = "fixture-run";
    value.durable_receipt.adapter_call_id = value.call_id;
  }
  const generation = (id, phase, value) => ({
    attempt_id: id,
    phase,
    callbacks: [value],
    selected_tool_names: [value.name],
    terminal_proof_received: true,
    terminal_proof_outcome: "completed",
    process_closed: true,
    terminal_proof_sha256: "d".repeat(64),
    discovery_ACK_completed_before_dispatch: true,
  });
  const seed = {
    synthetic_provider_transport: false,
    synthetic_publication_override: false,
    unresolved_native_or_proof_state: false,
    human_confirmations: [
      {
        proposal_id: "fixture-proposal",
        revision: 1,
        proposal_hash: "e".repeat(64),
        execution_id: "fixture-execution-id",
        duplicate_confirmation_same_execution: true,
        layer: "operator_HTTP_fixture_actor_not_UI",
      },
    ],
    per_capability: {
      nodia_proposals_get: {
        semantic_assertions: [
          {
            id: "proposal_exact_revision_hash",
            passed: true,
            expected: {
              proposal_id: "fixture-proposal",
              revision: 1,
              hash: "e".repeat(64),
            },
            observed: {
              proposal_id: "fixture-proposal",
              revision: 1,
              hash: "e".repeat(64),
            },
          },
        ],
      },
      [capability]: {
        selected_in_real_generation: true,
        successful_callbacks: 1,
        contract_hash: contractHash,
        semantic_assertions: requiredSemantics[capability].map((id) => ({
          id,
          passed: true,
          expected: "fixture",
          observed: "fixture",
        })),
      },
    },
    native_terminal_ACKs: ["fixture-discovery", "fixture-execution"].map(
      (attempt_id) => ({
        attempt_id,
        terminal_proof_sha256: "d".repeat(64),
        acknowledged_at_utc: "fixture-time",
      }),
    ),
    turns: [
      {
        state: "completed",
        run_id: "fixture-run",
        label: "isolated-security-fixture",
        callbacks: [selection, callback],
        generations: [
          generation("fixture-discovery", "discovery", selection),
          generation("fixture-execution", "execution", callback),
        ],
        receipts: [selection, callback].map((item) => ({
          receipt_id: item.durable_receipt.receipt_id,
          tool_name: item.name,
          state: "completed",
          run_id: "fixture-run",
          adapter_call_id: item.call_id,
          contract_hash: contractHash,
          result_sha256: item.durable_receipt.result_sha256,
        })),
      },
    ],
  };
  assert.equal(
    evaluate(seed, capability).representative_real_E2E_verified,
    true,
  );
  const partial = structuredClone(seed);
  partial.status = "failed";
  assert.equal(
    evaluate(partial, capability).representative_real_E2E_verified,
    true,
    "a later unrelated cohort failure does not erase a fully proven capability",
  );
  const attacks = {
    missing_execution_ACK: (r) => r.native_terminal_ACKs.pop(),
    another_attempt_ACK: (r) => {
      r.native_terminal_ACKs[1].attempt_id = "other-run";
    },
    another_proof_ACK: (r) => {
      r.native_terminal_ACKs[1].terminal_proof_sha256 = "e".repeat(64);
    },
    cancelled_native_proof: (r) => {
      r.turns[0].generations[1].terminal_proof_outcome = "cancelled";
    },
    process_not_closed: (r) => {
      r.turns[0].generations[1].process_closed = false;
    },
    callback_from_another_turn: (r) => {
      r.turns[0].callbacks = [selection];
    },
    foreign_receipt: (r) => {
      r.turns[0].receipts[1].receipt_id = "foreign";
    },
    result_changed: (r) => {
      r.turns[0].receipts[1].result_sha256 = "f".repeat(64);
    },
    incompatible_contract: (r) => {
      r.turns[0].receipts[1].contract_hash = "f".repeat(64);
    },
    foreign_explicit_SQL_run: (r) => {
      r.turns[0].receipts[1].run_id = "other-run";
    },
    foreign_explicit_SQL_call: (r) => {
      r.turns[0].receipts[1].adapter_call_id = "other-call";
    },
    missing_SQL_binding_columns: (r) => {
      delete r.turns[0].receipts[1].run_id;
    },
    missing_observed_generation_binding: (r) => {
      delete r.turns[0].generations[1].callbacks[0].observed_attempt_id;
    },
    another_observed_generation: (r) => {
      r.turns[0].generations[1].callbacks[0].observed_attempt_id =
        "other-attempt";
    },
    duplicated_receipt_identity: (r) => {
      r.turns[0].receipts.push({ ...r.turns[0].receipts[1] });
    },
    duplicated_callback_identity: (r) => {
      r.turns[0].callbacks.push(structuredClone(r.turns[0].callbacks[1]));
    },
    incomplete_terminal_receipt: (r) => {
      r.turns[0].receipts[1].state = "unknown";
    },
    execution_before_discovery_ACK: (r) => {
      r.turns[0].generations[1].discovery_ACK_completed_before_dispatch = false;
    },
    incomplete_callback_receipt: (r) => {
      r.turns[0].generations[1].callbacks[0].durable_receipt.state = "unknown";
    },
    domain_not_selected: (r) => {
      r.turns[0].generations[1].selected_tool_names = [];
    },
    selector_not_durable: (r) => {
      r.turns[0].receipts.shift();
    },
    overall_pass_cannot_override_unknown_turn: (r) => {
      r.status = "passed";
      r.turns[0].state = "unknown";
    },
    unresolved_native_state: (r) => {
      r.unresolved_native_or_proof_state = true;
    },
    simulated_transport: (r) => {
      r.synthetic_provider_transport = true;
    },
    missing_semantic_check: (r) => {
      r.per_capability[capability].semantic_assertions.pop();
    },
    false_semantic_check: (r) => {
      r.per_capability[capability].semantic_assertions[0].passed = false;
    },
    wrong_semantic_value: (r) => {
      r.per_capability[capability].semantic_assertions[0].observed =
        "wrong-amount";
    },
    missing_human_confirmation: (r) => {
      r.human_confirmations = [];
    },
    implicit_model_confirmation: (r) => {
      r.human_confirmations[0].layer = "model_tool_call";
    },
    non_idempotent_human_confirmation: (r) => {
      r.human_confirmations[0].duplicate_confirmation_same_execution = false;
    },
    unrelated_known_proposal_confirmation: (r) => {
      r.human_confirmations[0].proposal_id = "another-proposal";
    },
    bootstrap_confirmation_is_not_capability_confirmation: (r) => {
      r.human_confirmations[0].purpose =
        "bootstrap_fixture_not_capability_acceptance";
    },
    independent_case_requires_explicit_confirmation_purpose: (r) => {
      r.independent_case = "finance";
    },
  };
  for (const [name, mutate] of Object.entries(attacks)) {
    const candidate = structuredClone(seed);
    mutate(candidate);
    assert.equal(
      evaluate(candidate, capability).representative_real_E2E_verified,
      false,
      name,
    );
  }
  const realReceipts = [1, 2].map((attempt) => {
    const file = `docs/evidence/nodia-ai-ai36-c05-live-attempt0${attempt}.json`;
    const receipt = read(file);
    const accepted = Object.keys(requiredSemantics).filter(
      (name) =>
        evaluate(receipt.assertion_result, name)
          .representative_real_E2E_verified,
    );
    assert.deepEqual(accepted, []);
    return { evidence: reference(file), accepted_capabilities: accepted };
  });
  return {
    positive_isolated_fixtures: 2,
    negative_security_fixtures: Object.keys(attacks),
    historical_real_receipts: realReceipts,
    fixture_scope: "isolated_validator_inputs_not_provider_results",
    cohort_provenance_controls: provenanceSelfTest(),
  };
}
if (mode === "--self-test") {
  console.log(JSON.stringify({ stage: "AI-36-C05-R01", ...selfTest() }));
  process.exit(0);
}
const inputs = read(inputsPath);
assert.equal(inputs.stage, "AI-36-C05-R01");
const historicalEvidence = historical(inputs);
const historicalReport = read(inputs.historical_report.path);
if (mode === "--check-historical") {
  console.log(
    JSON.stringify({ stage: inputs.stage, mode, ...historicalEvidence }),
  );
  process.exit(0);
}
verifyReference(inputs.publication);
assert.equal(
  inputs.release_id,
  read(inputs.publication.path).compiled_publication.release_id,
);
assert.deepEqual(
  [...inputs.capability_ids].sort(),
  Object.keys(requiredSemantics).sort(),
);
assert.equal(
  new Set(inputs.cohorts.map((item) => item.receipt.path)).size,
  inputs.cohorts.length,
);
const currentCompiledDelta = inputs.current_compiled_delta
  ? (() => {
      verifyReference(inputs.current_compiled_delta);
      const delta = read(inputs.current_compiled_delta.path);
      assert.equal(delta.stage, "AI-36-C05-R01");
      assert.equal(delta.release_id, inputs.release_id);
      assert.equal(delta.capability_contract_count, 74);
      assert.equal(delta.current_provider_acceptance_claimed, false);
      assert.equal(delta.publication_builder_check.exit_code, 0);
      assert.equal(
        delta.publication_builder_check.result.counts.published_capabilities,
        74,
      );
      assert.equal(
        delta.publication_builder_check.result.release,
        inputs.release_id,
      );
      for (const item of [
        delta.baseline_manifest,
        delta.baseline_receipt,
        delta.publication,
        delta.compiled_knowledge_manifest,
        delta.source,
        delta.publication_builder_check.source,
        ...delta.declared_native_hash_sources,
        ...delta.compiled_factory_inputs_preserved,
      ])
        verifyReference(item);
      assert.equal(
        Object.keys(delta.current_files).length,
        delta.compiled_executable_file_count,
      );
      for (const [file, digest] of Object.entries(delta.current_files))
        assert.equal(
          reference("nodia-server/" + file).sha256,
          digest,
          "compiled delta changed: " + file,
        );
      return { evidence: inputs.current_compiled_delta, ...delta };
    })()
  : null;
const historicalCohortPaths = new Set(
  historicalReport.real_provider.attempts.map((item) => item.path),
);
assert(
  inputs.cohorts.every((item) => !historicalCohortPaths.has(item.receipt.path)),
  "a historical cohort must not be counted twice in the continuation",
);
const cohorts = inputs.cohorts.map((item) => {
  assert(["diagnostic", "representative_acceptance"].includes(item.role));
  assert(
    [
      "explicit_sql_run_call_and_observed_generation",
      "producer_query_legacy_projection",
    ].includes(item.receipt_binding_policy),
  );
  verifyReference(item.receipt);
  const receipt = read(item.receipt.path),
    result = receipt.assertion_result;
  assert.equal(receipt.stage, "AI-36-C05");
  const manifestFile = item.receipt.path.replace(/\.json$/, "-manifest.json");
  assert.equal(reference(manifestFile).sha256, receipt.manifest_sha256);
  const manifest = read(manifestFile);
  assert.equal(manifest.knowledge_release, inputs.release_id);
  const preflightOnly = item.format === "preflight_only";
  assert(
    [undefined, "compiled_harness_receipt", "preflight_only"].includes(
      item.format,
    ),
  );
  if (preflightOnly) {
    assert.equal(item.role, "diagnostic");
    assert.equal(receipt.status, "preflight_failed");
    assert.equal(receipt.harness_started, false);
    assert.equal(receipt.actual_provider_generations, 0);
    assert.equal(receipt.assertion_result, null);
    assert.equal(receipt.services_restarted, false);
  } else assert.equal(manifest.compiled_files, receipt.compiled_files_verified);
  assert(
    string(item.producer_harness_path) &&
      hashPattern.test(manifest.files[item.producer_harness_path] ?? ""),
  );
  for (const side of preflightOnly ? [] : ["stdout", "stderr"]) {
    const file = item.receipt.path.replace(/\.json$/, `-${side}.log`);
    assert.equal(reference(file).sha256, receipt[side + "_sha256"]);
  }
  const compiledFiles = Object.entries(manifest.files).filter(
    ([file]) => file.startsWith("dist/") && /\.(js|json|md)$/.test(file),
  );
  assert(compiledFiles.length > 0);
  const provenance = preflightOnly
    ? null
    : cohortProvenance(item, receipt, manifest);
  if (provenance?.mode === "current_compiled") {
    assert(
      currentCompiledDelta,
      "current-build cohort requires its explicit compiled delta pin",
    );
    assert.deepEqual(
      Object.fromEntries(compiledFiles),
      currentCompiledDelta.current_files,
    );
  }
  const evaluated =
    result && item.role === "representative_acceptance"
      ? inputs.capability_ids.map((name) =>
          evaluate(result, name, item.receipt_binding_policy),
        )
      : [];
  return {
    role: item.role,
    format: preflightOnly
      ? "preflight_only_no_harness_or_provider_start"
      : "compiled_harness_receipt",
    declared_scope: item.scope ?? null,
    receipt_binding_policy: item.receipt_binding_policy,
    frozen_producer_harness: {
      archive_member: item.producer_harness_path,
      sha256: manifest.files[item.producer_harness_path],
    },
    evidence: item.receipt,
    manifest: reference(manifestFile),
    status: receipt.status,
    inner_status: result?.status ?? null,
    failure_category: result?.failure_category ?? null,
    preflight_failure_phase: receipt.failure_phase ?? null,
    failure_assertion: result?.failure_assertion ?? null,
    completed_checks: Array.isArray(result?.checks)
      ? result.checks.length
      : null,
    selection: result?.selection ?? null,
    native_runtime_provenance: {
      observed_operational_Gemini_containers_before:
        receipt.operational_runtime_before?.gemini_containers ?? null,
      observed_operational_Gemini_containers_after:
        receipt.operational_runtime_after?.gemini_containers ?? null,
      public_mode_configuration_sha256:
        result?.public_mode_configuration_sha256 ?? null,
      scope:
        "Observed container/configuration metadata for this cohort only; no result is transferred to another native image, role or policy.",
      native_role_policy_independently_retained: false,
    },
    actual_provider_generations: number(
      result?.actual_provider_generations ??
        receipt.actual_provider_generations,
    ),
    provider_dispatch_attempts: number(result?.provider_dispatch_attempts),
    compiled_executable_files: compiledFiles.length,
    compiled_files_execution_verified: preflightOnly
      ? null
      : receipt.compiled_files_verified,
    compiled_provenance: provenance,
    current_compiled_provenance_checked:
      provenance?.current_compiled_provenance_checked ?? false,
    capability_callback_observations: inputs.capability_ids.map((name) => ({
      capability_id: name,
      requested: number(result?.per_capability?.[name]?.actual_callbacks),
      successful: number(result?.per_capability?.[name]?.successful_callbacks),
      selected_in_real_generation:
        typeof result?.per_capability?.[name]?.selected_in_real_generation ===
        "boolean"
          ? result.per_capability[name].selected_in_real_generation
          : null,
      observation_is_not_E2E_acceptance: true,
    })),
    evaluated,
    diagnostic_observations_are_not_acceptance: item.role === "diagnostic",
  };
});
const accepted = inputs.capability_ids.filter((name) =>
  cohorts.some((cohort) =>
    cohort.evaluated.some(
      (item) =>
        item.capability_id === name && item.representative_real_E2E_verified,
    ),
  ),
);
const capabilityMatrix = inputs.capability_ids.map((name) => {
  const observations = cohorts.flatMap((cohort) => {
    const result = cohort.evaluated.find((item) => item.capability_id === name);
    return result
      ? [
          {
            evidence: cohort.evidence,
            selection: cohort.selection,
            cohort_status: cohort.status,
            compiled_provenance: cohort.compiled_provenance,
            native_runtime_provenance: cohort.native_runtime_provenance,
            receipt_binding_policy: cohort.receipt_binding_policy,
            callback_and_terminal_protocol_verified:
              result.real_callback_and_terminal_protocol_verified,
            representative_real_E2E_verified:
              result.representative_real_E2E_verified,
          },
        ]
      : [];
  });
  return {
    capability_id: name,
    representative_real_E2E_verified: accepted.includes(name),
    callback_and_terminal_protocol_verified: observations.some(
      (item) => item.callback_and_terminal_protocol_verified,
    ),
    evidence_by_cohort: observations,
    required_semantic_assertion_ids: requiredSemantics[name],
    physical_UI_accepted: false,
    productive_acceptance: false,
    complete_semantic_acceptance_for_this_capability: false,
  };
});
const supplementary = inputs.supplementary_evidence.map(verifyReference);
const diagnosticProbeComparisons = (
  inputs.diagnostic_probe_comparisons ?? []
).map((item) => {
  assert(["synthetic_control", "real_diagnostic"].includes(item.role));
  verifyReference(item.evidence);
  verifyReference(item.source);
  const document = read(item.evidence.path);
  assert.equal(document.stage, "AI-36-C05");
  assert.equal(document.source_sha256, item.source.sha256);
  assert.equal(
    document.synthetic_provider_transport,
    item.role === "synthetic_control",
  );
  for (const key of [
    "configured_SQL_writes",
    "business_tools",
    "business_effects",
    "storage_operations",
    "automatic_inference_retries",
  ])
    assert.equal(document[key], 0);
  for (const key of [
    "configured_selection_modified",
    "services_restarted",
    "semantic_acceptance",
  ])
    assert.equal(document[key], false);
  for (const key of [
    "native_start_requests",
    "accepted_native_starts",
    "real_provider_generations",
  ])
    assert.notEqual(number(document[key]), null);
  assert(
    document.native_start_requests <= 2 &&
      document.accepted_native_starts <= document.native_start_requests,
  );
  assert.equal(
    new Set(document.probes.map((probe) => probe.attempt_id)).size,
    document.probes.length,
  );
  assert.equal(
    document.probes.reduce(
      (sum, probe) => sum + probe.accepted_native_starts,
      0,
    ),
    document.accepted_native_starts,
  );
  assert.equal(
    document.probes.reduce(
      (sum, probe) => sum + probe.real_provider_generations,
      0,
    ),
    document.real_provider_generations,
  );
  if (item.role === "synthetic_control")
    assert.equal(document.real_provider_generations, 0);
  const probes = document.probes.map((probe) => {
    if (probe.status === "passed") {
      assert.equal(probe.callback_count, 1);
      assert.equal(probe.attestation.verified, true);
      assert.equal(probe.terminal_proof.attempt_id, probe.attempt_id);
      assert.equal(probe.terminal_proof.outcome, "completed");
      assert.equal(probe.terminal_proof.process_closed, true);
      assert(hashPattern.test(probe.terminal_proof.terminal_proof_sha256));
      assert.equal(probe.ACK.attempt_id, probe.attempt_id);
      assert.equal(
        probe.ACK.terminal_proof_sha256,
        probe.terminal_proof.terminal_proof_sha256,
      );
      assert.equal(probe.ACK.acknowledged, true);
    }
    return {
      label: probe.label,
      selection: probe.selection,
      status: probe.status,
      attempt_id: probe.attempt_id,
      accepted_native_starts: probe.accepted_native_starts,
      real_provider_generations: probe.real_provider_generations,
      callback_count: probe.callback_count,
      attestation: probe.attestation ?? null,
      terminal_proof: probe.terminal_proof ?? null,
      ACK: probe.ACK ?? null,
      execute_elapsed_ms: probe.execute_elapsed_ms ?? null,
    };
  });
  return {
    evidence: item.evidence,
    source: item.source,
    role: item.role,
    scope: document.scope,
    status: document.status,
    native_start_requests: document.native_start_requests,
    accepted_native_starts: document.accepted_native_starts,
    real_provider_generations: document.real_provider_generations,
    completed_checks: document.checks.length,
    probes,
    business_capability_acceptance_added: false,
    real_comparison_executed:
      item.role === "real_diagnostic" && document.real_provider_generations > 0,
    provider_latency_cause_established: false,
  };
});
const diagnosticComparisonPreflights = (
  inputs.diagnostic_comparison_preflights ?? []
).map((item) => {
  verifyReference(item.evidence);
  verifyReference(item.source);
  const document = read(item.evidence.path);
  assert.equal(document.stage, "AI-36-C05");
  assert.equal(document.source_sha256, item.source.sha256);
  for (const key of [
    "provider_generations",
    "configured_SQL_writes",
    "storage_operations",
  ])
    assert.equal(document[key], 0);
  assert.equal(document.services_restarted, false);
  return {
    evidence: item.evidence,
    source: item.source,
    status: document.status,
    scope: document.scope,
    comparison_input: document.compare_input,
    observations: document.observations,
    native_metadata_requests: document.native_metadata_requests,
    real_provider_generations: 0,
    real_comparison_executed: false,
    business_capability_acceptance_added: false,
  };
});
const diagnosticProbeGenerations = diagnosticProbeComparisons.reduce(
  (sum, item) => sum + item.real_provider_generations,
  0,
);
const semanticControls = (inputs.offline_semantic_controls ?? []).map(
  (item) => {
    verifyReference(item);
    const outer = read(item.path),
      result = outer.assertion_result;
    const kind = item.control_kind ?? "full_semantic";
    assert(
      [
        "full_semantic",
        "intermediate_failed",
        "discovery_only",
        "independent_case",
      ].includes(kind),
    );
    assert.equal(outer.stage, "AI-36-C05");
    assert.equal(
      outer.status,
      kind === "intermediate_failed" ? "failed" : "passed",
    );
    if (kind !== "intermediate_failed") assert.equal(outer.exit_code, 0);
    assert.equal(outer.timeout, false);
    assert.equal(
      result.status,
      kind === "full_semantic" || kind === "independent_case"
        ? "passed"
        : kind === "discovery_only"
          ? "diagnostic_completed"
          : "failed",
    );
    assert.equal(outer.actual_provider_generations, 0);
    assert.equal(result.actual_provider_generations, 0);
    assert.equal(result.synthetic_provider_transport, true);
    if (kind === "independent_case") {
      assert.equal(outer.configured_SQL_layer, "none");
      assert.equal(result.configured_database_access, "none");
      assert.equal(outer.next_case_automatically_started, false);
      assert.equal(outer.next_case_requires_explicit_operator_GO, true);
      assert(Object.hasOwn(independentCaseTools, result.independent_case));
      assert.deepEqual(
        result.requested_capability_names,
        independentCaseTools[result.independent_case],
      );
      assert.equal(result.maximum_generations, 2);
      assert.equal(result.turns.length, 1);
    } else assert.equal(outer.configured_database_used, false);
    assert.equal(outer.services_restarted, false);
    assert.equal(outer.disposable_containers_remaining, 0);
    const manifestFile = item.path.replace(/\.json$/, "-manifest.json");
    assert.equal(reference(manifestFile).sha256, outer.manifest_sha256);
    assert.equal(read(manifestFile).knowledge_release, inputs.release_id);
    for (const side of ["stdout", "stderr"])
      assert.equal(
        reference(item.path.replace(/\.json$/, `-${side}.log`)).sha256,
        outer[side + "_sha256"],
      );
    const targeted =
      kind === "independent_case"
        ? independentCaseTools[result.independent_case]
        : inputs.capability_ids;
    const checks = targeted.map((name) => ({
      capability_id: name,
      ...semantics(result, name),
    }));
    if (kind === "full_semantic" || kind === "independent_case")
      assert(checks.every((row) => row.checks.every((check) => check.passed)));
    assert(
      inputs.capability_ids.every(
        (name) => !evaluate(result, name).representative_real_E2E_verified,
      ),
      "synthetic semantic controls must never grant real provider acceptance",
    );
    return {
      evidence: item,
      control_kind: kind,
      independent_case: result.independent_case ?? null,
      status: outer.status,
      inner_status: result.status,
      failure_assertion: result.failure_assertion ?? null,
      manifest: reference(manifestFile),
      completed_checks: result.checks.length,
      semantic_checks: Object.values(result.per_capability ?? {}).reduce(
        (sum, row) => sum + (row.semantic_assertions?.length ?? 0),
        0,
      ),
      synthetic_adapter_generations: number(
        result.synthetic_adapter_generations,
      ),
      actual_provider_generations: 0,
      semantic_assertions:
        kind === "full_semantic" || kind === "independent_case" ? checks : [],
      real_capability_acceptance_added: false,
      scope:
        "same_harness_SQL_semantics_synthetic_transport_not_real_provider_acceptance",
    };
  },
);
const diagnosticToolControls = (inputs.diagnostic_tool_controls ?? []).map(
  (item) => {
    verifyReference(item);
    const document = read(item.path);
    assert.equal(document.stage, "AI-36-C05-R01");
    assert.equal(document.provider_requests, 0);
    assert.equal(document.services_restarted, false);
    const references = [...collectReferences(document).values()];
    assert(
      ["frozen_tool_control", "current_sources"].includes(
        item.source_provenance,
      ),
    );
    const immutableReferences = references.filter(
      (entry) =>
        entry.path.startsWith("docs/evidence/") ||
        entry.path.startsWith(".tmp/"),
    );
    (item.source_provenance === "frozen_tool_control"
      ? immutableReferences
      : references
    ).forEach(verifyReference);
    const retainedHistoricalSources =
      item.source_provenance === "frozen_tool_control"
        ? references
            .filter((entry) => !immutableReferences.includes(entry))
            .map((entry) => ({
              ...entry,
              current_source_comparison_claimed: false,
              scope:
                "historical_source_hash_not_current_native_role_verification",
            }))
        : [];
    for (const key of [
      "windows_full_suite",
      "windows",
      "linux",
      "focused_after",
    ])
      if (document[key]) assert.equal(document[key].failures, 0);
    if (document.deployment_performed !== undefined)
      assert.equal(document.deployment_performed, false);
    if (document.production_deployment !== undefined)
      assert.equal(document.production_deployment, false);
    if (document.timeout_cause_identified !== undefined)
      assert.equal(document.timeout_cause_identified, false);
    return {
      evidence: item,
      source_provenance: item.source_provenance,
      scope: document.scope,
      source_and_log_references_verified:
        item.source_provenance === "frozen_tool_control"
          ? immutableReferences.length
          : references.length,
      retained_historical_source_references: retainedHistoricalSources,
      windows_full_suite: document.windows_full_suite ?? null,
      windows: document.windows ?? null,
      linux: document.linux ?? null,
      focused_after: document.focused_after ?? null,
      provider_requests: 0,
      services_restarted: false,
      provider_acceptance_added: false,
      deployment_performed: false,
      timeout_resolution_claimed: false,
      auxiliary_cleanup: document.auxiliary_cleanup ?? null,
      limitations: document.limitations,
    };
  },
);
const nativePreparationEvidence = (
  inputs.native_preparation_evidence ?? []
).map((item) => {
  verifyReference(item);
  const document = read(item.path);
  assert.equal(document.stage, "AI-36-C05-R01");
  assert.equal(document.provider_generations, 0);
  assert.equal(document.candidate_activated, false);
  if (document.services_restarted !== undefined)
    assert.equal(document.services_restarted, false);
  if (document.service_restarts !== undefined)
    assert.equal(document.service_restarts, 0);
  return {
    evidence: item,
    scope: document.scope,
    recorded_status: document.status,
    derived_preparation_outcome:
      document.build_exit_code !== undefined && document.build_exit_code !== 0
        ? "build_failed_without_activation_or_inference"
        : document.QA_exit_code !== undefined && document.QA_exit_code !== 0
          ? "image_built_but_original_Linux_suite_failed"
          : "applicable_Linux_QA_completed_with_explicit_scope",
    build_exit_code: document.build_exit_code ?? null,
    QA_exit_code: document.QA_exit_code ?? null,
    Linux_tests_total: document.Linux_tests_total ?? null,
    Linux_skips: document.Linux_skips ?? null,
    excluded_test_file: document.excluded_test_file ?? null,
    candidate_image_id: document.candidate_image_id ?? null,
    base_image_id:
      document.base_image_id ?? document.baseline_container?.image_id ?? null,
    public_source_delta: document.public_source_delta ?? null,
    public_source_files_compared: document.public_source_files_compared ?? null,
    production_dependency_comparison:
      document.production_dependency_comparison ?? null,
    provider_generations: 0,
    real_capability_acceptance_added: false,
    limitation:
      "Preparation QA and image readiness do not verify the provider or grant MCP capability acceptance; raw failed outcomes remain preserved.",
  };
});
const nativeCanaries = (inputs.native_canaries ?? []).map((item) => {
  for (const entry of [
    item.evidence,
    item.binding,
    item.source,
    item.existing_source,
    item.original_report,
  ])
    verifyReference(entry);
  const document = read(item.evidence.path),
    original = read(item.original_report.path);
  assert.equal(document.stage, "AI-36-C05-R01");
  assert.equal(
    document.scope,
    "new_owned_role_single_exact_configured_MCP_probe_not_capability_acceptance",
  );
  assert.equal(document.capability_acceptance, false);
  for (const key of [
    "business_effects",
    "configured_SQL_writes",
    "automatic_inference_retries",
  ])
    assert.equal(document[key], 0);
  assert.equal(document.configured_selection_modified, false);
  assert.equal(document.maximum_native_start_requests, 1);
  for (const key of [
    "native_start_requests",
    "accepted_native_starts",
    "real_provider_generations",
  ])
    assert.notEqual(number(document[key]), null);
  assert(
    document.native_start_requests <= 1 &&
      document.accepted_native_starts <= document.native_start_requests,
  );
  assert.equal(
    document.real_provider_generations,
    document.accepted_native_starts,
  );
  assert.equal(document.source_sha256, item.source.sha256);
  assert.equal(
    document.existing_canary_source_sha256,
    item.existing_source.sha256,
  );
  assert.equal(document.image_binding_file_sha256, item.binding.sha256);
  assert.deepEqual(document.image_binding, read(item.binding.path));
  assert.equal(
    document.existing_canary_report_sha256,
    item.original_report.sha256,
  );
  assert.equal(original.configured_database_modified, false);
  assert.equal(original.configured_database_read_only, true);
  assert.equal(original.inference_replayed, false);
  const proofs = document.proofs.filter(
    (proof) => proof.attempt_id === document.attempt_id,
  );
  const acknowledgements = document.acknowledgements.filter(
    (ack) =>
      ack.attempt_id === document.attempt_id && ack.acknowledged === true,
  );
  const terminal = proofs.find(
    (proof) =>
      proof.process_closed === true &&
      hashPattern.test(proof.terminal_proof_sha256) &&
      acknowledgements.some(
        (ack) => ack.terminal_proof_sha256 === proof.terminal_proof_sha256,
      ),
  );
  if (
    document.native_pending_identity === false &&
    document.accepted_native_starts > 0
  )
    assert(terminal, "closed canary must retain its exact proof/ACK");
  if (document.status === "passed") {
    assert.equal(terminal?.outcome, "completed");
    assert.equal(original.diagnostic_nonce_verified, true);
    assert.equal(original.supports_mcp_before, false);
    assert.equal(original.native_terminal_proof_acknowledged, true);
    assert.equal(document.fixture_callbacks_observed, 1);
    assert.equal(document.attestation?.verified, true);
  }
  return {
    evidence: item.evidence,
    binding: item.binding,
    source: item.source,
    existing_source: item.existing_source,
    original_report: item.original_report,
    status: document.status,
    scope: document.scope,
    image_binding: document.image_binding,
    native_start_requests: document.native_start_requests,
    accepted_native_starts: document.accepted_native_starts,
    real_provider_generations: document.real_provider_generations,
    fixture_callback_counter_retained: number(
      document.fixture_callbacks_observed,
    ),
    diagnostic_nonce_verified: original.diagnostic_nonce_verified,
    attestation: document.attestation ?? null,
    error_code: original.error_code ?? null,
    terminal_proof_and_exact_ACK: terminal ?? null,
    native_pending_identity: document.native_pending_identity ?? null,
    real_capability_acceptance_added: false,
    limitation:
      "Native canary diagnostic only. An abandoned_unknown proof and its cleanup ACK do not verify the new role or any completed business turn. Previous-role capability results are not transferred.",
  };
});
const nativeCanaryGenerations = nativeCanaries.reduce(
  (sum, item) => sum + item.real_provider_generations,
  0,
);
const cumulativeObservedNativeStarts =
  historicalReport.real_provider.actual_generations.observed_total +
  cohorts.reduce(
    (sum, item) => sum + (item.actual_provider_generations ?? 0),
    0,
  ) +
  diagnosticProbeGenerations +
  nativeCanaryGenerations;
const finalRestoration = inputs.final_restoration
  ? (() => {
      for (const entry of Object.values(inputs.final_restoration))
        verifyReference(entry);
      const summary = read(inputs.final_restoration.summary.path);
      for (const [file, digest] of Object.entries(
        summary.source_artifacts_sha256,
      ))
        assert.equal(reference(file).sha256, digest);
      assert.equal(summary.stage, "AI-36-C05-R01");
      assert.equal(summary.wrapper_executed, false);
      for (const field of [
        "native_start_requests",
        "accepted_native_starts",
        "real_provider_generations",
        "capability_acceptance_new",
        "business_effects",
        "Node_deployments",
      ])
        assert.equal(summary[field], 0);
      assert.equal(
        summary.C05_cumulative_native_accepted_starts,
        cumulativeObservedNativeStarts,
      );
      assert.equal(summary.current_High_available, false);
      assert.equal(summary.current_MCP_verified, false);
      assert.equal(summary.current_Web_available, true);
      assert.equal(summary.invalid_credentials_inferred, false);
      assert.equal(summary.inference_retry_performed, false);
      const state = read(inputs.final_restoration.service_state.path),
        rollback = read(inputs.final_restoration.rollback.path);
      const before = read(
        inputs.cohorts[0].receipt.path,
      ).operational_runtime_before;
      assert.equal(state.image_id, before.gemini_containers[0].image);
      assert.equal(state.image_id, summary.current_image_id);
      assert.equal(state.health, "healthy");
      assert.deepEqual(state.units, {
        "nodia-api": "active",
        "nodia-ai-worker": "active",
        "nodia-gemini-lab": "active",
        nginx: "active",
      });
      assert.equal(state.actual_native_starts_in_R02_or_restoration, 0);
      assert.equal(rollback.status, "passed");
      assert.equal(
        rollback.operational_Node_compiled_files,
        before.compiled_files,
      );
      assert.equal(
        rollback.operational_Node_manifest_sha256,
        before.manifest_sha256,
      );
      assert.equal(
        rollback.API_and_worker_restored_with_original_Node_bytes,
        true,
      );
      const sql = read(inputs.final_restoration.sql_quiet.path),
        native = read(inputs.final_restoration.native_quiet.path);
      for (const field of ["pending_jobs", "open_attempts", "retained_slots"])
        assert.equal(sql[field], 0);
      assert.equal(sql.preserved_r05_chat, 1);
      for (const field of [
        "unknown_markers",
        "armed_native_proofs",
        "terminal_native_proofs",
        "invalid_native_proofs",
        "temporary_attachment_directories",
        "temporary_cli_directories",
      ])
        assert.equal(native[field], 0);
      return {
        evidence: inputs.final_restoration,
        summary,
        final_service_state: state,
        acceptance_not_transferred_to_restored_provider: true,
        scope:
          "Exact baseline image and original operational Node bytes restored; services active does not establish Agentic availability, MCP support or a successful inference.",
      };
    })()
  : null;
const report = {
  schema_version: 1,
  stage: inputs.stage,
  status:
    accepted.length === 7
      ? "seven_representative_real_scenarios_verified_AI36_still_open"
      : "real_acceptance_partial_AI36_still_open",
  inputs: reference(inputsPath),
  historical: historicalEvidence,
  publication: inputs.publication,
  release_id: inputs.release_id,
  capability_ids: inputs.capability_ids,
  continuation_decisions: inputs.continuation_decisions,
  current_compiled_delta: currentCompiledDelta,
  cohorts,
  accepted_representative_capabilities: accepted,
  accepted_representative_capability_count: accepted.length,
  accepted_on_current_compiled_capability_ids: inputs.capability_ids.filter(
    (name) =>
      cohorts.some(
        (cohort) =>
          cohort.current_compiled_provenance_checked &&
          cohort.evaluated.some(
            (item) =>
              item.capability_id === name &&
              item.representative_real_E2E_verified,
          ),
      ),
  ),
  capability_acceptance_matrix: capabilityMatrix,
  new_cohort_generations: {
    observed_total: cohorts.reduce(
      (sum, item) => sum + (item.actual_provider_generations ?? 0),
      0,
    ),
    complete_for_all_recorded_cohorts: cohorts.every(
      (item) => item.actual_provider_generations !== null,
    ),
    unknown_cohorts: cohorts
      .filter((item) => item.actual_provider_generations === null)
      .map((item) => item.evidence.path),
  },
  cumulative_real_generations: {
    historical_observed_total:
      historicalReport.real_provider.actual_generations.observed_total,
    continuation_observed_total: cohorts.reduce(
      (sum, item) => sum + (item.actual_provider_generations ?? 0),
      0,
    ),
    observed_total: cumulativeObservedNativeStarts,
    diagnostic_probe_observed_total: diagnosticProbeGenerations,
    native_canary_observed_total: nativeCanaryGenerations,
    complete_for_all_explicit_cohorts:
      historicalReport.real_provider.actual_generations
        .complete_for_all_recorded_attempts &&
      cohorts.every((item) => item.actual_provider_generations !== null),
    scope: "accepted_native_start_requests_not_token_or_billing_measurement",
  },
  supplementary_evidence: supplementary,
  offline_semantic_controls: semanticControls,
  diagnostic_tool_controls: diagnosticToolControls,
  native_preparation_evidence: nativePreparationEvidence,
  native_canaries: nativeCanaries,
  final_restoration: finalRestoration,
  diagnostic_probe_comparisons: diagnosticProbeComparisons,
  diagnostic_comparison_preflights: diagnosticComparisonPreflights,
  offline_validator_controls: selfTest(),
  boundaries: {
    historical_evidence_rewritten: false,
    diagnostic_cohorts_promoted_to_acceptance: false,
    automatic_inference_replays: 0,
    physical_UI_accepted: false,
    productive_acceptance: false,
    source_publication_or_permissions_changed_by_validator: false,
    corrected_Node_runtime_operationally_deployed: false,
    native_role_candidate_adopted: false,
    complete_semantic_acceptance_for_all_capabilities: false,
    AI36_open: true,
    remaining_unpublished_candidates: 77,
  },
  limitations: [
    "Representative directed synthetic records with a real provider do not prove unrestricted language quality, every semantic scenario, physical UI or productive acceptance.",
    "A callback is accepted only with its selected execution generation, linked durable receipt, completed turn, completed closed native proofs and exact ACKs for every generation; overall attempt status cannot bypass these gates.",
    "New cohorts and their roles are explicit. Diagnostic observations never grant capability acceptance.",
    "Acceptance retained against a frozen cohort manifest belongs to that exact executed build. It does not prove the later current compiled runtime; current-build acceptance is reported separately, even when publication and capability contract hashes remain compatible.",
    "Node compiled compatibility does not establish compatibility or acceptance of a different native Gemini role, policy or image. Each cohort retains its own observed runtime metadata; a new native policy requires its own real callback, semantic checks, completed turn, terminal proof and exact acknowledgements.",
    "The corrected Node deadline runtime was verified in the candidate build and disposable harness, not copied into the operational Node service. The new native role candidates are not adopted as the final operational runtime.",
    "Native start counters are observed requests, not token or billing measurements.",
    "Where an older cohort omits SQL run_id and adapter_call_id from its public receipt projection, the result explicitly relies on the frozen producer query filtered by run and callback. Later retained columns are compared exactly; no SQL attempt_id column is invented.",
    "Human confirmation and effect linkage rely on the frozen harness producer and native SQL assertions in the same cohort. The public artifact does not independently reconstruct the complete preparation-callback-to-proposal/execution chain from callback hashes. A retained finance proposal identity is correlated to its operator confirmation where available.",
  ],
  reproducible_consolidator: reference(
    "docs/evidence/scripts/validate-nodia-ai-ai36-c05-r01.cjs",
  ),
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (mode === "--write") {
  assert(!fs.existsSync(outputPath), "never replace an earlier R01 report");
  fs.writeFileSync(outputPath, serialized);
} else if (mode === "--check")
  assert.equal(
    fs.readFileSync(outputPath, "utf8"),
    serialized,
    "R01 evidence drift",
  );
console.log(
  JSON.stringify({
    stage: inputs.stage,
    mode,
    status: report.status,
    accepted_representative_capabilities: accepted.length,
    explicit_cohorts: cohorts.length,
    historical_report_unchanged: true,
  }),
);
