// Offline schema/baseline verification; no DB, HTTP, accounts or provider inference.
const taskRoot=require('node:path').resolve(__dirname,'../../..');
process.chdir(taskRoot);

const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const Ajv=require(taskRoot+'/nodia-server/node_modules/ajv/dist/2020.js').default;
const formats=require(taskRoot+'/nodia-server/node_modules/ajv-formats').default;
const schemaPath='docs/mvp/nodia-ai-v1-common-contracts.schema.json';
const catalogPath='docs/mvp/nodia-ai-v1-tool-catalog.json';
const inventoryPath='docs/mvp/nodia-ai-current-endpoints.json';
const schema=JSON.parse(fs.readFileSync(schemaPath)),cat=JSON.parse(fs.readFileSync(catalogPath)),inv=JSON.parse(fs.readFileSync(inventoryPath));
const ajv=new Ajv({strict:true,allErrors:true});formats(ajv);ajv.addSchema(schema);
const validations=new Map(Object.keys(schema.$defs).map(k=>[k,ajv.getSchema(schema.$id+'#/$defs/'+k)]));
assert.equal(validations.size,148,'AI-33 closed common schema definition count');
const fixtureId='00000000-0000-4000-8000-000000000001';
function minimal(s){
 if(s.$ref){const key=s.$ref.split('/').at(-1);const preference={scope_key:'finance',scope:{},key:'expense_category_id',value:'1'};if(key==='PreferenceValue')return preference;if(key==='PreferenceItem')return {preference_id:fixtureId,...preference,revision:1,value_label:'Synthetic category',scope_label:null,available:true};if(key==='PreferencePrepareInput')return {operation:'create',...preference};if(key==='PreferencePrepareRequest')return {conversation_id:fixtureId,operation:'create',...preference};}
 if(Array.isArray(s.type)&&s.type.includes('null'))return null;
 if(s.$ref==='https://json-schema.org/draft/2020-12/schema')return {type:'object',properties:{},additionalProperties:false};
 if(s.$ref){const key=s.$ref.split('/').at(-1); if(key==='EntityCandidates')return {status:'unique',candidates:[{resource_key:'fixture',id:'1'}],next_cursor:null};if(key==='ProtocolId'||key==='DomainUuid')return fixtureId;if(key==='Hash')return 'a'.repeat(64);if(key==='ConfirmationToken')return 'A'.repeat(43);if(key==='BigintId'||key==='Sequence')return '1';if(key==='ConversationUpdateRequest')return {expected_conversation_revision:1,title:'fixture'};return minimal(schema.$defs[key]);}
 if(s.const!==undefined)return s.const;
 if(s.enum)return s.enum[0];
 if(s.anyOf||s.oneOf)return minimal((s.anyOf||s.oneOf)[0]);
 if(s.type==='object'){return Object.fromEntries((s.required||[]).map(k=>[k,minimal(s.properties[k])]));}
 if(s.type==='array')return Array.from({length:s.minItems||0},()=>minimal(s.items));
 if(s.type==='integer'||s.type==='number')return s.minimum??0;
 if(s.type==='boolean')return false;
 if(s.type==='null')return null;
 if(s.type==='string'){if(s.pattern==='^(0|[1-9][0-9]*)$')return '0';if(s.pattern==='^nodia_ai:[a-z0-9_]{1,100}$')return 'nodia_ai:synthetic';if(s.format==='date-time')return '2026-01-01T00:00:00Z';if(s.format==='date')return '2026-01-01';if(s.format==='uuid')return fixtureId;return 'fixture';}
 throw Error('Unsupported shape '+JSON.stringify(s));
}
const fixtures=[];
function check(key,value,expected,label){const validate=validations.get(key);assert(validate,'Missing schema '+key);const ok=validate(value);assert.equal(ok,expected,label+': '+JSON.stringify(validate.errors));fixtures.push({schema:key,label,expectedValid:expected});}
for(const [key]of validations)check(key,minimal({$ref:'#/$defs/'+key}),true,'minimal structural fixture');
const sample=k=>structuredClone(minimal({$ref:'#/$defs/'+k}));
for (const operation of ['api_key_create','api_key_update','api_key_delete','connection_login','nodia_logout','codex_logout','gemini_web_logout','sync_models']) check('SecureFlowReceipt',{schema_version:1,resource_key:'secure_flows',id:fixtureId,operation},true,'closed safe receipt '+operation);
for (const key of ['secret','session_id','native_reference','cookie','url','confirmation_token']) check('SecureFlowReceipt',{...sample('SecureFlowReceipt'),[key]:'forbidden'},false,'secret/native reference rejected '+key);
check('BigintId','9223372036854775807',true,'bigint max string preserved');
check('BigintId',Number(9223372036854775807n),false,'numeric ID rejected');
check('BigintId','0',false,'zero identity rejected');
check('BigintId','01',false,'noncanonical identity rejected');
check('BigintId','-1',false,'negative identity rejected');
check('BigintId','9999999999999999999',true,'shape alone does not enforce arithmetic upper bound');
assert(BigInt('9999999999999999999')>9223372036854775807n);
const financialReceipt={schema_version:1,resource_key:'finance_movements',resource_id:'9223372036854775807',subject_user_id:'9223372036854775807'};
for(const resource_key of ['ai_providers','ai_provider_catalog'])for(const operation of ['create','update'])
 check('AiProviderEffectReceipt',{schema_version:1,resource_key,operation,resource_id:'9007199254740993'},true,`non-secret AI ${resource_key} ${operation} witness`);
for(const delta of [{operation:'delete'},{resource_key:'users'},{resource_id:1},{resource_id:'0'},{api_key:'synthetic-forbidden'},{fields:{}},{command:{is_default:true}},{subject_user_id:'1'}])
 check('AiProviderEffectReceipt',{schema_version:1,resource_key:'ai_providers',operation:'update',resource_id:'1',...delta},false,'AI configuration receipt excludes unrelated identity and data '+JSON.stringify(delta));
check('FinancialMovementReceipt',financialReceipt,true,'minimal financial witness preserves maximum bigint identities as strings');
check('FinancialMovementReceipt',{...financialReceipt,resource_id:Number(9223372036854775807n)},false,'receipt resource identity rejects unsafe numeric coercion');
check('FinancialMovementReceipt',{...financialReceipt,subject_user_id:1},false,'receipt subject identity is a bigint string');
check('FinancialMovementReceipt',{...financialReceipt,owner_id:'1'},false,'receipt cannot add a competing owner identity');
check('FinancialMovementReceipt',{...financialReceipt,confirmation_token:'synthetic-secret'},false,'receipt excludes human approval credentials');
{const receipt={...financialReceipt};delete receipt.resource_id;check('FinancialMovementReceipt',receipt,false,'receipt must identify its financial resource');}
check('FinancialMovementReceipt',{...financialReceipt,resource_key:'finance_obligations'},false,'financial movement witness cannot nominate another resource family');
for(const resource_key of ['finance_movements','finance_categories','finance_category_groups','finance_obligations'])for(const operation of ['create','update','delete'])
 check('FinancialEffectReceipt',{...financialReceipt,resource_key,operation},true,`closed financial ${resource_key} ${operation} witness`);
check('FinancialEffectReceipt',{...financialReceipt,operation:'execute'},false,'financial witness rejects unknown operation');
check('FinancialEffectReceipt',{...financialReceipt,operation:'delete',resource_key:'users'},false,'financial witness rejects unrelated resource');
check('FinancialEffectReceipt',financialReceipt,false,'new financial witness requires operation');
check('FinancialEffectReceipt',{...financialReceipt,operation:'delete',command:{id:'1'}},false,'financial witness excludes executable command');
for(const resource_key of ['businesses','products','product_logs','providers','provider_contacts','invoices'])
 check('BusinessEffectReceipt',{schema_version:1,resource_key,operation:'create',resource_id:['businesses','product_logs'].includes(resource_key)?fixtureId:'9223372036854775807',business_id:fixtureId},true,`business ${resource_key} witness keeps native identity`);
check('BusinessEffectReceipt',{schema_version:1,resource_key:'invoices',operation:'update',resource_id:'1',business_id:fixtureId,storage_key:'forbidden'},false,'business witness cannot expose storage keys');
check('BusinessEffectReceipt',{schema_version:1,resource_key:'invoices',operation:'delete',resource_id:'1',business_id:fixtureId},false,'business witness cannot invent physical deletion');
check('BusinessEffectReceipt',{schema_version:1,resource_key:'invoices',operation:'update',resource_id:1,business_id:fixtureId},false,'business witness rejects numeric bigint identity');
check('BusinessEffectReceipt',{schema_version:1,resource_key:'invoices',operation:'update',resource_id:'1',business_id:'1'},false,'business witness requires UUID destination');
check('BusinessEffectReceipt',{schema_version:1,resource_key:'invoices',operation:'update',resource_id:'1',business_id:fixtureId,command:{provider_id:null}},false,'business witness excludes executable command');
check('BusinessEffectReceipt',{schema_version:1,resource_key:'invoices',operation:'update',resource_id:'1',business_id:fixtureId,confirmation_token:'A'.repeat(43)},false,'business witness excludes human approval token');
for(const resource_key of ['rental_properties','rental_collaborators','rental_cancellation_policies'])for(const operation of ['create','update'])
 check('RentalEffectReceipt',{schema_version:1,resource_key,operation,resource_id:'9223372036854775807',property_id:'9223372036854775807'},true,`closed rental ${resource_key} ${operation} witness`);
for(const delta of [{operation:'delete'},{property_id:1},{resource_key:'rental_payments'},{command:{is_active:false}},{request_key:fixtureId},{owner_id:'1'}])
 check('RentalEffectReceipt',{schema_version:1,resource_key:'rental_properties',operation:'update',resource_id:'1',property_id:'1',...delta},false,'rental receipt rejects unsupported identity operation or content '+JSON.stringify(delta));
check('ProposalEditableField',{...sample('ProposalEditableField'),kind:'rental_cancellation_rules',minimum:'1',maximum:'100',max_length:null},true,'policy rules use explicit structured review kind');
for(const operation of ['create','update','confirm','start','complete','cancel'])
 check('RentalEffectReceipt',{schema_version:1,resource_key:'rental_reservations',operation,resource_id:'9007199254740993',property_id:'7'},true,`reservation lifecycle ${operation} historical witness`);
for(const operation of ['confirm','start','complete','cancel'])for(const resource_key of ['rental_properties','rental_collaborators','rental_cancellation_policies'])
 check('RentalEffectReceipt',{schema_version:1,resource_key,operation,resource_id:'1',property_id:'7'},false,`configuration ${resource_key} cannot acquire reservation transition ${operation}`);
for(const delta of [{operation:'delete'},{operation:'pay'},{reservation_id:'1'},{cancelled_at:'2026-10-17T12:00:00Z'},{refund_amount:'0'},{policy_snapshot:{}}])
 check('RentalEffectReceipt',{schema_version:1,resource_key:'rental_reservations',operation:'cancel',resource_id:'1',property_id:'7',...delta},false,'reservation witness excludes unsupported operation or live agreement '+JSON.stringify(delta));
check('ProposalEditableField',{...sample('ProposalEditableField'),kind:'integer'},true,'native signed integer editor metadata is explicit');
const rentalReceiptOperations={
 rental_properties:['create','update'],rental_collaborators:['create','update'],rental_cancellation_policies:['create','update'],
 rental_reservations:['create','update','confirm','start','complete','cancel'],rental_payments:['create','void'],
 rental_expenses:['create','update','pay','void'],rental_blocks:['create','update'],rental_turnovers:['update','approve_same_day'],
};
for(const [resource_key,allowed] of Object.entries(rentalReceiptOperations))for(const operation of ['create','update','confirm','start','complete','cancel','void','pay','approve_same_day'])
 check('RentalEffectReceipt',{schema_version:1,resource_key,operation,resource_id:'9007199254740993',property_id:'7'},allowed.includes(operation),`AI26 exact native resource/operation ${resource_key}/${operation}`);
for(const resource_key of ['users','roles','actions','business_actions','modules','module_groups'])for(const operation of ['create','update','delete'])
 check('CoreEffectReceipt',{schema_version:1,resource_key,operation,resource_id:'9007199254740993'},!(resource_key==='users'&&operation==='delete'),`AI27 Core exact receipt ${resource_key}/${operation}`);
for(const delta of [{resource_id:1},{resource_id:'0'},{resource_key:'auth_sessions'},{operation:'execute'},{command:{roles:[]}},{subject_user_id:'1'}])
 check('CoreEffectReceipt',{schema_version:1,resource_key:'roles',operation:'delete',resource_id:'1',...delta},false,'Core receipt excludes invented action scope or payload '+JSON.stringify(delta));
for(const kind of ['core_id_list','core_translations'])check('ProposalEditableField',{...sample('ProposalEditableField'),kind},true,`Core closed structured editor ${kind}`);
check('Selection',{...sample('Selection'),model_id:''},false,'empty model rejected');
{const v=sample('Selection');delete v.model_id;check('Selection',v,false,'missing model has no fallback');}
check('MessageCreateRequest',{...sample('MessageCreateRequest'),parts:[]},false,'empty message rejected');
check('MessageCreateRequest',{...sample('MessageCreateRequest'),actor:fixtureId},false,'model cannot supply actor');
check('SecureFlowPrepareInput',{...sample('SecureFlowPrepareInput'),code:'synthetic'},false,'OAuth code rejected');
check('SecureFlowPrepareInput',{...sample('SecureFlowPrepareInput'),secret:'synthetic'},false,'API secret rejected');
check('SecureFlowPrepareInput',{...sample('SecureFlowPrepareInput'),password:'synthetic'},false,'password rejected');
check('PublicProposal',{...sample('PublicProposal'),confirmation_token:'synthetic'},false,'public proposal excludes approval token');
check('ConfirmationRequest',{...sample('ConfirmationRequest'),approved:true},false,'untyped approval flag rejected');
check('ConfirmationRequest',{...sample('ConfirmationRequest'),proposal_revision:0},false,'invalid confirmation revision');
check('ConfirmationToken','A'.repeat(43),true,'canonical random32-byte base64url nonce shape');
check('ConfirmationToken','A'.repeat(42),false,'short nonce rejected');
check('ConfirmationToken','A'.repeat(44),false,'long nonce rejected');
check('ConfirmationToken','A'.repeat(42)+'B',false,'noncanonical trailing base64url bits rejected');
check('ConfirmationToken','A'.repeat(42)+'=',false,'padded nonce rejected');
check('ConfirmationToken','+'.repeat(43),false,'ordinary base64 alphabet rejected');
check('ConfirmationRequest',{...sample('ConfirmationRequest'),proposal_revision:2147483648},false,'confirmation revision cannot overflow PostgreSQL integer');
check('ConfirmationRequest',{...sample('ConfirmationRequest'),actor_id:'1'},false,'human approval derives actor from current session');
check('ConfirmationChallengeRequest',{...sample('ConfirmationChallengeRequest'),confirmation_token:'A'.repeat(43)},false,'challenge request cannot nominate its own nonce');
check('ProposalReviewMetadata',{...sample('ProposalReviewMetadata'),command_template:{sql:'synthetic'}},false,'human review metadata excludes executable commands');
check('ProposalReviewMetadata',{...sample('ProposalReviewMetadata'),confirmation_token:'A'.repeat(43)},false,'review metadata never mints or includes challenge token');
check('ProposalEditableField',{...sample('ProposalEditableField'),kind:'json'},false,'editor cannot accept arbitrary JSON command input');
check('ProposalEditableField',{...sample('ProposalEditableField'),path:'/scope/actor'},false,'typed editor has no arbitrary pointer');
check('ExecutionChangedEvent',{...sample('ExecutionChangedEvent'),run_id:fixtureId},false,'execution observation never borrows model run identity');
{const value=sample('ExecutionChangedEvent');delete value.execution_id;check('ExecutionChangedEvent',value,false,'execution event requires its own durable identity');}
check('ExecutionChangedEvent',{...sample('ExecutionChangedEvent'),payload:{...sample('ExecutionChangedEvent').payload,confirmation_token:'A'.repeat(43)}},false,'approval credentials never enter outbox');
check('PublicScope',{...sample('PublicScope'),actor:fixtureId},false,'scope cannot impersonate actor');
check('ReportQueryInput',{...sample('ReportQueryInput'),sql:'synthetic'},false,'raw SQL property rejected');
check('ReportQueryInput',{...sample('ReportQueryInput'),table:'synthetic'},false,'raw table property rejected');
check('ReportQueryInput',{...sample('ReportQueryInput'),url:'https://invalid.example'},false,'arbitrary URL property rejected');
check('ReportQueryInput',{...sample('ReportQueryInput'),combine:'sum_all'},false,'unregistered cross-source grand total rejected');
check('ReportQueryInput',{...sample('ReportQueryInput'),page_limit:0},false,'zero query page rejected');
check('ReportQueryInput',{...sample('ReportQueryInput'),sources:[]},false,'empty report source set rejected');
check('MeasureRequest',{...sample('MeasureRequest'),aggregation:'arbitrary_sql'},false,'unsupported aggregate rejected');
check('ContainsPredicate',{...sample('ContainsPredicate'),value:0},false,'contains requires text');
check('InPredicate',{...sample('InPredicate'),value:[]},false,'empty IN rejected');
check('SimplePredicate',{...sample('SimplePredicate'),value:false},true,'false filter preserved');
check('SimplePredicate',{...sample('SimplePredicate'),value:0},true,'zero filter preserved');
check('SimplePredicate',{...sample('SimplePredicate'),value:null},true,'nullable scalar preserved subject to field semantics');
check('CivilPeriod',{...sample('CivilPeriod'),from:'2026-02-30'},false,'invalid civil date rejected');
check('InstantPeriod',{...sample('InstantPeriod'),from:'2026-01-01'},false,'instant requires offset datetime');
check('ChangedField',{...sample('ChangedField'),before:0,after:null,before_present:true,after_present:true},true,'zero and real null are distinct values');
{const v=sample('ChangedField');delete v.before_present;check('ChangedField',v,false,'absent-vs-null metadata required');}
check('WorkflowPrepareInput',{...sample('WorkflowPrepareInput'),draft_ids:[fixtureId,fixtureId]},false,'workflow drafts cannot repeat');
const workflowIds=Array.from({length:9},(_,index)=>'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'));
const workflowBinding={draft_id:workflowIds[1],target_field_key:'provider_id',from_draft_id:workflowIds[0],output_key:'id'};
const workflowInput={catalog_version:'nodia-ai-ai23-workflow/1',draft_ids:workflowIds.slice(0,2),bindings:[workflowBinding]};
check('WorkflowPrepareInput',workflowInput,true,'closed draft-to-draft typed future binding shape');
check('WorkflowPrepareInput',{catalog_version:workflowInput.catalog_version,draft_ids:workflowIds.slice(0,8)},true,'eight-step sequential workflow structural boundary');
check('WorkflowPrepareInput',{catalog_version:workflowInput.catalog_version,draft_ids:workflowIds},false,'ninth workflow step rejected');
check('WorkflowPrepareInput',{...workflowInput,bindings:[workflowBinding,workflowBinding]},false,'duplicate future binding objects rejected');
check('WorkflowPrepareInput',{...workflowInput,bindings:[{...workflowBinding,sql:'forbidden'}]},false,'future binding cannot carry raw SQL or an executable expression');
check('WorkflowPrepareInput',{...workflowInput,bindings:[{...workflowBinding,path:'/command/provider_id'}]},false,'future binding cannot nominate arbitrary command paths');
check('WorkflowPrepareInput',{...workflowInput,bindings:[{...workflowBinding,from_draft_id:'1'}]},false,'future binding source remains a protocol UUID');
check('WorkflowPrepareInput',{...workflowInput,bindings:[{...workflowBinding,target_field_key:'x'.repeat(129)}]},false,'future binding target key is bounded');
check('WorkflowPrepareInput',{...workflowInput,bindings:[{...workflowBinding,output_key:''}]},false,'future binding output must be named');
{const binding={...workflowBinding};delete binding.from_draft_id;check('WorkflowPrepareInput',{...workflowInput,bindings:[binding]},false,'future binding requires an explicit source draft');}
const remainingInput={execution_id:fixtureId,expected_execution_revision:1,edits:[{step_id:workflowIds[1],field_key:'name',value:'Synthetic corrected contact'}]};
check('RemainingWorkflowPrepareInput',remainingInput,true,'pending correction carries exact execution revision and registered field edit shape');
check('RemainingWorkflowPrepareInput',{...remainingInput,edits:[{...remainingInput.edits[0],value:0}]},true,'pending correction preserves explicit zero');
check('RemainingWorkflowPrepareInput',{...remainingInput,edits:[]},false,'material pending correction requires at least one explicit edit');
check('RemainingWorkflowPrepareInput',{...remainingInput,expected_execution_revision:0},false,'pending correction cannot nominate revision zero');
check('RemainingWorkflowPrepareInput',{...remainingInput,expected_execution_revision:2147483648},false,'pending correction revision cannot overflow PostgreSQL integer');
check('RemainingWorkflowPrepareInput',{...remainingInput,actor_id:'2'},false,'pending correction derives actor from its authenticated context');
check('RemainingWorkflowPrepareInput',{...remainingInput,confirmation_token:'A'.repeat(43)},false,'preparation never accepts human confirmation credentials');
check('RemainingWorkflowPrepareInput',{...remainingInput,edits:[{...remainingInput.edits[0],path:'/scope/business_id'}]},false,'pending correction cannot inject an arbitrary command pointer');
check('RemainingWorkflowPrepareInput',{...remainingInput,edits:Array.from({length:129},(_,index)=>({...remainingInput.edits[0],field_key:'synthetic_'+index}))},false,'pending correction collection is bounded');
check('PublicStep',{...sample('PublicStep'),output_bindings:[{target_field_key:'fixture_reference',from_step_id:fixtureId,output_key:'created_id'}]},true,'declared output binding shape accepted');
check('PublicStep',{...sample('PublicStep'),output_bindings:[{target_field_key:'fixture_reference',from_step_id:fixtureId,output_key:'created_id',sql:'synthetic'}]},false,'output binding rejects raw expression');
check('ExecutionStatus',{...sample('ExecutionStatus'),state:'unknown'},true,'uncertain execution representable');
check('ExecutionStatus',{...sample('ExecutionStatus'),state:'assumed_success'},false,'invented state rejected');
check('StepStatus',{...sample('StepStatus'),state:'unknown'},true,'uncertain step representable');
check('AttachmentMetadata',{...sample('AttachmentMetadata'),duration_seconds:0},true,'real zero metadata preserved');
check('AttachmentMetadata',{...sample('AttachmentMetadata'),duration_seconds:null},true,'unknown metadata preserved');
check('ApiError',{...sample('ApiError'),stack:'synthetic'},false,'raw stack excluded');
const acceptedPreference={operation:'create',scope_key:'finance',scope:{},key:'expense_category_id',value:'1'};
check('PreferencePrepareInput',acceptedPreference,true,'registered typed category memory');
for(const value of [false,0,null,'free text memory',{},[]])check('PreferencePrepareInput',{...acceptedPreference,value},false,'AI-33 memory values are closed references '+JSON.stringify(value));
for(const key of ['api_key','password','role','permission','system_prompt','payment_status'])check('PreferencePrepareInput',{...acceptedPreference,key},false,'no secret, authority, free memory or ambiguous status '+key);
check('PreferencePrepareInput',{...acceptedPreference,scope_key:'rental'},false,'key cannot move to a different product scope');
check('PreferencePrepareInput',{operation:'create',scope_key:'business',scope:{business_id:fixtureId},key:'supplier_id',value:'1'},true,'supplier memory has an explicit business scope');
check('PreferencePrepareInput',{operation:'create',scope_key:'business',scope:{},key:'supplier_id',value:'1'},false,'supplier memory cannot be global');
check('PreferencePrepareInput',{operation:'update',preference_id:fixtureId,expected_revision:1,value:'2'},true,'memory update uses CAS');
check('PreferencePrepareInput',{operation:'update',preference_id:fixtureId,value:'2'},false,'memory update requires the exact revision');
check('PreferencePrepareInput',{operation:'delete',preference_id:fixtureId,expected_revision:1},true,'forgetting is an exact revision proposal');
for(const operation of ['create','update','delete'])check('PreferenceEffectReceipt',{schema_version:1,resource_key:'nodia_ai_preferences',operation,resource_id:fixtureId,owner_id:'1',revision:1},true,'closed preference effect '+operation);
for(const extra of [{value:'1'},{scope:{}},{secret:'forbidden'},{confirmation_token:'forbidden'}])check('PreferenceEffectReceipt',{schema_version:1,resource_key:'nodia_ai_preferences',operation:'create',resource_id:fixtureId,owner_id:'1',revision:1,...extra},false,'memory receipt contains no content or secrets '+Object.keys(extra)[0]);

check('Selection',{...sample('Selection'),model_id:'   '},false,'whitespace model has no identity');
check('MessageCreateRequest',{...sample('MessageCreateRequest'),expected_conversation_revision:0},false,'message revision agrees with positive ERD revision');
check('MessageCreateRequest',{...sample('MessageCreateRequest'),expected_conversation_revision:2147483648},false,'revision overflow rejected');
check('ConversationUpdateRequest',{expected_conversation_revision:1},false,'empty metadata patch rejected');
check('ConversationUpdateRequest',{expected_conversation_revision:1,is_pinned:false},true,'false is a valid explicit metadata edit');
check('ConversationUpdateRequest',{expected_conversation_revision:1,title:null},true,'null resets an unassigned title');
check('ConversationUpdateRequest',{expected_conversation_revision:1,selection:sample('Selection')},false,'selection has its own endpoint');
check('ConversationUpdateRequest',{expected_conversation_revision:1,owner_user_id:'2'},false,'metadata cannot transfer chat ownership');
check('ConversationListQuery',{is_pinned:'false'},false,'query requires canonical HTTP normalization');
check('ConversationListQuery',{page_limit:0},false,'zero page limit rejected');
check('ConversationListQuery',{cursor:'not a cursor'},false,'cursor syntax rejected');
const phoneProjection={kind:'array',items:[{kind:'object',fields:[{field_key:'number',value:'+56900000000'}]}]};
check('ReviewValue',phoneProjection,true,'tagged phone collection can be reviewed without raw execution JSON');
check('ReviewValue',{number:'+56900000000'},false,'untyped object rejected in preview/edit');
check('ReviewValue',[{number:'+56900000000'}],false,'untyped array rejected in preview/edit');
check('ReviewValue',{kind:'object',fields:[{field_key:'active',value:false},{field_key:'amount',value:'0'},{field_key:'comment',value:null}]},true,'false zero-string and null remain distinct');
check('ProposalUpdateRequest',{...sample('ProposalUpdateRequest'),edits:[]},false,'empty proposal edit rejected');
check('ProposalUpdateRequest',{...sample('ProposalUpdateRequest'),command:{sql:'fixture'}},false,'raw replacement command rejected');
check('ProposalUpdateRequest',{...sample('ProposalUpdateRequest'),edits:[{step_id:fixtureId,json_pointer:'/scope/actor',value:'fixture'}]},false,'arbitrary JSON pointer rejected');
check('ProposalUpdateRequest',{...sample('ProposalUpdateRequest'),actor:fixtureId},false,'edit cannot supply actor');
check('ProposalUpdateRequest',{...sample('ProposalUpdateRequest'),edits:[{step_id:fixtureId,field_key:'phone',value:phoneProjection}]},true,'typed collection edit accepted structurally');
check('ConfirmationChallengeResponse',{...sample('ConfirmationChallengeResponse'),session_token:'fixture'},false,'human challenge does not expose Nodia session');
check('PublicEvent',{...sample('RunAcceptedEvent'),confirmation_token:'fixture'},false,'public event excludes approval token');
check('ToolCompletedEvent',{...sample('ToolCompletedEvent'),payload:{...sample('ToolCompletedEvent').payload,result:{sql:'fixture'}}},false,'event references a result rather than copying arbitrary data');
check('PublicEvent',{...sample('RunAcceptedEvent'),kind:'execute_sql'},false,'unregistered event kind rejected');
check('AssistantDeltaEvent',{...sample('AssistantDeltaEvent'),seq:1},false,'bigint sequence is not a JS number');
check('RestrictedMessage',{...sample('RestrictedMessage'),parts:[{kind:'text',text:'fixture-private'}]},false,'restricted message cannot contain text');
check('ChatConnectionSummary',{...sample('ChatConnectionSummary'),fields:{api_key:'fixture'}},false,'chat connection projection excludes administrative credential JSON');
check('ChatModeSummary',{...sample('ChatModeSummary'),inference:'healthy'},false,'configuration cannot invent verified inference');
check('ApiErrorResponse',{error:{...sample('ApiError'),stack:'fixture'}},false,'raw errors do not enter the wire contract');
check('CapabilitySchemas',{...sample('CapabilitySchemas'),input_schema:'fixture'},false,'resolved schema must be a JSON Schema document');
check('AttachmentUploadMetadata',{...sample('AttachmentUploadMetadata'),storage_key:'fixture'},false,'storage key is generated by Server');
check('AttachmentUploadMetadata',{...sample('AttachmentUploadMetadata'),actor:fixtureId},false,'upload cannot impersonate owner');
check('ExecutionCancelRequest',{...sample('ExecutionCancelRequest'),expected_execution_revision:0},false,'operation cancel revision must be positive');
check('UtcInstant','2026-10-14T12:00:00-03:00',false,'server output is UTC; civil domain dates have separate types');
check('PublicStep',{...sample('PublicStep'),depends_on:[fixtureId,fixtureId]},false,'exact duplicate dependencies rejected');
// AI-14 bounded discovery contracts. Synthetic fixture values never register tools.
check('CatalogSearchInput',{query:'x'.repeat(256),module_key:'x'.repeat(128),cursor:'x'.repeat(2048)},true,'bounded catalog search boundary');
check('CatalogSearchInput',{query:'😀'.repeat(256)},true,'Unicode query length counts code points');
check('CatalogSearchInput',{query:'x'.repeat(257)},false,'catalog query overflow rejected');
check('CatalogSearchInput',{module_key:'x'.repeat(129)},false,'catalog module key overflow rejected');
check('CatalogSearchInput',{cursor:'x'.repeat(2049)},false,'catalog cursor overflow rejected');
check('CatalogSearchInput',{actor:'synthetic'},false,'discovery cannot supply actor');
check('CatalogDescribeInput',{tool_name:'x'.repeat(128),catalog_version:'x'.repeat(128)},true,'bounded descriptor identity boundary');
check('CatalogDescribeInput',{tool_name:'x'.repeat(129),catalog_version:'synthetic'},false,'descriptor name overflow rejected');
check('CatalogDescribeInput',{tool_name:'synthetic',catalog_version:'x'.repeat(129)},false,'catalog version overflow rejected');
check('EntitySearchInput',{...sample('EntitySearchInput'),term:'x'.repeat(256),resource_key:'x'.repeat(128),cursor:'x'.repeat(2048)},true,'bounded entity search boundary');
check('EntitySearchInput',{...sample('EntitySearchInput'),term:'x'.repeat(257)},false,'entity term overflow rejected');
check('EntitySearchInput',{...sample('EntitySearchInput'),resource_key:'x'.repeat(129)},false,'entity resource overflow rejected');
check('EntitySearchInput',{...sample('EntitySearchInput'),cursor:'x'.repeat(2049)},false,'entity cursor overflow rejected');
check('EntitySearchInput',{...sample('EntitySearchInput'),scope:{actor:'synthetic'}},false,'entity scope cannot impersonate actor');

check('EntityCandidates',{status:'unique',candidates:[{resource_key:'fixture',id:'1'}],next_cursor:'more'},false,'page of one does not prove unique');
check('EntityCandidates',{status:'unique',candidates:[],next_cursor:null},false,'unique needs one candidate');
check('EntityCandidates',{status:'empty',candidates:[{resource_key:'fixture',id:'1'}],next_cursor:null},false,'empty cannot contain candidates');
check('EntityCandidates',{status:'empty',candidates:[],next_cursor:'more'},false,'empty cannot hide later candidates');
check('EntityCandidates',{status:'ambiguous',candidates:[{resource_key:'fixture',id:'1'}],next_cursor:null},false,'single complete candidate is not ambiguous');
check('EntityCandidates',{status:'ambiguous',candidates:[{resource_key:'fixture',id:'1'}],next_cursor:'more'},true,'partial page of one remains ambiguous');
check('EntityCandidates',{status:'ambiguous',candidates:[{resource_key:'fixture',id:'1'},{resource_key:'fixture',id:'2'}],next_cursor:null},true,'multiple complete candidates remain ambiguous');

const apiPath='docs/mvp/nodia-ai-v1-coordination-api.json';
const api=JSON.parse(fs.readFileSync(apiPath));
assert.equal(api.routes.length,41);
assert.equal(new Set(api.routes.map(r=>r.method+' '+r.path)).size,api.routes.length);
const implementedCoordination = new Set([
 'GET /api/v1/nodia-ai/preferences','GET /api/v1/nodia-ai/preferences/catalog','GET /api/v1/nodia-ai/preferences/options','POST /api/v1/nodia-ai/preferences/prepare',
 'GET /api/v1/nodia-ai/attachments/capabilities','POST /api/v1/nodia-ai/attachments','GET /api/v1/nodia-ai/attachments/:id','PUT /api/v1/nodia-ai/attachments/:id/content','GET /api/v1/nodia-ai/attachments/:id/content','PATCH /api/v1/nodia-ai/attachments/:id/interpretation','DELETE /api/v1/nodia-ai/attachments/:id',
 'POST /api/v1/nodia-ai/conversations','GET /api/v1/nodia-ai/conversations',
 'GET /api/v1/nodia-ai/conversations/:id','PATCH /api/v1/nodia-ai/conversations/:id',
 'GET /api/v1/nodia-ai/conversations/:id/messages','POST /api/v1/nodia-ai/conversations/:id/messages',
 'PATCH /api/v1/nodia-ai/conversations/:id/selection',
 'PATCH /api/v1/nodia-ai/conversations/:id/routing',
 'GET /api/v1/nodia-ai/connections',
 'GET /api/v1/nodia-ai/connections/:id/eligibility',
 'GET /api/v1/nodia-ai/capabilities',
 'GET /api/v1/nodia-ai/capabilities/:name',
 'GET /api/v1/nodia-ai/capabilities/:name/schema',
 'GET /api/v1/nodia-ai/artifacts/:reference',
 'GET /api/v1/nodia-ai/runs/:id',
 'GET /api/v1/nodia-ai/runs/:id/events',
 'GET /api/v1/nodia-ai/tool-calls/:id/result',
 'GET /api/v1/nodia-ai/tool-calls/:id/observation',
 'GET /api/v1/nodia-ai/proposals/:id',
 'PATCH /api/v1/nodia-ai/proposals/:id',
 'POST /api/v1/nodia-ai/proposals/:id/cancel',
 'GET /api/v1/nodia-ai/proposals/:id/review-metadata',
 'POST /api/v1/nodia-ai/proposals/:id/confirmation-challenge',
 'POST /api/v1/nodia-ai/proposals/:id/confirm',
 'GET /api/v1/nodia-ai/operations/:id',
 'POST /api/v1/nodia-ai/operations/:id/cancel',
 'POST /api/v1/nodia-ai/operations/:id/resume',
 'GET /api/v1/nodia-ai/operations/:id/secure-flow',
 'POST /api/v1/nodia-ai/operations/:id/secure-flow/:reference/:action',
]);
const attachmentSchema=JSON.parse(fs.readFileSync('nodia-server/src/nodia-ai-attachment/config/attachment-contract.schema.json','utf8'));
ajv.addSchema(attachmentSchema);
for(const r of api.routes){
 assert.equal(r.implemented,implementedCoordination.has(r.method+' '+r.path));
 if(r.inputContract)assert(validations.has(r.inputContract),'unknown request '+r.path);
 if(r.implementationPhase==='AI-32'){assert.equal(r.implementationSchema,'nodia-server/src/nodia-ai-attachment/config/attachment-contract.schema.json');for(const key of [r.inputDefinition,r.outputDefinition].filter(Boolean))assert(ajv.getSchema(attachmentSchema.$id+'#/$defs/'+key),'unknown attachment contract '+key);}
 if(r.outputContract)assert(validations.has(r.outputContract),'unknown response '+r.path);
 if(r.sseFrameContract)assert(validations.has(r.sseFrameContract));
 if(!r.outputContract)assert.equal(r.outputResolution,r.path.includes('/attachments')?(r.method==='GET'&&r.path.endsWith('/content')?'private_attachment_stream':'registered_attachment_output_schema'):r.path.includes('/secure-flow')?'private_secure_human_transport':r.path==='/api/v1/nodia-ai/artifacts/:reference'?'private_artifact_stream':'registered_tool_output_schema');
 if(/confirmation-challenge|\/confirm$|\/operations\/.*\/(resume|cancel)$/.test(r.path))assert.equal(r.channel,'human');
}

// AI-09 typed routing/stage contracts, not runtime authorization evidence.
check('SelectionUpdateRequest',{...sample('SelectionUpdateRequest'),expected_conversation_revision:0},false,'selection revision must be positive');
check('Selection',{...sample('Selection'),effort_id:null},true,'unknown effort remains explicit null');
check('Selection',{...sample('Selection'),effort_id:''},false,'empty effort is not a configured identifier');
check('RoutingSnapshot',{...sample('RoutingSnapshot'),enabled:true,target:null},false,'enabled routing needs an exact target');
check('RoutingSnapshot',{...sample('RoutingSnapshot'),enabled:false,target:null},true,'disabled routing preserves absence without inventing a destination');
check('AgenticSelection',{...sample('AgenticSelection'),mode:'api_key'},false,'API is not an automatic destination in v1');
check('RoutingTarget',{...sample('RoutingTarget'),cookie:'synthetic'},false,'routing observations cannot include credentials');
check('RoutingUpdateRequest',{...sample('RoutingUpdateRequest'),expected_routing_revision:0},false,'routing change is revisioned');
check('RoutingUpdateRequest',{...sample('RoutingUpdateRequest'),enabled:'false'},false,'routing false is not a truthy string');
check('RunBudgetUsage',{...sample('RunBudgetUsage'),tool_calls:-1},false,'used budget cannot be negative');
check('RunBudgetUsage',{...sample('RunBudgetUsage'),tool_calls:0},true,'real zero budget use is preserved');
check('RunStageProvenance',{...sample('RunStageProvenance'),routing_phase:'fallback'},false,'failure cannot create an automatic fallback stage');
check('MessageListQuery',{direction:'backward',page_limit:20},true,'bounded latest window is explicitly selected');
check('MessageListQuery',{direction:'descending'},false,'arbitrary message query direction is rejected');
check('ChatConnectionListQuery',{direction:'backward'},false,'connection cursors do not accept message direction');
check('ChatEligibilityQuery',{mode:'token_plan_web',model_id:'synthetic-model'},true,'omitted effort means provider default');
check('ChatEligibilityQuery',{mode:'token_plan_web',model_id:'synthetic-model',effort_id:null},false,'query effort omits null rather than coercing it');
check('ChatEligibility',{...sample('ChatEligibility'),resource_key:'synthetic-private'},false,'public eligibility excludes physical profile identities');
check('EventPage',{...sample('EventPage'),has_more:true},true,'event checkpoint and backlog flag are distinct');
{const value=sample('EventPage');delete value.has_more;check('EventPage',value,false,'durable observer needs explicit backlog state');}
check('EventPage',{...sample('EventPage'),delivered:true},false,'no global delivery flag');
check('VisibleMessage',{...sample('VisibleMessage'),run_id:null},true,'legacy message has no fabricated run');
check('ToolObservation',{...sample('ToolObservation'),summary:{total:0,returned:0}},true,'real zero result counts retained');
check('ToolObservation',{...sample('ToolObservation'),summary:{total:null,returned:null}},true,'unknown result counts retained');
check('ToolObservation',{...sample('ToolObservation'),result:{rows:[]}},false,'metadata never becomes generic result JSON');
check('ResultNavigation',{kind:'business_detail',id:'00000000-0000-1000-8000-000000000001',module_route:'/tools/business',label:null},true,'native historic UUID version preserved');
check('ResultNavigation',{kind:'module',id:null,module_route:'https://invalid.example',label:null},false,'external result destination denied');
check('ResultNavigation',{kind:'rental_property',id:'1',module_route:'/tools/business',label:null},false,'property cannot navigate into another module');
check('ToolObservation',{...sample('ToolObservation'),url:'https://invalid.example'},false,'arbitrary observation URLs denied');
check('ProposalVersionQuery',{},true,'omitted revision resolves current proposal');
check('ProposalVersionQuery',{revision:1},true,'exact historical revision supported');
check('ProposalVersionQuery',{revision:'1'},false,'normalized revision is an integer');
check('ProposalVersionQuery',{revision:0},false,'revision zero denied');
check('ProposalVersionQuery',{revision:1,owner_id:'1'},false,'query cannot override proposal ownership');

const handlers=inv.controllers.flatMap(c=>c.operations.map(o=>({controller:c,...o})));
const rentalHandlers=handlers.filter(handler=>handler.controller.name.startsWith('Rental'));
assert.equal(rentalHandlers.length,44,'complete native rental endpoint family');
const rentalCoverage=rentalHandlers.map(handler=>cat.handlerCoverage.find(entry=>entry.operationId===handler.operationId));
assert(rentalCoverage.every(Boolean),'every rental handler has explicit treatment');
const rentalPrepareNames=rentalCoverage.flatMap(entry=>entry.toolNames).filter(name=>name.includes('_prepare_'));
assert.equal(rentalPrepareNames.length,22,'twenty-two individual internal rental writers');
assert.equal(rentalCoverage.filter(entry=>entry.treatment==='coordinator_internal').length,1);
assert.equal(rentalCoverage.filter(entry=>entry.treatment==='coordinator_internal')[0].operationId,'RentalHistoryController.recover');
assert.equal(rentalCoverage.flatMap(entry=>entry.toolNames).filter(name=>!name.includes('_prepare_')).length,21);
const rentalIdentitySource=fs.readFileSync('nodia-server/src/nodia-ai-proposal/types/local-operation.types.ts','utf8');
assert.deepEqual([...rentalIdentitySource.matchAll(/\b(nodia_rental_[a-z_]+_prepare_[a-z_]+):/g)].map(match=>match[1]).sort(),rentalPrepareNames.sort(),'receipt identity whitelist matches the complete native writer family');
assert.deepEqual(inv.ai26.rentalEndpointCoverage,{total:44,publishedReads:21,internalWrites:22,internalRecovery:1});
assert.equal(inv.ai26.nativeOperations,48);
assert.equal(inv.ai26.databaseMigrations,0);
for(const name of ['NodiaAiExecutionModule','NodiaAiFinanceEffectModule','NodiaAiNativeEffectModule','NodiaAiBusinessCatalogModule','NodiaAiSupplierOperationsModule','NodiaAiInvoiceOperationsModule','InvoicePersistenceModule']){const module=inv.modules.find(item=>item.module===name);assert(module,'missing internal local operation module '+name);assert.deepEqual(module.controllers,[],'internal operation/persistence modules add no execution HTTP controller');}
assert(inv.modules.find(item=>item.module==='NodiaAiModule').imports.includes('NodiaAiExecutionModule'));
assert.deepEqual(inv.modules.find(item=>item.module==='NodiaAiFinanceEffectModule').imports,['NodiaAiProposalModule','FinanceMovementModule']);
assert.deepEqual(inv.modules.find(item=>item.module==='NodiaAiInvoiceOperationsModule').imports,['InvoicePersistenceModule','NodiaAiRuntimePolicyModule']);
assert(inv.modules.find(item=>item.module==='InvoiceModule').imports.includes('InvoicePersistenceModule'));
assert(!inv.modules.find(item=>item.module==='NodiaAiInvoiceOperationsModule').imports.includes('InvoiceModule'),'SQL ports must not import the native upload/OCR daemon module');
assert.equal(inv.ai22.nativeBusinessOperations,14);
assert.equal(inv.ai22.databaseMigrations,0);
assert.equal(inv.ai23.nativeOperations,26);
assert.equal(inv.ai23.maximumStepsPerProposal,8);
assert.equal(schema.$defs.WorkflowPrepareInput.properties.draft_ids.maxItems,inv.ai23.maximumStepsPerProposal);
assert.equal(inv.ai23.databaseMigrations,1);
assert.equal(inv.ai23.newTables,0);
assert.deepEqual(inv.ai23.newColumns,[{table:'nodia_ai_execution_steps',column:'bound_command',type:'jsonb',nullable:true},{table:'nodia_ai_proposals',column:'prior_execution_id',type:'uuid',nullable:true}]);
assert.deepEqual(inv.ai23.typedOutputBindings,[{sourceTool:'nodia_providers_prepare_create',outputKey:'id',outputType:'provider_id',targetTool:'nodia_provider_contacts_prepare_create',targetFieldKey:'provider_id'}]);
for(const file of ['nodia-server/src/nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case.ts','nodia-server/src/nodia-ai-proposal/use-case/prepare-nodia-ai-remaining-workflow.use-case.ts','nodia-server/src/nodia-ai-execution/types/bound-execution-step.ts','nodia-server/src/nodia-ai-execution/types/sequential-execution.ts','nodia-server/src/migrations/1792700000000-AddNodiaAiWorkflowBindings.ts'])assert(inv.sourceChecksums.some(source=>source.file===file),'missing AI23 source checksum '+file);
assert.equal(handlers.length,inv.counts.handlerOperations);assert.equal(cat.handlerCoverage.length,177);
assert.equal(new Set(cat.handlerCoverage.map(h=>h.operationId)).size,177);
const byId=new Map(handlers.map(o=>[o.operationId,o]));
for(const h of cat.handlerCoverage)assert(byId.has(h.operationId),'unknown source handler');
const catalogHandlerIds=new Set(cat.handlerCoverage.map(handler=>handler.operationId));
const coordinationHandlers=handlers.filter(handler=>!catalogHandlerIds.has(handler.operationId));
assert.equal(coordinationHandlers.length,implementedCoordination.size);
assert(coordinationHandlers.every(handler=>['NodiaAiConversationController','NodiaAiConnectionsController','NodiaAiCapabilitiesController','NodiaAiArtifactsController','NodiaAiObservationController','NodiaAiProposalController','NodiaAiConfirmationController','NodiaAiOperationController','NodiaAiProposalReviewController','NodiaAiSecureFlowController','NodiaAiAttachmentController','NodiaAiPreferenceController'].includes(handler.controller.name) && handler.nodiaAiProposal.category==='A'));
assert.deepEqual(new Set(coordinationHandlers.flatMap(handler=>handler.paths.map(route=>handler.method+' '+route))),implementedCoordination);
const tools=[...cat.domainTools,...cat.commonTools,...cat.secureFlowTools];
assert.equal(tools.length,156);assert.equal(new Set(tools.map(t=>t.name)).size,156);
assert.equal(cat.domainTools.length,141);
const implementedCommonTools=new Set(['nodia_capabilities_search','nodia_capabilities_describe','nodia_entities_search']);
assert.deepEqual(new Set(cat.commonTools.filter(tool=>tool.publication.implemented).map(tool=>tool.name)),implementedCommonTools);
const implementedDomainTools = cat.domainTools.filter(tool => tool.publication.implemented);
assert.equal(implementedDomainTools.length,67,'AI-15 read/artifact candidate coverage');
const publishedRegistry=JSON.parse(fs.readFileSync('nodia-server/config/nodia-ai-knowledge.registry.json','utf8'));
const runtimePublishedNames=new Set(publishedRegistry.capabilities.map(capability=>capability.capability_id));
assert([0,67].includes(runtimePublishedNames.size),'AI-15 publication is either absent or the explicitly approved 67-read release');
assert([...runtimePublishedNames].every(name=>implementedDomainTools.some(tool=>tool.name===name&&['read','read_artifact'].includes(tool.kind))),'Unimplemented/write capability cannot be published by AI-15');
assert.deepEqual(new Set(tools.filter(tool=>tool.publication.published).map(tool=>tool.name)),runtimePublishedNames,'Catalog publication must match the explicit backend registry');
const externalReadGates = new Set(['nodia_ai_providers_health','nodia_ai_providers_gemini_engines','nodia_ai_providers_codex_session','nodia_ai_providers_models','nodia_invoices_eligible_invoice_connections']);
const artifactGates = new Set(['nodia_invoices_file','nodia_products_export_csv','nodia_providers_export_csv']);
assert.equal(cat.domainTools.filter(tool => tool.kind === 'read' && !tool.publication.implemented).length,0);
assert.equal(cat.domainTools.filter(tool => tool.kind === 'read_artifact' && !tool.publication.implemented).length,0);
for(const name of [...externalReadGates,...artifactGates])assert(implementedDomainTools.some(tool=>tool.name===name));
const domainSchemaPaths = [...new Set(implementedDomainTools.map(tool=>tool.implementationContract.schemaPath))].sort();
assert.equal(domainSchemaPaths.length,7);
const domainSchemas = new Map();
const domainAjv = new Ajv({strict:true,allErrors:true}); formats(domainAjv);
let domainSchemaDefinitionsCompiled=0, domainClosedContractAssertions=0;
for(const file of domainSchemaPaths){
 assert.match(file,/^nodia-server\/src\/nodia-ai-products\/contracts\/[a-z-]+\.schema\.json$/);
 const source=fs.readFileSync(file,'utf8'),document=JSON.parse(source);
 assert(document.$defs && document.$id,'domain schema identity missing');
 domainAjv.addSchema(document); domainSchemas.set(file,{document,sha256:crypto.createHash('sha256').update(source).digest('hex')});
 for(const definition of Object.keys(document.$defs)){assert(domainAjv.getSchema(document.$id+'#/$defs/'+definition),'uncompiled '+file+'#'+definition);domainSchemaDefinitionsCompiled++;}
}
for(const tool of implementedDomainTools){
 assert(['read','read_artifact'].includes(tool.kind));assert.equal(tool.inputContract.schemaStatus,'implemented_closed_runtime_candidate');const contract=tool.implementationContract;
 for(const handlerId of tool.sourceHandlerIds){const handler=byId.get(handlerId);assert.equal(handler.nodiaAiProposal.implementedInNodiaAi,true);assert.equal(handler.nodiaAiProposal.implementationStage,'AI-15');assert.equal(handler.nodiaAiProposal.runtimePublished,runtimePublishedNames.has(tool.name));}
 assert.equal(contract.stage,'AI-15'); assert.equal(contract.capabilityId,tool.name); assert.equal(contract.revision,1);
 assert(contract.requiredModuleRoutes.includes(tool.targetModuleRoute));
 assert(contract.handlerSources.length>0);for(const file of contract.handlerSources) assert(fs.existsSync(file));
 const {document,sha256}=domainSchemas.get(contract.schemaPath);
 for(const side of ['inputSchema','outputSchema']){
  const schemaRef=contract[side];assert.equal(schemaRef.sha256,sha256,'schema bytes changed '+tool.name);
  const definition=document.$defs[schemaRef.definition];assert(definition,'missing '+tool.name+' '+side);
  assert.equal(definition.type,'object');assert.equal(definition.additionalProperties,false,'open '+tool.name+' '+side);
  const validate=domainAjv.getSchema(document.$id+'#/$defs/'+schemaRef.definition);
  assert.equal(validate({sql:'forbidden',credentials:'forbidden'}),false,'unbounded domain input/output '+tool.name);domainClosedContractAssertions++;
 }
}
assert.equal(domainClosedContractAssertions,134,'67 closed input/output runtime candidates');
const implementedToolNames=new Set([...implementedCommonTools,...implementedDomainTools.map(tool=>tool.name)]);
for(const t of tools){assert.match(t.name,/^nodia_[a-z0-9_]+$/);assert.equal(t.publication.implemented,implementedToolNames.has(t.name));assert.equal(t.publication.published,runtimePublishedNames.has(t.name));
 for(const key of ['inputContractRef','outputContractRef'])if(t[key])assert(validations.has(t[key]),t.name+' unresolved '+t[key]);
}
const coverageCounts={};
for(const h of cat.handlerCoverage){coverageCounts[h.treatment]=(coverageCounts[h.treatment]||0)+1;
 for(const name of h.toolNames)assert(tools.some(t=>t.name===name),'unknown tool in coverage');
 if(h.treatment==='deferred_bulk')assert.equal(h.toolNames.length,0);
}
assert.equal(coverageCounts.domain_tool,144);assert.equal(coverageCounts.secure_client_flow,18);assert.equal(coverageCounts.deferred_bulk,7);
for(const t of cat.domainTools)for(const b of t.backendBindings){const h=byId.get(b.operationId);assert(h);assert.equal(b.httpMethod,h.method);assert.deepEqual(b.httpPaths,h.paths);assert.equal(b.controllerLine,h.line);
 assert.equal(b.controllerFile,h.controller.file);
}
assert.deepEqual(cat.domainTools.filter(t=>t.sourceHandlerIds.length>1).map(t=>t.name).sort(),['nodia_actions_prepare_update','nodia_modules_prepare_update','nodia_roles_prepare_update']);
const oauth=cat.handlerCoverage.find(h=>h.operationId==='AiProviderController.submitGeminiAgenticCode');
assert.equal(oauth.treatment,'secure_client_flow');assert(!cat.domainTools.some(t=>t.sourceHandlerIds.includes(oauth.operationId)));
assert.equal(inv.categoryCounts.M,75);assert.equal(inv.categoryCounts.I,18);
for(const source of inv.sourceChecksums){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,'source changed '+source.file);}

const ts=require(taskRoot+'/nodia-server/node_modules/typescript');
const httpKinds=new Map(['Get','Post','Put','Patch','Delete','Options','Head'].map(k=>[k,k.toUpperCase()]));
const literal=n=>{if(!n)return [''];if(ts.isStringLiteralLike(n))return [n.text];if(ts.isArrayLiteralExpression(n))return n.elements.flatMap(literal);throw Error('Unresolved route decorator '+n.getText());};
const decorators=n=>ts.canHaveDecorators(n)?ts.getDecorators(n)||[]:[];
const currentControllers=[];
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())scan(p);else if(p.endsWith('.controller.ts')){
 const sf=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true);
 for(const c of sf.statements.filter(ts.isClassDeclaration)){const cd=decorators(c).find(d=>ts.isCallExpression(d.expression)&&d.expression.expression.getText(sf)==='Controller');if(!cd)continue;
 const paths=literal(cd.expression.arguments[0]);const ops=[];
 for(const method of c.members.filter(ts.isMethodDeclaration))for(const dec of decorators(method)){if(!ts.isCallExpression(dec.expression))continue;const kind=httpKinds.get(dec.expression.expression.getText(sf));if(!kind)continue;
 const routePaths=literal(dec.expression.arguments[0]).flatMap(t=>paths.map(b=>('/'+[inv.prefix,b,t].join('/')).replace(/\/+/g,'/').replace(/\/$/,'')));
 ops.push({operationId:c.name.text+'.'+method.name.getText(sf),method:kind,paths:routePaths});
 }
 currentControllers.push({name:c.name.text,operations:ops});
 }
}}}
scan('nodia-server/src');
assert.equal(currentControllers.length,inv.counts.controllerFiles,'controller set changed');
const currentHandlers=currentControllers.flatMap(c=>c.operations);
assert.equal(currentHandlers.length,inv.counts.handlerOperations,'current AST handler count changed');
for(const op of currentHandlers){const previous=byId.get(op.operationId);assert(previous,'handler missing from snapshot '+op.operationId);assert.equal(op.method,previous.method);assert.deepEqual([...op.paths].sort(),[...previous.paths].sort());}
assert.equal(currentHandlers.flatMap(h=>h.paths).length,inv.counts.httpMethodPathPairs);

const docPaths=['docs/mvp/75-nodia-ai-ai29-secure-human-flows.md','docs/architecture/decisions/ADR-053-nodia-ai-secure-human-interaction.md','docs/mvp/73-nodia-ai-ai27-core-administration.md','docs/nodia-ai/knowledge/general-settings/features/confirmed-administration.md','docs/architecture/decisions/ADR-051-nodia-ai-core-exclusive-execution.md','docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md','docs/nodia-ai/knowledge/reservations/features/confirmed-money.md','docs/nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md','docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md','docs/mvp/70-nodia-ai-ai24-rental-configuration.md','docs/nodia-ai/knowledge/reservations/features/confirmed-reservation-lifecycle.md','docs/mvp/69-nodia-ai-ai23-dependent-workflows.md','docs/architecture/decisions/ADR-050-nodia-ai-dependent-workflows.md','docs/mvp/68-nodia-ai-ai22-business-operations.md','docs/architecture/decisions/ADR-049-nodia-ai-business-operation-ports.md','docs/nodia-ai/knowledge/businesses/features/confirmed-business-effects.md','docs/mvp/67-nodia-ai-ai21-financial-operations.md','docs/architecture/decisions/ADR-048-nodia-ai-financial-operation-ports.md','docs/mvp/46-nodia-ai-ai01-contract-baseline.md','docs/nodia-ai/knowledge/nodia-ai/README.md','docs/nodia-ai/knowledge/nodia-ai/features/conversation-coordination.md','docs/mvp/00-progress.md','docs/mvp/38-nodia-ai-research-and-v1-plan.md','docs/mvp/39-nodia-ai-current-capabilities-inventory.md','docs/mvp/40-nodia-ai-tool-catalog-v1.md','docs/mvp/41-nodia-ai-v1-contracts.md','docs/mvp/README.md','docs/mvp/11-architecture-overview.md','docs/architecture/decisions/ADR-032-nodia-ai-domain-tools-and-conversation.md','docs/architecture/decisions/ADR-033-nodia-ai-confirmation-and-sequential-recovery.md'];
let checkedLinks=0;
for(const file of docPaths){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){let target=match[1].replace(/^<|>$/g,'');if(/^[a-z]+:\/\//i.test(target)||target.startsWith('#'))continue;target=target.split('#')[0];if(!target)continue;assert(fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(target))),'broken '+file+' -> '+target);checkedLinks++;}}
const result={date:'2026-10-14',verifiedAt:new Date().toISOString(),reconciledThrough:'AI-29',scope:'ai01_offline_compiled_common_contracts_and_current_ast_baseline',schemaDefinitionsCompiled:validations.size,domainSchemas:{files:domainSchemaPaths.length,definitionsCompiled:domainSchemaDefinitionsCompiled,closedContractAssertions:domainClosedContractAssertions,localReadCandidates:59,externalReadsImplemented:externalReadGates.size,artifactReadsImplemented:artifactGates.size,runtimePublicationPending:implementedDomainTools.filter(tool=>!tool.publication.published).length,runtimePublished:runtimePublishedNames.size},structuralFixtureAssertions:fixtures.length,fixtureNote:'Synthetic values generated in memory; no real identities, models, accounts or service calls',catalogCounts:cat.counts,handlerCoverage:coverageCounts,sourceHashesChecked:inv.sourceChecksums.length,localLinksChecked:checkedLinks,coordinationRoutes:api.routes.length,workflow:inv.ai23,rentalReservation:inv.ai25,rentalMoneyOccupancyPreparation:inv.ai26,coreAdministration:inv.ai27,aiProviderConfiguration:inv.ai28,secureHumanInteraction:inv.ai29,currentAstCounts:{controllers:currentControllers.length,handlers:currentHandlers.length,routes:currentHandlers.flatMap(h=>h.paths).length},files:[schemaPath,catalogPath,inventoryPath,apiPath,...domainSchemaPaths].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),fixtures,limitations:['Seven domain libraries are compiled structurally; candidate implementation does not approve or publish knowledge/tools','No authorization, transaction, DB, inference or UI acceptance proven by structural fixtures','Per-resource arithmetic bounds, DAG, workflow ownership, report grain/units and state transitions require implementation tests']};
fs.mkdirSync('docs/evidence',{recursive:true});fs.writeFileSync('docs/evidence/nodia-ai-v1-catalog-contracts-validation.json',JSON.stringify(result,null,2)+'\n');
console.log({coordinationRoutes:api.routes.length,currentAstHandlers:currentHandlers.length,compiled:validations.size,domainDefinitions:domainSchemaDefinitionsCompiled,domainContracts:domainClosedContractAssertions,fixtures:fixtures.length,coverageCounts,hashes:inv.sourceChecksums.length,localLinks:checkedLinks});


