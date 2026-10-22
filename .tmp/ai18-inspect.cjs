const fs=require('node:fs');
const s=JSON.parse(fs.readFileSync('docs/mvp/nodia-ai-v1-common-contracts.schema.json','utf8'));
for(const [key,value] of Object.entries(s.$defs).filter(([key])=>/ConfirmationRequest|ExecutionStatus|ExecutionStepStatus|OperationSummary/.test(key)))console.log(key,JSON.stringify(value));
const model=JSON.parse(fs.readFileSync('docs/mvp/nodia-ai-v1-data-model.json','utf8'));
for(const t of model.tables.filter(t=>/confirmation_challenges|executions$|execution_steps$/.test(t.name)))console.log(t.name,JSON.stringify(t));
