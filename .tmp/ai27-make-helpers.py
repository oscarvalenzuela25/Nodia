from pathlib import Path
root=Path(__file__).resolve().parents[1]
for name in ['refresh-lab.py','activate-lab.py','dist-equality.py','live-state.mjs','lab-db.mjs','service-state.py']:
 text=(root/'.tmp'/('ai26-'+name)).read_text(encoding='utf-8').replace('ai26','ai27').replace('AI-26','AI-27')
 if name=='activate-lab.py':text=text.replace('before-rental-money-operations','before-core-administration')
 if name=='live-state.mjs':
  text=text.replace('const registrations=admission.useFactory', "const {BuildNodiaAiCoreOperationsUseCase}=await import(runtime+'/dist/nodia-ai-core-operations/use-case/build-nodia-ai-core-operations.use-case.js');\nconst core=new BuildNodiaAiCoreOperationsUseCase(null,null,null,null,null,null,null,null,null,null,null,null,null);\nconst registrations=admission.useFactory")
  text=text.replace('money.operations,operations.operations);','money.operations,operations.operations,core.operations);').replace('registrations.length!==48','registrations.length!==65')
 (root/'.tmp'/('ai27-'+name)).write_text(text,encoding='utf-8')
print('AI27 isolated SQL stage, backup activation and read-only runtime helpers prepared')
