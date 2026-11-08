import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { ApiProviderService } from '../dist/common/ai/api-provider.service.js';

// Explicit operator invocation only. Credentials stay in stdin/process memory, never argv/env/files/logs.
let bytes = 0;
const chunks = [];
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 12 * 1024 * 1024) throw new Error('smoke_input_limit');
  chunks.push(chunk);
}
let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (
    !['openai', 'gemini'].includes(input.provider) ||
    typeof input.secret !== 'string' ||
    !input.secret.trim() ||
    typeof input.model !== 'string' ||
    !input.model.trim() ||
    typeof input.file_base64 !== 'string' ||
    !['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(
      input.mime,
    )
  )
    throw new Error();
} catch {
  process.stdout.write(
    JSON.stringify({
      success: false,
      phase: 'input',
      code: 'invalid_smoke_input',
    }) + '\n',
  );
  process.exit(1);
}
const provider = input.provider,
  model = input.model;
let phase = 'discovery';
let logicalInferencePosts = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (resource, options) => {
  if (options?.method === 'POST') logicalInferencePosts++;
  return originalFetch(resource, options);
};
try {
  const api = new ApiProviderService();
  const models = await api.listModels(provider, input.secret);
  if (!models.some((item) => item.id === model))
    throw new Error('model_not_discovered');
  phase = 'inference';
  const buffer = Buffer.from(input.file_base64, 'base64');
  if (!buffer.length || buffer.length > 8 * 1024 * 1024)
    throw new Error('invalid_fixture_size');
  const result = await api.extractInvoice(
    provider,
    input.secret,
    model,
    buffer,
    input.mime,
    undefined,
    19,
    AbortSignal.timeout(90000),
    input.thinking_level,
  );
  const checks = Object.entries(input.expected ?? {}).map(
    ([path, expected]) => {
      let current = result;
      for (const key of path.split('.')) {
        if (
          current === null ||
          typeof current !== 'object' ||
          !Object.hasOwn(current, key)
        )
          return false;
        current = current[key];
      }
      return current === expected;
    },
  );
  if (checks.some((value) => !value))
    throw new Error('fixture_expectation_failed');
  process.stdout.write(
    JSON.stringify({
      success: true,
      provider,
      mode: 'api_key',
      model,
      discovered: true,
      completed_and_schema_valid: true,
      items: result.items.length,
      fixture_checks: checks.length,
      result_sha256: createHash('sha256')
        .update(JSON.stringify(result))
        .digest('hex'),
      inference_calls: logicalInferencePosts,
      inference_retries: 0,
      usage: null,
      scope:
        'real API discovery/extraction; does not attest DB encryption, UI or NodiaAI chat',
    }) + '\n',
  );
} catch (error) {
  const body =
    typeof error?.getResponse === 'function' ? error.getResponse() : null;
  process.stdout.write(
    JSON.stringify({
      success: false,
      provider,
      mode: 'api_key',
      model,
      phase,
      status: typeof error?.getStatus === 'function' ? error.getStatus() : null,
      upstream_status:
        typeof body?.upstream_status === 'number' ? body.upstream_status : null,
      code: [
        'model_not_discovered',
        'fixture_expectation_failed',
        'invalid_fixture_size',
      ].includes(error?.message)
        ? error.message
        : 'api_smoke_failed',
      logical_inference_posts: logicalInferencePosts,
      inference_retries: 0,
      usage: null,
    }) + '\n',
  );
  process.exitCode = 1;
} finally {
  input.secret = '';
  chunks.fill(null);
  globalThis.fetch = originalFetch;
}
