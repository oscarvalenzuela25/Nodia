// Actual encrypted CAS against an exclusive synthetic recovery namespace.
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadNodiaAiExternalRecoveryConfig, createNodiaAiExternalRecovery } from '/opt/nodia/releases/nodia-server-ai38-journal-r01/dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js';
const require = createRequire('/opt/nodia/releases/nodia-server-ai38-journal-r01/package.json');
const { GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const config = { ...loadNodiaAiExternalRecoveryConfig('/etc/nodia-ai-recovery/recovery.json'),
  deployment_id: 'ai38-cas-' + randomUUID().slice(0, 12), era_id: randomUUID() };
const first = createNodiaAiExternalRecovery(config), second = createNodiaAiExternalRecovery(config);
const key = `${first.prefix}/state.bin`;
const signal = AbortSignal.timeout(45000);
const checks = {};
let existed = false;
try {
  await first.store.initialize(); existed = true;
  try { await second.store.initialize(); checks.reset_refused = false; }
  catch { checks.reset_refused = true; }
  const conversation_id = randomUUID(), preference_id = randomUUID();
  await Promise.all([
    first.store.recordResources({ deleted_at: new Date().toISOString(), resources: [{ kind: 'conversation', conversation_id, storage_generations: [] }] }),
    second.store.recordResources({ deleted_at: new Date().toISOString(), resources: [{ kind: 'preference', preference_id }] }),
  ]);
  const observed = await first.store.snapshot();
  checks.concurrent_resources_preserved = observed.state.entries.length === 2 && observed.state.last_sequence === 2;
  checks.sequence_contiguous = observed.state.entries.every((entry, index) => entry.sequence === index + 1);
  try { await first.store.catalog.checkpoint(); checks.pending_blocks_backup = false; }
  catch { checks.pending_blocks_backup = true; }
  await first.store.confirmResources([{ kind: 'conversation', conversation_id, storage_generations: [] }, { kind: 'preference', preference_id }]);
  checks.confirmed_checkpoint = (await second.store.catalog.checkpoint()).sequence === 2;
  const raw = await first.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: signal });
  const encrypted = Buffer.from(await raw.Body.transformToByteArray());
  checks.no_plaintext_identifiers = !encrypted.includes(Buffer.from(conversation_id)) && !encrypted.includes(Buffer.from(preference_id));
  const wrong = createNodiaAiExternalRecovery({ ...config, journal_encryption_key: Buffer.alloc(32, 8).toString('base64') });
  try { await wrong.store.snapshot(); checks.wrong_key_rejected = false; }
  catch { checks.wrong_key_rejected = true; }
  finally { wrong.client.destroy(); }
  await first.store.closeEra();
  try { await second.store.catalog.checkpoint(); checks.closed_era_blocks_backup = false; }
  catch { checks.closed_era_blocks_backup = true; }
  await first.client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: signal });
  try { await first.client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: signal }); checks.own_namespace_removed = false; }
  catch (error) { checks.own_namespace_removed = error?.$metadata?.httpStatusCode === 404; }
  existed = !checks.own_namespace_removed;
  process.stdout.write(JSON.stringify({ stage: 'AI-38', scope: 'two_real_R2_clients_encrypted_synthetic_CAS_no_application_SQL',
    observed_at_VM_utc: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks, owned_object_retained: existed, configured_SQL_writes: 0, provider_requests: 0, release_authorized: false }) + '\n');
  if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
} catch {
  process.stdout.write(JSON.stringify({ stage: 'AI-38', status: 'failed', checks, owned_object_retained: existed, private_details_emitted: false }) + '\n');
  process.exitCode = 1;
} finally { first.client.destroy(); second.client.destroy(); }
