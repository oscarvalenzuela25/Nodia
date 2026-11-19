import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ciIdentity, digestFile } from './artifact-release.mjs';
import { ancestor } from './cd-selection.mjs';
import { isHex, isSha, requireCd, safeFailure, writeState } from './cd-github.mjs';

const schemaInputs = [
  'nodia-server/src/migrations/', ':(glob)nodia-server/src/**/*.entity.ts', 'nodia-server/src/config/',
  'nodia-server/src/ai-provider/helpers/ai-key-crypto.helper.ts',
  'nodia-server/package.json', 'nodia-server/package-lock.json', 'nodia-server/tsconfig.json',
  'nodia-server/tsconfig.build.json', 'nodia-server/nest-cli.json', 'nodia-server/scripts/seed-core.mjs',
  'ops/production/update-backend-action.mjs',
];

export function migrationRehearsalRequired(repo, baseline, candidate) {
  ancestor(repo, baseline, candidate);
  const diff = spawnSync('git', ['-C', repo, 'diff', '--quiet', '--no-ext-diff', '--no-textconv', '--no-renames',
    baseline, candidate, '--', ...schemaInputs], { stdio: 'ignore' });
  requireCd(!diff.error && [0, 1].includes(diff.status), 'migration_change_detection_failed');
  return diff.status === 1;
}

function identity(value) {
  return { source_sha: value?.source_sha, release_id: value?.release_id, package_tree_sha256: value?.package_tree_sha256 };
}

function sameRelease(actual, expected) {
  const fields = identity(expected);
  return isSha(fields.source_sha) && isHex(fields.package_tree_sha256) &&
    fields.release_id === `backend-${fields.source_sha.slice(0, 12)}-${fields.package_tree_sha256.slice(0, 12)}` &&
    Object.entries(fields).every(([key, value]) => actual?.[key] === value);
}

export function requireMigrationProof(proof, baseline, candidate) {
  requireCd(proof?.schema_version === 1 && proof.status === 'passed', 'migration_rehearsal_required');
  requireCd(sameRelease(proof.baseline, baseline), 'migration_rehearsal_baseline_changed');
  requireCd(sameRelease(proof.candidate, candidate), 'migration_rehearsal_candidate_mismatch');
  const { clean, upgraded } = proof;
  requireCd(Number.isSafeInteger(proof.postgres) && Math.trunc(proof.postgres / 10_000) === 16 &&
    Number.isSafeInteger(clean?.entities) && clean.entities > 0 && Number.isSafeInteger(clean?.migrations) &&
    Number.isSafeInteger(upgraded?.from) && upgraded.from >= 2 && upgraded.to === clean.migrations &&
    upgraded.to >= upgraded.from && upgraded.applied === upgraded.to - upgraded.from && isHex(upgraded.ledger_sha256) &&
    proof.failed_commit_rolled_back === (upgraded.applied > 0 ? true : null) &&
    proof.representative_rows_preserved === true && proof.api_started === true && proof.http_status === 200,
  'migration_rehearsal_result_invalid');
}

export function recordMigrationProof(directory, receiptFile, environment = process.env) {
  const metadataFile = path.join(directory, 'build-metadata.json');
  const resultFile = path.join(directory, 'artifact-result.json');
  const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const ci = ciIdentity(environment, metadata.source_sha);
  requireCd(ci.event === 'push' && ci.ref === 'refs/heads/master' &&
    Object.entries(ci).every(([name, value]) => metadata.ci?.[name] === value) &&
    metadata.component === 'server' && metadata.production_eligible === true &&
    sameRelease(result, metadata) && digestFile(metadataFile) === result.metadata_sha256 &&
    !Object.hasOwn(metadata, 'migration_rehearsal'), 'migration_candidate_artifact_invalid');
  const baseline = { source_sha: environment.MIGRATION_BASELINE_SHA, release_id: environment.MIGRATION_BASELINE_RELEASE,
    package_tree_sha256: environment.MIGRATION_BASELINE_TREE };
  const proof = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  requireMigrationProof(proof, baseline, metadata);
  writeState(metadataFile, { ...metadata, migration_rehearsal: proof });
  writeState(resultFile, { ...result, metadata_sha256: digestFile(metadataFile) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, first, second, ...extra] = process.argv.slice(2);
    requireCd(first && second && extra.length === 0, 'migration_gate_arguments_invalid');
    if (command === 'required') console.log(migrationRehearsalRequired(process.env.GITHUB_WORKSPACE ?? process.cwd(), first, second));
    else if (command === 'record') recordMigrationProof(first, second);
    else requireCd(false, 'migration_gate_arguments_invalid');
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
