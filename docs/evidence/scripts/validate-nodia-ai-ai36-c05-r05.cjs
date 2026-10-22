/* C05-R05 versioned offline acceptance gate. No application imports, SQL, network or inference.
 * Historical C05 files stay immutable. New cohorts are explicit, never discovered. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
process.chdir(path.resolve(__dirname, "../../.."));
const inputsPath = "docs/evidence/nodia-ai-ai36-c05-r05-inputs.json";
const outputPath = "docs/evidence/nodia-ai-ai36-c05-r05-validation.json";
const mode = process.argv[2] ?? "--check";
assert(
  [
    "--check",
    "--write",
    "--dry-run",
    "--self-test",
    "--check-baseline",
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

// End inherited security and control functions.
const inputs = read(inputsPath);
assert.equal(inputs.stage, "AI-36-C05-R05");
verifyReference(inputs.baseline.consolidator);
function inheritedSecurityIdentity() {
  const original = fs.readFileSync(inputs.baseline.consolidator.path, "utf8");
  const current = fs.readFileSync(__filename, "utf8");
  const begin = "function validAcknowledgement(";
  const originalBlock = original
    .slice(
      original.indexOf(begin),
      original.includes("// End inherited security and control functions.")
        ? original.indexOf("// End inherited security and control functions.")
        : original.indexOf('if (mode === "--self-test")'),
    )
    .replace(/\r\n/g, "\n")
    .trim();
  const currentBlock = current
    .slice(
      current.indexOf(begin),
      current.indexOf("// End inherited security and control functions."),
    )
    .replace(/\r\n/g, "\n")
    .trim();
  assert.equal(
    currentBlock,
    originalBlock,
    "R05 ACK/receipt/semantic/provenance gates and security controls must remain literal R01 functions",
  );
  return {
    source: inputs.baseline.consolidator,
    normalized_function_block_sha256: hash(originalBlock),
    functions_literal_and_controls_unchanged: true,
  };
}
const inheritedSecurity = inheritedSecurityIdentity();
function metadataZeroCounters(document) {
  assert.equal(
    document.native_start_requests,
    0,
    "metadata needs its observed native-start zero; absent is not zero",
  );
  for (const field of [
    "accepted_native_starts",
    "real_provider_generations",
    "provider_generations",
    "actual_provider_generations",
  ])
    if (Object.hasOwn(document, field))
      assert.equal(
        document[field],
        0,
        "a generation must not be hidden as metadata",
      );
}
function completedCanaryAckMillis(document) {
  const events = document.request_events.filter(
    (event) => event.kind === "acknowledge" && event.returned === true,
  );
  assert.equal(
    events.length,
    1,
    "one successful observed canary ACK timestamp is required",
  );
  const value = Date.parse(events[0].finished?.at_utc);
  assert(
    Number.isFinite(value),
    "missing or invalid observed VM ACK timestamp",
  );
  return value;
}
function dispatchAfterCanaryAck(ackMillis, generations) {
  assert(Number.isFinite(ackMillis));
  for (const generation of generations) {
    const started = Date.parse(generation.started_at_utc);
    assert(Number.isFinite(started), "missing observed VM dispatch timestamp");
    assert(
      started >= ackMillis,
      "business dispatch preceded its exact epoch's canary ACK",
    );
  }
}
function nativeStartTotals(records, maximum) {
  let requests = 0,
    accepted = 0;
  for (const record of records) {
    assert.notEqual(number(record.native_start_requests), null);
    assert.notEqual(number(record.accepted_native_starts), null);
    assert(record.accepted_native_starts <= record.native_start_requests);
    requests += record.native_start_requests;
    accepted += record.accepted_native_starts;
  }
  assert(requests <= maximum, "R05 native-start authorization budget exceeded");
  return { requests, accepted };
}
function exactArtifactAlias(original, alias) {
  assert(Buffer.isBuffer(original) && Buffer.isBuffer(alias));
  assert(
    original.equals(alias),
    "captured artifact alias differs from original bytes",
  );
}
function nativeBinaryIdentity(observed, expected) {
  assert(string(observed?.version));
  assert(/^[a-f0-9]{128}$/.test(observed?.sha512 ?? ""));
  assert.deepEqual(
    observed,
    expected,
    "native binary identity must match the explicitly pinned candidate",
  );
}
function observedBinaryForEpoch(observation, epoch, expected) {
  assert.equal(observation.image_id, epoch.image_id);
  assert.equal(observation.container_id, epoch.id);
  assert.equal(
    observation.container_started_at,
    epoch.container_started_at_utc,
  );
  assert.equal(observation.version_command_exit_code, 0);
  assert(Number.isFinite(Date.parse(observation.observed_at_utc)));
  nativeBinaryIdentity(
    { version: observation.binary_version, sha512: observation.binary_sha512 },
    expected,
  );
}
function restoredRuntimeIdentity(runtime, expected) {
  assert.equal(runtime.epoch.image, expected.image_id);
  assert.equal(runtime.binary.configured_version, expected.binary_version);
  assert.equal(runtime.binary.configured_sha512, expected.binary_sha512);
  if (runtime.binary.actual_sha512 !== null)
    assert.equal(runtime.binary.actual_sha512, expected.binary_sha512);
  else {
    assert.equal(
      runtime.binary.identity_scope,
      "exact_frozen_baseline_image_and_configuration_no_fresh_digest",
    );
    assert.equal(runtime.exact_baseline_descriptor, true);
  }
  assert.equal(runtime.Node_compiled_files, expected.node_outputs);
  assert.equal(runtime.Node_manifest_sha256, expected.node_manifest_sha256);
  assert.deepEqual(
    Object.keys(runtime.unit_pairs).sort(),
    ["nginx", "nodia-ai-worker", "nodia-api", "nodia-gemini-lab"].sort(),
  );
  for (const pair of Object.values(runtime.unit_pairs))
    assert.deepEqual(pair, { state: "active", exit_code: 0 });
  for (const key of ["pending_jobs", "open_attempts", "retained_slots"])
    assert.equal(runtime.SQL_quiet[key], 0);
  assert.equal(runtime.SQL_quiet.preserved_r05_chat, 1);
  for (const key of [
    "unknown_markers",
    "armed_native_proofs",
    "terminal_native_proofs",
    "invalid_native_proofs",
    "temporary_attachment_directories",
    "temporary_cli_directories",
  ])
    assert.equal(runtime.native_quiet[key], 0);
}
function caseRuntimeEnvelope(receipt, epoch) {
  assert.equal(receipt.stage, "AI-36-C05-R05");
  assert(Number.isFinite(Date.parse(epoch.container_started_at_utc)));
  for (const state of [
    receipt.operational_runtime_before,
    receipt.operational_runtime_after,
  ]) {
    assert.equal(state.container.id, epoch.id);
    assert.equal(state.container.image, epoch.image_id);
    assert.equal(state.container.started_at, epoch.container_started_at_utc);
  }
}
function continuationInterfaceControls() {
  const metadata = { native_start_requests: 0, real_provider_generations: 0 };
  const canary = {
    request_events: [
      {
        kind: "acknowledge",
        returned: true,
        finished: { at_utc: "2026-10-19T20:00:00.000Z" },
      },
    ],
  };
  const generations = [{ started_at_utc: "2026-10-19T20:00:01.000Z" }];
  const binary = { version: "isolated-version", sha512: "a".repeat(128) };
  const restorationExpected = {
    image_id: "isolated-restored-image",
    binary_version: binary.version,
    binary_sha512: binary.sha512,
    node_outputs: 1,
    node_manifest_sha256: "c".repeat(64),
  };
  const restored = {
    epoch: { image: restorationExpected.image_id },
    binary: {
      configured_version: binary.version,
      configured_sha512: binary.sha512,
      actual_sha512: binary.sha512,
    },
    Node_compiled_files: 1,
    Node_manifest_sha256: restorationExpected.node_manifest_sha256,
    unit_pairs: Object.fromEntries(
      ["nginx", "nodia-ai-worker", "nodia-api", "nodia-gemini-lab"].map(
        (key) => [key, { state: "active", exit_code: 0 }],
      ),
    ),
    SQL_quiet: {
      pending_jobs: 0,
      open_attempts: 0,
      retained_slots: 0,
      preserved_r05_chat: 1,
    },
    native_quiet: {
      unknown_markers: 0,
      armed_native_proofs: 0,
      terminal_native_proofs: 0,
      invalid_native_proofs: 0,
      temporary_attachment_directories: 0,
      temporary_cli_directories: 0,
    },
  };
  restoredRuntimeIdentity(restored, restorationExpected);
  const restoredWithoutFreshDigest = {
    ...restored,
    binary: {
      ...restored.binary,
      actual_sha512: null,
      identity_scope:
        "exact_frozen_baseline_image_and_configuration_no_fresh_digest",
    },
    exact_baseline_descriptor: true,
  };
  restoredRuntimeIdentity(restoredWithoutFreshDigest, restorationExpected);
  nativeBinaryIdentity(binary, binary);
  const epoch = {
    id: "isolated-epoch",
    image_id: "sha256:" + "a".repeat(64),
    container_started_at_utc: "2026-10-19T19:00:00Z",
  };
  const runtime = {
    container: {
      id: epoch.id,
      image: epoch.image_id,
      started_at: epoch.container_started_at_utc,
    },
  };
  const binaryObservation = {
    image_id: epoch.image_id,
    container_id: epoch.id,
    container_started_at: epoch.container_started_at_utc,
    binary_version: binary.version,
    binary_sha512: binary.sha512,
    version_command_exit_code: 0,
    observed_at_utc: "2026-10-19T19:30:00Z",
  };
  observedBinaryForEpoch(binaryObservation, epoch, binary);
  const receipt = {
    stage: "AI-36-C05-R05",
    operational_runtime_before: runtime,
    operational_runtime_after: runtime,
  };
  exactArtifactAlias(Buffer.from("captured"), Buffer.from("captured"));
  caseRuntimeEnvelope(receipt, epoch);
  metadataZeroCounters(metadata);
  const ack = completedCanaryAckMillis(canary);
  dispatchAfterCanaryAck(ack, generations);
  assert.deepEqual(
    nativeStartTotals(
      [{ native_start_requests: 3, accepted_native_starts: 2 }],
      3,
    ),
    { requests: 3, accepted: 2 },
  );
  const attacks = {
    configured_digest_without_exact_baseline_descriptor: () =>
      restoredRuntimeIdentity(
        { ...restoredWithoutFreshDigest, exact_baseline_descriptor: false },
        restorationExpected,
      ),
    foreign_restored_image: () =>
      restoredRuntimeIdentity(restored, {
        ...restorationExpected,
        image_id: "other-image",
      }),
    foreign_restored_binary: () =>
      restoredRuntimeIdentity(restored, {
        ...restorationExpected,
        binary_sha512: "b".repeat(128),
      }),
    wrong_operational_Node: () =>
      restoredRuntimeIdentity(restored, {
        ...restorationExpected,
        node_outputs: 2,
      }),
    inactive_operational_consumer: () =>
      restoredRuntimeIdentity(
        {
          ...restored,
          unit_pairs: {
            ...restored.unit_pairs,
            "nodia-api": { state: "inactive", exit_code: 3 },
          },
        },
        restorationExpected,
      ),
    nonquiet_restored_SQL: () =>
      restoredRuntimeIdentity(
        { ...restored, SQL_quiet: { ...restored.SQL_quiet, open_attempts: 1 } },
        restorationExpected,
      ),
    unobserved_binary_command: () =>
      observedBinaryForEpoch(
        { ...binaryObservation, version_command_exit_code: null },
        epoch,
        binary,
      ),
    binary_observed_on_foreign_image: () =>
      observedBinaryForEpoch(
        { ...binaryObservation, image_id: "other-image" },
        epoch,
        binary,
      ),
    binary_observation_missing_time: () =>
      observedBinaryForEpoch(
        { ...binaryObservation, observed_at_utc: null },
        epoch,
        binary,
      ),
    binary_observed_in_foreign_epoch: () =>
      observedBinaryForEpoch(
        { ...binaryObservation, container_id: "other-epoch" },
        epoch,
        binary,
      ),
    missing_binary_identity: () => nativeBinaryIdentity({}, binary),
    foreign_binary_version: () =>
      nativeBinaryIdentity({ ...binary, version: "other-version" }, binary),
    foreign_binary_digest: () =>
      nativeBinaryIdentity({ ...binary, sha512: "b".repeat(128) }, binary),
    truncated_binary_digest: () =>
      nativeBinaryIdentity({ ...binary, sha512: "a".repeat(64) }, binary),
    divergent_artifact_alias: () =>
      exactArtifactAlias(Buffer.from("captured"), Buffer.from("altered")),
    wrong_R05_runner_stage: () =>
      caseRuntimeEnvelope({ ...receipt, stage: "AI-36-C05" }, epoch),
    foreign_runtime_image: () =>
      caseRuntimeEnvelope(receipt, {
        ...epoch,
        image_id: "sha256:" + "b".repeat(64),
      }),
    foreign_runtime_epoch: () =>
      caseRuntimeEnvelope(receipt, { ...epoch, id: "other-epoch" }),
    foreign_runtime_started_at: () =>
      caseRuntimeEnvelope(receipt, {
        ...epoch,
        container_started_at_utc: "2026-10-19T18:00:00Z",
      }),
    metadata_without_native_start_zero: () =>
      metadataZeroCounters({ provider_generations: 0 }),
    positive_native_start_hidden_in_metadata: () =>
      metadataZeroCounters({ native_start_requests: 1 }),
    accepted_start_hidden_behind_zero_request: () =>
      metadataZeroCounters({ ...metadata, accepted_native_starts: 1 }),
    generation_hidden_in_metadata: () =>
      metadataZeroCounters({ ...metadata, real_provider_generations: 1 }),
    conflicting_generation_counter: () =>
      metadataZeroCounters({ ...metadata, provider_generations: 1 }),
    missing_ACK_observation: () =>
      completedCanaryAckMillis({ request_events: [] }),
    missing_ACK_timestamp: () =>
      completedCanaryAckMillis({
        request_events: [{ kind: "acknowledge", returned: true }],
      }),
    invalid_ACK_timestamp: () =>
      completedCanaryAckMillis({
        request_events: [
          {
            kind: "acknowledge",
            returned: true,
            finished: { at_utc: "unknown" },
          },
        ],
      }),
    dispatch_before_canary_ACK: () =>
      dispatchAfterCanaryAck(ack + 2000, generations),
    missing_dispatch_timestamp: () => dispatchAfterCanaryAck(ack, [{}]),
    invalid_dispatch_timestamp: () =>
      dispatchAfterCanaryAck(ack, [{ started_at_utc: "unknown" }]),
    accepted_starts_exceed_requests: () =>
      nativeStartTotals(
        [{ native_start_requests: 1, accepted_native_starts: 2 }],
        7,
      ),
    fourth_start_exceeds_authorization: () =>
      nativeStartTotals(
        [{ native_start_requests: 4, accepted_native_starts: 3 }],
        3,
      ),
  };
  for (const [name, exercise] of Object.entries(attacks))
    assert.throws(exercise, name);
  return {
    positive_fixtures: 9,
    negative_fixtures: Object.keys(attacks),
    scope:
      "Isolated R05 interface guards; no invented provider result or inferred cross-clock order.",
  };
}
if (mode === "--self-test") {
  console.log(
    JSON.stringify({
      stage: inputs.stage,
      inherited_security: inheritedSecurity,
      ...selfTest(),
      R05_interface_controls: continuationInterfaceControls(),
    }),
  );
  process.exit(0);
}
for (const entry of Object.values(inputs.baseline)) verifyReference(entry);
const baseline = read(inputs.baseline.report.path);
assert.equal(baseline.stage, "AI-36-C05-R04");
assert.deepEqual(baseline.inputs, inputs.baseline.inputs);
assert.deepEqual(
  baseline.reproducible_consolidator,
  inputs.baseline.consolidator,
);
assert.equal(
  baseline.native_starts.cumulative_accepted_native_starts,
  inputs.baseline_observed_native_starts,
);
assert.equal(inputs.baseline_observed_native_starts, 28);
assert.deepEqual(
  baseline.accumulated_accepted_capability_ids,
  inputs.baseline_accepted_capability_ids,
);
assert.equal(inputs.baseline_accepted_capability_ids.length, 4);
verifyReference(baseline.baseline.report);
const ancestor = read(baseline.baseline.report.path);
assert.equal(ancestor.stage, "AI-36-C05-R03");
verifyReference(ancestor.baseline.report);
const firstAncestor = read(ancestor.baseline.report.path);
assert.equal(firstAncestor.stage, "AI-36-C05-R02");
verifyReference(firstAncestor.baseline.report);
const earliestAncestor = read(firstAncestor.baseline.report.path);
assert.equal(earliestAncestor.stage, "AI-36-C05-R01");
const historicalReports = [earliestAncestor, firstAncestor, ancestor, baseline];
const ancestorReferences = collectReferences(
  ancestor,
  collectReferences(firstAncestor, collectReferences(earliestAncestor)),
);
const immutableBaselineRefs = [
  ...collectReferences(baseline, ancestorReferences).values(),
].filter(
  (entry) =>
    entry.path.startsWith("docs/evidence/") || entry.path.startsWith(".tmp/"),
);
immutableBaselineRefs.forEach(verifyReference);
const baselineEvidence = {
  ...inputs.baseline,
  immutable_references_verified: immutableBaselineRefs.length,
  accepted_capability_ids: inputs.baseline_accepted_capability_ids,
  observed_native_starts: 28,
  environment_layers: {
    inherited_R01_R02_R03: baseline.baseline.environment_layers,
    R04: {
      evidence: inputs.baseline.report,
      newly_accepted_capability_ids: baseline.newly_accepted_capability_ids,
      native_epochs: baseline.native_epochs,
    },
  },
  scope:
    "Frozen accumulated R01/R02/R03/R04 evidence with each original Node/native environment; not verification of the R05 epoch.",
};
if (mode === "--check-baseline") {
  console.log(
    JSON.stringify({
      stage: inputs.stage,
      baseline: baselineEvidence,
      inherited_security: inheritedSecurity,
    }),
  );
  process.exit(0);
}
assert.deepEqual(inputs.target_capability_ids, [
  "nodia_finance_movements_prepare_create",
]);
assert.deepEqual(inputs.case_plan, ["finance"]);
assert.equal(inputs.maximum_native_start_requests, 3);
assert(
  inputs.target_capability_ids.every(
    (name) => !inputs.baseline_accepted_capability_ids.includes(name),
  ),
);
assert.equal(inputs.release_id, baseline.release_id);
verifyReference(inputs.native_binary_identity_anchor);
verifyReference(inputs.required_adapter_contract_evidence);
assert.equal(
  inputs.required_adapter_contract_version,
  read(inputs.required_adapter_contract_evidence.path).attestation
    .adapter_contract_version,
);
const baselineBinary = read(inputs.native_binary_identity_anchor.path).binary;
nativeBinaryIdentity(inputs.required_native_binary, {
  version: baselineBinary.configured_version,
  sha512: baselineBinary.actual_sha512,
});
verifyReference(inputs.publication);
assert.deepEqual(inputs.publication, baseline.publication);
verifyReference(inputs.node_compiled_delta);
const compiled = read(inputs.node_compiled_delta.path);
assert.equal(compiled.release_id, inputs.release_id);
assert.equal(compiled.capability_contract_count, 74);
assert.equal(compiled.compiled_executable_file_count, 971);
for (const [file, digest] of Object.entries(compiled.current_files))
  assert.equal(
    reference("nodia-server/" + file).sha256,
    digest,
    "frozen Node build changed: " + file,
  );
for (const entry of Object.values(inputs.producers)) verifyReference(entry);
for (const entry of inputs.candidate_source_checks) verifyReference(entry);
const previouslyCountedPaths = new Set([
  ...historicalReports.flatMap((report) =>
    report.cohorts.map((item) => item.evidence.path),
  ),
  ...historicalReports.flatMap((report) =>
    report.native_canaries.map((item) => item.evidence.path),
  ),
]);
const seenAttemptIds = new Set();
function rememberAttemptIds(value) {
  if (!value || typeof value !== "object") return;
  if (string(value.attempt_id)) seenAttemptIds.add(value.attempt_id);
  for (const child of Object.values(value)) rememberAttemptIds(child);
}
for (const report of historicalReports) {
  for (const item of report.cohorts)
    rememberAttemptIds(read(item.evidence.path));
  for (const item of report.native_canaries)
    rememberAttemptIds(read(item.evidence.path));
}
function claimNewAttempts(ids) {
  assert.equal(
    new Set(ids).size,
    ids.length,
    "duplicate attempt in new record",
  );
  for (const id of ids) {
    assert(
      string(id) && !seenAttemptIds.has(id),
      "an attempt must not be counted or accepted twice",
    );
    seenAttemptIds.add(id);
  }
}
const epochs = new Map();
if (
  inputs.native_epochs.length ||
  inputs.native_canaries.length ||
  inputs.cohorts.length
)
  assert.equal(
    inputs.candidate_build_state,
    "verified_R05_QA_and_compiled_delta",
    "R05 candidate artifacts must be qualified before provider evidence is ingested",
  );
for (const alias of inputs.artifact_aliases ?? []) {
  verifyReference(alias.original);
  verifyReference(alias.alias);
  exactArtifactAlias(
    fs.readFileSync(alias.original.path),
    fs.readFileSync(alias.alias.path),
  );
}
for (const epoch of inputs.native_epochs) {
  assert(string(epoch.id) && !epochs.has(epoch.id));
  assert(/^sha256:[a-f0-9]{64}$/.test(epoch.image_id));
  assert(hashPattern.test(epoch.role_policy_sha256));
  assert.deepEqual(epoch.selection, inputs.required_selection);
  nativeBinaryIdentity(
    { version: epoch.binary_version, sha512: epoch.binary_sha512 },
    inputs.required_native_binary,
  );
  assert.equal(
    epoch.public_mode_configuration_sha256,
    inputs.required_public_mode_configuration_sha256,
  );
  assert.deepEqual(epoch.node_compiled_delta, inputs.node_compiled_delta);
  for (const entry of [epoch.source_manifest, epoch.qualification])
    verifyReference(entry);
  const qualification = read(epoch.qualification.path);
  assert.equal(qualification.epoch.id, epoch.id);
  assert.equal(qualification.epoch.started_at, epoch.container_started_at_utc);
  assert.equal(qualification.image_id, epoch.image_id);
  assert.equal(qualification.role_policy_sha256, epoch.role_policy_sha256);
  nativeBinaryIdentity(
    {
      version: qualification.binary_version,
      sha512: qualification.binary_sha512,
    },
    inputs.required_native_binary,
  );
  verifyReference(qualification.binary_observation_evidence);
  verifyReference(qualification.binary_observation_artifact);
  assert.deepEqual(
    read(qualification.binary_observation_evidence.path).binary_observation,
    read(qualification.binary_observation_artifact.path),
  );
  observedBinaryForEpoch(
    read(qualification.binary_observation_evidence.path).binary_observation,
    epoch,
    inputs.required_native_binary,
  );
  epochs.set(epoch.id, epoch);
}
function verifiedEpoch(id) {
  const epoch = epochs.get(id);
  assert(epoch, "new evidence needs an explicit native epoch");
  return epoch;
}
const qualifiedEpochs = new Map();
const canaries = inputs.native_canaries.map((item) => {
  assert(!previouslyCountedPaths.has(item.evidence.path));
  const epoch = verifiedEpoch(item.epoch_id);
  for (const entry of [item.evidence, item.binding, item.original_report])
    verifyReference(entry);
  const document = read(item.evidence.path),
    original = read(item.original_report.path),
    binding = read(item.binding.path);
  assert.equal(
    document.scope,
    "new_owned_role_single_exact_configured_MCP_probe_not_capability_acceptance",
  );
  assert.equal(document.capability_acceptance, false);
  assert.equal(document.maximum_native_start_requests, 1);
  for (const field of [
    "business_effects",
    "configured_SQL_writes",
    "automatic_inference_retries",
  ])
    assert.equal(document[field], 0);
  assert.equal(document.configured_selection_modified, false);
  assert.deepEqual(document.image_binding, binding);
  assert.equal(document.image_binding_file_sha256, item.binding.sha256);
  assert.equal(binding.candidate_image_id, epoch.image_id);
  assert.equal(binding.role_policy_sha256, epoch.role_policy_sha256);
  assert.deepEqual(binding.selection, epoch.selection);
  assert.equal(
    binding.public_mode_configuration_sha256,
    epoch.public_mode_configuration_sha256,
  );
  assert.equal(document.source_sha256, inputs.producers.canary.sha256);
  assert.equal(
    document.existing_canary_source_sha256,
    inputs.producers.existing_canary.sha256,
  );
  assert.equal(
    document.existing_canary_report_sha256,
    item.original_report.sha256,
  );
  for (const field of [
    "native_start_requests",
    "accepted_native_starts",
    "real_provider_generations",
  ])
    assert.notEqual(number(document[field]), null);
  assert(
    document.native_start_requests <= 1 &&
      document.accepted_native_starts <= document.native_start_requests,
  );
  assert.equal(
    document.real_provider_generations,
    document.accepted_native_starts,
  );
  if (document.native_start_requests > 0)
    claimNewAttempts([document.attempt_id]);
  const proof = document.proofs.find(
    (entry) =>
      entry.attempt_id === document.attempt_id &&
      entry.process_closed === true &&
      hashPattern.test(entry.terminal_proof_sha256) &&
      document.acknowledgements.some(
        (ack) =>
          ack.attempt_id === entry.attempt_id &&
          ack.terminal_proof_sha256 === entry.terminal_proof_sha256 &&
          ack.acknowledged === true,
      ),
  );
  const passed = document.status === "passed";
  if (passed) {
    assert.equal(document.accepted_native_starts, 1);
    assert.equal(document.fixture_callbacks_observed, 1);
    assert.equal(document.attestation?.verified, true);
    assert.equal(
      document.attestation.adapter_contract_version,
      inputs.required_adapter_contract_version,
    );
    nativeBinaryIdentity(
      { version: binding.binary_version, sha512: binding.binary_sha512 },
      inputs.required_native_binary,
    );
    const qualification = read(epoch.qualification.path);
    assert.equal(
      binding.binary_observation_sha256,
      qualification.binary_observation_artifact.sha256,
    );
    assert.equal(binding.encoding_observed, null);
    const observedBinary = read(qualification.binary_observation_artifact.path);
    const dispatchedAt = document.request_events.find(
      (event) => event.kind === "start",
    )?.started?.at_utc;
    assert(
      Number.isFinite(Date.parse(dispatchedAt)) &&
        Date.parse(observedBinary.observed_at_utc) <= Date.parse(dispatchedAt),
      "binary identity must be observed before the canary dispatch",
    );
    assert.equal(proof?.outcome, "completed");
    assert.equal(original.status, "passed");
    assert.equal(original.supports_mcp_before, false);
    assert.equal(original.diagnostic_nonce_verified, true);
    assert.equal(original.native_terminal_proof_acknowledged, true);
    assert.equal(original.native_pending_identity, false);
    assert.equal(original.configured_database_modified, false);
    assert.equal(original.inference_replayed, false);
    qualifiedEpochs.set(epoch.id, completedCanaryAckMillis(document));
  }
  return {
    evidence: item.evidence,
    binding: item.binding,
    original_report: item.original_report,
    epoch_id: epoch.id,
    status: document.status,
    native_start_requests: document.native_start_requests,
    accepted_native_starts: document.accepted_native_starts,
    exact_terminal_proof_and_ACK: proof ?? null,
    epoch_MCP_qualified: passed,
    wire_observation: {
      adapter_contract_version:
        document.attestation?.adapter_contract_version ?? null,
      callback_nonce_completed_proof_and_ACK_verified: passed,
      native_binary: {
        version: epoch.binary_version,
        sha512: epoch.binary_sha512,
      },
      encoding_observed: null,
      scope:
        "Effective MCP roundtrip only. The frozen bridge normalizes objects and JSON strings and does not retain the original argument encoding; no encoding is inferred from binary version or help.",
    },
    business_capability_acceptance_added: false,
    scope:
      "Fresh image/policy-bound diagnostic canary; never a business capability acceptance.",
  };
});
assert(
  canaries.length <= 1,
  "one authorized native canary; a failed attempt is not replayed",
);
const caseIds = new Set();
const cohorts = inputs.cohorts.map((item) => {
  assert(!previouslyCountedPaths.has(item.receipt.path));
  assert(
    inputs.case_plan.includes(item.case_id) && !caseIds.has(item.case_id),
    "only one independently authorized invocation of each planned case",
  );
  caseIds.add(item.case_id);
  const epoch = verifiedEpoch(item.epoch_id);
  assert(
    qualifiedEpochs.has(epoch.id),
    "business verification requires this epoch's own successful canary",
  );
  verifyReference(item.receipt);
  const receipt = read(item.receipt.path),
    result = receipt.assertion_result;
  caseRuntimeEnvelope(receipt, epoch);
  assert.equal(receipt.case_id, item.case_id);
  assert.equal(result.independent_case, item.case_id);
  assert.deepEqual(
    result.requested_capability_names,
    independentCaseTools[item.case_id],
  );
  assert.equal(result.maximum_generations, 2);
  assert.equal(result.maximum_generations_per_run, 2);
  assert.deepEqual(result.selection, epoch.selection);
  assert.equal(
    result.public_mode_configuration_sha256,
    epoch.public_mode_configuration_sha256,
  );
  assert.equal(result.publication.release_id, inputs.release_id);
  assert.equal(result.publication.capabilities, 74);
  assert.equal(receipt.harness_sha256, inputs.producers.harness.sha256);
  assert.equal(
    receipt.case_fixture_sha256,
    inputs.producers.case_fixture.sha256,
  );
  for (const side of ["stdout", "stderr"])
    assert.equal(
      reference(item.receipt.path.replace(/\.json$/, `-${side}.log`)).sha256,
      receipt[side + "_sha256"],
    );
  const manifestPath = item.receipt.path.replace(/\.json$/, "-manifest.json");
  assert.equal(reference(manifestPath).sha256, receipt.manifest_sha256);
  const manifest = read(manifestPath);
  assert.equal(manifest.knowledge_release, inputs.release_id);
  assert.equal(manifest.compiled_files, receipt.compiled_files_verified);
  const provenance = cohortProvenance(item, receipt, manifest);
  assert.equal(provenance.mode, "current_compiled");
  const actualFiles = Object.fromEntries(
    Object.entries(manifest.files).filter(
      ([file]) => file.startsWith("dist/") && /\.(js|json|md)$/.test(file),
    ),
  );
  assert.deepEqual(actualFiles, compiled.current_files);
  const attempts = result.turns.flatMap((turn) =>
    turn.generations.map((generation) => generation.attempt_id),
  );
  dispatchAfterCanaryAck(
    qualifiedEpochs.get(epoch.id),
    result.turns.flatMap((turn) => turn.generations),
  );
  claimNewAttempts(attempts);
  assert.notEqual(number(result.actual_provider_generations), null);
  assert(result.actual_provider_generations <= 2);
  const starts = Object.values(
    result.native_transport_observations ?? {},
  ).reduce(
    (sum, observation) =>
      sum + (number(observation.request_counts?.start) ?? 0),
    0,
  );
  assert(starts <= 2 && result.actual_provider_generations <= starts);
  return {
    evidence: item.receipt,
    manifest: reference(manifestPath),
    case_id: item.case_id,
    epoch_id: epoch.id,
    native_epoch: epoch,
    producer_stage: receipt.stage,
    status: receipt.status,
    compiled_provenance: provenance,
    native_start_requests: starts,
    accepted_native_starts: result.actual_provider_generations,
    evaluated: independentCaseTools[item.case_id].map((name) =>
      evaluate(result, name, "explicit_sql_run_call_and_observed_generation"),
    ),
    scope:
      "One directed real-provider turn over disposable SQL; overall cohort status never bypasses individual capability gates.",
  };
});
const controls = inputs.offline_controls.map((item) => {
  verifyReference(item.evidence);
  assert(inputs.case_plan.includes(item.case_id));
  const outer = read(item.evidence.path),
    result = outer.assertion_result;
  assert.equal(outer.status, "passed");
  assert.equal(outer.exit_code, 0);
  assert.equal(outer.actual_provider_generations, 0);
  assert.equal(result.actual_provider_generations, 0);
  assert.equal(result.synthetic_provider_transport, true);
  assert.equal(result.configured_database_access, "none");
  assert.equal(result.independent_case, item.case_id);
  assert.deepEqual(
    result.requested_capability_names,
    independentCaseTools[item.case_id],
  );
  assert.equal(outer.next_case_automatically_started, false);
  const manifestFile = item.evidence.path.replace(/\.json$/, "-manifest.json");
  assert.equal(reference(manifestFile).sha256, outer.manifest_sha256);
  const manifest = read(manifestFile);
  assert.equal(
    manifest.files["test/nodia-ai-ai36-c05-live.integration.mjs"],
    inputs.producers.harness.sha256,
  );
  assert.equal(
    manifest.files["test/nodia-ai-ai36-c05-independent-cases.fixture.mjs"],
    inputs.producers.case_fixture.sha256,
  );
  const checked = independentCaseTools[item.case_id].map((name) => ({
    capability_id: name,
    ...semantics(result, name),
  }));
  assert(checked.every((row) => row.checks.every((check) => check.passed)));
  assert(
    checked.every(
      (row) =>
        !evaluate(result, row.capability_id).representative_real_E2E_verified,
    ),
  );
  return {
    ...item,
    checks: result.checks.length,
    semantic_assertions: checked,
    synthetic_generations: result.synthetic_adapter_generations,
    real_provider_generations: 0,
    scope:
      "Retained historical SQL semantic controls with synthetic transport; not R05 runtime, provider or native-role acceptance.",
  };
});
const metadata = inputs.metadata_evidence.map((item) => {
  verifyReference(item.evidence);
  metadataZeroCounters(read(item.evidence.path));
  return {
    ...item,
    scope:
      "Non-generative diagnostic evidence; never counted as a capability or inferred provider availability.",
  };
});
inputs.supplementary_evidence.forEach(verifyReference);
const closingState = inputs.restoration_evidence
  ? (() => {
      for (const entry of Object.values(inputs.restoration_evidence))
        verifyReference(entry);
      const restoration = read(inputs.restoration_evidence.report.path);
      const capturedRuntime = read(
        inputs.restoration_evidence.runtime_after.path,
      );
      const runtime = {
        observed_at_utc: capturedRuntime.observed_at_utc,
        epoch: capturedRuntime.container,
        binary: {
          configured_version: capturedRuntime.binary_version_configured,
          configured_sha512: capturedRuntime.binary_sha512_configured,
          actual_sha512: null,
          identity_scope:
            "exact_frozen_baseline_image_and_configuration_no_fresh_digest",
        },
        exact_baseline_descriptor:
          capturedRuntime.six_mounts_unique_env_UID_ports_resources_match_private_baseline,
        Node_compiled_files: capturedRuntime.compiled_files,
        Node_manifest_sha256: capturedRuntime.operational_Node_manifest_sha256,
        unit_pairs: capturedRuntime.units,
        SQL_quiet: capturedRuntime.SQL,
        native_quiet: capturedRuntime.native,
      };
      const modalities = read(inputs.restoration_evidence.modalities.path);
      restoredRuntimeIdentity(runtime, inputs.required_restoration);
      assert.equal(
        restoration.target_image,
        inputs.required_restoration.image_id,
      );
      assert.deepEqual(restoration.restored_epoch, runtime.epoch);
      assert.equal(restoration.provider_generations, 0);
      assert.equal(restoration.old_MCP_proofs_transferred, false);
      assert.equal(restoration.Node_runtime_files_modified, 0);
      assert.equal(
        restoration.descriptor_environment_unique_six_mounts_UID_port_resources_exact,
        true,
      );
      assert.equal(modalities.provider_generations, 0);
      assert.equal(modalities.modality_canaries_executed, 0);
      return {
        evidence: inputs.restoration_evidence,
        observed_at_utc: runtime.observed_at_utc,
        restored_epoch: runtime.epoch,
        binary: runtime.binary,
        Node_compiled_files: runtime.Node_compiled_files,
        Node_manifest_sha256: runtime.Node_manifest_sha256,
        unit_pairs: runtime.unit_pairs,
        SQL_quiet: runtime.SQL_quiet,
        native_quiet: runtime.native_quiet,
        mode_observations: modalities.observations,
        MCP_verified_after_restoration: false,
        scope:
          "Restored baseline is a distinct epoch. Current metadata is retained verbatim; candidate MCP proofs do not qualify a restored runtime or its modalities. No return inference is inferred.",
      };
    })()
  : null;
if (["--write", "--check"].includes(mode))
  assert(
    closingState,
    "final R05 evidence requires exact observed restoration",
  );
const totals = nativeStartTotals(
  [...canaries, ...cohorts],
  inputs.maximum_native_start_requests,
);
const starts = totals.requests,
  acceptedStarts = totals.accepted;
let closureInterpretation = null;
if (inputs.continuation_closure) {
  verifyReference(inputs.continuation_closure);
  const closure = read(inputs.continuation_closure.path);
  assert.equal(
    closure.global_native_accepted_starts_after,
    28 + acceptedStarts,
  );
  assert.equal(closure.Python_fix_adopted_operationally, false);
  assert.equal(closure.Node_candidate_adopted_operationally, false);
  assert.equal(closure.finance.executed, false);
  for (const key of ["RPC_messages", "callbacks", "cause", "CLI_phase"])
    assert.equal(closure.canary02.native_WARN_diagnostic[key], null);
  closureInterpretation = {
    evidence: inputs.continuation_closure,
    pre_activation_control: closure.controls,
    native_WARN_diagnostic: closure.canary02.native_WARN_diagnostic,
    Python_fix_adopted_operationally: false,
    Node_candidate_adopted_operationally: false,
    finance: closure.finance,
    retry_counter_scope:
      "Any raw zero retry value is Nodia/harness-only; internal CLI or upstream requests and retries remain unknown.",
  };
}
const newlyAccepted = inputs.target_capability_ids.filter((name) =>
  cohorts.some((cohort) =>
    cohort.evaluated.some(
      (entry) =>
        entry.capability_id === name && entry.representative_real_E2E_verified,
    ),
  ),
);
const allAccepted = [
  ...new Set([...inputs.baseline_accepted_capability_ids, ...newlyAccepted]),
].sort();
const historicalBudgetProjectionNotes = [ancestor, baseline].map((report) => {
  const authorized = read(report.inputs.path).maximum_native_start_requests;
  assert(report.native_starts.new_native_start_requests <= authorized);
  return {
    stage: report.stage,
    recorded_projection_limit: report.native_starts.maximum_new_start_requests,
    authorized_input_and_enforced_gate_limit: authorized,
    observed_native_start_requests:
      report.native_starts.new_native_start_requests,
    interpretation:
      "The frozen projection retained an incorrect inherited display limit; its explicit input, execution gate and observed counts remain unchanged. Historical artifacts are not rewritten.",
  };
});
const matrix = Object.keys(requiredSemantics)
  .sort()
  .map((name) => ({
    capability_id: name,
    historical_R01_R02_R03_R04: {
      accepted: inputs.baseline_accepted_capability_ids.includes(name),
      evidence: inputs.baseline.report,
      environment_claim:
        "Only the respective R01/R02/R03/R04 cohort builds and native policies; no result is copied into R05.",
    },
    R05: {
      in_target_scope: inputs.target_capability_ids.includes(name),
      representative_accepted: newlyAccepted.includes(name),
      evidence: cohorts.flatMap((cohort) =>
        cohort.evaluated
          .filter((entry) => entry.capability_id === name)
          .map((entry) => ({
            epoch_id: cohort.epoch_id,
            receipt: cohort.evidence,
            evaluation: entry,
          })),
      ),
    },
    accumulated_representative_accepted: allAccepted.includes(name),
    acceptance_for_every_scenario_or_productive_use: false,
  }));
const report = {
  schema_version: 1,
  stage: inputs.stage,
  status:
    newlyAccepted.length === 1
      ? "finance_representative_capability_verified_AI36_still_open"
      : starts === 0
        ? "prepared_no_new_provider_acceptance"
        : "partial_real_acceptance_AI36_still_open",
  inputs: reference(inputsPath),
  baseline: baselineEvidence,
  inherited_security: inheritedSecurity,
  publication: inputs.publication,
  release_id: inputs.release_id,
  node_compiled_delta: inputs.node_compiled_delta,
  candidate_source_checks: inputs.candidate_source_checks,
  candidate_build_state: inputs.candidate_build_state,
  experimental_native_binary: {
    intended_identity: inputs.required_native_binary,
    historical_identity_anchor: inputs.native_binary_identity_anchor,
    scope:
      "The exact historical CLI1.3.1 binary digest identifies the intended candidate; its new Python/Node behavior still requires this epoch's own observed identity and successful canary.",
  },
  native_epochs: inputs.native_epochs,
  native_canaries: canaries,
  cohorts,
  deferred_cases: inputs.deferred_cases ?? [],
  offline_controls: controls,
  metadata_evidence: metadata,
  artifact_aliases: inputs.artifact_aliases ?? [],
  supplementary_evidence: inputs.supplementary_evidence,
  closing_observed_state: closingState,
  continuation_closure: closureInterpretation,
  historical_budget_projection_notes: historicalBudgetProjectionNotes,
  new_target_capability_ids: inputs.target_capability_ids,
  newly_accepted_capability_ids: newlyAccepted,
  historical_accepted_capability_ids: inputs.baseline_accepted_capability_ids,
  accumulated_accepted_capability_ids: allAccepted,
  capability_acceptance_matrix: matrix,
  native_starts: {
    baseline_accepted_starts: 28,
    new_native_start_requests: starts,
    new_accepted_native_starts: acceptedStarts,
    cumulative_accepted_native_starts: 28 + acceptedStarts,
    maximum_new_start_requests: inputs.maximum_native_start_requests,
    scope:
      "Observed accepted native MCP start requests, not tokens or billing measurements.",
    automatic_inference_retry_scope:
      "Any zero recorded in raw automatic_inference_retries fields refers only to Nodia/harness resubmissions. Upstream requests, retries inside the native CLI, tokens and billing are unknown and are not inferred from the accepted-start counter.",
  },
  offline_validator_controls: selfTest(),
  R05_interface_controls: continuationInterfaceControls(),
  boundaries: {
    baseline_R01_or_R02_or_R03_or_R04_modified: false,
    historical_capabilities_transferred_to_R05_epoch: false,
    operational_business_database_writes: 0,
    physical_UI_accepted: false,
    productive_acceptance: false,
    attachments_or_OCR_candidate_accepted: false,
    restored_operational_MCP_verified_by_candidate: false,
    AI36_C05_open: true,
    remaining_unpublished_candidates: 77,
  },
  limitations: [
    "A successful native canary qualifies only its exact image, policy, configuration and selection; it accepts no business capability.",
    "Historical and new results are accumulated by capability with explicit environment layers; seven accumulated capabilities would not prove seven under the new native role.",
    "Human proposal-to-effect linkage retains R01's honest frozen-producer plus same-cohort SQL assertion basis; public callback hashes do not independently reconstruct the entire chain.",
    "Preparation QA, metadata requests and synthetic controls never imply a successful generation or current provider availability.",
    "The operational Node runtime remains the 932-output AI35 baseline. The 2803-file/971-asset C05 candidate and its 74 published capability records are acceptance artifacts; this report does not deploy or adopt them operationally.",
    "Nodia/harness automatic resubmission controls do not observe or prove the absence of internal CLI or upstream retries; historical raw zero fields retain their original producer meaning and are not rewritten.",
    "A successful or failed CLI1.4.2 experiment is not a controlled causal explanation of earlier CLI1.3.1 timeouts; runtime metadata and capabilities remain scoped to the observed binary, image and epoch.",
  ],
  reproducible_consolidator: reference(
    "docs/evidence/scripts/validate-nodia-ai-ai36-c05-r05.cjs",
  ),
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (mode === "--write") {
  assert(!fs.existsSync(outputPath), "never replace a frozen R05 report");
  fs.writeFileSync(outputPath, serialized);
} else if (mode === "--check")
  assert.equal(
    fs.readFileSync(outputPath, "utf8"),
    serialized,
    "R05 evidence drift",
  );
console.log(
  JSON.stringify({
    stage: inputs.stage,
    mode,
    status: report.status,
    historical_capabilities: 4,
    newly_accepted_capabilities: newlyAccepted.length,
    new_native_start_requests: starts,
    cumulative_accepted_native_starts: 28 + acceptedStarts,
    baseline_unchanged: true,
  }),
);
