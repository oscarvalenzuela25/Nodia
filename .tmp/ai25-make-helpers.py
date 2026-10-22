from pathlib import Path
root=Path(__file__).resolve().parents[1]
for name in ['refresh-lab.py','activate-lab.py','dist-equality.py','live-state.mjs']:
 text=(root/'.tmp'/('ai24-'+name)).read_text(encoding='utf-8').replace('ai24','ai25').replace('AI-24','AI-25')
 if name=='activate-lab.py':
  text=text.replace('before-dependent-workflows','before-reservation-lifecycle')
 if name=='live-state.mjs':
  text=text.replace('const registrations=admission.useFactory', "const {BuildNodiaAiRentalReservationOperationsUseCase}=await import(runtime+'/dist/nodia-ai-rental-reservation/use-case/build-nodia-ai-rental-reservation-operations.use-case.js');\nconst reservations=new BuildNodiaAiRentalReservationOperationsUseCase(null,null,null,null,null,null,null,null);\nconst registrations=admission.useFactory")
  text=text.replace('rental.operations);','rental.operations,reservations.operations);').replace('registrations.length!==32','registrations.length!==38')
 (root/'.tmp'/('ai25-'+name)).write_text(text,encoding='utf-8')
text=(root/'.tmp/ai24-lab-db.mjs').read_text(encoding='utf-8')
start=text.index(' if(process.argv[2]')
end=text.index('  const row=',start)
text=text[:start]+text[end:]
text=text.replace("import { pathToFileURL } from 'node:url';\n",'').replace(" }\n} finally {await db.end();}","} finally {await db.end();}")
(root/'.tmp/ai25-lab-db.mjs').write_text(text,encoding='utf-8')
print('AI-25 isolated stage and deployment helpers prepared; no migration path')
