// Compiled native contracts, human confirmation HTTP, real PostgreSQL and worker processes.
// Synthetic disposable records only. Preparation is an internal port, never a published MCP assertion.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai22');
const { db, options, identities } = fixture;
const checks = [], children = new Set(), exercised = new Set();
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
let app, compiled, base, prepare, execute, claimer, recovery, worker, providerCalls = 0;
const kill = async child => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGKILL');
  await ended;
};
try {
  const [Confirmation, Execution, Conversation, Overview, Prepare, Execute, Claim, Recover, Run, Redis, Adapter] = await Promise.all([
    loadAi('nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'),
    loadAi('nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'),
    loadAi('finance-overview/finance-overview.module', 'FinanceOverviewModule'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'),
    loadAi('nodia-ai-execution/use-case/execute-nodia-ai-financial-execution.use-case', 'ExecuteNodiaAiFinancialExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'),
  ]);
  const InvoiceHttp = await loadAi('invoice/invoice.module','InvoiceModule');
  const UploadRecoveryWorker = await loadAi('invoice/invoice-upload-recovery.worker','InvoiceUploadRecoveryWorker');
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview, InvoiceHttp,
  ] });
  builder.overrideProvider(UploadRecoveryWorker).useValue({});
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI22 provider');
  }])));
  compiled = await builder.compile();
  prepare = compiled.get(Prepare); execute = compiled.get(Execute);
  claimer = compiled.get(Claim); recovery = compiled.get(Recover); worker = compiled.get(Run);
  const Policy = await loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
  const parser = await loadAi('nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser');
  const Filter = await loadAi('common/filters/all-exceptions.filter', 'AllExceptionsFilter');
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', parser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId };
    return true;
  } });
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
  async function request(path, { actor = '1', method = 'GET', body, status = 200 } = {}) {
    const response = await fetch(base + path, { method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = response.status === 204 ? null : await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  let [destination] = await db.query("SELECT id FROM modules WHERE link='/tools/business'");
  if (!destination) [destination] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/business','synthetic_ai22_business' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [destination.id]);
  const toolName = (resource, operation) => `nodia_${resource}_prepare_${operation}`;
  async function proposal(resource, operation, partial, actor = '1', expectedStatus = 'ready') {
    const chat = randomUUID(), identity = identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI22 only',clock_timestamp()+interval '90 days')", [chat,identity.userId,randomUUID(),'a'.repeat(64)]);
    const result=await db.transaction(manager=>prepare.execute(manager,identity,{conversationId:chat,toolName:toolName(resource,operation),partial}));
    assert.equal(result.status,expectedStatus,JSON.stringify(result));return {chat,result,...result.proposal};
  }
  async function admit(p,actor='1',expectedStatus=202) {
    const challenge=await request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`,{actor,method:'POST',body:{proposal_revision:p.revision,expected_hash:p.hash}});
    const value=await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`,{actor,method:'POST',status:expectedStatus,body:{client_request_id:randomUUID(),proposal_revision:p.revision,expected_hash:p.hash,confirmation_token:challenge.confirmation_token}});return value.execution;
  }
  const claim=()=>claimer.execute(randomUUID());
  const status=(id,actor='1')=>request(`/nodia-ai/operations/${id}`,{actor});
  const count=async(table,where='true',values=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,values))[0].n;
  async function perform(resource,operation,partial,actor='1') {
    const p=await proposal(resource,operation,partial,actor), admitted=await admit(p,actor), acquired=await claim();
    assert.equal(acquired.executionId,admitted.execution_id);
    const result=await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal(result.state,'completed');assert.equal(result.steps.length,1);
    const [step]=await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',[admitted.execution_id]);
    const receipt=step.minimal_receipt;assert.equal(receipt.resource_key,resource);assert.equal(receipt.operation,operation);
    const destination=resource==='businesses'&&operation==='create'?receipt.resource_id:(await db.query('SELECT preconditions FROM nodia_ai_proposal_steps WHERE id=$1',[step.source_step_id]))[0].preconditions.destination_business_id;
    assert.equal(receipt.business_id,destination);
    if(operation!=='create') assert.equal(receipt.resource_id,partial.id??partial.business_id);
    assert.equal(result.steps[0].result_refs[0].id,receipt.resource_id);
    await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal((await status(admitted.execution_id,actor)).state,'completed');
    exercised.add(`${resource}/${operation}`);return {id:receipt.resource_id,execution:result,proposal:p,claim:acquired,step};
  }
  const rejection=async(resource,operation,partial,actor='1',expected=[400,404,409])=>assert.rejects(proposal(resource,operation,partial,actor),error=>expected.includes(error.getStatus?.()));
  const first=await perform('businesses','create',{name:'Synthetic AI22 business',translates:[{key:'description',es:'Descripción sintética',en:'Synthetic description'}]});
  const business=first.id;
  let businessView=await request(`/businesses/${business}`);
  check('business create commits translations and derived description flag with one native receipt',businessView.owner_id==='1'&&businessView.has_description===true&&await count('translations',"source_id=$1 AND source_key='description'",[business])===2);
  await perform('businesses','update',{business_id:business,id:business,name:'Synthetic renamed business',translates:[]});
  businessView=await request(`/businesses/${business}`);
  check('business update preserves native empty translation-list upsert semantics while updating the derived flag',businessView.name==='Synthetic renamed business'&&businessView.has_description===false&&await count('translations','source_id=$1',[business])===2);
  await perform('businesses','update',{business_id:business,id:business,translates:[{key:'description',es:'',en:''}]});
  check('explicit empty translation values clear both languages without deleting their stable keys',await count('translations',"source_id=$1 AND value=''",[business])===2);
  const second=await perform('businesses','create',{name:'Synthetic destination'}),businessTwo=second.id;
  const [action]=await db.query("INSERT INTO business_actions(key) VALUES('synthetic_ai22_permission') RETURNING id");
  await perform('businesses','set_collaborators',{business_id:business,id:business,users:[{user_id:'2',position:'Synthetic role',action_ids:[action.id]},{user_id:'3',position:'Preserved omitted collaborator',action_ids:[action.id]}]});
  let [collaborator]=await db.query('SELECT * FROM business_collaborators WHERE business_id=$1 AND user_id=2',[business]);
  check('collaborator assignment preserves native owner and creates the requested permissions',collaborator.is_active===true&&businessView.owner_id==='1'&&collaborator.action_ids.length===1&&collaborator.action_ids[0]===action.id);
  await perform('businesses','set_collaborators',{business_id:business,id:business,users:[{user_id:'2',action_ids:[]}]});
  [collaborator]=await db.query('SELECT * FROM business_collaborators WHERE business_id=$1 AND user_id=2',[business]);
  check('empty collaborator actions deactivate the specified collaborator while preserving omitted collaborators',collaborator.is_active===false&&collaborator.position==='Synthetic role'&&await count('business_collaborators','business_id=$1 AND user_id=3 AND is_active=true',[business])===1);
  await rejection('businesses','update',{business_id:business,id:business,name:'Forbidden actor'},'2',[403]);
  check('ordinary actor cannot change a business owned by another user');
  const supplier=await perform('providers','create',{business_id:business,name:'  SYNTHETIC Supplier  ',tax:0,fields:{price:'Precio',enabled:false,nested:{number:0,value:null}},is_active:false});
  let supplierView=await request(`/providers/${supplier.id}`);
  check('provider creation preserves zero false JSON and native lowercase normalization',supplierView.tax===0&&supplierView.is_active===false&&supplierView.name==='synthetic supplier'&&supplierView.fields.nested.value===null);
  await perform('providers','update',{business_id:business,id:supplier.id,name:'Synthetic renamed supplier'});
  supplierView=await request(`/providers/${supplier.id}`);
  check('provider partial update preserves omitted tax fields and archived state despite DTO create initializers',supplierView.tax===0&&supplierView.fields.enabled===false&&supplierView.is_active===false);
  const person=await perform('provider_contacts','create',{business_id:business,provider_id:supplier.id,name:'María Synthetic',phone:[{number:'+56987654321'}],email:'synthetic@example.invalid',description:null,schedule:{monday:[{from:'09:00',to:'12:00'}]},is_active:false});
  const contactList=async provider=>(await request(`/providers/${provider}/contacts?page=1&limit=100`)).data;
  let personView=(await contactList(supplier.id)).find(row=>row.id===person.id);
  check('contact creation preserves personal casing native values version and omits internal request keys',personView.name==='María Synthetic'&&personView.version===1&&personView.is_active===false&&!Object.hasOwn(personView,'creation_key')&&!Object.hasOwn(personView,'creation_hash'));
  const [sourceContact]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE id=$1',[person.step.source_step_id]);
  const contactCommand=sourceContact.command_template.command;
  const replay=await request(`/providers/${supplier.id}/contacts`,{method:'POST',status:201,body:contactCommand});
  assert.equal(replay.id,person.id);assert.equal(await count('personal_info_provider','provider_id=$1',[supplier.id]),1);
  await request(`/providers/${supplier.id}/contacts`,{method:'POST',status:409,body:{...contactCommand,name:'Different intent'}});
  check('native request key replay recovers the AI-created contact and rejects a changed payload');
  await perform('provider_contacts','update',{business_id:business,provider_id:supplier.id,id:person.id,name:'María Replaced',phone:[],email:null,description:null,schedule:{},is_active:true});
  personView=(await contactList(supplier.id)).find(row=>row.id===person.id);
  check('complete contact replacement explicitly clears optional values and increments version once',personView.version===2&&personView.phone.length===0&&Object.keys(personView.schedule).length===0&&personView.email===null);
  await perform('provider_contacts','set_active',{business_id:business,provider_id:supplier.id,id:person.id,is_active:false});
  personView=(await contactList(supplier.id)).find(row=>row.id===person.id);
  check('contact status uses native CAS and preserves the other values',personView.version===3&&personView.is_active===false&&personView.name==='María Replaced');
  await request(`/providers/${supplier.id}/contacts/${person.id}/status`,{method:'PATCH',body:{version:2,is_active:false}});
  check('native identical immediate status replay does not increment contact version again',(await contactList(supplier.id)).find(row=>row.id===person.id).version===3);
  await request(`/providers/${supplier.id}/contacts/${person.id}/status`,{method:'PATCH',status:409,body:{version:2,is_active:true}});
  check('native changed stale contact payload cannot overwrite the confirmed state');
  await rejection('provider_contacts','create',{business_id:businessTwo,provider_id:supplier.id,name:'Wrong parent'});
  await rejection('provider_contacts','update',{business_id:business,provider_id:supplier.id,id:person.id,name:'Bad key',request_key:randomUUID()});
  check('contact parent scope and backend-owned keys cannot be supplied by model arguments');
  const prices={code:'SYN22',name:'Synthetic product',cost_price:100,cost_price_tax:119,profit_percentage:30,sale_price:150,stock:0};
  const product=await perform('products','create',{business_id:business,...prices,provider_id:supplier.id,is_active:false});
  let productView=await request(`/products/${product.id}`);
  check('product creation commits one native product and matching history snapshot atomically',productView.stock===0&&productView.is_active===false&&await count('product_logs','product_id=$1',[product.id])===1);
  await perform('products','update',{business_id:business,id:product.id,sale_price:200});
  productView=await request(`/products/${product.id}`);
  check('product update appends one complete native snapshot while preserving omitted state',productView.sale_price===200&&productView.stock===0&&productView.is_active===false&&await count('product_logs','product_id=$1',[product.id])===2);
  const log=await perform('product_logs','create',{business_id:business,...prices,code:'SYN22LOG',product_id:product.id});
  await perform('product_logs','update',{business_id:business,id:log.id,sale_price:250});
  const logView=await request(`/product-logs/${log.id}`);
  check('independent history create and update do not mutate the live product',logView.sale_price===250&&(await request(`/products/${product.id}`)).sale_price===200);
  const invoice=await perform('invoices','create',{business_id:business,provider_id:supplier.id,code:'SYN22INV',total_amount:0,data:{paid:false,value:null,items:[]},is_active:false});
  let invoiceView=await request(`/invoices/${invoice.id}`);
  check('SQL invoice creation preserves zero false null and cannot invent an object path',invoiceView.total_amount===0&&invoiceView.is_active===false&&invoiceView.data.paid===false&&invoiceView.data.value===null&&invoiceView.path_storage==='');
  await perform('invoices','update',{business_id:business,id:invoice.id,code:'SYN22INV-EDIT',data:{value:0,paid:false}});
  invoiceView=await request(`/invoices/${invoice.id}`);
  check('invoice metadata update preserves omitted provider inactive state and zero total',invoiceView.code==='SYN22INV-EDIT'&&invoiceView.is_active===false&&invoiceView.provider_id===supplier.id&&invoiceView.total_amount===0);
  await rejection('invoices','create',{business_id:business,code:'Bad arbitrary path',path_storage:'untrusted/object.pdf'});
  await rejection('invoices','update',{business_id:business,id:invoice.id,total_amount:'12'});
  check('invoice commands reject arbitrary storage keys and permissive legacy numeric coercion');
  assert.equal(exercised.size,14);check('all fourteen individual business operations commit exact native receipts',exercised.size===14);
  await rejection('providers','update',{business_id:business,id:supplier.id,destination_business_id:businessTwo},'1',[409]);
  await request(`/providers/${supplier.id}`,{method:'PUT',status:409,body:{business_id:businessTwo}});
  check('AI preparation and native provider update both reject transfers leaving linked products or invoices behind',(await request(`/providers/${supplier.id}`)).business_id===business);
  const bulkGuardSupplier=await perform('providers','create',{business_id:business,name:'Synthetic bulk guard preserved'});
  await request('/providers/bulk',{method:'PUT',status:409,body:{items:[{id:bulkGuardSupplier.id,name:'Must roll back'},{id:supplier.id,business_id:businessTwo}]}});
  await request('/providers/bulk',{method:'PUT',status:400,body:{items:[{id:bulkGuardSupplier.id,name:'First'},{id:'0'+bulkGuardSupplier.id,name:'Second'}]}});
  check('legacy provider bulk transfer cannot bypass references and rejected batches preserve every selected provider',(await request(`/providers/${bulkGuardSupplier.id}`)).name==='synthetic bulk guard preserved'&&(await request(`/providers/${supplier.id}`)).business_id===business);
  const beforeBulkLogs=await count('product_logs');
  await request('/products/bulk',{method:'POST',status:400,body:{items:[{business_id:business,...prices,code:'SYN22-BULK-VALID',provider_id:null},{business_id:businessTwo,...prices,code:'SYN22-BULK-INVALID',provider_id:supplier.id}]}});
  check('legacy bulk product creation rejects incompatible supplier scopes before writing products or logs',await count('products',"code IN ('SYN22-BULK-VALID','SYN22-BULK-INVALID')")===0&&await count('product_logs')===beforeBulkLogs);
  const bulkOtherProduct=await perform('products','create',{business_id:business,...prices,code:'SYN22-BULK-EDIT',provider_id:null});
  await request('/products/bulk',{method:'PUT',status:400,body:{items:[{id:product.id,name:'Must not partially rename'},{id:bulkOtherProduct.id,business_id:businessTwo,provider_id:supplier.id}]}});
  await request('/products/bulk',{method:'PUT',status:400,body:{items:[{id:product.id,name:'First'},{id:product.id,name:'Second'}]}});
  check('legacy bulk product update rejects mismatched supplier and duplicate targets without partial changes',(await request(`/products/${product.id}`)).name===prices.name);
  await db.query("CREATE FUNCTION synthetic_ai22_bulk_log_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.code='SYN22-BULK-LOG-FAIL' THEN RAISE EXCEPTION 'synthetic_ai22_bulk_log_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai22_bulk_log_failure BEFORE INSERT ON product_logs FOR EACH ROW EXECUTE FUNCTION synthetic_ai22_bulk_log_failure()");
  const logCountBeforeFailure=await count('product_logs');
  try{await request('/products/bulk',{method:'POST',status:500,body:{items:[{business_id:business,...prices,code:'SYN22-BULK-LOG-OK',provider_id:null},{business_id:business,...prices,code:'SYN22-BULK-LOG-FAIL',provider_id:null}]}});}finally{await db.query('DROP TRIGGER synthetic_ai22_bulk_log_failure ON product_logs;DROP FUNCTION synthetic_ai22_bulk_log_failure()');}
  check('native bulk product log failure rolls back every product and appended history row',await count('products',"code IN ('SYN22-BULK-LOG-OK','SYN22-BULK-LOG-FAIL')")===0&&await count('product_logs')===logCountBeforeFailure);
  const invoiceRevision=await proposal('invoices','update',{business_id:business,id:invoice.id,code:'SYN22-BEFORE-REVIEW',total_amount:25});
  const invoiceReviewed=await request(`/nodia-ai/proposals/${invoiceRevision.proposal_id}`,{method:'PATCH',body:{expected_proposal_revision:invoiceRevision.revision,expected_hash:invoiceRevision.hash,edits:[{step_id:invoiceRevision.steps[0].step_id,field_key:'code',value:'SYN22-REVIEWED'},{step_id:invoiceRevision.steps[0].step_id,field_key:'total_amount',value:0}]}});
  const revisedInvoiceExecution=await admit(invoiceReviewed),revisedInvoiceClaim=await claim();
  await execute.execute(identities.get('1'),revisedInvoiceExecution.execution_id,revisedInvoiceClaim);
  check('human invoice review reparses stored commands preserving explicit integer zero',(await status(revisedInvoiceExecution.execution_id)).state==='completed'&&(await request(`/invoices/${invoice.id}`)).code==='SYN22-REVIEWED'&&(await request(`/invoices/${invoice.id}`)).total_amount===0);
  const personRevision=await proposal('provider_contacts','create',{business_id:business,provider_id:supplier.id,name:'Synthetic before human review'});
  const [beforeReviewKey]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1 AND proposal_revision=1',[personRevision.proposal_id]);
  const personReviewed=await request(`/nodia-ai/proposals/${personRevision.proposal_id}`,{method:'PATCH',body:{expected_proposal_revision:personRevision.revision,expected_hash:personRevision.hash,edits:[{step_id:personRevision.steps[0].step_id,field_key:'name',value:'Synthetic human reviewed contact'}]}});
  const [afterReviewKey]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1 AND proposal_revision=2',[personRevision.proposal_id]);
  assert.equal(beforeReviewKey.command_template.command.request_key,afterReviewKey.command_template.command.request_key);
  const revisedPersonExecution=await admit(personReviewed),revisedPersonClaim=await claim();
  await execute.execute(identities.get('1'),revisedPersonExecution.execution_id,revisedPersonClaim);
  check('human contact review preserves the backend intent key across proposal revisions and creates one native contact',await count('personal_info_provider','provider_id=$1 AND creation_key=$2',[supplier.id,afterReviewKey.command_template.command.request_key])===1&&(await contactList(supplier.id)).some(row=>row.name==='Synthetic human reviewed contact'));
  await perform('products','update',{business_id:business,id:product.id,provider_id:null});
  await perform('invoices','update',{business_id:business,id:invoice.id,provider_id:null});
  check('explicit null clears native product and invoice provider associations without stale ORM relations restoring them',(await request(`/products/${product.id}`)).provider_id===null&&(await request(`/invoices/${invoice.id}`)).provider_id===null);
  const moved=await perform('providers','update',{business_id:business,id:supplier.id,destination_business_id:businessTwo});
  check('provider transfer receipt binds the destination while native contacts remain with their parent',(await request(`/providers/${supplier.id}`)).business_id===businessTwo&&moved.step.minimal_receipt.business_id===businessTwo&&(await contactList(supplier.id)).some(row=>row.id===person.id));
  await rejection('provider_contacts','set_active',{business_id:business,provider_id:supplier.id,id:person.id,is_active:true});
  await perform('provider_contacts','set_active',{business_id:businessTwo,provider_id:supplier.id,id:person.id,is_active:true});
  check('a provider transfer changes contact operation scope and invalidates the former parent business');
  const changed=await proposal('products','update',{business_id:business,id:product.id,name:'Must not overwrite'});
  await db.query('UPDATE products SET name=$2 WHERE id=$1',[product.id,'Synthetic concurrent rename']);
  await admit(changed,'1',409);check('same timestamp material product changes invalidate confirmation');
  const afterAdmission=await admit(await proposal('products','update',{business_id:business,id:product.id,name:'Must not dispatch'}));
  await db.query('UPDATE products SET sale_price=sale_price+1 WHERE id=$1',[product.id]);
  await worker.execute(randomUUID(),new AbortController().signal);
  const stale=await status(afterAdmission.execution_id);
  check('material changes after admission reject old commands before a native effect',stale.state==='failed'&&!stale.can_resume&&(await request(`/products/${product.id}`)).name==='Synthetic concurrent rename');
  const beforeProvider=await proposal('provider_contacts','set_active',{business_id:businessTwo,provider_id:supplier.id,id:person.id,is_active:false});
  await db.query('UPDATE providers SET name=$2 WHERE id=$1',[supplier.id,'synthetic changed parent']);
  await admit(beforeProvider,'1',409);check('same timestamp supplier changes invalidate a frozen contact proposal');
  const globalProvider=await perform('providers','create',{business_id:business,name:'Synthetic globally permitted supplier'},'2');
  check('native global supplier access remains allowed with the target module while business ownership stays unchanged',(await request(`/providers/${globalProvider.id}`)).business_id===business&&(await request(`/businesses/${business}`)).owner_id==='1');
  await perform('businesses','update',{business_id:business,id:business,name:'Synthetic super admin edit'},'3');
  check('super admin can manage a foreign business without transferring its owner',(await request(`/businesses/${business}`)).owner_id==='1');
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destination.id]);
  await rejection('providers','create',{business_id:business,name:'Missing target module'},'2',[403]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destination.id]);
  check('ordinary actors require the destination business module as well as NodiaAI');
  const rollbackName='Synthetic rollback composed product';
  const rollback=await admit(await proposal('products','create',{business_id:business,...prices,code:'SYN22ROLLBACK',name:rollbackName,provider_id:null})),rollbackClaim=await claim();
  await db.query("CREATE FUNCTION synthetic_ai22_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai22_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai22_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai22_receipt_failure()");
  const beforeLogs=await count('product_logs');
  try {await assert.rejects(execute.execute(identities.get('1'),rollback.execution_id,rollbackClaim));}finally{await db.query('DROP TRIGGER synthetic_ai22_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai22_receipt_failure()');}
  await recovery.execute(rollbackClaim,'nodia_ai:execution_conflict');
  check('receipt failure rolls back the native product and its appended history together',await count('products','code=$1',['SYN22ROLLBACK'])===0&&await count('product_logs')===beforeLogs);
  const waitFor=async(read,predicate,description,timeout=20000)=>{
    const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await delay(30);}throw Error('Timed out: '+description);
  };
  const childWorker=async()=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai22-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI22_FIXTURE_DB:JSON.stringify(options)}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});child.on('error',error=>{exited={message:error.message};});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    const next=async type=>waitFor(async()=>{const message=messages.find(value=>value.type===type||value.type==='error');if(message?.type==='error')throw Error(JSON.stringify(message));if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return message;},Boolean,'child '+type);
    await next('ready');return {child,next};
  };
  const crash=await admit(await proposal('providers','update',{business_id:businessTwo,id:supplier.id,name:'Synthetic resumed supplier'}));
  const crashing=await childWorker();crashing.child.send({type:'claim',workerId:randomUUID()});
  assert.equal((await crashing.next('claimed')).claim.executionId,crash.execution_id);await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1",[crash.execution_id]);await recovery.execute();
  const failed=await status(crash.execution_id);
  check('real worker death before supplier UPDATE leaves no native effect and permits explicit resume',failed.state==='failed'&&failed.can_resume&&(await request(`/providers/${supplier.id}`)).name==='synthetic changed parent');
  const resumeBody={client_request_id:randomUUID(),expected_execution_revision:failed.revision};
  await request(`/nodia-ai/operations/${failed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});await request(`/nodia-ai/operations/${failed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  await worker.execute(randomUUID(),new AbortController().signal);
  check('resumed supplier UPDATE commits once after duplicate human resume',(await status(failed.execution_id)).state==='completed'&&(await request(`/providers/${supplier.id}`)).name==='synthetic resumed supplier');
  const lost=await admit(await proposal('invoices','update',{business_id:business,id:invoice.id,code:'SYN22-COMMIT-LOST'})),lostClaim=await claim();
  const Store=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),store=compiled.get(Store),transaction=store.transaction.bind(store);
  store.transaction=async work=>{await transaction(work);throw Error('synthetic_ai22_post_commit_response_lost');};
  try{await assert.rejects(execute.execute(identities.get('1'),lost.execution_id,lostClaim),error=>error.getStatus?.()===503);}finally{store.transaction=transaction;}
  await recovery.execute();const recovered=await execute.execute(identities.get('1'),lost.execution_id,lostClaim);
  check('lost invoice UPDATE commit acknowledgement reconciles its immutable native receipt',recovered.state==='completed'&&(await request(`/invoices/${invoice.id}`)).code==='SYN22-COMMIT-LOST');
  const cancel=await admit(await proposal('providers','update',{business_id:businessTwo,id:supplier.id,name:'Must not apply after cancel'})),cancelClaim=await claim();
  const cancelled=await request(`/nodia-ai/operations/${cancel.execution_id}/cancel`,{method:'POST',body:{client_request_id:randomUUID(),expected_execution_revision:cancel.revision+1}});
  await assert.rejects(execute.execute(identities.get('1'),cancel.execution_id,cancelClaim));
  check('human cancellation fences a stale business worker before writing',cancelled.execution.state==='cancelled'&&(await request(`/providers/${supplier.id}`)).name==='synthetic resumed supplier');
  const race=await admit(await proposal('provider_contacts','set_active',{business_id:businessTwo,provider_id:supplier.id,id:person.id,is_active:false})),raceClaim=await claim();
  const beforeRace=(await contactList(supplier.id)).find(row=>row.id===person.id);
  const outcomes=await Promise.allSettled([
    execute.execute(identities.get('1'),race.execution_id,raceClaim),
    fetch(base+`/providers/${supplier.id}/contacts/${person.id}/status`,{method:'PATCH',headers:{'content-type':'application/json','x-fixture-actor':'1'},body:JSON.stringify({version:beforeRace.version,is_active:false})}),
  ]);
  assert.equal(outcomes[1].status,'fulfilled');assert.ok([200,409].includes(outcomes[1].value.status));
  if(outcomes[0].status==='rejected')await recovery.execute(raceClaim,'nodia_ai:preconditions_changed');
  const afterRace=(await contactList(supplier.id)).find(row=>row.id===person.id);
  check('native HTTP status and confirmed worker share contact CAS without duplicate version increments',afterRace.version===beforeRace.version+1&&afterRace.is_active===false);
  const newReferenceSupplier=await perform('providers','create',{business_id:business,name:'Synthetic new-reference supplier'});
  const beforeNewReference=await proposal('providers','update',{business_id:business,id:newReferenceSupplier.id,destination_business_id:businessTwo});
  await request('/products',{method:'POST',status:201,body:{business_id:business,...prices,code:'SYN22-NEW-REFERENCE',provider_id:newReferenceSupplier.id}});
  await admit(beforeNewReference,'1',409);
  check('a newly linked native product invalidates the frozen provider-transfer proof before confirmation');
  const postAdmissionSupplier=await perform('providers','create',{business_id:business,name:'Synthetic admitted-reference supplier'});
  const admittedTransfer=await admit(await proposal('providers','update',{business_id:business,id:postAdmissionSupplier.id,destination_business_id:businessTwo}));
  await request('/invoices',{method:'POST',status:201,body:{business_id:business,provider_id:postAdmissionSupplier.id,code:'SYN22-ADMITTED-REFERENCE',total_amount:0}});
  await worker.execute(randomUUID(),new AbortController().signal);
  const rejectedTransfer=await status(admittedTransfer.execution_id);
  check('a newly linked native invoice after admission blocks the worker transfer without a receipt or resume',rejectedTransfer.state==='failed'&&!rejectedTransfer.can_resume&&(await request(`/providers/${postAdmissionSupplier.id}`)).business_id===business);
  for(const [resource,path,body] of [
    ['product','/products',{...prices,code:'SYN22-PROVIDER-RACE'}],
    ['invoice','/invoices',{code:'SYN22-INVOICE-RACE',total_amount:0}],
  ]) {
    const racingSupplier=await perform('providers','create',{business_id:business,name:`Synthetic ${resource} race supplier`});
    const racingExecution=await admit(await proposal('providers','update',{business_id:business,id:racingSupplier.id,destination_business_id:businessTwo})),racingClaim=await claim();
    const racingResults=await Promise.allSettled([
      execute.execute(identities.get('1'),racingExecution.execution_id,racingClaim),
      fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-fixture-actor':'1'},body:JSON.stringify({...body,business_id:business,provider_id:racingSupplier.id})}),
    ]);
    assert.equal(racingResults[1].status,'fulfilled');assert.ok([201,400,409].includes(racingResults[1].value.status));
    if(racingResults[0].status==='rejected')await recovery.execute(racingClaim,'nodia_ai:preconditions_changed');
    const [invalidReferences]=await db.query(`SELECT count(*)::int n FROM ${resource==='product'?'products':'invoices'} r JOIN providers p ON p.id=r.provider_id WHERE p.id=$1 AND r.business_id<>p.business_id`,[racingSupplier.id]);
    const racingState=await status(racingExecution.execution_id);
    check(`native ${resource} creation and confirmed supplier transfer serialize on the supplier and preserve business associations`,invalidReferences.n===0&&['completed','failed'].includes(racingState.state)&&!(racingState.state==='completed'&&racingResults[1].value.status===201));
  }
  for(const operation of ['create','update']) {
    const bulkRaceSupplier=await perform('providers','create',{business_id:business,name:`Synthetic bulk ${operation} race supplier`});
    const target=operation==='update'?await perform('products','create',{business_id:business,...prices,code:'SYN22-BULK-RACE-TARGET',provider_id:null}):null;
    const bulkRaceExecution=await admit(await proposal('providers','update',{business_id:business,id:bulkRaceSupplier.id,destination_business_id:businessTwo})),bulkRaceClaim=await claim();
    const body={items:[operation==='create'?{business_id:business,...prices,code:'SYN22-BULK-CREATE-RACE',provider_id:bulkRaceSupplier.id}:{id:target.id,provider_id:bulkRaceSupplier.id}]};
    const bulkRaceOutcomes=await Promise.allSettled([execute.execute(identities.get('1'),bulkRaceExecution.execution_id,bulkRaceClaim),fetch(base+'/products/bulk',{method:operation==='create'?'POST':'PUT',headers:{'content-type':'application/json','x-fixture-actor':'1'},body:JSON.stringify(body)})]);
    assert.equal(bulkRaceOutcomes[1].status,'fulfilled');assert.ok([200,201,400,409].includes(bulkRaceOutcomes[1].value.status));
    if(bulkRaceOutcomes[0].status==='rejected')await recovery.execute(bulkRaceClaim,'nodia_ai:preconditions_changed');
    const [bad]=await db.query('SELECT count(*)::int n FROM products p JOIN providers r ON r.id=p.provider_id WHERE r.id=$1 AND p.business_id<>r.business_id',[bulkRaceSupplier.id]);
    const state=await status(bulkRaceExecution.execution_id);
    check(`native bulk product ${operation} serializes with confirmed supplier transfer`,bad.n===0&&['completed','failed'].includes(state.state)&&!(state.state==='completed'&&bulkRaceOutcomes[1].value.status<300));
  }
  const providerBulkRace=await perform('providers','create',{business_id:business,name:'Synthetic provider bulk race'});
  const productRaceExecution=await admit(await proposal('products','create',{business_id:business,...prices,code:'SYN22-PROVIDER-BULK-RACE',provider_id:providerBulkRace.id})),productRaceClaim=await claim();
  const providerBulkOutcomes=await Promise.allSettled([execute.execute(identities.get('1'),productRaceExecution.execution_id,productRaceClaim),fetch(base+'/providers/bulk',{method:'PUT',headers:{'content-type':'application/json','x-fixture-actor':'1'},body:JSON.stringify({items:[{id:providerBulkRace.id,business_id:businessTwo}]})})]);
  assert.equal(providerBulkOutcomes[1].status,'fulfilled');assert.ok([200,409].includes(providerBulkOutcomes[1].value.status));
  if(providerBulkOutcomes[0].status==='rejected')await recovery.execute(productRaceClaim,'nodia_ai:preconditions_changed');
  const [badProviderBulk]=await db.query('SELECT count(*)::int n FROM products p JOIN providers r ON r.id=p.provider_id WHERE r.id=$1 AND p.business_id<>r.business_id',[providerBulkRace.id]);
  check('native bulk supplier transfer cannot bypass a confirmed product creation in flight',badProviderBulk.n===0&&!((await status(productRaceExecution.execution_id)).state==='completed'&&providerBulkOutcomes[1].value.status===200));
  const bulkSuccessOne=await perform('providers','create',{business_id:business,name:'Synthetic bulk success one'}),bulkSuccessTwo=await perform('providers','create',{business_id:business,name:'Synthetic bulk success two'});
  const bulkSuccess=await request('/providers/bulk',{method:'PUT',body:{items:[{id:bulkSuccessTwo.id,business_id:businessTwo},{id:bulkSuccessOne.id,business_id:businessTwo}]}});
  check('valid native bulk supplier transfers remain atomic and preserve requested response order',bulkSuccess[0].id===bulkSuccessTwo.id&&bulkSuccess[1].id===bulkSuccessOne.id&&(await request(`/providers/${bulkSuccessOne.id}`)).business_id===businessTwo&&(await request(`/providers/${bulkSuccessTwo.id}`)).business_id===businessTwo);
  const standalone=await admit(await proposal('providers','create',{business_id:businessTwo,name:'Synthetic standalone supplier'}));
  const child=spawn(process.execPath,[fileURLToPath(new URL('../dist/nodia-ai-worker.js',import.meta.url))],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODE_ENV:'test',RATE_LIMIT_STORAGE:'memory',POSTGRES_HOST:options.host,POSTGRES_PORT:String(options.port),POSTGRES_DB:options.database,POSTGRES_USER:options.username,POSTGRES_PASSWORD:options.password,GEMINI_MICROSERVICE_URL:'http://127.0.0.1:1',GEMINI_SERVICE_TOKEN:'',REDIS_HOST:'127.0.0.1',REDIS_PORT:'1'}});
  children.add(child);let output='',childExit;const stopped=new Promise(resolve=>child.once('exit',(code,signal)=>{childExit={code,signal};children.delete(child);resolve();}));
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
  try{
    const finished=await waitFor(async()=>{if(childExit)throw Error(`Standalone worker exited ${JSON.stringify(childExit)} ${output}`);return status(standalone.execution_id);},value=>value.state==='completed','standalone business operation',45000);
    check('standalone compiled worker resolves all native metadata and commits a new business effect',(await request(`/providers/${finished.steps[0].result_refs[0].id}`)).name==='synthetic standalone supplier');
    child.kill('SIGTERM');let drainTimer;try{await Promise.race([stopped,new Promise((_,reject)=>{drainTimer=setTimeout(()=>reject(Error('Standalone worker drain timeout')),15000);})]);}finally{clearTimeout(drainTimer);}
    check('standalone worker drains with its committed receipt preserved',(childExit.code===0||childExit.signal==='SIGTERM')&&(await status(standalone.execution_id)).state==='completed');
  }finally{await kill(child);}
  const nativeReads=[`/businesses/${business}`,`/providers/${supplier.id}`,`/providers/${supplier.id}/contacts`,`/products/${product.id}`,`/product-logs/${log.id}`,`/invoices/${invoice.id}`];
  for(const path of nativeReads)await request(path);
  check('all six business resource families remain readable through their native endpoints',nativeReads.length===6);
  check('all local business operations avoid AI provider calls and runtime slots',providerCalls===0&&await count('nodia_ai_runtime_slots')===0);
  check('execution attempts and delivery leases terminate without orphans',await count('nodia_ai_job_attempts','ended_at IS NULL')===0&&await count('nodia_ai_jobs',"state='leased'")===0);
  console.log(JSON.stringify({stage:'AI-22',scope:'compiled_http_confirmation_worker_disposable_postgresql_all_fourteen_native_business_mutations_no_provider_no_r2',checks:checks.length,exercised_operations:[...exercised].sort(),passed:checks},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-22',completed_checks:checks.length,last_checks:checks.slice(-4)}));throw error;}
finally{for(const child of children)await kill(child);if(app)await app.close();await fixture.close();}
