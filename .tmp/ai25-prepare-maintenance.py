from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
script=(root/'.tmp/ai24-refresh-inventory.cjs').read_text(encoding='utf-8')
script=script.replace("const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('../nodia-server/node_modules/typescript');", "const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');\nconst root=path.resolve(__dirname,'../../..');process.chdir(root);\nconst ts=require(path.join(root,'nodia-server/node_modules/typescript'));")
script=script.replace(" ['nodia-server/src/nodia-ai-rental-configuration/nodia-ai-rental-configuration.module.ts','NodiaAiRentalConfigurationModule'],", " ['nodia-server/src/nodia-ai-rental-configuration/nodia-ai-rental-configuration.module.ts','NodiaAiRentalConfigurationModule'],\n ['nodia-server/src/nodia-ai-rental-reservation/nodia-ai-rental-reservation.module.ts','NodiaAiRentalReservationModule'],")
script=script.replace("'nodia-ai-rental-configuration','rental-property'", "'nodia-ai-rental-configuration','nodia-ai-rental-reservation','rental-reservation','rental-property'")
script=script.replace("fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\\n');", "inv.ai25={date:'2026-10-17',scope:'Six internal native reservation lifecycle ports, advisory availability without hold, exact human confirmation and historical receipts; MCP prepare publication remains gated',newControllers:[],newHandlers:[],nativeRentalReservationOperations:6,nativeOperations:38,databaseMigrations:0,newColumns:[],newTables:0,newModules:['NodiaAiRentalReservationModule']};\nfs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\\n');")
script=script.replace('ai23:inv.ai23}));','ai25:inv.ai25}));')
(root/'docs/evidence/scripts/reconcile-nodia-ai-ai25.cjs').write_text(script,encoding='utf-8')
validator=root/'docs/evidence/scripts/validate-nodia-ai-catalog-contracts.cjs'
text=validator.read_text(encoding='utf-8').replace("reconciledThrough:'AI-24'","reconciledThrough:'AI-25'")
text=text.replace("workflow:inv.ai23,currentAstCounts", "workflow:inv.ai23,rentalReservation:inv.ai25,currentAstCounts")
text=text.replace("const docPaths=['docs/mvp/69", "const docPaths=['docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md','docs/mvp/70-nodia-ai-ai24-rental-configuration.md','docs/nodia-ai/knowledge/reservations/features/confirmed-reservation-lifecycle.md','docs/mvp/69")
validator.write_text(text,encoding='utf-8')
package=root/'nodia-server/package.json'
data=json.loads(package.read_text(encoding='utf-8'))
data['scripts']['test:nodia-ai:reservation-lifecycle']='npm run build && node test/nodia-ai-ai25.integration.mjs'
package.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('AI-25 maintenance scripts prepared')
