import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { selectChecks, unmanagedRuntimePaths, ancestor } from './cd-selection.mjs';

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
  return { repo, write, commit, git };
}
const result = selected => ({ ...Object.fromEntries(['client','server','contracts','native','python','docs','ci'].map(key => [key, selected.includes(key)])),
  reasons: Object.fromEntries(['client','server','contracts','native','python','docs','ci'].map(key => [key, []])), docs_only: selected.join() === 'docs' });

test('deployed backlog and config drift expand ordinary checks without reducing event selections', t => {
  const f = fixture(t), baseline = f.commit(); f.write('client'); const eventBase = f.commit(); f.write('docs'); const head = f.commit();
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
