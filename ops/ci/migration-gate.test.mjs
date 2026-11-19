import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { digestFile } from './artifact-release.mjs';
import { migrationRehearsalRequired, recordMigrationProof, requireMigrationProof } from './migration-gate.mjs';

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nodia-migration-gate-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('compare against deployed commit, including renames out of migration paths', t => {
  const repo = temporaryDirectory(t);
  const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.name=Nodia CI', '-c', 'user.email=ci@example.invalid',
    '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = message => {
    git('add', '.');
    git('commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q');
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
  const deployed = commit('deployed');
  fs.writeFileSync(path.join(repo, 'README.md'), 'docs\n');
  const docs = commit('docs');
  assert.equal(migrationRehearsalRequired(repo, deployed, docs), false);
  const migrations = path.join(repo, 'nodia-server/src/migrations');
  fs.mkdirSync(migrations, { recursive: true });
  const input = path.join(migrations, 'new.ts');
  fs.writeFileSync(input, 'export {};\n');
  const migration = commit('migration');
  fs.writeFileSync(path.join(repo, 'README.md'), 'next docs\n');
  const candidate = commit('candidate');
  assert.equal(migrationRehearsalRequired(repo, deployed, candidate), true);
  assert.equal(migrationRehearsalRequired(repo, migration, candidate), false);
  fs.renameSync(input, path.join(repo, 'moved.ts'));
  assert.equal(migrationRehearsalRequired(repo, candidate, commit('rename')), true);
});

const release = (source, tree) => ({ source_sha: source.repeat(40), package_tree_sha256: tree.repeat(64),
  release_id: `backend-${source.repeat(12)}-${tree.repeat(12)}` });
const baseline = release('a', 'b');
const candidate = release('c', 'd');
const proof = { schema_version: 1, status: 'passed', baseline, candidate, postgres: 160015,
  clean: { migrations: 56, entities: 73 },
  upgraded: { from: 52, to: 56, applied: 4, ledger_sha256: 'e'.repeat(64) },
  failed_commit_rolled_back: true, representative_rows_preserved: true, api_started: true, http_status: 200 };

test('a failed rehearsal or a different deployed package cannot authorize production', () => {
  assert.doesNotThrow(() => requireMigrationProof(proof, baseline, candidate));
  assert.throws(() => requireMigrationProof(undefined, baseline, candidate), /migration_rehearsal_required/);
  assert.throws(() => requireMigrationProof(proof, { ...baseline, package_tree_sha256: 'b'.repeat(63) + 'c' }, candidate),
    /migration_rehearsal_baseline_changed/);
  assert.throws(() => requireMigrationProof(proof, baseline, release('c', 'f')), /migration_rehearsal_candidate_mismatch/);
  assert.throws(() => requireMigrationProof({ ...proof, failed_commit_rolled_back: false }, baseline, candidate),
    /migration_rehearsal_result_invalid/);
});

test('recording the passed rehearsal preserves the candidate archive and updates the bound metadata digest', t => {
  const directory = temporaryDirectory(t);
  const metaFile = path.join(directory, 'build-metadata.json');
  const resultFile = path.join(directory, 'artifact-result.json');
  const receiptFile = path.join(directory, 'receipt.json');
  const ci = { repository: 'oscarvalenzuela25/Nodia', run_id: '1', run_attempt: '1', event: 'push', ref: 'refs/heads/master' };
  const metadata = { ...candidate, ci, component: 'server', production_eligible: true, archive_sha256: 'f'.repeat(64) };
  fs.writeFileSync(metaFile, JSON.stringify(metadata));
  const result = { ...candidate, archive_sha256: metadata.archive_sha256, metadata_sha256: digestFile(metaFile) };
  fs.writeFileSync(resultFile, JSON.stringify(result));
  fs.writeFileSync(receiptFile, JSON.stringify(proof));
  recordMigrationProof(directory, receiptFile, { GITHUB_ACTIONS: 'true', GITHUB_SHA: candidate.source_sha,
    GITHUB_REPOSITORY: ci.repository, GITHUB_RUN_ID: ci.run_id, GITHUB_RUN_ATTEMPT: ci.run_attempt,
    GITHUB_EVENT_NAME: ci.event, GITHUB_REF: ci.ref, MIGRATION_BASELINE_SHA: baseline.source_sha,
    MIGRATION_BASELINE_RELEASE: baseline.release_id, MIGRATION_BASELINE_TREE: baseline.package_tree_sha256 });
  assert.deepEqual(JSON.parse(fs.readFileSync(metaFile, 'utf8')), { ...metadata, migration_rehearsal: proof });
  assert.deepEqual(JSON.parse(fs.readFileSync(resultFile, 'utf8')), { ...result, metadata_sha256: digestFile(metaFile) });
});
