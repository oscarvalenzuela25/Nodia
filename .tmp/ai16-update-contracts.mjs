import fs from 'node:fs';
const schemaPath = 'docs/mvp/nodia-ai-v1-common-contracts.schema.json';
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const d = schema.$defs;
for (const name of ['VisibleMessage','RestrictedMessage']) {
  d[name].properties.run_id={anyOf:[{$ref:'#/$defs/ProtocolId'},{type:'null'}]};
  if(!d[name].required.includes('run_id'))d[name].required.push('run_id');
}
d.EventPage.properties.items.maxItems = 100;
d.EventPage.properties.has_more = { type: 'boolean', description: 'More rows remain after the scanned checkpoint. next_cursor is an observer checkpoint, including at the tail.' };
if (!d.EventPage.required.includes('has_more')) d.EventPage.required.push('has_more');
const closed = properties => ({type:'object', additionalProperties:false, properties, required:Object.keys(properties)});
const key = {type:'string',minLength:1,maxLength:128};
const route = {type:'string', pattern:'^/(tools|settings)/[a-z][a-z0-9_-]*$',maxLength:128};
const label = {anyOf:[{type:'string',minLength:1,maxLength:256},{type:'null'}]};
d.ResultNavigation = {oneOf:[
  closed({kind:{const:'business_detail'},id:{$ref:'#/$defs/DomainUuid'},module_route:{const:'/tools/business'},label}),
  closed({kind:{const:'rental_property'},id:{type:'string',pattern:'^[1-9][0-9]{0,18}$'},module_route:{const:'/tools/reservations'},label}),
  closed({kind:{const:'module'},id:{type:'null'},module_route:route,label}),
]};
d.ToolObservation = closed({
  result_ref:{$ref:'#/$defs/ToolResultRef'},observed_at:{$ref:'#/$defs/UtcInstant'},
  source:closed({module_key:key,resource_key:key,operation_key:key,description_key:{type:'string',minLength:1,maxLength:256}}),
  summary:closed({total:{anyOf:[{type:'number'},{type:'string',minLength:1,maxLength:128},{type:'null'}]},returned:{anyOf:[{type:'integer',minimum:0,maximum:100},{type:'null'}]}}),
  navigation:{type:'array',maxItems:25,items:{$ref:'#/$defs/ResultNavigation'}},
});
fs.writeFileSync(schemaPath,JSON.stringify(schema,null,2)+'\n');
const apiPath='docs/mvp/nodia-ai-v1-coordination-api.json';
const api=JSON.parse(fs.readFileSync(apiPath,'utf8'));
api.dates.ai16='2026-10-16';
for(const route of api.routes) {
  if(['/api/v1/nodia-ai/runs/:id','/api/v1/nodia-ai/runs/:id/events','/api/v1/nodia-ai/tool-calls/:id/result'].includes(route.path)) {
    route.implemented=true; route.implementationPhase='AI-16';route.implementationScope='durable_read_only_observation_current_authority';
  }
  if(route.path.endsWith('/events')) {route.delivery='durable_bounded_polling';route.sseImplemented=false;route.cursorSemantics='next_cursor is last scanned checkpoint even when filtered/empty; has_more drains backlog; visibility change resets; actor/session/run mismatch rejects';}
}
if(!api.routes.some(route=>route.path==='/api/v1/nodia-ai/tool-calls/:id/observation'))api.routes.push({method:'GET',path:'/api/v1/nodia-ai/tool-calls/:id/observation',channel:'app',inputContract:null,outputContract:'ToolObservation',implemented:true,implementationPhase:'AI-16',requires:'current_conversation_and_exact_registered_tool_resource_authority',semantics:'Closed source/time/summary/navigation only; does not execute handler or refresh historical result'});
fs.writeFileSync(apiPath,JSON.stringify(api,null,2)+'\n');
