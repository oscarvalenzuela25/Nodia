// Maintained successor of the historical common-contract fixtures only.
// The original validator remains byte-for-byte unchanged. All named assertions
// and minimal fixtures from its common segment are preserved below; definition
// counts derive from the supplied schema rather than a fixed release count.
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function verifyCommonContracts(schema) {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv); ajv.addSchema(schema);
  const validations = new Map(Object.keys(schema.$defs).map(key => [key, ajv.getSchema(schema.$id + '#/$defs/' + key)]));
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


  return {
    definitions_compiled: validations.size,
    fixture_assertions: fixtures.length,
    positive_fixtures: fixtures.filter(item => item.expectedValid).length,
    negative_fixtures: fixtures.filter(item => !item.expectedValid).length,
    fixtures,
  };
}
