// Same acceptance cases as the frozen SQL harness below, with the real encrypted R2 journal transport.
// Base SHA256: 8e05a5ffa829867419fa4ab8135b264890b50d37dadd8d17e0e31b790cdbc4e9.
// PostgreSQL/pg_dump/pg_restore remain disposable; business object deletion is synthetic.
// No production SQL, AppModule, inference, bucket listing, or business object R2 calls.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, lstat, realpath, writeFile, unlink } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { Readable } from 'node:stream';
import { GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createNodiaAiExternalRecovery, loadNodiaAiExternalRecoveryConfig } from '../dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js';
import { DataSource } from 'typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai38');
const { db, options, identities } = fixture;
const checks = [], started = Date.now();
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); };
const hash = value => createHash('sha256').update(value).digest('hex');
let restored, liveExternal, liveConfig, ledgerPath, result, runError;
let initialized = false, ledgerCreated = false;
const missing = error => error?.$metadata?.httpStatusCode === 404;
const safeError = error => error instanceof Error && /^nodia_ai:[a-z0-9_]{1,100}$/u.test(error.message) ? error.message : 'nodia_ai:combined_verification_failed';
async function ledger(status) {
  assert.ok(ledgerPath && liveConfig && (status === 'before_initialize' || ledgerCreated));
  await writeFile(ledgerPath, JSON.stringify({ schema_version: 1, deployment_id: liveConfig.deployment_id, era_id: liveConfig.era_id, state_key: `${liveExternal.prefix}/state.bin`, initialized, status, passed_checks: checks.length }) + '\n', { mode: 0o600, flag: status === 'before_initialize' ? 'wx' : 'w' });
  ledgerCreated = true;
}
async function cleanupOwnedJournal() {
      await liveExternal.store.closeEra();
      const state = (await liveExternal.store.snapshot()).state;
      assert.equal(state.era_id, liveConfig.era_id);
      assert.notEqual(state.closed_at, null);
      assert.equal(state.backups.length, 0);
      assert.ok(state.entries.every(entry => entry.confirmed_at !== null));
      await ledger('closed_verified_before_cleanup');
      const key = `${liveExternal.prefix}/state.bin`;
      const signal = AbortSignal.timeout(15000);
      const head = await liveExternal.client.send(new HeadObjectCommand({ Bucket: liveConfig.bucket, Key: key }), { abortSignal: signal });
      assert.equal(head.VersionId ?? null, null, 'versioned state is not owned by this cleanup');
      assert.ok(head.ETag && Number.isSafeInteger(head.ContentLength) && head.ContentLength > 28 && head.ContentLength <= 8 * 1024 * 1024 + 28);
      const object = await liveExternal.client.send(new GetObjectCommand({ Bucket: liveConfig.bucket, Key: key, IfMatch: head.ETag }), { abortSignal: signal });
      assert.ok(object.Body instanceof Readable);
      assert.equal(object.ETag, head.ETag); assert.equal(object.ContentLength, head.ContentLength);
      const cipherHash = createHash('sha256'); let cipherBytes = 0;
      try {
        for await (const part of object.Body) {
          signal.throwIfAborted(); cipherBytes += part.byteLength;
          if (cipherBytes > 8 * 1024 * 1024 + 28) throw Error('nodia_ai:combined_state_capacity');
          cipherHash.update(part);
        }
      } finally { object.Body.destroy(); }
      assert.equal(cipherBytes, head.ContentLength);
      // R2 does not enforce DELETE If-Match here. Cleanup is limited to this
      // exclusive test prefix/era, ledger, closed writer and positively read key.
      // There is exactly one DELETE attempt; a lost ACK is reconciled by HEAD.
      let deleteAcknowledged = false;
      try {
        await liveExternal.client.send(new DeleteObjectCommand({ Bucket: liveConfig.bucket, Key: key }), { abortSignal: signal });
        deleteAcknowledged = true;
      } catch { /* Exact-key HEAD below determines observed absence, not a retry. */ }
      let absent = false;
      try { await liveExternal.client.send(new HeadObjectCommand({ Bucket: liveConfig.bucket, Key: key }), { abortSignal: signal }); }
      catch (error) { if (missing(error)) absent = true; else throw error; }
      assert.equal(absent, true, 'owned state absence must be confirmed');
      await ledger('owned_state_absent');
      await unlink(ledgerPath);
      ledgerCreated = false;
      return {
        ...result,
        stage: 'AI-38-journal-combined-real-R2',
        acceptance_cases_reused_from: 'nodia-ai-ai38-journal.integration.mjs',
        acceptance_source_sha256: '8e05a5ffa829867419fa4ab8135b264890b50d37dadd8d17e0e31b790cdbc4e9',
        acceptance_cases_are_new: false,
        external_storage: 'real encrypted CAS journal through configured R2 factory; business deletion port remains synthetic',
        journal_cleanup: { era_closed: true, positive_head_get: true, cipher_bytes: cipherBytes, cipher_sha256: cipherHash.digest('hex'), delete_requests: 1, delete_acknowledged: deleteAcknowledged, conditional_delete_enforced: false, exclusive_owned_test_namespace: true, head_after_delete: 404, private_ledger_removed: true, bucket_list_requests: 0 },
        operational_database_writes: 0,
        scope: 'disposable PostgreSQL and real R2 journal only; no production SQL, business object R2, provider or inference; source preference deletion is controlled SQL',
      };
}

try {
  const names = [
    ['nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase'],
    ['nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService'],
    ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase'],
    ['nodia-ai-attachment/nodia-ai-attachment.service', 'NodiaAiAttachmentService'],
    ['nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService'],
    ['nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case', 'CleanupNodiaAiAttachmentsUseCase'],
    ['nodia-ai-recovery/use-case/prepare-nodia-ai-restore.use-case', 'PrepareNodiaAiRestoreUseCase'],
    ['nodia-ai-recovery/use-case/validate-nodia-ai-restore.use-case', 'ValidateNodiaAiRestoreUseCase'],
    ['nodia-ai-recovery/types/deletion-journal', 'DisabledNodiaAiDeletionJournal'],
    ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case', 'AuthorizeNodiaAiConversationUseCase'],
    ['nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case', 'ManageNodiaAiAttachmentUseCase'],
  ];
  const [ValidatePolicy, Conversations, Expire, Attachments, Runtime, Cleanup, Prepare, ValidateRestore, Disabled, AuthStore, Authorize, ConversationAccess, ManageAttachment] = await Promise.all(names.map(([file, name]) => loadAi(file, name)));
  const policy = new ValidatePolicy().execute(JSON.parse(await readFile(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')));
  const clock = async source => new Date((await source.query('SELECT clock_timestamp() AS now'))[0].now);
  if (process.platform !== 'linux' || process.getuid() !== 0) throw Error('nodia_ai:combined_linux_root_required');
  const configPath = process.env.NODIA_AI_JOURNAL_TEST_CONFIG;
  if (!configPath || !isAbsolute(configPath) || await realpath(configPath) !== configPath) throw Error('nodia_ai:combined_config_invalid');
  const configInfo = await lstat(configPath);
  if (!configInfo.isFile() || configInfo.isSymbolicLink() || configInfo.nlink !== 1 || configInfo.uid !== 0 || (configInfo.mode & 0o777) !== 0o600) throw Error('nodia_ai:combined_config_invalid');
  liveConfig = loadNodiaAiExternalRecoveryConfig(configPath);
  if (liveConfig.deployment_id !== 'ai38-combined-r01') throw Error('nodia_ai:combined_namespace_invalid');
  liveExternal = createNodiaAiExternalRecovery(liveConfig);
  const external = liveExternal.store;
  ledgerPath = configPath + '.combined-ledger.json';
  await ledger('before_initialize');
  await external.initialize();
  initialized = true;
  await ledger('initialized');
  let afterRecord;
  const unlocked = async () => {
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
    try {
      await runner.query("SET LOCAL lock_timeout='100ms'");
      await runner.query('LOCK TABLE users IN ACCESS EXCLUSIVE MODE NOWAIT');
      const [result] = await runner.query("SELECT pg_try_advisory_xact_lock(hashtext('nodia-ai:foreground-admission')) AS available");
      assert.equal(result.available, true, 'external I/O must run outside the queue/authority transaction');
    } finally { await runner.rollbackTransaction(); await runner.release(); }
  };
  const journal = {
    enabled: true,
    async recordDeletions(input) {
      await unlocked(); await external.recordDeletions(input);
      const next = afterRecord; afterRecord = undefined; if (next) await next();
    },
    async recordResources(input) { await unlocked(); await external.recordResources(input); },
    async assertResourcesRecorded(resources) { await unlocked(); await external.assertResourcesRecorded(resources); },
    async confirmResources(resources) { await unlocked(); await external.confirmResources(resources); },
  };
  const conversations = new Conversations(db), attachments = new Attachments(db, policy);
  const expire = new Expire(conversations, policy, attachments, journal);
  const deletedObjects = [];
  const storage = { async delete(key) { await unlocked(); deletedObjects.push(key); } };
  const cleanup = new Cleanup(new Runtime(db), storage, policy, journal);
  const count = async (source, table, id) => Number((await source.query(`SELECT count(*)::int n FROM ${table} WHERE id=$1`, [id]))[0].n);
  async function chat(expired = false) {
    const id = randomUUID();
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at) VALUES($1,1,$2,'Synthetic AI38 journal',$3,clock_timestamp()+$4*interval '1 second')", [id, randomUUID(), hash(id), expired ? -10 : 86400]);
    return id;
  }
  async function attachment(chatId, state = 'rejected') {
    const id = randomUUID(), generation = randomUUID(), key = `nodia-ai/${chatId}/${id}/${generation}`;
    await db.query(`INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,interpretation_text,interpretation_revision,interpretation_reviewed,interpretation_origin,expires_at)
      VALUES($1,$2,$3,$4,1,'pdf',$5,'synthetic.pdf',$6,$7,4,4,'application/pdf',$4,'Synthetic private derivative',1,true,'user_reviewed',clock_timestamp()+interval '1 day')`, [id, chatId, randomUUID(), hash(id), state, key, generation]);
    return { id, generation, key, chatId };
  }
  async function drain(sourceCleanup = cleanup, source = db) {
    for (let i = 0; i < 20; i++) {
      const ids = await source.query("SELECT id FROM nodia_ai_jobs WHERE kind='delete_blob' AND stage_key='attachment_cleanup' ORDER BY id");
      if (!ids.length) return;
      for (const { id } of ids) assert.equal((await sourceCleanup.execute(id, true)).settled, 1);
    }
    throw Error('synthetic cleanup did not settle');
  }

  const racedChat = await chat(true), firstGeneration = await attachment(racedChat);
  let addedGeneration;
  afterRecord = async () => { addedGeneration = await attachment(racedChat); };
  await assert.rejects(expire.execute(), /deletion_journal_generation_changed/u);
  check('generation changed after journal append prevents SQL chat deletion', await count(db, 'nodia_ai_conversations', racedChat) === 1);
  check('generation mismatch does not queue a destructive partial purge', Number((await db.query('SELECT count(*)::int n FROM nodia_ai_jobs WHERE conversation_id=$1', [racedChat]))[0].n) === 0);
  assert.equal((await expire.execute()).purged_chats, 1);
  const raceEntries = (await external.snapshot()).state.entries.filter(entry => entry.kind === 'conversation' && entry.conversation_id === racedChat);
  check('retry merges changed generation snapshot into one conversation identity', raceEntries.length === 1 && [firstGeneration.generation, addedGeneration.generation].every(generation => raceEntries[0].storage_generations.includes(generation)));
  await drain();
  check('both generation cleanup witnesses settle without replay or SQL leftovers', deletedObjects.includes(firstGeneration.key) && deletedObjects.includes(addedGeneration.key));

  const rollbackChat = await chat(true);
  const realTransaction = conversations.transaction.bind(conversations);
  let transactionCount = 0;
  conversations.transaction = work => realTransaction(async manager => {
    const value = await work(manager);
    if (++transactionCount === 2) throw Error('synthetic SQL commit rejected');
    return value;
  });
  await assert.rejects(expire.execute(), /synthetic SQL commit rejected/u);
  conversations.transaction = realTransaction;
  check('external intent survives actual SQL transaction rollback', await count(db, 'nodia_ai_conversations', rollbackChat) === 1 && (await external.snapshot()).state.entries.some(entry => entry.kind === 'conversation' && entry.conversation_id === rollbackChat && entry.confirmed_at === null));
  await assert.rejects(external.catalog.checkpoint(), /unconfirmed_deletions/u);
  check('unconfirmed rollback blocks new backup checkpoint');
  assert.equal((await expire.execute()).purged_chats, 1);
  check('retry removes rolled-back chat once and confirms original intent', (await external.snapshot()).state.entries.filter(entry => entry.kind === 'conversation' && entry.conversation_id === rollbackChat).length === 1);

  const keepChat = await chat(), dropChat = await chat(), keepAttachment = await attachment(keepChat, 'ready');
  const boundDropAttachment = await attachment(dropChat, 'ready'), dropMessage = randomUUID();
  await db.transaction(async manager => {
    await manager.query('UPDATE nodia_ai_conversations SET next_message_seq=1 WHERE id=$1', [dropChat]);
    await manager.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed','{}',clock_timestamp(),$4)", [dropMessage, dropChat, randomUUID(), hash(dropMessage)]);
    await manager.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text,attachment_id) VALUES($1,$2,0,'pdf','Synthetic bound file',$3)", [dropMessage, dropChat, boundDropAttachment.id]);
  });
  const untouchedChat = await chat(), untouchedAttachment = await attachment(untouchedChat, 'ready');
  const preferenceId = randomUUID(), untouchedPreferenceId = randomUUID();
  for (const [id, key] of [[preferenceId, 'expense_category_id'], [untouchedPreferenceId, 'income_category_id']])
    await db.query("INSERT INTO nodia_ai_preferences(id,owner_id,scope_key,scope_hash,scope,key,value,source_conversation_id) VALUES($1,1,'finance',$2,'{}',$3,'\"7\"',$4)", [id, hash('finance:{}'), key, keepChat]);
  const captured = (await clock(db)).toISOString();
  const container = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim().split('\n').find(name => name.startsWith(`template_ai38_${process.pid}_`));
  assert.ok(container);
  const dump = execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'ai38', '-d', 'ai38', '--format=c', '--no-owner'], { maxBuffer: 64 * 1024 * 1024 });
  const authorize = new Authorize(new AuthStore(db));
  const manage = new ManageAttachment(attachments, new ConversationAccess(conversations, authorize), authorize, storage, policy, journal);
  await manage.discard(identities.get('1'), keepAttachment.id);
  await drain();
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [dropChat]);
  await expire.execute();
  await drain();
  await journal.recordResources({ deleted_at: (await clock(db)).toISOString(), resources: [{ kind: 'preference', preference_id: preferenceId }] });
  await db.query('DELETE FROM nodia_ai_preferences WHERE id=$1', [preferenceId]);
  await journal.confirmResources([{ kind: 'preference', preference_id: preferenceId }]);
  check('source state removes independent attachment and preference while preserving their chat', await count(db, 'nodia_ai_conversations', keepChat) === 1 && await count(db, 'nodia_ai_attachments', keepAttachment.id) === 0 && await count(db, 'nodia_ai_preferences', preferenceId) === 0);
  const targetName = 'nodia_restore_ai38_' + randomUUID().replaceAll('-', '');
  await db.query(`CREATE DATABASE ${targetName}`);
  const restoredProcess = spawnSync('docker', ['exec', '-i', container, 'pg_restore', '-U', 'ai38', '-d', targetName, '--no-owner', '--exit-on-error'], { input: dump, maxBuffer: 1024 * 1024 });
  assert.equal(restoredProcess.status, 0, restoredProcess.stderr.toString());
  restored = await new DataSource({ ...options, database: targetName }).initialize();
  const quarantined = (await clock(restored)).toISOString(), backupId = randomUUID();
  const state = (await external.snapshot()).state;
  check('source journal contains both whole-chat and bound-file generation tombstones', state.entries.some(entry => entry.kind === 'conversation' && entry.conversation_id === dropChat) && state.entries.some(entry => entry.kind === 'attachment' && entry.attachment_id === boundDropAttachment.id));
  const manifest = JSON.stringify({ schema_version: 2, backup_id: backupId, coverage_from: state.coverage_from, coverage_through: quarantined, first_sequence: state.first_sequence, entries: state.entries.map(({ confirmed_at: _confirmed, ...entry }) => entry) });
  const restoreAttachments = new Attachments(restored, policy), disabled = new Disabled();
  const prepare = new Prepare(restored, policy, new Expire(new Conversations(restored), policy, restoreAttachments, disabled), new ValidateRestore(), restoreAttachments);
  const report = await prepare.execute({ operationMode: 'quarantine', backup: { id: backupId, captured_at: captured }, quarantined_at: quarantined, journalHead: { sha256: hash(manifest), last_sequence: state.last_sequence }, manifest });
  check('real dump restore applies conversation v2 tombstone', await count(restored, 'nodia_ai_conversations', dropChat) === 0);
  check('overlapping bound-file tombstone defers to whole-chat cascade instead of conflicting', await count(restored, 'nodia_ai_messages', dropMessage) === 0 && await count(restored, 'nodia_ai_attachments', boundDropAttachment.id) === 0);
  const restoredAttachment = await restored.query('SELECT state,interpretation_text FROM nodia_ai_attachments WHERE id=$1', [keepAttachment.id]);
  check('independent attachment tombstone preserves live parent chat and redacts derivative', await count(restored, 'nodia_ai_conversations', keepChat) === 1 && restoredAttachment.length === 1 && restoredAttachment[0].state === 'expired' && restoredAttachment[0].interpretation_text === null);
  check('independent preference tombstone preserves unrelated preference', await count(restored, 'nodia_ai_preferences', preferenceId) === 0 && await count(restored, 'nodia_ai_preferences', untouchedPreferenceId) === 1);
  check('unrelated chat and attachment are retained exactly', await count(restored, 'nodia_ai_conversations', untouchedChat) === 1 && (await restored.query('SELECT state,interpretation_text FROM nodia_ai_attachments WHERE id=$1', [untouchedAttachment.id])).some(row => row.state === 'ready' && row.interpretation_text === 'Synthetic private derivative'));
  check('restore never authorizes release or dispatches', report.release_authorized === false && report.dispatches === 0);
  const restoreCleanup = new Cleanup(new Runtime(restored), { async delete(key) { deletedObjects.push(key); } }, policy, disabled);
  await drain(restoreCleanup, restored);
  check('restored generation uses ordinary cleanup and leaves no attachment metadata', await count(restored, 'nodia_ai_attachments', keepAttachment.id) === 0);
  check('no run, execution, tool or financial effect is created', (await restored.query('SELECT (SELECT count(*) FROM nodia_ai_runs)+(SELECT count(*) FROM nodia_ai_executions)+(SELECT count(*) FROM finance_movements) AS total'))[0].total === '0');
  result = { schema_version: 1, stage: 'AI-38-journal-SQL', passed: checks.length, checks, duration_ms: Date.now() - started, real_pg_dump_restore: true, dump_bytes: dump.length, dump_sha256: hash(dump), external_storage: 'synthetic CAS and exact-key deletion ports', provider_calls: 0, operational_database_writes: 0, scope: 'disposable PostgreSQL only; preference source deletion uses controlled synthetic SQL, not confirmed execution acceptance' };
} catch (error) {
  runError = error;
} finally {
  try {
    if (restored?.isInitialized) await restored.destroy();
    await fixture.close();
  } catch (error) { runError ??= error; }
  try {
    if (!runError && result && initialized) {
      result = await cleanupOwnedJournal();
    } else if (ledgerCreated && liveConfig && liveExternal) {
      await ledger('failed_preserved_for_reconciliation');
    }
  } catch (error) {
    runError ??= error;
    if (ledgerCreated && liveConfig && liveExternal) {
      try { await ledger('cleanup_unconfirmed_preserved_for_reconciliation'); } catch { /* Preserve original ledger. */ }
    }
  } finally { liveExternal?.client.destroy(); }
}
if (runError) {
  process.stdout.write(JSON.stringify({ schema_version: 1, stage: 'AI-38-journal-combined-real-R2', status: 'failed', passed_checks: checks.length, checks, error_code: safeError(runError), private_ledger_preserved: ledgerCreated, external_state_may_exist: Boolean(liveExternal), provider_calls: 0, operational_database_writes: 0 }) + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write(JSON.stringify({ ...result, status: 'passed', duration_ms: Date.now() - started }) + '\n');
}

