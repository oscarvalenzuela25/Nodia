const fs=require('fs');
const path='docs/mvp/nodia-ai-v1-common-contracts.schema.json',schema=JSON.parse(fs.readFileSync(path,'utf8')),d=schema.$defs;
const ref=name=>({$ref:'#/$defs/'+name}),obj=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const scopes=['finance','business','rental'],keys=['expense_category_id','income_category_id','business_id','supplier_id','property_id'];
d.PreferenceScopeKey={enum:scopes};d.PreferenceKey={enum:keys};
d.PreferenceScope={oneOf:[obj({}),obj({business_id:ref('DomainUuid')})]};
const correlations=[
  {scope_key:{const:'finance'},key:{enum:keys.slice(0,2)},scope:obj({}),value:ref('BigintId')},
  {scope_key:{const:'business'},key:{const:'business_id'},scope:obj({}),value:ref('DomainUuid')},
  {scope_key:{const:'business'},key:{const:'supplier_id'},scope:obj({business_id:ref('DomainUuid')}),value:ref('BigintId')},
  {scope_key:{const:'rental'},key:{const:'property_id'},scope:obj({}),value:ref('BigintId')},
].map(properties=>({type:'object',properties,required:['scope_key','key','scope','value']}));
d.PreferenceValue={...obj({scope_key:ref('PreferenceScopeKey'),scope:ref('PreferenceScope'),key:ref('PreferenceKey'),value:{type:'string'}}),oneOf:correlations};
d.PreferenceItem={...obj({preference_id:ref('ProtocolId'),scope_key:ref('PreferenceScopeKey'),scope:ref('PreferenceScope'),key:ref('PreferenceKey'),value:{type:'string'},revision:{type:'integer',minimum:1},value_label:{type:['string','null'],maxLength:255},scope_label:{type:['string','null'],maxLength:255},available:{type:'boolean'}}),oneOf:correlations};
d.PreferencePageQuery.properties.scope_key=ref('PreferenceScopeKey');d.PreferencePageQuery.properties.page_limit={type:'integer',minimum:1,maximum:50};
d.PreferenceListInput=d.PreferencePageQuery;
const revision={type:'integer',minimum:1,maximum:2147483646};
const branches=[
  {...obj({operation:{const:'create'},scope_key:ref('PreferenceScopeKey'),scope:ref('PreferenceScope'),key:ref('PreferenceKey'),value:{type:'string'}}),oneOf:correlations},
  obj({operation:{const:'update'},preference_id:ref('ProtocolId'),expected_revision:revision,value:{type:'string',minLength:1,maxLength:36}}),
  obj({operation:{const:'delete'},preference_id:ref('ProtocolId'),expected_revision:revision}),
];
d.PreferencePrepareInput={oneOf:branches};
d.PreferencePrepareRequest={oneOf:branches.map(branch=>({...branch,properties:{conversation_id:ref('ProtocolId'),...branch.properties},required:['conversation_id',...branch.required]}))};
d.PreferenceOptionsQuery=obj({scope_key:ref('PreferenceScopeKey'),key:ref('PreferenceKey'),business_id:ref('DomainUuid'),for_supplier_scope:{type:'boolean'},search:{type:'string',minLength:1,maxLength:128},cursor:ref('Cursor'),page_limit:{type:'integer',minimum:1,maximum:50}},['scope_key','key']);
d.PreferenceCatalog=obj({items:{type:'array',maxItems:5,items:obj({scope_key:ref('PreferenceScopeKey'),key:ref('PreferenceKey'),value_type:{enum:['uuid','bigint']},requires_business_scope:{type:'boolean'}})}});
d.PreferenceOptionsPage=obj({items:{type:'array',maxItems:50,items:obj({id:{type:'string',minLength:1,maxLength:36},label:{type:'string',minLength:1,maxLength:255}})},next_cursor:{type:['string','null']}});
d.PreferenceEffectReceipt=obj({schema_version:{const:1},resource_key:{const:'nodia_ai_preferences'},operation:{enum:['create','update','delete']},resource_id:ref('ProtocolId'),owner_id:ref('BigintId'),revision:{type:'integer',minimum:1,maximum:2147483647}});
fs.writeFileSync(path,JSON.stringify(schema,null,2)+'\n');fs.copyFileSync(path,'nodia-server/src/nodia-ai-tools/config/common-schema.json');
