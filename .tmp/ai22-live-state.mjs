import fs from 'node:fs';
import { createRequire } from 'node:module';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016',require=createRequire(runtime+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(runtime+'/.env')));
require('reflect-metadata');
const {NodiaAiConfirmationModule}=await import(runtime+'/dist/nodia-ai-confirmation/nodia-ai-confirmation.module.js');
const {NODIA_AI_EXECUTION_ADMISSION}=await import(runtime+'/dist/nodia-ai-confirmation/types/execution-admission.types.js');
const admission=Reflect.getMetadata('providers',NodiaAiConfirmationModule).find(provider=>provider.provide===NODIA_AI_EXECUTION_ADMISSION);
if(typeof admission?.useFactory!=='function')throw Error('Missing actual admission registry factory');
const {PrepareNodiaAiFinanceMovementUseCase}=await import(runtime+'/dist/nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.js');
// Constructor only captures a ledger dependency; fields expose compiled contract metadata. No native method invoked.
const {BuildNodiaAiFinanceCatalogOperationsUseCase}=await import(runtime+'/dist/nodia-ai-finance-catalog/use-case/build-nodia-ai-finance-catalog-operations.use-case.js');
const {BuildNodiaAiFinanceLedgerOperationsUseCase}=await import(runtime+'/dist/nodia-ai-finance-ledger/use-case/build-nodia-ai-finance-ledger-operations.use-case.js');
const catalog=new BuildNodiaAiFinanceCatalogOperationsUseCase(null,null,null,null,null,null,null,null);
const ledger=new BuildNodiaAiFinanceLedgerOperationsUseCase(null,null,null,null,null,null);
const {BuildNodiaAiBusinessCatalogOperationsUseCase}=await import(runtime+'/dist/nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case.js');
const {BuildNodiaAiSupplierOperationsUseCase}=await import(runtime+'/dist/nodia-ai-supplier-operations/use-case/build-nodia-ai-supplier-operations.use-case.js');
const {BuildNodiaAiInvoiceOperationsUseCase}=await import(runtime+'/dist/nodia-ai-invoice-operations/use-case/build-nodia-ai-invoice-operations.use-case.js');
const {ValidateNodiaAiRuntimePolicyUseCase}=await import(runtime+'/dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js');
const policy=new ValidateNodiaAiRuntimePolicyUseCase().execute(JSON.parse(fs.readFileSync(runtime+'/dist/nodia-ai-runtime/config/runtime-policy.json','utf8')));
const business=new BuildNodiaAiBusinessCatalogOperationsUseCase(null,null,null,null,null,null,null,null);
const suppliers=new BuildNodiaAiSupplierOperationsUseCase(null,null,null,null,null);
const invoices=new BuildNodiaAiInvoiceOperationsUseCase(null,null,null,policy);
const registrations=admission.useFactory(new PrepareNodiaAiFinanceMovementUseCase(null),[...catalog.operations,...ledger.operations],[...business.operations,...suppliers.operations,...invoices.operations]);
if(registrations.length!==26)throw Error('Unexpected admission count');
const {Client}=require('pg'),db=new Client({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
await db.connect();
try {
 const [row]=(await db.query(`SELECT (SELECT count(*)::int FROM migrations) AS migrations,
 (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS tables,
 (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS columns,
 (SELECT count(*)::int FROM nodia_ai_confirmation_challenges) AS challenges,
 (SELECT count(*)::int FROM nodia_ai_executions) AS executions,
 (SELECT count(*)::int FROM nodia_ai_execution_steps) AS execution_steps,
 (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','waiting','leased','unknown')) AS pending_jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) AS open_attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) AS held_or_unknown_slots`)).rows;
 if(row.migrations!==24||row.tables!==18||row.columns!==239||row.challenges||row.executions||row.execution_steps||row.pending_jobs||row.open_attempts||row.held_or_unknown_slots)throw Error('Unexpected lab state');
 const pin=JSON.parse(fs.readFileSync(runtime+'/dist/nodia-ai-context/config/knowledge-pin.json','utf8'));
 const knowledge=JSON.parse(fs.readFileSync(runtime+'/dist/nodia-ai/knowledge/manifest.json','utf8'));
 console.log(JSON.stringify({stage:'AI-22',scope:'read_only_configured_private_lab',observed_at_utc:new Date().toISOString(),...row,knowledge_release:pin.release_id,published_capabilities:knowledge.capability_contracts.length,published_fragments:knowledge.fragments.length,production_executor_registrations:registrations.length,native_business_execution_enabled:registrations.length>0}));
} finally {await db.end();}
