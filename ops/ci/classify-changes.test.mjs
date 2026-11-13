import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checks, classifyChanges, classifyPaths, githubOutputs, nativeContractInputs, parseArguments, parseNameStatus, summary } from './classify-changes.mjs';

const modulePath = fileURLToPath(new URL('./classify-changes.mjs', import.meta.url));
const policyInputs = [
  'docs/mvp/nodia-ai-v1-runtime-policy.json',
  'docs/mvp/nodia-ai-v1-runtime-policy.schema.json',
  'docs/mvp/nodia-ai-v1-common-contracts.schema.json',
  'docs/mvp/nodia-ai-v1-tool-catalog.json',
  'docs/mvp/nodia-ai-v1-tool-catalog.extensions.json',
  'docs/evidence/scripts/validate-nodia-ai-ai04.cjs',
];
function fixture(t, { registry = true } = {}) {
  const parent = realpathSync(os.tmpdir());
  const repo = mkdtempSync(path.join(parent, 'nodia-ci-fixture-'));
  const git = args => {
    const result = spawnSync('git', ['-C', repo, '-c', 'core.hooksPath=' + path.join(repo, 'empty-hooks'), ...args], {
      encoding: 'utf8', windowsHide: true,
      env: { ...process.env, GIT_AUTHOR_NAME: 'CI fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'CI fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(['init', '--quiet']); git(['config', 'core.autocrlf', 'false']);
  git(['config', 'commit.gpgsign', 'false']);
  const write = (name, value = 'fixture\n') => {
    const target = path.join(repo, name); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, value);
  };
  const commit = () => { git(['add', '-A']); git(['commit', '--quiet', '--no-gpg-sign', '-m', 'synthetic CI fixture']); return git(['rev-parse', 'HEAD']); };
  if (registry) write('nodia-server/config/nodia-ai-knowledge.registry.json', JSON.stringify({ source_paths: [], capabilities: [], bindings: [] }));
  for (const name of policyInputs) write(name, '{}\n');
  t.after(() => {
    assert.equal(path.dirname(repo), parent);
    assert.ok(path.basename(repo).startsWith('nodia-ci-fixture-'));
    rmSync(repo, { recursive: true, force: true });
  });
  return { repo, write, commit, git, remove: name => rmSync(path.join(repo, name)),
    rename: (oldName, newName) => {
      mkdirSync(path.dirname(path.join(repo, newName)), { recursive: true });
      renameSync(path.join(repo, oldName), path.join(repo, newName));
    } };
}
const allSelected = result => checks.every(check => result[check] === true);

test('strict NUL parser preserves newline paths and both sides of a rename/copy', () => {
  const parsed = parseNameStatus(Buffer.from('R100\0nodia-client/old\nname.ts\0docs/new.md\0D\0nodia-server/gone.ts\0C75\0a\0b\0'));
  assert.deepEqual(parsed[0].paths, ['nodia-client/old\nname.ts', 'docs/new.md']);
  assert.deepEqual(parsed[2].paths, ['a', 'b']);
  for (const raw of ['M\0path', 'R90\0old\0', 'U\0unmerged\0', 'M\0../outside\0', 'M\0\0']) {
    assert.throws(() => parseNameStatus(Buffer.from(raw)), /invalid|incomplete/);
  }
  assert.deepEqual(parseNameStatus(Buffer.alloc(0)), []);
  assert.throws(() => parseNameStatus(Buffer.from([77, 0, 0xff, 0])), /invalid_git_utf8/);
});

test('CLI arguments reject ambiguity, repetition and option-shaped values', () => {
  assert.deepEqual(parseArguments(['--base', 'a'.repeat(40), '--head', 'b'.repeat(40)]), { base: 'a'.repeat(40), head: 'b'.repeat(40) });
  for (const args of [[], ['--base'], ['--repo', '.'], ['--base', 'x', '--base', 'y', '--head', 'z'],
    ['--base', '--head', '--head', 'x'], ['--base', 'x', '--head', 'y', '--summary', 'a\0b']]) {
    assert.throws(() => parseArguments(args), /invalid_arguments/);
  }
});

test('client-only change does not build Server without an actual cross-root dependency', t => {
  const f = fixture(t); f.write('nodia-client/src/main.ts', 'export const x = 1;\n');
  const base = f.commit(); f.write('nodia-client/src/main.ts', 'export const x = 2;\n'); const head = f.commit();
  const result = classifyChanges({ repo: f.repo, base, head });
  assert.equal(result.client, true); assert.equal(result.server, false); assert.equal(result.contracts, false);
  assert.equal(result.changed_files, 1); assert.equal(result.docs_only, false);
});

test('administrative prose and unconsumed JSON evidence need docs, without application builds', t => {
  const f = fixture(t); const base = f.commit();
  f.write('docs/mvp/notes.md'); f.write('docs/evidence/administrative.json', '{}\n'); const head = f.commit();
  const result = classifyChanges({ repo: f.repo, base, head });
  assert.equal(result.docs_only, true); assert.equal(result.docs, true);
  assert.ok(checks.filter(check => check !== 'docs').every(check => result[check] === false));
});

test('requirements and text fixtures inside components activate their owning checks', t => {
  for (const [name, expected] of [
    ['nodia-gemini-microservice/requirements.txt', ['python', 'server', 'contracts']],
    ['nodia-gemini-microservice/requirements-dev.txt', ['python', 'server', 'contracts']],
    ['nodia-client/src/test/fixture.txt', ['client']],
    ['nodia-server/test/fixture.txt', ['server', 'contracts']],
  ]) {
    const f = fixture(t); f.write(name, 'original fixture\n'); const base = f.commit();
    f.write(name, 'changed fixture\n'); const head = f.commit();
    const result = classifyChanges({ repo: f.repo, base, head });
    assert.ok(expected.every(check => result[check]), name);
    assert.equal(result.docs_only, false, name);
  }
  const f = fixture(t); const base = f.commit(); f.write('docs/mvp/administrative.txt'); const head = f.commit();
  assert.equal(classifyChanges({ repo: f.repo, base, head }).docs_only, true);
  assert.ok(allSelected(classifyPaths([{ status: 'A', paths: ['unknown-root/fixture.txt'] }])));
});

function knowledgeFixture(f) {
  const source = 'docs/nodia-ai/knowledge/fixture/README.md';
  f.write('nodia-server/config/nodia-ai-knowledge.registry.json', JSON.stringify({ source_paths: [source], capabilities: [], bindings: [] }));
  f.write('nodia-client/src/referenced.ts'); f.write('docs/evidence/approval.json', '{}\n');
  f.write('nodia-gemini-microservice/public_source.py');
  f.write(source, '---\n' + JSON.stringify({ document_status: 'approved',
    sources: [{ path: 'nodia-client/src/referenced.ts' }],
    verification: { evidence_paths: ['docs/evidence/approval.json'] }, approval: { reference: 'docs/evidence/approval.json' } }) +
    '\n---\n\n# Fixture\n\n[Python](../../../../nodia-gemini-microservice/public_source.py)\n');
}

test('registry/frontmatter, approval evidence and approved Markdown links are actual Server inputs', t => {
  for (const changed of ['nodia-client/src/referenced.ts', 'docs/evidence/approval.json', 'nodia-gemini-microservice/public_source.py']) {
    const f = fixture(t); knowledgeFixture(f); const base = f.commit(); f.write(changed, 'changed fixture\n'); const head = f.commit();
    const result = classifyChanges({ repo: f.repo, base, head });
    assert.equal(result.server, true); assert.equal(result.contracts, true); assert.equal(result.docs_only, false);
    assert.ok(result.reasons.server.includes('committed_dependency'));
  }
});

test('literal external inputs of tests/build scripts activate their actual consumer', t => {
  const f = fixture(t);
  f.write('nodia-client/src/test.ts', 'const input = "../../docs/mvp/client-input.md";\n');
  f.write('docs/mvp/client-input.md'); const base = f.commit(); f.write('docs/mvp/client-input.md', 'new fixture\n'); const head = f.commit();
  const result = classifyChanges({ repo: f.repo, base, head });
  assert.equal(result.client, true); assert.equal(result.server, false); assert.equal(result.docs_only, false);
});

test('rename out of Client retains the old component; deleted Server paths are detected', t => {
  const f = fixture(t); f.write('nodia-client/src/moved.ts', 'unique rename fixture\n'); f.write('nodia-server/src/gone.ts');
  const base = f.commit(); f.rename('nodia-client/src/moved.ts', 'docs/mvp/moved.md'); f.remove('nodia-server/src/gone.ts'); const head = f.commit();
  const result = classifyChanges({ repo: f.repo, base, head });
  assert.equal(result.client, true); assert.equal(result.server, true); assert.equal(result.docs, true);
  assert.equal(result.changed_files, 2); assert.equal(result.changed_paths, 3);
});

test('more than 300 changed files are all classified through Git, without API truncation', t => {
  const f = fixture(t); const base = f.commit();
  for (let index = 0; index < 350; index++) f.write(`docs/mvp/fixture-${index}.md`);
  f.write('nodia-client/src/last.ts'); const head = f.commit();
  const result = classifyChanges({ repo: f.repo, base, head });
  assert.equal(result.changed_files, 351); assert.equal(result.client, true); assert.equal(result.server, false);
});

test('workflow/tooling changes and unknown paths select every check conservatively', () => {
  for (const name of ['.github/workflows/ci.yml', 'ops/ci/classify-changes.mjs', 'new-root/unknown', '.gitattributes']) {
    assert.ok(allSelected(classifyPaths([{ status: 'M', paths: [name] }])));
  }
  const native = classifyPaths([{ status: 'M', paths: ['nodia-server/native/teacher-codex-host/src/protocol.rs'] }]);
  assert.ok(native.native && native.python && native.server && native.contracts);
  assert.equal(native.client, false);
});

test('actual TS native-host protocol and runtime callers select the Rust lane', t => {
  for (const name of nativeContractInputs) {
    assert.ok(existsSync(new URL('../../' + name, import.meta.url)), 'listed native consumer must exist: ' + name);
    assert.ok(!name.endsWith('.spec.ts'));
  }
  const f = fixture(t); const name = 'nodia-server/src/ai-generation/codex-teacher-text-transport.ts';
  f.write(name, 'const protocol = "synthetic-v1";\n'); const base = f.commit();
  f.write(name, 'const protocol = "synthetic-v2";\n'); const head = f.commit();
  const result = classifyChanges({ repo: f.repo, base, head });
  assert.ok(result.native && result.server && result.contracts);
  assert.ok(result.reasons.native.includes('native_contract_input'));
  assert.equal(result.client, false);
  for (const input of nativeContractInputs) {
    assert.equal(classifyPaths([{ status: 'M', paths: [input] }]).native, true);
  }
  assert.equal(classifyPaths([{ status: 'M', paths: ['nodia-server/src/user/user.service.ts'] }]).native, false);
});

test('absent refs and incomplete committed dependency trees fail before publishing any outputs', t => {
  const f = fixture(t); const base = f.commit(); f.write('docs/mvp/notes.md'); const head = f.commit();
  assert.throws(() => classifyChanges({ repo: f.repo, base: 'f'.repeat(40), head }), /git_read_failed/);
  assert.throws(() => classifyChanges({ repo: f.repo, base: 'refs/heads/master', head }), /invalid_commit_sha/);
  const output = path.join(f.repo, 'github-output'); const report = path.join(f.repo, 'summary');
  const cli = spawnSync(process.execPath, [modulePath, '--base', 'f'.repeat(40), '--head', head,
    '--github-output', output, '--summary', report], { cwd: f.repo, encoding: 'utf8', windowsHide: true });
  assert.equal(cli.status, 1); assert.equal(cli.stdout, ''); assert.equal(existsSync(output), false); assert.equal(existsSync(report), false);
  assert.deepEqual(JSON.parse(cli.stderr), { schema_version: 1, status: 'failed', error: 'git_read_failed' });
  const missing = fixture(t, { registry: false }); const invalid = missing.commit();
  assert.throws(() => classifyChanges({ repo: missing.repo, base: invalid, head: invalid }), /dependency_source_missing/);
  f.remove('docs/mvp/nodia-ai-v1-runtime-policy.json'); const incomplete = f.commit();
  assert.throws(() => classifyChanges({ repo: f.repo, base: head, head: incomplete }), /dependency_source_missing/);
});

test('dirty or incomplete working files cannot change committed-tree classification', t => {
  const f = fixture(t); const base = f.commit(); f.write('docs/mvp/notes.md'); const head = f.commit();
  f.remove('nodia-server/config/nodia-ai-knowledge.registry.json');
  assert.equal(classifyChanges({ repo: f.repo, base, head }).docs_only, true);
});

test('newline filenames cannot inject Actions outputs, summaries or workflow commands', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); const base = f.commit();
  const name = 'nodia-client/src/file\nserver=false\n::warning::fixture.ts';
  f.write(name); const head = f.commit();
  const output = path.join(f.repo, 'github-output'); const report = path.join(f.repo, 'summary');
  const cli = spawnSync(process.execPath, [modulePath, '--base', base, '--head', head,
    '--github-output', output, '--summary', report], { cwd: f.repo, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const result = JSON.parse(cli.stdout);
  assert.equal(result.client, true); assert.equal(result.server, false);
  assert.equal(readFileSync(output, 'utf8'), githubOutputs(result));
  assert.equal(readFileSync(report, 'utf8'), summary(result));
  assert.ok(!cli.stdout.includes('::warning::') && !summary(result).includes('::warning::'));
  assert.equal(githubOutputs(result).split('\n').filter(line => line.startsWith('server=')).length, 1);
});
