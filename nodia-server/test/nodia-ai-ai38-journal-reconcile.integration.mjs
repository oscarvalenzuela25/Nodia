// Small real-SQL regression for whole-journal reconciliation. No R2/provider/configured DB.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai38');
const { db } = fixture;
const checks = [], started = Date.now();
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const hash = value => createHash('sha256').update(value).digest('hex');
try {
  const Reconcile = await loadAi('nodia-ai-recovery/use-case/reconcile-nodia-ai-deletion-journal.use-case', 'ReconcileNodiaAiDeletionJournalUseCase');
  const presentPreferences = Array.from({ length: 100 }, () => randomUUID());
  for (const [index, id] of presentPreferences.entries()) {
    const businessId = randomUUID();
    // Fifty synthetic values per owner, all with distinct valid business scopes.
    await db.query("INSERT INTO nodia_ai_preferences(id,owner_id,scope_key,scope_hash,scope,key,value) VALUES($1,$2,'business',$3,$4,'supplier_id','\"7\"')", [id, index < 50 ? '1' : '2', hash(businessId), { business_id: businessId }]);
  }
  const presentChat = randomUUID(), presentAttachment = randomUUID(), generation = randomUUID();
  await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at) VALUES($1,1,$2,'Synthetic reconciliation',$3,clock_timestamp()+interval '1 day')", [presentChat, randomUUID(), hash(presentChat)]);
  await db.query("INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,expires_at) VALUES($1,$2,$3,$4,1,'pdf','rejected','synthetic.pdf',$5,$6,4,clock_timestamp()+interval '1 day')", [presentAttachment, presentChat, randomUUID(), hash(presentAttachment), `nodia-ai/${presentChat}/${presentAttachment}/${generation}`, generation]);
  const absentPreference = { kind: 'preference', preference_id: randomUUID() };
  const absentChat = { kind: 'conversation', conversation_id: randomUUID(), storage_generations: [] };
  const absentAttachment = { kind: 'attachment', conversation_id: presentChat, attachment_id: randomUUID(), storage_generations: [randomUUID()] };
  const resources = [
    ...presentPreferences.map(id => ({ kind: 'preference', preference_id: id })), absentPreference,
    { kind: 'conversation', conversation_id: presentChat, storage_generations: [] }, absentChat,
    { kind: 'attachment', conversation_id: presentChat, attachment_id: presentAttachment, storage_generations: [generation] }, absentAttachment,
  ];
  const deletedAt = (await db.query('SELECT clock_timestamp() AS now'))[0].now.toISOString();
  const entries = resources.map((resource, index) => ({ ...resource, sequence: index + 1, deleted_at: deletedAt, confirmed_at: null }));
  const tableNames = { conversation: 'nodia_ai_conversations', attachment: 'nodia_ai_attachments', preference: 'nodia_ai_preferences' };
  const reads = [];
  const result = await db.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY');
    await manager.query("SET LOCAL statement_timeout='5s'");
    return new Reconcile().execute(entries, {
      async findExisting(kind, ids) {
        reads.push({ kind, count: ids.length });
        const rows = await manager.query(`SELECT id::text AS id FROM ${tableNames[kind]} WHERE id=ANY($1::uuid[])`, [ids]);
        return rows.map(row => row.id);
      },
    });
  });
  check('absent preference at position 101 is eligible despite 100 earlier present witnesses', result.confirmed.some(resource => resource.kind === 'preference' && resource.preference_id === absentPreference.preference_id));
  check('all three absent resource kinds are selected and no present resource is acknowledged', result.confirmed.length === 3 && result.confirmed.some(resource => resource.kind === 'conversation' && resource.conversation_id === absentChat.conversation_id) && result.confirmed.some(resource => resource.kind === 'attachment' && resource.attachment_id === absentAttachment.attachment_id));
  check('all 102 present resource witnesses remain pending', result.pending === 102);
  check('three kinds require exactly three set reads instead of one query per witness', reads.length === 3 && reads.map(read => read.kind).join(',') === 'conversation,attachment,preference' && reads.find(read => read.kind === 'preference').count === 101);
  const retained = await db.query('SELECT (SELECT count(*) FROM nodia_ai_preferences)::int AS preferences,(SELECT count(*) FROM nodia_ai_conversations)::int AS chats,(SELECT count(*) FROM nodia_ai_attachments)::int AS files');
  check('read-only reconciliation preserves every seeded source row', retained[0].preferences === 100 && retained[0].chats === 1 && retained[0].files === 1);
  process.stdout.write(JSON.stringify({ schema_version: 1, stage: 'AI-38-journal-reconcile-SQL', status: 'passed', passed: checks.length, checks, inspected_pending: entries.length, existing_preserved: result.pending, absent_eligible_for_external_confirmation: result.confirmed.length, read_only_SQL_set_queries: reads.length, duration_ms: Date.now() - started, provider_requests: 0, R2_requests: 0, operational_SQL_reads: 0, operational_SQL_writes: 0, scope: 'disposable PostgreSQL only; eligibility rule with real read-only SQL, no external confirmation performed' }) + '\n');
} finally { await fixture.close(); }
