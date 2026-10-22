// Build-time validation only; no app, database, provider, or runtime service starts here.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const {
  validatePolicy,
} = require('../../docs/evidence/scripts/validate-nodia-ai-ai04.cjs');
try {
  if (
    process.argv
      .slice(2)
      .some((arg) => !['--check', '--prepare'].includes(arg)) ||
    process.argv.length > 3
  )
    throw Error();
  const bytes = fs.readFileSync(
    path.join(root, 'docs/mvp/nodia-ai-v1-runtime-policy.json'),
  );
  const policy = JSON.parse(bytes.toString('utf8'));
  validatePolicy(policy);
  const payload = {
    schema_version: 1,
    policyVersion: policy.policy_version,
    policyHash: createHash('sha256').update(bytes).digest('hex'),
    retentionDays: policy.retention.chat_days,
    titleUtf8Bytes: policy.admission.title_utf8_bytes,
  };
  const asset = {
    ...payload,
    contentHash: createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex'),
  };
  if (!process.argv.includes('--check')) {
    const destination = path.join(
      root,
      process.argv.includes('--prepare')
        ? 'nodia-server/src/nodia-ai-conversation/config'
        : 'nodia-server/dist/nodia-ai-conversation/config',
    );
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(
      path.join(destination, 'conversation-policy.json'),
      JSON.stringify(asset) + '\n',
    );
  }
  console.log(
    JSON.stringify({
      task: 'AI-09',
      policy: payload.policyVersion,
      policyHash: payload.policyHash,
      emitted: !process.argv.includes('--check'),
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      task: 'AI-09',
      error: 'conversation_policy_build_failed',
    }),
  );
  process.exitCode = 1;
}
