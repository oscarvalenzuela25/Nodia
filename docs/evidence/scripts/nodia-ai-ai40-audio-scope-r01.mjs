// Pure code/policy fingerprint only. No runtime, account, model discovery or CLI process.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [root, pin] = process.argv.slice(2);
assert.match(root, /^\/opt\/nodia\/verification\/ai40-audio-candidate-r[0-9]{2}\/server$/u);
assert.match(pin, /^[a-f0-9]{64}$/u);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = readFileSync(root + '/../candidate-manifest.json');
assert.equal(sha(manifestBytes), pin);
const manifest = JSON.parse(manifestBytes);
for (const [name, pin] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(root + '/' + name)), pin);
createRequire(root + '/package.json')('reflect-metadata');
const { codexChatRuntimeFingerprint: fingerprint } = await import(pathToFileURL(root + '/dist/common/ai/codex/codex-chat-acceptance.js'));
const { ValidateNodiaAiRuntimePolicyUseCase: Validate } = await import(pathToFileURL(root + '/dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js'));
const executable = '/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex';
const binarySha = sha(readFileSync(executable));
assert.equal(binarySha, '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c');
const rawPolicy = readFileSync(root + '/dist/nodia-ai-runtime/config/runtime-policy.json');
const policy = new Validate().execute(JSON.parse(rawPolicy));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const base = await fingerprint(executable);
console.log(JSON.stringify({ schema: 'nodia-ai-ai40-audio-candidate-scope-v1', status: 'passed',
  candidate_root: root, candidate_manifest_sha256: sha(manifestBytes), files_verified: Object.keys(manifest.files).length,
  native_binary_sha256: binarySha, node: process.version, v8: process.versions.v8, platform: process.platform,
  architecture: process.arch, runtime_base_fingerprint: base,
  runtime_fingerprint: sha(base + JSON.stringify(canonical(policy))), runtime_policy_asset_sha256: sha(rawPolicy),
  validated_policy_sha256: sha(JSON.stringify(canonical(policy))),
  fingerprint_implementation_sha256: manifest.files['dist/common/ai/codex/codex-chat-acceptance.js'],
  source_sha256: sha(readFileSync(process.argv[1])), provider_observations: 0, provider_generations: 0,
  operational_profile_reads: 0, services_changed: false }));
