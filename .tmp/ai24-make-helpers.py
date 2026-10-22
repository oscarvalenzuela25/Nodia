from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
for name in ['refresh-lab.py','activate-lab.py','dist-equality.py','live-state.mjs','lab-db.mjs']:
 text=(root/'.tmp'/('ai23-'+name)).read_text(encoding='utf-8').replace('ai23','ai24').replace('AI-23','AI-24')
 if name=='activate-lab.py':
  text=text.replace("baseline['migrations'] in (24,25)","baseline['migrations']==25")
  lines=text.splitlines()
  lines=[" applied={'applied':0,'reason':'AI-24 reuses existing schema; no migration'}" if line.startswith(' applied=json.loads(') else line for line in lines]
  text='\n'.join(lines)+'\n'
  text=text.replace("'new_columns':2,'existing_columns_added':2","'new_columns':0,'existing_columns_added':0")
 if name=='live-state.mjs':
  text=text.replace("const registrations=admission.useFactory", "const {BuildNodiaAiRentalConfigurationOperationsUseCase}=await import(runtime+'/dist/nodia-ai-rental-configuration/use-case/build-nodia-ai-rental-configuration-operations.use-case.js');\nconst rental=new BuildNodiaAiRentalConfigurationOperationsUseCase(null,null,null,null,null,null,null);\nconst registrations=admission.useFactory")
  text=text.replace('...invoices.operations]);','...invoices.operations],rental.operations);').replace('registrations.length!==26','registrations.length!==32')
 (root/'.tmp'/('ai24-'+name)).write_text(text,encoding='utf-8')
print(json.dumps({'helpers':5,'migrations_expected':25,'executors_expected':32}))
