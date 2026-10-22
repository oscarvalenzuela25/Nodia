// Real compiled storage/adapter and AWS SDK against localhost HTTP only.
// Synthetic credentials/objects; no R2, database, user files or provider calls.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const attempts = new Map();
const objects = new Map();
const received = new Map();
const payload = Buffer.from('synthetic immutable attachment bytes');
let acceptAbort;
const abortAccepted = new Promise(resolve => { acceptAbort = resolve; });
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const server = createServer(async (request, response) => {
  const key = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/synthetic-bucket\//, '');
  const identity = `${request.method}:${key}`;
  attempts.set(identity, (attempts.get(identity) ?? 0) + 1);
  const count = attempts.get(identity);
  if (request.method === 'PUT') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const data = Buffer.concat(chunks);
    objects.set(key, data);
    received.set(key, { data, mediaType: request.headers['content-type'] });
    if (key === 'abort-active') { acceptAbort(); return; }
    if (key.startsWith('uncertain') || (key === 'native-retry' && count < 3)) {
      response.writeHead(503, { 'Content-Type': 'application/xml' });
      response.end('<Error><Code>ServiceUnavailable</Code><Message>synthetic-private-upstream-error</Message></Error>');
      return;
    }
    response.writeHead(200, { ETag: '"synthetic"' });
    response.end();
    return;
  }
  if ((request.method === 'GET' || request.method === 'DELETE') && count < 3) {
    response.writeHead(503, { 'Content-Type': 'application/xml' });
    response.end('<Error><Code>ServiceUnavailable</Code></Error>');
    return;
  }
  if (request.method === 'GET') {
    response.writeHead(200, { 'Content-Length': payload.byteLength });
    response.end(payload);
    return;
  }
  if (request.method === 'DELETE') {
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(405);
  response.end();
});

let storage;
let folder;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, {
    R2_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
    R2_ACCOUNT_ID: 'synthetic', R2_ACCESS_KEY_ID: 'synthetic', R2_SECRET_ACCESS_KEY: 'synthetic',
    R2_BUCKET_NAME: 'synthetic-bucket', AWS_MAX_ATTEMPTS: '3', AWS_RETRY_MODE: 'standard',
  });
  const { StorageService } = await import('../dist/common/storage/storage.service.js');
  const { StorageNodiaAiAttachment } = await import('../dist/nodia-ai-attachment/adapters/storage-nodia-ai-attachment.js');
  storage = new StorageService();
  const normal = Reflect.get(storage, 's3Client');
  const once = Reflect.get(storage, 'singleAttemptS3Client');
  check('separate reusable clients retain exact endpoint credentials and checksum configuration',
    normal !== once && JSON.stringify(await normal.config.endpoint()) === JSON.stringify(await once.config.endpoint()) &&
    JSON.stringify(await normal.config.credentials()) === JSON.stringify(await once.config.credentials()) &&
    await normal.config.requestChecksumCalculation() === await once.config.requestChecksumCalculation() &&
    await normal.config.responseChecksumValidation() === await once.config.responseChecksumValidation());
  check('NodiaAI explicitly overrides the environment retry count while the normal client preserves it',
    await once.config.maxAttempts() === 1 && await normal.config.maxAttempts() === 3);

  const safeFailure = error => error.getStatus?.() === 500 && error.message === 'Failed to upload file to storage.';
  await assert.rejects(() => storage.uploadFileOnce('uncertain-once', payload, 'audio/webm'), safeFailure);
  check('a PUT persisted before a 503 response is not resent and preserves exact bytes MIME and key',
    attempts.get('PUT:uncertain-once') === 1 && objects.get('uncertain-once').equals(payload) &&
    received.get('uncertain-once').mediaType === 'audio/webm');
  check('a successful single-attempt call returns the same key and reuses its client',
    await storage.uploadFileOnce('success', payload, 'audio/ogg') === 'success' &&
    attempts.get('PUT:success') === 1 && received.get('success').data.equals(payload) &&
    received.get('success').mediaType === 'audio/ogg' && Reflect.get(storage, 'singleAttemptS3Client') === once);

  folder = await mkdtemp(join(tmpdir(), 'nodia-ai-storage-retry-'));
  const file = join(folder, 'synthetic-upload');
  await writeFile(file, payload, { mode: 0o600 });
  const adapter = new StorageNodiaAiAttachment(storage);
  await assert.rejects(() => adapter.put('uncertain-adapter', file, 'audio/webm', new AbortController().signal), safeFailure);
  check('the actual NodiaAI adapter selects the single-attempt path',
    attempts.get('PUT:uncertain-adapter') === 1 && received.get('uncertain-adapter').data.equals(payload));

  const before = attempts.size;
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  await assert.rejects(() => storage.uploadFileOnce('abort-before', payload, 'audio/webm', alreadyAborted.signal), safeFailure);
  check('an already aborted upload never reaches the HTTP transport', attempts.size === before);
  const controller = new AbortController();
  const pending = storage.uploadFileOnce('abort-active', payload, 'audio/webm', AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
  // Attach rejection handling before aborting, without waiting on an arbitrary sleep.
  const rejected = assert.rejects(pending, safeFailure);
  let requestDeadline;
  try {
    await Promise.race([abortAccepted, new Promise((_, reject) => {
      requestDeadline = setTimeout(() => reject(new Error('Synthetic transport did not receive the active upload')), 15000);
    })]);
  } finally { clearTimeout(requestDeadline); }
  controller.abort();
  await rejected;
  check('abort after persistence stops the request without a replay', attempts.get('PUT:abort-active') === 1);

  await storage.uploadFile('native-retry', payload, 'application/pdf');
  check('existing native invoice uploads retain the normal SDK retry policy', attempts.get('PUT:native-retry') === 3);
  const downloaded = await storage.downloadFile('read-retry', payload.byteLength, AbortSignal.timeout(15000));
  check('bounded GET retains its existing retry policy and returns exact bytes',
    attempts.get('GET:read-retry') === 3 && downloaded.equals(payload));
  await storage.deleteFile('delete-retry');
  check('idempotent DELETE retains its existing retry policy', attempts.get('DELETE:delete-retry') === 3);

  const { envs } = await import('../dist/config/envs.config.js');
  envs.R2_ACCESS_KEY_ID = '';
  const missing = new StorageService();
  await assert.rejects(() => missing.uploadFileOnce('unconfigured', payload, 'audio/webm'),
    error => error.getStatus?.() === 500 && error.message === 'Storage service is not configured. Missing R2 credentials.');
  check('an unconfigured single-attempt path fails closed without a request', !attempts.has('PUT:unconfigured'));
  missing.onModuleDestroy();

  let closes = 0;
  for (const client of [normal, once]) {
    const destroy = client.destroy.bind(client);
    client.destroy = () => { closes++; destroy(); };
  }
  storage.onModuleDestroy();
  storage = null;
  check('module shutdown closes both reusable SDK clients', closes === 2);
  console.log(JSON.stringify({ stage: 'AI-32-R05', scope: 'compiled_storage_and_sdk_localhost_synthetic_http',
    status: 'passed', checks: checks.length, provider_generations: 0, real_storage_calls: 0, database_writes: 0,
    single_attempt_uncertain_put_requests: attempts.get('PUT:uncertain-once'),
    adapter_uncertain_put_requests: attempts.get('PUT:uncertain-adapter'), native_upload_requests: attempts.get('PUT:native-retry'),
    get_requests: attempts.get('GET:read-retry'), delete_requests: attempts.get('DELETE:delete-retry'),
    synthetic_payload_sha256: createHash('sha256').update(payload).digest('hex'), raw_response_stored: false }));
} finally {
  storage?.onModuleDestroy();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  if (folder) await rm(folder, { recursive: true, force: true });
}
