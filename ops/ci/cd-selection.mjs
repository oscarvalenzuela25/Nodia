import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checks, classifyChanges, githubOutputs, parseNameStatus, summary } from './classify-changes.mjs';
import { isSha, requireCd, safeFailure } from './cd-github.mjs';
import { isGeminiRuntimeProof } from './gemini-runtime-proof.mjs';
import { geminiSdkMatchesImage, isCodexCvRuntimeProof } from './runtime-attestations.mjs';

export const unmanagedRuntimeError = 'unmanaged_runtime_change_requires_coordinated_rollout';
const geminiPath = 'nodia-gemini-microservice';
const codexCvPath = 'nodia-server/native/teacher-codex-host';
// The host directory shares sources with Teacher. Only this reviewed CV tree
// is covered by the Codex CV release proof and the preserved Teacher artifact.
const reviewedCodexCvTree = '174765ff83c3820b01d4a8741f702472c0b466d6';
const cvAdoption = '907407843d6c9460d80fbd2daf44665a9d6aee6c';

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
function treeAt(repo, source, directory) {
  const value = execFileSync('git', ['-C', repo, 'rev-parse', '--verify', source + ':' + directory],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const type = execFileSync('git', ['-C', repo, 'cat-file', '-t', value],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  requireCd(type === 'tree' && isSha(value), unmanagedRuntimeError);
  return value;
}

function includesCv(repo, adoption, source) {
  try {
    ancestor(repo, adoption, source);
    return true;
  } catch { return false; }
}

function requireAttestedTree(repo, head, directory, proof) {
  try {
    ancestor(repo, proof.source_sha, head);
    requireCd(treeAt(repo, proof.source_sha, directory) === proof.source_tree_sha &&
      treeAt(repo, head, directory) === proof.source_tree_sha, unmanagedRuntimeError);
  } catch { requireCd(false, unmanagedRuntimeError); }
}

export function deploymentPlan({ repo = process.cwd(), head, clientBase, serverBase, forceClient = false,
  geminiRuntime, codexCvRuntime, geminiCvSdk, cvAdoptionSource = cvAdoption }) {
  requireCd(isSha(clientBase) && isSha(serverBase) && isSha(head), 'deployed_baselines_required');
  const client = deployedChanges({ repo, base: clientBase, head });
  const server = clientBase === serverBase ? client : deployedChanges({ repo, base: serverBase, head });
  const unmanaged = unmanagedRuntimePaths({ repo, base: serverBase, head });
  requireCd(unmanaged.every(name => name.startsWith(geminiPath + '/') || name.startsWith(codexCvPath + '/')),
    unmanagedRuntimeError);
  const cvIncluded = includesCv(repo, cvAdoptionSource, head);
  // An already committed Server can precede Pages when recovering the initial rollout.
  const cvAdopting = cvIncluded && (!includesCv(repo, cvAdoptionSource, clientBase) || !includesCv(repo, cvAdoptionSource, serverBase));
  const codex = cvAdopting || unmanaged.some(name => name.startsWith(codexCvPath + '/'));
  const geminiChanged = unmanaged.some(name => name.startsWith(geminiPath + '/'));
  const geminiSdk = codex || (cvIncluded && geminiChanged);
  const gemini = geminiSdk || geminiChanged;
  if (gemini) {
    requireCd(isGeminiRuntimeProof(geminiRuntime), unmanagedRuntimeError);
    requireAttestedTree(repo, head, geminiPath, geminiRuntime);
  }
  if (geminiSdk) requireCd(geminiSdkMatchesImage(geminiCvSdk, geminiRuntime), unmanagedRuntimeError);
  if (codex) {
    requireCd(isCodexCvRuntimeProof(codexCvRuntime) && codexCvRuntime.source_tree_sha === reviewedCodexCvTree,
      unmanagedRuntimeError);
    requireAttestedTree(repo, head, codexCvPath, codexCvRuntime);
  }
  return { schema_version: 1, source_sha: head, client_base: clientBase, server_base: serverBase,
    client_required: client.client || forceClient, server_required: server.server || server.contracts,
    server_upload_protocol_version: 2,
    server_content_equivalence_allowed: serverContentEquivalenceAllowed({ repo, base: serverBase, head }),
    python_or_native_deployed: false,
    ...(gemini ? { gemini_runtime: geminiRuntime } : {}),
    ...(codex ? { codex_cv_runtime: codexCvRuntime } : {}),
    ...(geminiSdk ? { gemini_cv_sdk: geminiCvSdk } : {}),
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
