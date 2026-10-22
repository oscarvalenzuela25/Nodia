// Offline consolidation of observed checks. No SQL, provider calls, asset emission or deployment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const mode = process.argv[2] ?? '--check';
const sha = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const ref = name => ({ path: name, sha256: sha(name) });
const evidence = name => 'docs/evidence/nodia-ai-ai38-' + name + '.json';

async function main() {
  assert(['--write', '--check'].includes(mode));
  const server = read(evidence('candidate01'));
  const client = read(evidence('client-candidate01'));
  function verifyCandidate(reference, project) {
    const manifestPath = reference.path + '/manifest.json';
    assert.equal(sha(manifestPath), reference.manifest_sha256);
    const manifest = read(manifestPath);
    for (const [file, hash] of Object.entries(manifest.files)) assert.equal(sha(reference.path + '/' + file), hash, file);
    for (const [file, hash] of Object.entries(manifest.production_sources)) assert.equal(sha(project + '/' + file), hash, file);
    return manifest;
  }
  const serverManifest = verifyCandidate(server, 'nodia-server');
  const clientManifest = verifyCandidate(client, 'nodia-client');
  assert.equal(Object.keys(serverManifest.production_sources).length, 924);
  assert.equal(Object.keys(clientManifest.production_sources).length, 647);
  const serverTests = read('.tmp/ai38-server-unit01.json');
  const clientTests = read('.tmp/ai38-client-unit01.json');
  for (const [report, count, files] of [[serverTests, 4274, 237], [clientTests, 1773, 228]]) {
    assert.equal(report.numPassedTests, count);
    assert.equal(report.numTotalTests, count);
    assert.equal(report.numFailedTests, 0);
    assert.equal(report.testResults.length, files);
  }
  const diagnosticLines = name => fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/)
    .filter(line => /error TS\d+:/.test(line)).map(line => line.replace(/\(\d+,\d+\)/g, '(LINE,COLUMN)')).sort();
  const baselineTypes = diagnosticLines('.tmp/ai37-fixture-types04.log');
  const currentTypes = diagnosticLines('.tmp/ai38-server-fixture-types01.log');
  assert.equal(currentTypes.length, 192);
  assert.deepEqual(currentTypes, baselineTypes);
  const ui = read(evidence('acceptance-r06'));
  assert.equal(ui.status, 'passed'); assert.equal(ui.checks, 20);
  for (const source of ui.source_hashes) assert.equal(sha(source.path), source.sha256, source.path);
  const regression = read(evidence('acceptance-regression-r01'));
  const ai36 = regression.results.find(result => result.stage === 'ai36');
  assert.equal(ai36.exit_code, 0); assert.equal(ai36.report.checks, 24);
  const context = read(evidence('acceptance-context-r02'));
  assert.equal(context.exit_code, 0); assert.equal(context.report.checks, 36);
  assert.equal(context.report.real_inference, false);
  const canary = read(evidence('mcp-canary-r01'));
  assert.equal(canary.native_result.real_provider_dispatch_requests, 1);
  assert.equal(canary.native_result.status, 'failed');
  assert.equal(canary.native_result.error_code, 'mcp_result_unknown');
  assert.equal(canary.native_result.native_pending_identity, false);
  assert.equal(canary.native_result.native_terminal_proof_acknowledged, true);
  assert.equal(canary.configured_SQL_writes, 0);
  const operational = read(evidence('delivery-inventory-r03'));
  assert(Object.values(operational.units).every(unit => unit.active_state === 'active'));
  assert.equal(operational.operational_node.compiled_files, 932);
  for (const key of ['pending_jobs', 'open_attempts', 'retained_slots']) assert.equal(operational.SQL_read_only[key], 0);
  const native = read(evidence('delivery-native-closure-r01')).native;
  for (const key of ['unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
    'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories']) assert.equal(native[key], 0);
  const gates = ['isolated', 'linux-lab'].map(scope => read(evidence('gates-' + scope + '-r03')));
  assert.deepEqual(gates[0].counts, { passed: 3, failed: 0, unknown: 7 });
  assert.deepEqual(gates[1].counts, { passed: 1, failed: 0, unknown: 9 });
  const { compileKnowledge } = await import(pathToFileURL(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  const frozenKnowledge = read(server.path + '/dist/nodia-ai/knowledge/manifest.json');
  const compiled = compileKnowledge(root, frozenKnowledge);
  assert.deepEqual(compiled.manifest, frozenKnowledge);
  assert.deepEqual(compiled.counts, { sources: 59, excluded: 28 });
  const approved = read('.tmp/ai37-baseline.json').approved_knowledge_hashes;
  assert.equal(Object.keys(approved).length, 31);
  for (const [file, hash] of Object.entries(approved)) assert.equal(sha(file), hash, file);
  const fichePath = 'docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md';
  const fiche = JSON.parse(fs.readFileSync(path.join(root, fichePath), 'utf8').split('---', 3)[1]);
  assert.equal(fiche.revision, 6); assert.equal(fiche.document_status, 'draft');
  assert.equal(fiche.integration_status, 'unregistered'); assert.equal(fiche.approval, null);
  const records = ['candidate01', 'client-candidate01', 'acceptance-r06', 'acceptance-cleanup-r02',
    'acceptance-regression-r01', 'acceptance-context-r02', 'delivery-preflight-r01', 'delivery-control-r01',
    'delivery-stage-r02', 'delivery-inventory-r03', 'delivery-native-closure-r01', 'delivery-clock-r02',
    'windows-clock-r01', 'modalities-r01', 'mcp-canary-r01', 'gates-isolated-r03', 'gates-linux-lab-r03'];
  const logs = ['server-build01.log', 'server-lint01.log', 'server-unit01.log', 'server-unit01.json',
    'server-fixture-types01.log', 'client-build01.log', 'client-typecheck01.log', 'client-lint01.log',
    'client-unit01.log', 'client-unit01.json'].map(name => ref('.tmp/ai38-' + name));
  const report = { schema_version: 1, stage: 'AI-38',
    status: 'isolated_acceptance_passed_environment_delivery_incomplete',
    target: 'VM Linux local, explicitly confirmed by the user',
    candidate: { server: ref(evidence('candidate01')), client: ref(evidence('client-candidate01')),
      server_archive: ref('.tmp/ai38-node-candidate01.tar.gz'), client_archive: ref('.tmp/ai38-client-candidate01.tar.gz'),
      production_source_hashes_verified: { server: 924, client: 647 }, deployment: false,
      client_target_origin_and_proxy_verified: false },
    quality: { server: { unit_tests: 4274, files: 237, build_exit_observed: 0, lint_exit_observed: 0,
        historical_lint_warnings: 3, global_fixture_type_exit: 2, historical_fixture_diagnostics: 192, new_fixture_diagnostics: 0 },
      client: { unit_tests: 1773, files: 228, build_exit_observed: 0, typecheck_exit_observed: 0, lint_exit_observed: 0 },
      isolated_acceptance: { UI_HTTP_SQL: 20, cross_product_regression: 24, context_regression: 36, total: 80,
        actual_provider: false, worker_standalone_process: false, complete_shell_login: false,
        product_context_evolution_between_deliveries: false },
      delivery_negative_controls: 8, evidence_checker_fixture_controls: 21, logs },
    knowledge: { fiche: ref(fichePath), revision: 6, status: 'draft_unregistered_approval_null',
      entry_snapshot: ref('docs/evidence/nodia-ai-ai38-runtime-policy-entry-snapshot.md'),
      approved_documents_byte_identical: 31, sources: 59, excluded: 28, fragments: 31, capabilities: 74,
      release_id: compiled.manifest.release_id, matches_frozen_server_candidate: true,
      current_validation_emitted_assets: false, new_approvals_or_bindings: false },
    provider: { metadata_requests: 2, canary_dispatch_requests: 1, canary_status: 'mcp_result_unknown_nonce_not_verified',
      terminal_proof_acknowledged: true, native_pending_identity: false, business_effects: 0,
      configured_SQL_writes: 0, inference_replayed: false, modality_canaries: 0, R2_operations: 0 },
    environment: { services_original_active: 4, operational_Node_outputs_unchanged: 932,
      pending_SQL_and_native_artifacts: 0, services_restarted: false, clocks_modified: false,
      Windows_clock_issue: 'W32Time stopped; independent HTTPS Date approximately 383 seconds ahead, consistent with guest NTP. No proven MCP causality.',
      adoption_or_rollback_rehearsal_performed: false, acceptance: 'incomplete' },
    gates: gates.map(gate => ({ environment: gate.environment, counts: gate.counts, status: gate.status })),
    records: records.map(name => ref(evidence(name))),
    open_scope: ['AI36/C05 historical 4/7 acceptance and 77 unpublished candidates remain in their own stage.',
      'Real text, delegation, MIME/model modalities and domain acceptance on the delivered runtime remain open.',
      'Actual adoption/rollback, full UI shell/auth, product context evolution and infrastructure retention/backup gates remain open.',
      'Client target-origin/proxy and a fresh dependency installation on the target are not verified.',
      'Synchronize the development host before further cross-host time-sensitive tests; do not enlarge future-observation tolerances.'],
    release_authorized: false, reproducible_validator: ref('docs/evidence/scripts/validate-nodia-ai-ai38.cjs') };
  const serialized = JSON.stringify(report, null, 2) + '\n';
  const output = path.join(root, evidence('validation'));
  if (mode === '--write') fs.writeFileSync(output, serialized, { flag: 'wx' });
  else assert.equal(fs.readFileSync(output, 'utf8'), serialized, 'AI38 validation drift');
  console.log(JSON.stringify({ stage: 'AI-38', mode, status: report.status,
    server_tests: 4274, client_tests: 1773, isolated_checks: 80, provider_canary: 'failed_ACK_closed_no_replay', deployment: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
