#!/usr/bin/env node
// Offline Git-tree classification only. Never import code from either revision.
import { spawnSync } from 'node:child_process';
import { appendFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const checks = Object.freeze(['client', 'server', 'python', 'native', 'contracts', 'docs', 'ci']);
const registryPath = 'nodia-server/config/nodia-ai-knowledge.registry.json';
const policyInputs = new Set([
  'docs/mvp/nodia-ai-v1-runtime-policy.json',
  'docs/mvp/nodia-ai-v1-runtime-policy.schema.json',
  'docs/mvp/nodia-ai-v1-common-contracts.schema.json',
  'docs/mvp/nodia-ai-v1-tool-catalog.json',
  'docs/mvp/nodia-ai-v1-tool-catalog.extensions.json',
  'docs/evidence/scripts/validate-nodia-ai-ai04.cjs',
]);
// The native host and its TS caller share framing, identity, policy, SDK pins and
// lifecycle ownership. Changing only the caller must still check the Rust lane.
export const nativeContractInputs = Object.freeze([
  'nodia-server/src/ai-generation/codex-teacher-text-transport.ts',
  'nodia-server/src/ai-generation/agentic-text-contract.ts',
  'nodia-server/src/ai-generation/ai-selection.ts',
  'nodia-server/src/ai-generation/teacher-agentic-text.service.ts',
  'nodia-server/src/ai-generation/teacher-generation-runtime.service.ts',
  'nodia-server/src/common/ai/codex/codex-contract.ts',
  'nodia-server/src/common/ai/codex/codex-chat-runtime.ts',
  'nodia-server/src/common/ai/codex/codex-runtime.service.ts',
  'nodia-server/src/common/ai/codex/codex-teacher-journal.ts',
  'nodia-server/src/common/ai/codex/codex-profile-lease.ts',
  'nodia-server/src/common/ai/codex/codex-process-ownership.ts',
]);
const nativeContracts = new Set(nativeContractInputs);
const roots = ['docs/', 'nodia-client/', 'nodia-server/', 'nodia-gemini-microservice/'];
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const decode = bytes => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('invalid_git_utf8'); }
};

function repositoryPath(value) {
  ensure(typeof value === 'string' && value.length > 0 && !value.startsWith('/') &&
    !value.split('/').some(part => part === '' || part === '.' || part === '..'), 'invalid_git_path');
  return value;
}

export function parseNameStatus(bytes) {
  ensure(Buffer.isBuffer(bytes), 'invalid_diff_bytes');
  if (bytes.length === 0) return [];
  ensure(bytes.at(-1) === 0, 'incomplete_git_diff');
  const fields = decode(bytes).split('\0'); fields.pop();
  const changes = [];
  for (let cursor = 0; cursor < fields.length;) {
    const status = fields[cursor++];
    ensure(/^(?:[ADMT]|[RC](?:100|[0-9]{1,2}))$/.test(status), 'invalid_git_diff_status');
    const count = /^[RC]/.test(status) ? 2 : 1;
    ensure(cursor + count <= fields.length, 'incomplete_git_diff');
    changes.push({ status, paths: fields.slice(cursor, cursor + count).map(repositoryPath) });
    cursor += count;
  }
  return changes;
}

function gitRunner(repo) {
  // Ignore ambient GIT_DIR/config injection; all operations are local and read-only.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_NO_LAZY_FETCH = '1';
  env.GIT_OPTIONAL_LOCKS = '0';
  return (args, { input, allowNoMatch = false } = {}) => {
    const result = spawnSync('git', ['--no-pager', '-C', repo, ...args], {
      env, input, encoding: 'buffer', maxBuffer: 128 * 1024 * 1024, windowsHide: true,
    });
    ensure(!result.error && (result.status === 0 || (allowNoMatch && result.status === 1)), 'git_read_failed');
    return result.stdout;
  };
}

function snapshot(git, sha) {
  const tree = new Map();
  const raw = git(['ls-tree', '-r', '-z', '--full-tree', sha]);
  ensure(raw.length > 0 && raw.at(-1) === 0, 'incomplete_git_tree');
  for (const record of decode(raw).split('\0').slice(0, -1)) {
    const match = /^([0-7]{6}) (blob|commit) ([a-f0-9]{40,64})\t([\s\S]+)$/.exec(record);
    ensure(match, 'invalid_git_tree');
    const name = repositoryPath(match[4]);
    ensure(!tree.has(name), 'duplicate_git_path');
    tree.set(name, { mode: match[1], type: match[2], oid: match[3] });
  }
  const read = name => {
    const entry = tree.get(name);
    ensure(entry?.type === 'blob' && ['100644', '100755'].includes(entry.mode), 'dependency_source_missing');
    return decode(git(['cat-file', 'blob', entry.oid]));
  };
  return { tree, read };
}

function referencedPath(value) {
  return typeof value === 'string' && roots.some(root => value.startsWith(root)) &&
    /^[A-Za-z0-9_./-]+$/.test(value) && !value.split('/').some(part => part === '' || part === '.' || part === '..');
}

function jsonStrings(raw) {
  // Parse for syntax, but scan every string token so duplicate keys cannot hide references.
  try { JSON.parse(raw); } catch { throw new Error('invalid_dependency_json'); }
  return [...raw.matchAll(/"(?:\\[\s\S]|[^"\\])*"/g)].map(match => JSON.parse(match[0]));
}

function ownerChecks(name) {
  if (name.startsWith('nodia-server/native/')) return ['native', 'python', 'server', 'contracts'];
  if (name.startsWith('nodia-server/')) return ['server', 'contracts'];
  if (name.startsWith('nodia-client/')) return ['client'];
  if (name.startsWith('nodia-gemini-microservice/')) return ['python', 'server', 'contracts'];
  return [];
}

function dependencies(git, sha) {
  const { tree, read } = snapshot(git, sha);
  const result = new Map();
  const add = (name, units, requireFile = true) => {
    ensure(referencedPath(name), 'invalid_dependency_path');
    if (requireFile) ensure(tree.get(name)?.type === 'blob' && tree.get(name)?.mode !== '120000', 'dependency_source_missing');
    if (!result.has(name)) result.set(name, new Set());
    for (const unit of units) result.get(name).add(unit);
  };
  const knowledge = ['server', 'contracts'];
  add(registryPath, knowledge);
  const registryRaw = read(registryPath);
  const registry = JSON.parse(registryRaw);
  ensure(Array.isArray(registry.source_paths) && Array.isArray(registry.capabilities) && Array.isArray(registry.bindings),
    'invalid_dependency_registry');
  const strings = jsonStrings(registryRaw);
  for (const value of strings.filter(referencedPath)) add(value, knowledge);
  // Includes duplicate-key source lists: never allow JSON last-key-wins to omit a source.
  const sourcePaths = new Set(strings.filter(value => /^docs\/nodia-ai\/knowledge\/.+\.md$/.test(value)));
  ensure(registry.source_paths.every(value => referencedPath(value) && sourcePaths.has(value)), 'invalid_dependency_registry');
  for (const source of sourcePaths) {
    const raw = read(source).replaceAll('\r\n', '\n');
    const match = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/.exec(raw);
    ensure(match, 'invalid_dependency_frontmatter');
    const metadata = JSON.parse(match[1]);
    ensure(metadata && ['draft', 'in_review', 'approved', 'retired'].includes(metadata.document_status) &&
      Array.isArray(metadata.sources) && metadata.sources.every(source => referencedPath(source?.path)) &&
      Array.isArray(metadata.verification?.evidence_paths) && metadata.verification.evidence_paths.every(referencedPath) &&
      (metadata.approval === null || referencedPath(metadata.approval?.reference)), 'invalid_dependency_metadata');
    for (const value of jsonStrings(match[1]).filter(referencedPath)) add(value, knowledge);
    if (metadata.document_status === 'approved') {
      for (const link of match[2].matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
        const target = link[1].replace(/^<|>$/g, '');
        if (!target || target.startsWith('#') || /^https?:\/\//i.test(target)) continue;
        ensure(!/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.includes('\\'), 'invalid_dependency_link');
        add(path.posix.normalize(path.posix.join(path.posix.dirname(source), target.split('#')[0])), knowledge);
      }
    }
  }
  for (const name of policyInputs) add(name, knowledge);
  // Cross-root literals in build tools, runtime and tests are also dependencies.
  // Git grep reads committed objects, not a potentially sparse/dirty working tree.
  const matches = git(['grep', '-z', '-l', '-I', '-F', '-e', 'docs/', '-e', 'nodia-client/',
    '-e', 'nodia-server/', '-e', 'nodia-gemini-microservice/', sha, '--',
    'nodia-server', 'nodia-client', 'nodia-gemini-microservice'], { allowNoMatch: true });
  if (matches.length) ensure(matches.at(-1) === 0, 'incomplete_git_grep');
  for (const record of decode(matches).split('\0').filter(Boolean)) {
    ensure(record.startsWith(sha + ':'), 'invalid_git_grep');
    const name = record.slice(sha.length + 1);
    if (!/\.(?:[cm]?js|[cm]?ts|tsx|py|rs)$/.test(name)) continue;
    const units = ownerChecks(name);
    for (const match of read(name).matchAll(/(?:docs|nodia-client|nodia-server|nodia-gemini-microservice)\/[A-Za-z0-9_./-]+/g)) {
      const reference = match[0];
      // Comments and synthetic fixture names are not required committed files.
      if (referencedPath(reference) && tree.has(reference)) add(reference, units);
    }
  }
  return result;
}

export function classifyPaths(changes, dependencyMaps = []) {
  const flags = Object.fromEntries(checks.map(check => [check, false]));
  const reasons = Object.fromEntries(checks.map(check => [check, new Set()]));
  const select = (units, reason) => {
    for (const unit of units) { flags[unit] = true; reasons[unit].add(reason); }
  };
  const paths = new Set(changes.flatMap(change => change.paths));
  for (const name of paths) {
    const dependency = new Set(dependencyMaps.flatMap(map => [...(map.get(name) ?? [])]));
    if (dependency.size) select(dependency, 'committed_dependency');
    if (nativeContracts.has(name)) select(['native', 'server', 'contracts'], 'native_contract_input');
    if (name.startsWith('.github/') || name.startsWith('ops/ci/')) {
      select(checks, 'pipeline_change'); continue;
    }
    const prose = /\.(?:md|mdx)$/.test(name) || (name.startsWith('docs/') && name.endsWith('.txt'));
    if ((prose && (roots.some(root => name.startsWith(root)) || name.startsWith('ops/'))) ||
      ['README.md', 'AGENTS.md'].includes(name) || (name.startsWith('docs/evidence/') && name.endsWith('.json'))) {
      select(['docs'], 'documentation'); continue;
    }
    if (name.startsWith('docs/nodia-ai/knowledge/') || policyInputs.has(name)) {
      select(['server', 'contracts', 'docs'], 'compiled_documentation'); continue;
    }
    if (name.startsWith('nodia-server/native/')) {
      select(['native', 'python', 'server', 'contracts'], 'native_source'); continue;
    }
    if (name.startsWith('nodia-client/')) { select(['client'], 'client_source'); continue; }
    if (name.startsWith('nodia-server/')) { select(['server', 'contracts'], 'server_source'); continue; }
    if (name.startsWith('nodia-gemini-microservice/')) {
      select(['python', 'server', 'contracts'], 'python_source');
      if (/\/(?:native_[^/]*|teacher_sdk_host|teacher_sdk_protocol)\.py$/.test(name)) select(['native'], 'native_protocol_consumer');
      continue;
    }
    if (dependency.size && name.startsWith('docs/')) { select(['docs'], 'referenced_documentation'); continue; }
    select(checks, name.startsWith('ops/') ? 'shared_operations' : 'unknown_path');
  }
  return { ...flags, docs_only: flags.docs && checks.every(check => check === 'docs' || !flags[check]),
    changed_files: changes.length, changed_paths: paths.size,
    reasons: Object.fromEntries(checks.map(check => [check, [...reasons[check]].sort()])) };
}

export function classifyChanges({ repo = process.cwd(), base, head }) {
  ensure(/^[a-f0-9]{40}$/.test(base ?? '') && /^[a-f0-9]{40}$/.test(head ?? '') &&
    !/^0+$/.test(base) && !/^0+$/.test(head), 'invalid_commit_sha');
  repo = realpathSync(repo);
  const git = gitRunner(repo);
  const top = decode(git(['rev-parse', '--show-toplevel'])).trim();
  ensure(realpathSync(top) === repo, 'repository_root_required');
  for (const sha of new Set([base, head])) ensure(decode(git(['cat-file', '-t', sha])).trim() === 'commit', 'commit_required');
  const changes = parseNameStatus(git(['diff', '--no-ext-diff', '--no-textconv', '--name-status', '-z',
    '--find-renames', base, head, '--']));
  const maps = [...new Set([base, head])].map(sha => dependencies(git, sha));
  return { schema_version: 1, base, head, ...classifyPaths(changes, maps) };
}

export function parseArguments(args) {
  const accepted = new Map([['--base', 'base'], ['--head', 'head'], ['--github-output', 'githubOutput'], ['--summary', 'summary']]);
  const parsed = {};
  ensure(args.length % 2 === 0, 'invalid_arguments');
  for (let index = 0; index < args.length; index += 2) {
    const name = accepted.get(args[index]);
    ensure(name && !Object.hasOwn(parsed, name) && typeof args[index + 1] === 'string' &&
      args[index + 1].length > 0 && !args[index + 1].includes('\0') && !args[index + 1].startsWith('--'), 'invalid_arguments');
    parsed[name] = args[index + 1];
  }
  ensure(parsed.base && parsed.head, 'invalid_arguments');
  return parsed;
}

export function githubOutputs(result) {
  return [...checks, 'docs_only', 'base', 'head', 'changed_files', 'changed_paths']
    .map(key => `${key}=${result[key]}\n`).join('');
}

export function summary(result) {
  return '### Monorepo CI changes\n\n' +
    `Compared commits: \`${result.base}\` → \`${result.head}\`. Files: ${result.changed_files}; paths: ${result.changed_paths}.\n\n` +
    '| Check | Required | Reasons |\n| --- | --- | --- |\n' +
    checks.map(check => `| ${check} | ${result[check]} | ${result.reasons[check].join(', ') || 'none'} |\n`).join('');
}

function main() {
  try {
    const { githubOutput, summary: summaryFile, ...options } = parseArguments(process.argv.slice(2));
    const result = classifyChanges(options);
    // No output is appended until all refs, trees, dependencies and the full diff are verified.
    if (githubOutput) appendFileSync(githubOutput, githubOutputs(result), { encoding: 'utf8' });
    if (summaryFile) appendFileSync(summaryFile, summary(result), { encoding: 'utf8' });
    console.log(JSON.stringify(result));
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'classification_failed';
    console.error(JSON.stringify({ schema_version: 1, status: 'failed', error: code }));
    process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
