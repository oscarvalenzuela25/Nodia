import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checks, classifyChanges, githubOutputs, parseNameStatus, summary } from './classify-changes.mjs';
import { isSha, requireCd, safeFailure } from './cd-github.mjs';
import { isGeminiRuntimeProof } from './gemini-runtime-proof.mjs';

export const unmanagedRuntimeError = 'unmanaged_runtime_change_requires_coordinated_rollout';
const geminiPath = 'nodia-gemini-microservice';

export function ancestor(repo, base, head) {
  requireCd(isSha(base) && isSha(head), 'baseline_commit_invalid');
  try { execFileSync('git', ['-C', repo, 'merge-base', '--is-ancestor', base, head], { stdio: 'ignore' }); }
  catch { requireCd(false, 'deployed_baseline_not_an_ancestor'); }
}
export function deployedChanges({ repo = process.cwd(), base, head, classify = classifyChanges }) {
  ancestor(repo, base, head);
  return classify({ repo, base, head });
}
export function selectChecks({ repo = process.cwd(), base, head, clientBase, serverBase,
  productionPush = false, forceClient = false, classify = classifyChanges }) {
  requireCd(!productionPush || isSha(clientBase) && isSha(serverBase), 'both_production_baselines_required');
  requireCd(Boolean(clientBase) === Boolean(serverBase), 'both_production_baselines_required');
  const event = classify({ repo, base, head });
  if (!clientBase) return event;
  const client = deployedChanges({ repo, base: clientBase, head, classify });
  const server = clientBase === serverBase ? client : deployedChanges({ repo, base: serverBase, head, classify });
  const result = { ...event, reasons: structuredClone(event.reasons), client_baseline: clientBase, server_baseline: serverBase };
  for (const [flag, additional] of [['client', client.client], ['server', server.server], ['contracts', server.contracts]]) {
    if (additional) {
      result[flag] = true;
      result.reasons[flag] = [...new Set([...result.reasons[flag], flag === 'client' ? 'deployed_client_baseline' : 'deployed_server_baseline'])].sort();
    }
  }
  if (forceClient) { result.client = true; result.reasons.client = [...new Set([...result.reasons.client, 'production_public_config_changed'])].sort(); }
  result.docs_only = result.docs && checks.every(flag => flag === 'docs' || !result[flag]);
  return result;
}
export function unmanagedRuntimePaths({ repo = process.cwd(), base, head }) {
  ancestor(repo, base, head);
  const raw = execFileSync('git', ['-C', repo, 'diff', '--no-ext-diff', '--no-textconv', '--name-status', '-z', '--find-renames', base, head, '--']);
  return [...new Set(parseNameStatus(raw).flatMap(item => item.paths))].filter(name => {
    if (!name.startsWith(geminiPath + '/') && !name.startsWith('nodia-server/native/')) return false;
    if (/\.(?:md|mdx)$/.test(name) || /\/(?:tests?|fixtures|__tests__)\//.test(name) || /\/test_[^/]+\.py$/.test(name)) return false;
    return true;
  }).sort();
}
export function serverContentEquivalenceAllowed({ repo = process.cwd(), base, head }) {
  ancestor(repo, base, head);
  const raw = execFileSync('git', ['-C', repo, 'diff', '--no-ext-diff', '--no-textconv', '--name-status', '-z', '--find-renames', base, head, '--']);
  // Renames must qualify at both ends. Operators, packaging and runtime inputs require a normal rollout.
  return parseNameStatus(raw).every(item => item.paths.every(name =>
    name.startsWith('docs/') || name.startsWith('nodia-client/')));
}
function requireCoordinatedGeminiRuntime(repo, head, changed, proof) {
  requireCd(changed.every(name => name.startsWith(geminiPath + '/')) &&
    isGeminiRuntimeProof(proof), unmanagedRuntimeError);
  try {
    ancestor(repo, proof.source_sha, head);
    for (const source of [proof.source_sha, head]) {
      const tree = execFileSync('git', ['-C', repo, 'rev-parse', '--verify', source + ':' + geminiPath],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      requireCd(tree === proof.source_tree_sha, unmanagedRuntimeError);
      const type = execFileSync('git', ['-C', repo, 'cat-file', '-t', tree],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      requireCd(type === 'tree', unmanagedRuntimeError);
    }
  } catch { requireCd(false, unmanagedRuntimeError); }
  return proof;
}

export function deploymentPlan({ repo = process.cwd(), head, clientBase, serverBase, forceClient = false, geminiRuntime }) {
  requireCd(isSha(clientBase) && isSha(serverBase) && isSha(head), 'deployed_baselines_required');
  const client = deployedChanges({ repo, base: clientBase, head });
  const server = clientBase === serverBase ? client : deployedChanges({ repo, base: serverBase, head });
  const unmanaged = unmanagedRuntimePaths({ repo, base: serverBase, head });
  const attestation = unmanaged.length ? requireCoordinatedGeminiRuntime(repo, head, unmanaged, geminiRuntime) : null;
  return { schema_version: 1, source_sha: head, client_base: clientBase, server_base: serverBase,
    client_required: client.client || forceClient, server_required: server.server || server.contracts,
    server_upload_protocol_version: 2,
    server_content_equivalence_allowed: serverContentEquivalenceAllowed({ repo, base: serverBase, head }),
    python_or_native_deployed: false,
    ...(attestation ? { gemini_runtime: attestation } : {}),
    separate_runtime_checks_selected: server.python || server.native };
}
function argumentsFor(argv) {
  requireCd(argv.length % 2 === 0, 'selection_arguments_invalid');
  const accepted = { '--base': 'base', '--head': 'head', '--client-base': 'clientBase', '--server-base': 'serverBase',
    '--force-client': 'forceClient', '--github-output': 'githubOutput', '--summary': 'summaryFile' };
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = accepted[argv[index]];
    requireCd(key && !Object.hasOwn(result, key), 'selection_arguments_invalid');
    result[key] = argv[index + 1];
  }
  requireCd(isSha(result.base) && isSha(result.head), 'selection_commits_required');
  requireCd(result.forceClient === undefined || ['true', 'false'].includes(result.forceClient), 'selection_arguments_invalid');
  result.forceClient = result.forceClient === 'true';
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { githubOutput, summaryFile, ...options } = argumentsFor(process.argv.slice(2));
    const result = selectChecks({ ...options, productionPush: process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/master' });
    if (githubOutput) fs.appendFileSync(githubOutput, githubOutputs(result));
    if (summaryFile) fs.appendFileSync(summaryFile, summary(result) + (result.client_baseline ?
      `\nEffective production baselines: Client \`${result.client_baseline}\`; Server \`${result.server_baseline}\`.\n` : ''));
    console.log(JSON.stringify(result));
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
