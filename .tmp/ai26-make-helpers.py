from pathlib import Path
root=Path(__file__).resolve().parents[1]
for name in ['refresh-lab.py','activate-lab.py','dist-equality.py','live-state.mjs','lab-db.mjs']:
 text=(root/'.tmp'/('ai25-'+name)).read_text(encoding='utf-8').replace('ai25','ai26').replace('AI-25','AI-26')
 if name=='activate-lab.py':
  text=text.replace('before-reservation-lifecycle','before-rental-money-operations')
 if name=='live-state.mjs':
  text=text.replace('const registrations=admission.useFactory', "const {BuildNodiaAiRentalMoneyOperationsUseCase}=await import(runtime+'/dist/nodia-ai-rental-money/use-case/build-nodia-ai-rental-money-operations.use-case.js');\nconst money=new BuildNodiaAiRentalMoneyOperationsUseCase(null,null,null,null,null,null,null,null);\nconst {BuildNodiaAiRentalOperationsUseCase}=await import(runtime+'/dist/nodia-ai-rental-operations/use-case/build-nodia-ai-rental-operations.use-case.js');\nconst operations=new BuildNodiaAiRentalOperationsUseCase(null,null,null,null,null,null);\nconst registrations=admission.useFactory")
  text=text.replace('rental.operations,reservations.operations);','rental.operations,reservations.operations,money.operations,operations.operations);').replace('registrations.length!==38','registrations.length!==48')
 (root/'.tmp'/('ai26-'+name)).write_text(text,encoding='utf-8')
print('AI26 staging, backup/deployment and read-only reflection helpers ready')
