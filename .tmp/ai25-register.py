from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
source='docs/nodia-ai/knowledge/reservations/features/confirmed-reservation-lifecycle.md'
assert (root/source).is_file(),source
registry_path=root/'nodia-server/config/nodia-ai-knowledge.registry.json'
registry=json.loads(registry_path.read_text(encoding='utf-8'))
registry['source_paths']=sorted(set(registry['source_paths']+[source]))
registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
model_path=root/'docs/mvp/nodia-ai-v1-data-model.json'
model=json.loads(model_path.read_text(encoding='utf-8'))
model['execution']['localRentalReservationExecution']={
 'implementedIn':'AI-25','nativeOperations':6,'resource':'rental_reservations',
 'operations':['create','update','confirm','start','complete','cancel'],
 'newTables':0,'newColumns':0,'newMigrations':0,
 'advisoryAvailabilityCreatesHold':False,'createRegistersPayment':False,'cancellationRegistersRefund':False,
 'sourceDocument':'docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md',
 'note':'Native lifecycle journal, effect, audit and NodiaAI receipt share the caller transaction. No duplicate reservation or availability model; monetary writers remain AI-26.'}
model_path.write_text(json.dumps(model,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('AI25 draft explicitly indexed; no capability or binding published')
