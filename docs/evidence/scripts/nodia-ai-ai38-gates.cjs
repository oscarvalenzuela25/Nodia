// Offline evidence coverage checker. It never deploys, probes a provider or authorizes release.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const defaultInput = 'docs/evidence/nodia-ai-ai38-gates-input.json';
const defaultOutput = 'docs/evidence/nodia-ai-ai38-gates.json';
const definitions = [
  ['package_integrity', 'artifact', 'Build, hashes, dependencies, policy/catalogue/knowledge pins and immutable package.', '52 §§Build; AI-38'],
  ['isolated_UI_API_SQL', 'isolated', 'Page against isolated API/database; results and errors come from the actual API.', '45 AI-38; NI-12'],
  ['authority_and_revocation', 'isolated', 'Ordinary owner/destination modules, super_admin, revoked access and exact human confirmation.', '41; 43; 45 AI-38'],
  ['leave_return_and_effects', 'isolated', 'Leave/return, durable result and confirmed effects visible through native application reads.', '45 AI-38'],
  ['product_context_evolution', 'isolated', 'Next turn uses the expected published context without rewriting an in-flight command or receipt.', '40 §Cómo conoce; 52 §Evolución; AI-38'],
  ['provider_text_and_routing', 'live_environment', 'Exact configured Web/Agentic selection and opt-in same-connection delegation; no fallback.', '48; 50; 45 AI-38'],
  ['provider_modalities', 'live_environment', 'Each claimed MIME/model/mode has a real completed response on the delivered runtime.', '45 AI-38; AI-32 acceptance'],
  ['published_domain_acceptance', 'live_environment', 'Acceptance by published domain/capability; historical 4/7 is not acceptance on a new runtime.', '45 AI36-C05 and AI-38'],
  ['deployment_and_rollback', 'infrastructure', 'Per-environment immutable deployment, startup pins, drain, rollback and reconciliation runbook rehearsed.', '43; 52; 45 AI-38'],
  ['retention_backup_restore', 'infrastructure', 'Actual isolation, encrypted/rotated backups, trusted deletion journal, object/version inventory and restore reconciliation.', '50; 83 §Gates; AI-38'],
];
const knownScopes = new Set(['artifact', 'isolated', 'live_environment', 'infrastructure', 'historical']);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
function ownKeys(value, allowed) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'object_required');
  for (const key of Object.keys(value)) assert(allowed.includes(key), `unexpected_field:${key}`);
}
function localFile(relative) {
  assert(isText(relative) && !relative.includes('\\') && !path.isAbsolute(relative), 'relative_repository_path_required');
  assert(!relative.split('/').some(part => part === '..' || part === '.' || part === ''), 'invalid_repository_path');
  const resolved = path.resolve(root, relative);
  assert(resolved.startsWith(root + path.sep), 'path_outside_repository');
  const actual = fs.realpathSync(resolved);
  assert(actual.startsWith(root + path.sep), 'symlink_outside_repository');
  return resolved;
}
function readJson(relative) {
  const filename = localFile(relative);
  assert(fs.statSync(filename).size <= 8 * 1024 * 1024, 'evidence_too_large');
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
function pointer(value, location) {
  assert(typeof location === 'string' && (location === '' || location.startsWith('/')), 'invalid_context_pointer');
  if (location === '') return value;
  return location.slice(1).split('/').reduce((current, raw) => {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    assert(current && typeof current === 'object' && Object.hasOwn(current, key), 'context_pointer_missing');
    return current[key];
  }, value);
}
function verifyReference(reference, expectedContext, read = readJson, hash = name => digest(fs.readFileSync(localFile(name)))) {
  ownKeys(reference, ['path', 'sha256', 'context_pointer']);
  assert(isText(reference.path) && isHash(reference.sha256), 'invalid_evidence_reference');
  assert.equal(hash(reference.path), reference.sha256, 'evidence_digest_mismatch');
  if (expectedContext) {
    assert(typeof reference.context_pointer === 'string', 'bound_evidence_context_required');
    const context = pointer(read(reference.path), reference.context_pointer);
    for (const [key, value] of Object.entries(expectedContext)) {
      assert.deepEqual(context[key], value, `evidence_context_mismatch:${key}`);
    }
  }
}
function evaluate(input, verify = verifyReference) {
  ownKeys(input, ['schema_version', 'stage', 'environment', 'observations', 'historical_evidence', 'excluded_modes', 'knowledge_provenance_note']);
  assert.equal(input.schema_version, 1);
  assert.equal(input.stage, 'AI-38');
  ownKeys(input.environment, ['environment_id', 'package_manifest_sha256']);
  const environment = input.environment;
  assert(environment.environment_id === null || isText(environment.environment_id), 'invalid_environment');
  assert(environment.package_manifest_sha256 === null || isHash(environment.package_manifest_sha256), 'invalid_package_manifest');
  assert(Array.isArray(input.observations) && input.observations.length <= definitions.length, 'invalid_observation_count');
  assert(Array.isArray(input.historical_evidence) && input.historical_evidence.length <= 32, 'invalid_history');
  for (const ref of input.historical_evidence) verify(ref, null);
  assert.deepEqual(input.excluded_modes, ['api_key', 'openai_codex_agentic'], 'scope_extension_requires_explicit_revision');
  assert(isText(input.knowledge_provenance_note), 'knowledge_note_required');
  const observations = new Map();
  for (const observation of input.observations) {
    ownKeys(observation, ['gate_id', 'status', 'scope', 'reason', 'evidence', 'provider_context']);
    assert(definitions.some(([id]) => id === observation.gate_id), 'unknown_gate');
    assert(!observations.has(observation.gate_id), 'duplicate_gate');
    assert(['passed', 'failed', 'unknown'].includes(observation.status), 'invalid_status');
    assert(knownScopes.has(observation.scope), 'invalid_scope');
    assert(isText(observation.reason), 'reason_required');
    assert(Array.isArray(observation.evidence) && observation.evidence.length <= 32, 'invalid_evidence_list');
    const definition = definitions.find(([id]) => id === observation.gate_id);
    let expectedContext = null;
    if (observation.status === 'passed') {
      assert.equal(observation.scope, definition[1], 'scope_cannot_promote_historical_or_isolated_evidence');
      assert(isText(environment.environment_id) && isHash(environment.package_manifest_sha256), 'passed_requires_bound_environment_and_package');
      assert(observation.evidence.length > 0, 'passed_requires_evidence');
      expectedContext = { ...environment };
      if (observation.scope === 'live_environment') {
        ownKeys(observation.provider_context, ['runtime_identity_sha256', 'selection']);
        assert(isHash(observation.provider_context.runtime_identity_sha256), 'provider_runtime_identity_required');
        const selection = observation.provider_context.selection;
        ownKeys(selection, ['connection_id', 'mode', 'model_id', 'effort_id']);
        assert(isText(selection.connection_id) && isText(selection.model_id), 'explicit_dynamic_selection_required');
        assert(['token_plan_web', 'token_plan_agentic'].includes(selection.mode), 'mode_outside_current_scope');
        assert(selection.effort_id === null || isText(selection.effort_id), 'invalid_effort');
        Object.assign(expectedContext, observation.provider_context);
      } else assert(observation.provider_context === undefined, 'provider_context_only_for_real_provider_gate');
    } else assert(observation.provider_context === undefined, 'unknown_or_failed_is_not_provider_acceptance');
    for (const ref of observation.evidence) verify(ref, expectedContext);
    observations.set(observation.gate_id, observation);
  }
  const gates = definitions.map(([id, scope, requirement, source]) => {
    const observed = observations.get(id);
    return { gate_id: id, required_scope: scope, requirement, source,
      status: observed?.status ?? 'unknown',
      reason: observed?.reason ?? 'No AI-38 evidence supplied for this environment and package.',
      evidence: observed?.evidence ?? [],
      ...(observed?.provider_context ? { provider_context: observed.provider_context } : {}) };
  });
  const counts = { passed: 0, failed: 0, unknown: 0 };
  for (const gate of gates) counts[gate.status]++;
  return { schema_version: 1, stage: 'AI-38',
    status: counts.passed === gates.length ? 'evidence_coverage_complete_requires_semantic_review' : 'environment_acceptance_incomplete',
    environment, gates, counts,
    historical_evidence: input.historical_evidence, excluded_modes: input.excluded_modes,
    knowledge_provenance_note: input.knowledge_provenance_note,
    boundaries: { offline_only: true, release_authorized: false, deployment_performed: false,
      productive_acceptance: false, provider_calls: 0, SQL_access: false,
      historical_acceptance_transferred: false, new_knowledge_approval: false,
      semantic_review: 'Checksums/context prevent accidental reassignment; they do not prove a producer is honest or its asserted success is semantically correct.' } };
}

function selfTest() {
  const reports = new Map();
  const hash = name => digest(Buffer.from(JSON.stringify(reports.get(name))));
  const verify = (ref, context) => verifyReference(ref, context, name => reports.get(name), hash);
  const initial = { schema_version: 1, stage: 'AI-38', environment: { environment_id: null, package_manifest_sha256: null },
    observations: [], historical_evidence: [], excluded_modes: ['api_key', 'openai_codex_agentic'], knowledge_provenance_note: 'fixture_only' };
  let passed = 0;
  const check = (label, operation) => { operation(); passed++; };
  const reject = (label, mutate) => check(label, () => { const input = structuredClone(initial); mutate(input); assert.throws(() => evaluate(input, verify)); });
  check('missing observations stay unknown', () => assert.deepEqual(evaluate(initial, verify).counts, { passed: 0, failed: 0, unknown: 10 }));
  check('a failed gate is retained', () => {
    const input = structuredClone(initial); input.observations.push({ gate_id: 'provider_text_and_routing', status: 'failed', scope: 'historical', reason: 'fixture failure', evidence: [] });
    assert.equal(evaluate(input, verify).counts.failed, 1);
  });
  reject('unknown status cannot become success', input => input.observations.push({ gate_id: 'package_integrity', status: 'ready', scope: 'artifact', reason: 'fixture', evidence: [] }));
  reject('unbound package cannot pass', input => input.observations.push({ gate_id: 'package_integrity', status: 'passed', scope: 'artifact', reason: 'fixture', evidence: [] }));
  reject('unknown gate rejected', input => input.observations.push({ gate_id: 'new_gate', status: 'unknown', scope: 'artifact', reason: 'fixture', evidence: [] }));
  reject('duplicate gates rejected', input => { const row = { gate_id: 'package_integrity', status: 'unknown', scope: 'artifact', reason: 'fixture', evidence: [] }; input.observations.push(row, row); });
  reject('API not silently enabled', input => input.excluded_modes = []);
  reject('unexpected field rejected', input => input.release_authorized = true);
  const bound = structuredClone(initial); bound.environment = { environment_id: 'fixture-sandbox', package_manifest_sha256: 'a'.repeat(64) };
  reports.set('fixture.json', { context: bound.environment, scope: 'artifact' });
  const ref = { path: 'fixture.json', sha256: hash('fixture.json'), context_pointer: '/context' };
  const row = { gate_id: 'package_integrity', status: 'passed', scope: 'artifact', reason: 'fixture package', evidence: [ref] };
  bound.observations = [row];
  check('exact package reference passes only its own gate', () => assert.deepEqual(evaluate(bound, verify).counts, { passed: 1, failed: 0, unknown: 9 }));
  const alterBound = (label, mutate) => check(label, () => { const value = structuredClone(bound); mutate(value); assert.throws(() => evaluate(value, verify)); });
  alterBound('changed evidence digest rejected', value => value.observations[0].evidence[0].sha256 = 'b'.repeat(64));
  alterBound('foreign environment rejected', value => value.environment.environment_id = 'another-environment');
  alterBound('foreign package rejected', value => value.environment.package_manifest_sha256 = 'b'.repeat(64));
  alterBound('missing pointer rejected', value => delete value.observations[0].evidence[0].context_pointer);
  alterBound('foreign pointer rejected', value => value.observations[0].evidence[0].context_pointer = '/missing');
  alterBound('history cannot promote to artifact', value => value.observations[0].scope = 'historical');
  alterBound('isolated cannot promote provider success', value => { value.observations[0].gate_id = 'provider_text_and_routing'; value.observations[0].scope = 'isolated'; });
  alterBound('missing provider identity rejected', value => { value.observations[0].gate_id = 'provider_text_and_routing'; value.observations[0].scope = 'live_environment'; });
  const provider = structuredClone(bound);
  provider.observations[0] = { ...row, gate_id: 'provider_text_and_routing', scope: 'live_environment', provider_context: {
    runtime_identity_sha256: 'c'.repeat(64), selection: { connection_id: 'fixture-connection', mode: 'token_plan_agentic', model_id: 'fixture-dynamic-model', effort_id: null } } };
  reports.set('provider.json', { context: { ...provider.environment, ...provider.observations[0].provider_context } });
  provider.observations[0].evidence = [{ path: 'provider.json', sha256: hash('provider.json'), context_pointer: '/context' }];
  check('provider evidence bound to exact selection and runtime', () => assert.equal(evaluate(provider, verify).counts.passed, 1));
  check('foreign model rejected', () => { const value = structuredClone(provider); value.observations[0].provider_context.selection.model_id = 'another-fixture-model'; assert.throws(() => evaluate(value, verify)); });
  check('foreign runtime rejected', () => { const value = structuredClone(provider); value.observations[0].provider_context.runtime_identity_sha256 = 'd'.repeat(64); assert.throws(() => evaluate(value, verify)); });
  check('complete synthetically valid coverage never authorizes release', () => {
    const input = structuredClone(bound); input.observations = definitions.map(([gate_id, scope]) => {
      if (scope === 'live_environment') return { ...structuredClone(provider.observations[0]), gate_id };
      return { ...structuredClone(row), gate_id, scope };
    });
    const report = evaluate(input, verify);
    assert.equal(report.status, 'evidence_coverage_complete_requires_semantic_review');
    assert.equal(report.boundaries.release_authorized, false);
    assert.equal(report.boundaries.productive_acceptance, false);
  });
  return { checks: passed, scope: 'isolated_checker_fixtures_only_no_provider_results' };
}

function main(args) {
  if (args.length === 1 && args[0] === '--self-test') { console.log(JSON.stringify({ stage: 'AI-38', ...selfTest() })); return; }
  const mode = args[0] ?? '--check';
  assert(['--write', '--check'].includes(mode), 'invalid_mode');
  let inputPath = defaultInput; let outputPath = defaultOutput;
  for (let index = 1; index < args.length; index += 2) {
    assert(['--input', '--output'].includes(args[index]) && isText(args[index + 1]), 'invalid_arguments');
    if (args[index] === '--input') inputPath = args[index + 1]; else outputPath = args[index + 1];
  }
  const input = readJson(inputPath);
  const report = evaluate(input);
  report.input = { path: inputPath, sha256: digest(fs.readFileSync(localFile(inputPath))) };
  report.validator = { path: 'docs/evidence/scripts/nodia-ai-ai38-gates.cjs', sha256: digest(fs.readFileSync(__filename)) };
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (mode === '--write') {
    assert(outputPath.startsWith('docs/evidence/nodia-ai-ai38-gates') && !outputPath.includes('..') && !outputPath.includes('\\'), 'output_prefix_required');
    fs.writeFileSync(path.join(root, outputPath), serialized, { flag: 'wx', encoding: 'utf8' });
  } else assert.equal(fs.readFileSync(localFile(outputPath), 'utf8'), serialized, 'gate_report_drift');
  console.log(JSON.stringify({ stage: 'AI-38', mode, status: report.status, counts: report.counts, release_authorized: false }));
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(error); process.exitCode = 1; } }
module.exports = { evaluate, selfTest };
