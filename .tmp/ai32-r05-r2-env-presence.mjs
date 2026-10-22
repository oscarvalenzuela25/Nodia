/** Presence/placeholder projection only. Never exports credentials or locations. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('missing_option');
  return args[index + 1];
};
const runtime = path.resolve(option('--runtime-root'));
const envPath = path.resolve(option('--env'));
const label = option('--label');
if (!['local', 'vm'].includes(label)) throw new Error('invalid_scope');
const require = createRequire(path.join(runtime, 'package.json'));
const { parse } = require('dotenv');
const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT'];
const required = keys.slice(0, 4);
const placeholder = /(?:\b(?:your|example|placeholder|changeme|change_me|replace_me|todo|pending|not_configured)\b|(?:^|[_-])(?:your|example|placeholder|changeme|change_me|replace_me|todo|pending|not_configured)(?:$|[_-])|\$\{|^<[^>]+>$|^x{3,}$|^0+$)/i;
let present = false;
let parsed = {};
if (fs.existsSync(envPath)) {
  const stat = fs.statSync(envPath);
  if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('invalid_environment_file');
  parsed = parse(fs.readFileSync(envPath));
  present = true;
}
const fields = {};
for (const key of keys) {
  const value = parsed[key];
  const text = typeof value === 'string' ? value.trim() : '';
  fields[key] = { state: !Object.hasOwn(parsed, key) ? 'absent' : !text ? 'empty'
    : placeholder.test(text) ? 'placeholder' : 'non_placeholder_candidate' };
}
const candidates = required.every((key) => fields[key].state === 'non_placeholder_candidate');
const report = { stage: 'AI-32-R05', scope: 'r2_configuration_presence_only', location: label,
  observed_at_utc: new Date().toISOString(), environment_file_present: present, fields,
  all_required_non_placeholder_candidates: candidates,
  credential_validity_verified: false, endpoint_or_bucket_values_exported: false,
  credential_values_or_fingerprints_exported: false, provider_calls: 0,
  configuration_modified: false, services_restarted: false };
console.log(JSON.stringify(report, null, 2));
