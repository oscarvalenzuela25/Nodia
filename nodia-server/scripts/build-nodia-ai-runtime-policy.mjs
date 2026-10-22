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
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    args.some((arg) => !['--check', '--prepare'].includes(arg))
  )
    throw Error();
  const bytes = fs.readFileSync(
    path.join(root, 'docs/mvp/nodia-ai-v1-runtime-policy.json'),
  );
  const policy = JSON.parse(bytes.toString('utf8'));
  validatePolicy(policy);
  const schema = JSON.parse(
    fs.readFileSync(
      path.join(root, 'docs/mvp/nodia-ai-v1-runtime-policy.schema.json'),
      'utf8',
    ),
  );
  const payload = {
    schema_version: 1,
    policyHash: createHash('sha256').update(bytes).digest('hex'),
    policy,
    schema,
  };
  const asset = {
    ...payload,
    contentHash: createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex'),
  };
  if (!args.includes('--check')) {
    const destination = path.join(
      root,
      args.includes('--prepare')
        ? 'nodia-server/src/nodia-ai-runtime/config'
        : 'nodia-server/dist/nodia-ai-runtime/config',
    );
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(
      path.join(destination, 'runtime-policy.json'),
      JSON.stringify(asset) + '\n',
    );
  }
  console.log(
    JSON.stringify({
      task: 'AI-11',
      policy: policy.policy_version,
      policyHash: payload.policyHash,
      emitted: !args.includes('--check'),
    }),
  );
} catch {
  console.error(
    JSON.stringify({ task: 'AI-11', error: 'runtime_policy_build_failed' }),
  );
  process.exitCode = 1;
}
