from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
sources=['docs/nodia-ai/knowledge/reservations/features/confirmed-money.md','docs/nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md']
for source in sources:assert (root/source).is_file(),source
registry_path=root/'nodia-server/config/nodia-ai-knowledge.registry.json'
registry=json.loads(registry_path.read_text(encoding='utf-8'))
registry['source_paths']=sorted(set(registry['source_paths']+sources))
registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
model_path=root/'docs/mvp/nodia-ai-v1-data-model.json';model=json.loads(model_path.read_text(encoding='utf-8'))
model['execution']['localRentalMoneyOccupancyPreparation']={
 'implementedIn':'AI-26','nativeOperations':10,'resources':['rental_payments','rental_expenses','rental_blocks','rental_turnovers'],
 'newTables':0,'newColumns':0,'newMigrations':0,'physicalDelete':False,
 'nativeFamilyCoverage':{'endpointOperations':44,'publishedReadPorts':21,'internalWritePorts':22,'nativeRecoveryCoordinator':1},
 'sourceDocument':'docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md',
 'note':'Native payment/refund, expenses, blocks and turnover records remain in their domain tables. Reuse intent/revision and atomic receipt storage; no new money ledger, hold table or generic recovery key tool.'}
model_path.write_text(json.dumps(model,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
script=(root/'docs/evidence/scripts/reconcile-nodia-ai-ai25.cjs').read_text(encoding='utf-8')
script=script.replace(" ['nodia-server/src/nodia-ai-rental-reservation/nodia-ai-rental-reservation.module.ts','NodiaAiRentalReservationModule'],", " ['nodia-server/src/nodia-ai-rental-reservation/nodia-ai-rental-reservation.module.ts','NodiaAiRentalReservationModule'],\n ['nodia-server/src/nodia-ai-rental-money/nodia-ai-rental-money.module.ts','NodiaAiRentalMoneyModule'],\n ['nodia-server/src/nodia-ai-rental-operations/nodia-ai-rental-operations.module.ts','NodiaAiRentalOperationsModule'],")
script=script.replace("'nodia-ai-rental-reservation','rental-reservation'", "'nodia-ai-rental-reservation','nodia-ai-rental-money','nodia-ai-rental-operations','rental-payment','rental-expense','rental-block','rental-turnover','rental-reservation'")
script=script.replace("fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\\n');", "inv.ai26={date:'2026-10-17',scope:'Ten internal native money, block and turnover ports; atomic receipts and native idempotency recovery; no MCP prepare publication',newControllers:[],newHandlers:[],nativeRentalMoneyOperations:6,nativeRentalCalendarOperations:4,nativeOperations:48,nativeRentalOperations:22,rentalEndpointCoverage:{total:44,publishedReads:21,internalWrites:22,internalRecovery:1},databaseMigrations:0,newColumns:[],newTables:0,newModules:['NodiaAiRentalMoneyModule','NodiaAiRentalOperationsModule']};\nfs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\\n');")
script=script.replace('ai25:inv.ai25}));','ai26:inv.ai26}));')
(root/'docs/evidence/scripts/reconcile-nodia-ai-ai26.cjs').write_text(script,encoding='utf-8')
validator_path=root/'docs/evidence/scripts/validate-nodia-ai-catalog-contracts.cjs';text=validator_path.read_text(encoding='utf-8')
text=text.replace('AI-25 closed common','AI-26 closed common').replace("reconciledThrough:'AI-25'","reconciledThrough:'AI-26'")
text=text.replace('rentalReservation:inv.ai25,currentAstCounts','rentalReservation:inv.ai25,rentalMoneyOccupancyPreparation:inv.ai26,currentAstCounts')
text=text.replace("const docPaths=['docs/mvp/71", "const docPaths=['docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md','docs/nodia-ai/knowledge/reservations/features/confirmed-money.md','docs/nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md','docs/mvp/71")
validator_path.write_text(text,encoding='utf-8')
package_path=root/'nodia-server/package.json';package=json.loads(package_path.read_text(encoding='utf-8'))
package['scripts']['test:nodia-ai:rental-operations']='npm run build && node test/nodia-ai-ai26.integration.mjs'
package_path.write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('AI26 two draft paths indexed, no publication; reconciler and metadata prepared')
