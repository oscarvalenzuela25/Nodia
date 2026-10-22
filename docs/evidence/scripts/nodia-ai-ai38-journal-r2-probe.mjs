// Synthetic exact-key R2 transport checks. No bucket listing or application data.
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire('/opt/nodia/releases/nodia-server-ai15-20261016/package.json');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { config } = require('dotenv');
config({ path: '/opt/nodia/releases/nodia-server-ai15-20261016/.env', quiet: true });
const bucket = process.env.R2_BUCKET_NAME;
const client = new S3Client({ region: 'auto', endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  requestHandler: { connectionTimeout: 1000, requestTimeout: 5000 } });
const key = `nodia-ai-recovery/ai38-probe-${randomUUID()}/probe.bin`;
const signal = AbortSignal.timeout(45000);
const send = command => client.send(command, { abortSignal: signal });
const code = error => error?.$metadata?.httpStatusCode;
const body = Buffer.from('Nodia AI-38 synthetic conditional transport probe.');
const checks = {};
let retained = false;
try {
  const first = await send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, IfNoneMatch: '*' }));
  retained = true;
  checks.initial_conditional_PUT = Boolean(first.ETag);
  try { await send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, IfNoneMatch: '*' })); checks.duplicate_create_rejected = false; }
  catch (error) { checks.duplicate_create_rejected = code(error) === 412; }
  try { await send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, IfMatch: '"incorrect-ai38-etag"' })); checks.stale_CAS_rejected = false; }
  catch (error) { checks.stale_CAS_rejected = code(error) === 412; }
  try { await send(new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: '"incorrect-ai38-etag"' })); checks.stale_GET_rejected = false; }
  catch (error) { checks.stale_GET_rejected = code(error) === 412; }
  try { await send(new DeleteObjectCommand({ Bucket: bucket, Key: key, IfMatch: '"incorrect-ai38-etag"' })); checks.stale_DELETE_rejected = false; }
  catch (error) { checks.stale_DELETE_rejected = code(error) === 412; }
  let head;
  try { head = await send(new HeadObjectCommand({ Bucket: bucket, Key: key })); checks.object_intact_after_wrong_delete = head.ContentLength === body.length; }
  catch { checks.object_intact_after_wrong_delete = false; }
  if (head) {
    const object = await send(new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: head.ETag }));
    const bytes = await object.Body.transformToByteArray();
    checks.digest_intact = createHash('sha256').update(bytes).digest('hex') === createHash('sha256').update(body).digest('hex');
    await send(new DeleteObjectCommand({ Bucket: bucket, Key: key, IfMatch: head.ETag }));
  }
  try { await send(new HeadObjectCommand({ Bucket: bucket, Key: key })); checks.owned_object_absent = false; }
  catch (error) { checks.owned_object_absent = code(error) === 404; }
  retained = !checks.owned_object_absent;
  process.stdout.write(JSON.stringify({ stage: 'AI-38', observed_at_VM_utc: new Date().toISOString(),
    scope: 'synthetic_single_owned_R2_object_no_domain_or_bucket_listing',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'conditional_transport_not_fully_supported', checks,
    own_object_retained: retained, application_SQL_writes: 0, provider_requests: 0,
    release_authorized: false }) + '\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ stage: 'AI-38', status: 'probe_failed', category: code(error) ?? 'transport', checks,
    own_object_retained: retained, private_details_emitted: false }) + '\n');
  process.exitCode = 1;
} finally { client.destroy(); }
