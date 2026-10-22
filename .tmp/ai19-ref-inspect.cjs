const fs=require('fs'),s=JSON.parse(fs.readFileSync('docs/mvp/nodia-ai-v1-common-contracts.schema.json'));for(const n of ['EntityRef','BigintId'])console.log(JSON.stringify({n,s:s.$defs[n]},null,2));
