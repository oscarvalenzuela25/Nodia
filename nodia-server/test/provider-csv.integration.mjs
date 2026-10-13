import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import qs from 'qs';
import { ProviderModule } from '../dist/provider/provider.module.js';
import { providerImportBodyParser } from '../dist/provider/provider-import-body-parser.js';
import { CreateProviderContacts1791220000000 } from '../dist/migrations/1791220000000-CreateProviderContacts.js';
import { createServer } from '../../nodia-client/node_modules/vite/dist/node/index.js';

// Disposable DB, synthetic auth, real compiled HTTP/DTO/ORM and actual Client CSV parser.
const container = `template_provider_csv_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
let db, app, vite, started = false, requests = 0;
try {
  docker('run','--detach','--rm','--name',container,'--publish','127.0.0.1::5432','--env','POSTGRES_DB=csv_test','--env','POSTGRES_USER=csv_test','--env',`POSTGRES_PASSWORD=${password}`,'postgres:16-alpine');
  started = true;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { docker('exec',container,'pg_isready','-h','127.0.0.1','-U','csv_test'); break; }
    catch (error) { if (attempt === 39) throw error; await delay(250); }
  }
  const options = { type: 'postgres', host: '127.0.0.1', port: Number(docker('port',container,'5432/tcp').split(':').at(-1)), username: 'csv_test', password, database: 'csv_test', synchronize: false, entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))] };
  db = new DataSource(options); await db.initialize();
  await db.query('CREATE TABLE businesses(id uuid PRIMARY KEY)');
  await db.query(`CREATE TABLE providers(id bigserial PRIMARY KEY,business_id uuid NOT NULL REFERENCES businesses(id),name varchar(255) NOT NULL,tax int NOT NULL DEFAULT 19,fields jsonb NOT NULL DEFAULT '{}',is_active boolean NOT NULL DEFAULT true,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`);
  const runner = db.createQueryRunner(); await new CreateProviderContacts1791220000000().up(runner); await runner.release();
  const business = randomUUID(), other = randomUUID();
  await db.query('INSERT INTO businesses VALUES ($1),($2)', [business, other]);
  class Guard { canActivate(context) { if (context.switchToHttp().getRequest().headers['x-test-actor'] !== '1') throw new UnauthorizedException(); return true; } }
  class IntegrationModule {}
  Module({ imports: [TypeOrmModule.forRoot(options), ProviderModule], providers: [{ provide: APP_GUARD, useClass: Guard }] })(IntegrationModule);
  app = await NestFactory.create(IntegrationModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.set('query parser', (value) => qs.parse(value, { comma: true }));
  app.use(['/api/v1/providers/import','/api/v1/provider/import'], providerImportBodyParser);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0,'127.0.0.1'); const base = await app.getUrl();
  const call = async (path, method = 'GET', body, auth = true) => {
    requests++;
    const response = await fetch(`${base}/api/v1/${path}`, { method, headers: { 'content-type':'application/json', ...(auth ? { 'x-test-actor':'1' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); return { status: response.status, body: response.headers.get('content-type')?.includes('text/csv') ? text : JSON.parse(text) };
  };
  vite = await createServer({ root: fileURLToPath(new URL('../../nodia-client',import.meta.url)), configFile: false, server: { middlewareMode: true } });
  const { parseCSV, buildImportPayload } = await vite.ssrLoadModule('/src/modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderBulkImport/helpers.ts');
  const snapshot = async () => ({ providers: (await db.query('SELECT id,business_id,name,tax,fields,is_active,created_at,updated_at FROM providers ORDER BY id')).map((p) => p), contacts: await db.query('SELECT id,provider_id,name,phone,email,schedule,description,is_active,version,created_at,updated_at FROM personal_info_provider ORDER BY id') });
  const contact = { name: 'María, "Norte"', phone: [{ number:'+56987654321' }], email:null, schedule:{ monday:[{ from:'09:00',to:'11:00',description:'Entrega semanal' }] }, description:'Uno\nDos',is_active:false };
  const payload = { items: [{ business_id:business,name:'=Sur, "Chile"',tax:0,is_active:false,fields:{ code:'SKU', cost_price:{value:'',instructions:'Línea 1\nLínea 2'},custom:{value:'Extra'} },contacts:[contact,{...contact,name:'Pedro'}] }, { business_id:business,name:'Norte',tax:19,contacts:[] }] };
  assert.equal((await call('providers/import','POST',payload,false)).status,401);
  assert.equal((await call('providers/import','POST',payload)).status,201);
  const before = await snapshot();
  assert.equal((await call('provider/import','POST',payload)).status,201);
  assert.deepEqual(await snapshot(),before);
  for (const lang of ['es','en']) {
    const csv = await call(`providers/export-csv?business_id=${business}&lang=${lang}`); assert.equal(csv.status,200);
    const rows = parseCSV(csv.body); assert.equal(rows.length,2); assert(rows.every((r) => r.isValid));
    const imported = await call('providers/import','POST',{items:buildImportPayload(rows,business)}); assert.equal(imported.status,201);
    assert.deepEqual(await snapshot(),before);
  }
  const providerId = before.providers[0].id;
  const view = await call(`providers/export-csv?business_id=${business}&ids=${providerId}`);
  assert.equal(parseCSV(view.body).length,1);
  const edit = buildImportPayload(parseCSV(view.body),business);
  edit[0].tax = 7;
  edit[0].contacts[0].description = 'Actualizado';
  assert.equal((await call('providers/import','POST',{items:edit})).status,201);
  const changed = await snapshot();
  assert.equal(changed.providers.find((p) => p.id === providerId).tax,7);
  assert.equal((await call('providers/import','POST',{items:edit})).status,201); assert.deepEqual(await snapshot(),changed);
  edit[0].contacts[0].description = 'Obsoleto';
  assert.equal((await call('providers/import','POST',{items:edit})).status,409);
  assert.deepEqual(await snapshot(),changed);
  const bad = { items:[{business_id:business,name:'Debe revertirse',tax:19},{business_id:business,id:'999999',name:'No existe',tax:19}] };
  assert.equal((await call('providers/import','POST',bad)).status,404); assert.deepEqual(await snapshot(),changed);
  assert.equal((await call('providers/import','POST',{items:[{business_id:other,id:providerId,name:'Ajeno'}]})).status,404);
  assert.equal((await call('providers/import','POST',{items:[{business_id:business,name:'Inválido',contacts:[{...contact,schedule:{ monday:[{from:'12:00',to:'09:00'}]}}]}]})).status,400);
  assert.equal((await call('providers/import','POST',{items:[{business_id:business,name:'Inválido',contacts:[{...contact,secret:'no'}]}]})).status,400);
  assert.equal((await call('providers/import','POST',{items:[{business_id:business,name:'Inválido',contacts:[{...contact,phone:[{number:'+56000000000'}]}]}]})).status,400);
  const parallel = await Promise.all([call('providers/import','POST',payload),call('providers/import','POST',payload)]);
  assert(parallel.every((r)=>r.status===201));
  assert.equal((await db.query('SELECT count(*)::int AS count FROM personal_info_provider'))[0].count,2);
  // Omitted/empty contacts never remove people; all includes inactive providers.
  assert.equal((await call('providers/import','POST',{items:[{business_id:business,id:providerId,name:payload.items[0].name,tax:0,contacts:[]}]})).status,201);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM personal_info_provider'))[0].count,2);
  assert.equal((await call(`providers/export-csv?ids=9223372036854775808`)).status,400);
  assert.equal((await call('providers/import','POST',{items:Array.from({length:1001},()=>payload.items[0])})).status,400);
  assert.equal((await call('providers/import','POST',{items:[],padding:'x'.repeat(4*1024*1024)})).status,413);
  console.log(JSON.stringify({requests,roundTrip:'ES/EN real Server export → Client parser → Server import',rollback:true,concurrency:true,scope:true,validation:true}));
} finally {
  if (vite) await vite.close(); if (app) await app.close(); if (db?.isInitialized) await db.destroy(); if (started) docker('stop',container);
}
