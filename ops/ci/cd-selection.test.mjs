import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { selectChecks, unmanagedRuntimePaths, ancestor, deploymentPlan, serverContentEquivalenceAllowed } from './cd-selection.mjs';

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nodia-selection-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const git = args => execFileSync('git', ['-C', repo, '-c', 'core.hooksPath=/dev/null', ...args], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_AUTHOR_NAME: 'fixture', GIT_COMMITTER_NAME: 'fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' } }).trim();
  git(['init', '-q']); git(['config', 'core.autocrlf', 'false']); git(['config', 'commit.gpgsign', 'false']);
  const write = (name, text = 'fixture\n') => { fs.mkdirSync(path.dirname(path.join(repo, name)), { recursive: true }); fs.writeFileSync(path.join(repo, name), text); };
  const commit = () => { git(['add', '-A']); git(['commit', '-qm', 'fixture', '--no-gpg-sign']); return git(['rev-parse', 'HEAD']); };
  write('fixture.txt');
  write('nodia-server/config/nodia-ai-knowledge.registry.json', JSON.stringify({ source_paths: [], capabilities: [], bindings: [] }));
  for (const name of ['docs/mvp/nodia-ai-v1-runtime-policy.json', 'docs/mvp/nodia-ai-v1-runtime-policy.schema.json',
    'docs/mvp/nodia-ai-v1-common-contracts.schema.json', 'docs/mvp/nodia-ai-v1-tool-catalog.json',
    'docs/mvp/nodia-ai-v1-tool-catalog.extensions.json', 'docs/evidence/scripts/validate-nodia-ai-ai04.cjs']) write(name, '{}\n');
  return { repo, write, commit, git };
}
const result = selected => ({ ...Object.fromEntries(['client','server','contracts','native','python','docs','ci'].map(key => [key, selected.includes(key)])),
  reasons: Object.fromEntries(['client','server','contracts','native','python','docs','ci'].map(key => [key, []])), docs_only: selected.join() === 'docs' });

test('deployed backlog and config drift expand ordinary checks without reducing event selections', t => {
  const f = fixture(t), baseline = f.commit(); f.write('client'); const eventBase = f.commit(); f.write('docs-fixture'); const head = f.commit();
  const classify = ({ base }) => result(base === baseline ? ['client','server','contracts'] : ['docs','python']);
  const selected = selectChecks({ repo: f.repo, base: eventBase, head, clientBase: baseline, serverBase: baseline, productionPush: true, classify });
  for (const flag of ['client','server','contracts','docs','python']) assert.equal(selected[flag], true);
  assert.equal(selected.docs_only, false);
  const config = selectChecks({ repo: f.repo, base: head, head, clientBase: head, serverBase: head, forceClient: true, classify: () => result(['docs']) });
  assert.equal(config.client, true); assert.ok(config.reasons.client.includes('production_public_config_changed'));
});
test('missing or unavailable production baselines fail closed; development needs no production access', t => {
  const f = fixture(t), head = f.commit();
  assert.throws(() => selectChecks({ repo: f.repo, base: head, head, productionPush: true, classify: () => result([]) }), /both_production_baselines_required/);
  assert.throws(() => ancestor(f.repo, 'f'.repeat(40), head), /deployed_baseline_not_an_ancestor/);
  assert.equal(selectChecks({ base: head, head, classify: () => result(['docs']) }).docs_only, true);
});
test('actual runtime dependencies block coordinated rollout but prose and isolated tests do not', t => {
  const f = fixture(t), base = f.commit();
  f.write('nodia-gemini-microservice/README.md'); f.write('nodia-server/native/tests/fixture.cc'); const docs = f.commit();
  assert.deepEqual(unmanagedRuntimePaths({ repo: f.repo, base, head: docs }), []);
  f.write('nodia-gemini-microservice/requirements.txt'); f.write('nodia-server/native/binding.gyp'); const head = f.commit();
  assert.deepEqual(unmanagedRuntimePaths({ repo: f.repo, base, head }), ['nodia-gemini-microservice/requirements.txt','nodia-server/native/binding.gyp']);
});

test('only an exact attested Gemini tree at a reachable commit permits a coordinated runtime diff', t => {
  const f = fixture(t);
  f.write('nodia-gemini-microservice/main.py', 'original\n');
  const base = f.commit();
  f.write('nodia-gemini-microservice/main.py', 'reviewed candidate\n');
  const runtime = f.commit();
  f.write('nodia-server/src/gemini-client.ts');
  const head = f.commit();
  const tree = commit => f.git(['rev-parse', commit + ':nodia-gemini-microservice']);
  const proof = { schema_version: 1, source_sha: runtime, source_tree_sha: tree(runtime), image_id: 'sha256:' + 'a'.repeat(64) };
  const options = { repo: f.repo, head, clientBase: base, serverBase: base };
  const plan = deploymentPlan({ ...options, geminiRuntime: proof });
  assert.deepEqual(plan.gemini_runtime, proof);
  assert.equal(plan.python_or_native_deployed, false);
  assert.equal(plan.server_required, true);
  assert.equal(plan.server_content_equivalence_allowed, false);

  f.git(['checkout', '-q', '--detach', base]);
  f.write('nodia-gemini-microservice/main.py', 'reviewed candidate\n');
  f.write('unrelated-sibling-commit.txt');
  const sibling = f.commit();
  assert.equal(tree(sibling), tree(runtime));
  for (const bad of [undefined, null, { ...proof, schema_version: '1' }, { ...proof, secret: 'hidden' },
    { ...proof, image_id: proof.image_id + '\n' }, { ...proof, source_sha: 'f'.repeat(40) },
    { ...proof, source_sha: sibling }, { ...proof, source_tree_sha: tree(base) },
    { ...proof, source_sha: base, source_tree_sha: tree(base) }]) {
    assert.throws(() => deploymentPlan({ ...options, geminiRuntime: bad }), /unmanaged_runtime_change_requires_coordinated_rollout/);
  }
  f.git(['checkout', '-q', '--detach', head]);
  f.write('nodia-server/native/host.rs', 'new native host\n');
  assert.throws(() => deploymentPlan({ ...options, head: f.commit(), geminiRuntime: proof }),
    /unmanaged_runtime_change_requires_coordinated_rollout/);
});

test('content equivalence eligibility considers the complete deployed server backlog, including both rename paths', t => {
  const f = fixture(t), base = f.commit();
  f.write('docs/mvp/example.md'); f.write('nodia-client/src/chat.ts'); const client = f.commit();
  assert.equal(serverContentEquivalenceAllowed({ repo: f.repo, base, head: client }), true);
  assert.equal(deploymentPlan({ repo: f.repo, head: client, clientBase: base, serverBase: base }).server_content_equivalence_allowed, true);
  f.write('ops/ci/runtime.mjs'); const runtime = f.commit();
  f.write('docs/new.md'); const latest = f.commit();
  assert.equal(serverContentEquivalenceAllowed({ repo: f.repo, base: client, head: latest }), false);
  assert.equal(serverContentEquivalenceAllowed({ repo: f.repo, base: runtime, head: latest }), true);
  f.git(['mv', 'ops/ci/runtime.mjs', 'docs/moved.md']); const renamed = f.commit();
  assert.equal(serverContentEquivalenceAllowed({ repo: f.repo, base: latest, head: renamed }), false);
});

test('equal payloads cannot bypass rollout for packaging, runtime, CI or root inputs', t => {
  const f = fixture(t); let base = f.commit();
  for (const name of ['nodia-server/src/app.ts', 'nodia-server/README.md', 'ops/production/package-backend-release.mjs',
    '.github/workflows/cd.yml', '.nvmrc', 'package.json', 'AGENTS.md', 'docs-lookalike/file.md', 'nodia-client-other/file.ts']) {
    f.write(name); const head = f.commit();
    assert.equal(serverContentEquivalenceAllowed({ repo: f.repo, base, head }), false, name);
    base = head;
  }
  assert.throws(() => serverContentEquivalenceAllowed({ repo: f.repo, base: 'f'.repeat(40), head: base }),
    /deployed_baseline_not_an_ancestor/);
});
