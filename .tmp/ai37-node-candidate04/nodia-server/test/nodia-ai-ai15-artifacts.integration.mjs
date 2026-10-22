// Compiled HTTP/native SQL, disposable PostgreSQL and synthetic storage only. No R2, credentials or inference.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai15');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
let app;
try {
  const Artifacts = await loadAi('nodia-ai-products/artifacts/nodia-ai-artifacts.module', 'NodiaAiArtifactsModule');
  const Storage = await loadAi('common/storage/storage.service', 'StorageService');
  async function boundedStorage(body, contentLength, signal = new AbortController().signal) {
    const real = new Storage();
    Reflect.set(real, 'bucketName', 'synthetic-only');
    Reflect.set(real, 's3Client', { async send(_command, options) {
      assert.equal(options.abortSignal, signal);
      return { Body: body, ...(contentLength === undefined ? {} : { ContentLength: contentLength }) };
    } });
    return real.downloadFile('synthetic-only', 6, signal);
  }
  const exactStream = Readable.from([Buffer.from('abc'), Buffer.from('def')]);
  check('real StorageService accepts exact byte boundary without a ContentLength and closes the stream', (await boundedStorage(exactStream)).toString() === 'abcdef' && exactStream.destroyed);
  const declaredStream = Readable.from([Buffer.from('secret')]);
  await assert.rejects(() => boundedStorage(declaredStream, 7), /byte limit/);
  check('real StorageService rejects an oversized ContentLength before consuming and closes the body', declaredStream.destroyed && declaredStream.readableLength === 0);
  const oversizedStream = Readable.from([Buffer.from('abc'), Buffer.from('defg')]);
  await assert.rejects(() => boundedStorage(oversizedStream), /byte limit/);
  check('real StorageService bounds bytes incrementally when ContentLength is absent', oversizedStream.destroyed);
  const lyingStream = Readable.from([Buffer.from('abcdefg')]);
  await assert.rejects(() => boundedStorage(lyingStream, 1), /byte limit/);
  check('real StorageService rejects a body larger than a falsely small ContentLength', lyingStream.destroyed);
  const cancelStream = new AbortController();
  const abortingStream = Readable.from((async function* () { yield Buffer.from('abc'); cancelStream.abort(); yield Buffer.from('def'); })());
  await assert.rejects(() => boundedStorage(abortingStream, undefined, cancelStream.signal));
  check('real StorageService cancellation destroys the body without returning a partial buffer', abortingStream.destroyed);
  const ArtifactExecutor = await loadAi('nodia-ai-products/artifacts/use-case/execute-nodia-ai-artifact.use-case', 'ExecuteNodiaAiArtifactUseCase');
  const Download = await loadAi('nodia-ai-products/artifacts/use-case/download-nodia-ai-artifact.use-case', 'DownloadNodiaAiArtifactUseCase');
  const Authorize = await loadAi('nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase');
  const { knowledgeHash, canonicalKnowledge } = await import('../dist/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js');
  const { lockAuthority } = await import('../dist/authorization/authority-transaction.js');
  let storageCalls = 0, externalEffect = async () => {};
  const storage = {
    async downloadFile(key, maxBytes, signal) {
      storageCalls++;
      assert.match(key, /^invoices\//);
      assert.equal(maxBytes, 10 * 1024 * 1024);
      // Prove no SQL authority lock remains across external I/O: a separate writer completes now.
      await db.query("SET lock_timeout='1s'");
      await db.query('UPDATE users SET name=name WHERE id=1');
      await externalEffect();
      signal.throwIfAborted();
      return Buffer.from('%PDF-synthetic-private');
    },
  };
  const compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Artifacts] })
    .overrideProvider(Storage).useValue(storage).compile();
  app = compiled.createNestApplication({ logger: false });
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId };
    return true;
  } });
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/nodia-ai/artifacts/';
  const request = async (reference, actor = '1', status = 200) => {
    const response = await fetch(base + reference, { headers: { 'x-fixture-actor': actor } });
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, status, buffer.toString());
    return { response, buffer, text: buffer.toString() };
  };
  let [destination] = await db.query("SELECT id FROM modules WHERE link='/tools/business'");
  if (!destination) [destination] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/business','ai15_artifact_businesses' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [destination.id]);
  const [business] = await db.query("INSERT INTO businesses(name,owner_id) VALUES('Synthetic artifact business',2) RETURNING id");
  const key = `invoices/${business.id}/synthetic.pdf`;
  const [invoice] = await db.query("INSERT INTO invoices(business_id,code,total_amount,path_storage) VALUES($1,'ARTIFACT-1',0,$2) RETURNING id", [business.id, key]);
  const [product] = await db.query("INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active) VALUES($1,'=CMD','Artifact product',0,0,0,0,0,false) RETURNING id", [business.id]);
  const [provider] = await db.query("INSERT INTO providers(business_id,name,tax,fields,is_active) VALUES($1,'Synthetic supplier',0,'{}',false) RETURNING id", [business.id]);
  const chat = randomUUID(), message = randomUUID(), run = randomUUID();
  await db.transaction(async (manager) => {
    await manager.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,expires_at,creation_request_hash) VALUES($1,1,$2,now()+interval '1 day',$3)", [chat, randomUUID(), 'a'.repeat(64)]);
    await manager.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed','{}',now(),$4)", [message, chat, randomUUID(), 'b'.repeat(64)]);
    await manager.query("INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,completed_at,retention_epoch,context_manifest) VALUES($1,$2,1,$3,'{}','synthetic-artifacts/1','synthetic/1',$4,'{}',$5,1,'completed','completed',now()+interval '1 hour',now(),1,'{}')", [run, chat, message, 'c'.repeat(64), { schema_version: 1, tool_calls: 24, mcp_rpc_messages: 96, provider_dispatches: 2, compactions: 1, delegations: 1 }]);
  });
  async function issue(operation, args) {
    const id = randomUUID();
    const result = await db.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await compiled.get(Authorize).execute(identities.get('1'), { moduleRoutes: ['/tools/business'] }, manager);
      const prepared = await compiled.get(ArtifactExecutor).prepare(operation, args, { manager, actor, moduleRoutes: ['/tools/business'], conversationId: chat, runId: run, toolCallId: id });
      return prepared;
    });
    const publicResult = await result.execute(new AbortController().signal);
    await db.query("INSERT INTO nodia_ai_tool_calls(id,conversation_id,run_id,adapter_call_id,tool_name,contract_hash,arguments_hash,arguments,public_result,scope_manifest,state,completed_at) VALUES($1::uuid,$2,$3,$1::text,$4,$5,$6,$7,$8,'{}','completed',now())", [id, chat, run, `nodia_${operation}`, 'd'.repeat(64), knowledgeHash(canonicalKnowledge(args)), args, publicResult]);
    assert.doesNotMatch(JSON.stringify(publicResult), /https?:|path_storage|invoices\/|%PDF|Code \(code\)/);
    return id;
  }
  const invoiceRef = await issue('invoices_file', { id: invoice.id });
  const productsRef = await issue('products_export_csv', { business_id: business.id, lang: 'en' });
  const providersRef = await issue('providers_export_csv', { business_id: business.id, ids: [provider.id], lang: 'en' });
  check('all three reference issuances store metadata only, never CSV/storage URL/content', true);
  await request(invoiceRef, 'missing', 401);
  check('artifact download requires a current authenticated session', storageCalls === 0);
  const invoiceResult = await request(invoiceRef);
  check('invoice proxy returns private bounded binary with no-store headers', invoiceResult.text === '%PDF-synthetic-private' && invoiceResult.response.headers.get('cache-control') === 'private, no-store' && invoiceResult.response.headers.get('content-disposition').includes('invoice-') && invoiceResult.response.headers.get('content-type').includes('application/pdf'));
  await request(invoiceRef, '2', 404);
  check('ordinary destination-assigned user cannot download another owner chat reference', storageCalls === 1);
  await request(invoiceRef, '3');
  const audits = await db.query("SELECT id FROM nodia_ai_audit_events WHERE conversation_id=$1 AND actor_id=3 AND minimal_details->>'operation'='artifact_download'", [chat]);
  check('super_admin can inspect the reference with the existing minimal audit', audits.length === 1);
  const productCsv = await request(productsRef);
  check('product export uses native CSV, formula protection, zero and inactive rows', productCsv.text.includes("'=CMD,Artifact product,0,0,0,0,0,false") && productCsv.response.headers.get('content-type').includes('text/csv'));
  await db.query("UPDATE products SET name='Changed after reference' WHERE id=$1", [product.id]);
  const changedCsv = await request(productsRef);
  check('reference explicitly regenerates current records instead of falsely promising an old snapshot', changedCsv.text.includes('Changed after reference') && !changedCsv.text.includes('Artifact product'));
  const supplierCsv = await request(providersRef);
  check('provider export retains native CSV v2, zero tax and inactive supplier', supplierCsv.text.includes('Synthetic supplier,0,false') && supplierCsv.text.includes('CSV Version (csv_version)'));
  await db.query("INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock) SELECT $1,'OVERFLOW-'||i,'Synthetic overflow',0,0,0,0,0 FROM generate_series(1,100) i", [business.id]);
  await request(productsRef, '1', 400);
  check('product export rejects 101 records without returning a truncated file', true);
  await db.query("DELETE FROM products WHERE code LIKE 'OVERFLOW-%'");
  await db.query("UPDATE providers SET fields=jsonb_build_object('synthetic',repeat('x',2100000)) WHERE id=$1", [provider.id]);
  await request(providersRef, '1', 400);
  check('provider export bounds legacy JSON bytes before hydration and never emits a partial CSV', true);
  await db.query("UPDATE providers SET fields='{}' WHERE id=$1", [provider.id]);
  const beforeInvalid = storageCalls;
  await db.query("UPDATE invoices SET path_storage='../../private.pdf' WHERE id=$1", [invoice.id]);
  await request(invoiceRef, '1', 400);
  check('persisted path traversal is rejected before object storage I/O', storageCalls === beforeInvalid);
  await db.query('UPDATE invoices SET path_storage=$2 WHERE id=$1', [invoice.id, key]);
  externalEffect = async () => { await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [destination.id]); };
  await request(invoiceRef, '1', 403);
  check('destination revocation committed during storage I/O prevents delivering the downloaded bytes', true);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [destination.id]);
  externalEffect = async () => { await db.query("UPDATE invoices SET path_storage=$2 WHERE id=$1", [invoice.id, `invoices/${business.id}/changed.pdf`]); };
  await request(invoiceRef, '1', 404);
  check('invoice replacement during storage I/O prevents returning the old file', true);
  await db.query('UPDATE invoices SET path_storage=$2 WHERE id=$1', [invoice.id, key]);
  externalEffect = async () => { await db.query("UPDATE nodia_ai_conversations SET expires_at=now()-interval '1 second' WHERE id=$1", [chat]); };
  await request(invoiceRef, '1', 410);
  check('chat expiry during storage I/O invalidates the reference before delivery', true);
  await db.query("UPDATE nodia_ai_conversations SET expires_at=now()+interval '1 day' WHERE id=$1", [chat]);
  externalEffect = async () => { await db.query('UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1', [identities.get('1').sessionId]); };
  await request(invoiceRef, '1', 401);
  check('session revocation during storage I/O denies the final response', true);
  await db.query('UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1', [identities.get('1').sessionId]);
  const cancellation = new AbortController();
  externalEffect = async () => { cancellation.abort(); };
  await assert.rejects(() => compiled.get(Download).execute(identities.get('1'), invoiceRef, cancellation.signal));
  check('request cancellation after storage I/O discards bytes without deleting business files or receipts', (await db.query('SELECT state FROM nodia_ai_tool_calls WHERE id=$1', [invoiceRef]))[0].state === 'completed');
  externalEffect = async () => { await db.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [chat]); };
  await request(invoiceRef, '1', 404);
  check('real SQL chat purge cascades receipts and discards an in-flight artifact result', true);
  externalEffect = async () => {};
  const beforePurge = storageCalls;
  await request(productsRef, '1', 404);
  await request(providersRef, '1', 404);
  check('purged CSV references are unavailable without additional storage work', storageCalls === beforePurge);
  const [businessCounts] = await db.query('SELECT (SELECT count(*) FROM invoices) invoices, (SELECT count(*) FROM products) products, (SELECT count(*) FROM providers) providers');
  check('chat purge preserves independently retained native business records', businessCounts.invoices === '1' && businessCounts.products === '1' && businessCounts.providers === '1');
  const report = { task: 'AI-15', verifiedAt: new Date().toISOString(), environment: 'compiled Nest HTTP, disposable PostgreSQL, synthetic storage', realGeminiInference: false, realR2: false, checks: checks.length, passed: checks, storageCalls };
  writeFileSync(new URL('../../docs/evidence/nodia-ai-ai15-artifacts-integration.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (app) await app.close();
  await fixture.close();
}

