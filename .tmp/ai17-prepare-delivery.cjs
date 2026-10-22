const fs=require('node:fs');
fs.writeFileSync('.tmp/ai17-prepare-delivery.py',fs.readFileSync('.tmp/ai17-prepare-verified.py','utf8').replaceAll('/opt/nodia/verification/ai17-20261016-verified','/opt/nodia/verification/ai17-20261016-delivery'));
let p=fs.readFileSync('.tmp/ai17-activate-lab.py','utf8').replaceAll('/opt/nodia/verification/ai17-20261016-verified','/opt/nodia/verification/ai17-20261016-delivery');
p=p.replace("baseline['migrations']==21,baseline", "baseline['migrations'] in (21,22),baseline");
p=p.replace("applied=json.loads(run(['/usr/local/bin/node',str(base/'ai17-lab-db.mjs'),'migrate',str(candidate)]).stdout)","applied=json.loads(run(['/usr/local/bin/node',str(base/'ai17-lab-db.mjs'),'migrate',str(candidate)]).stdout) if baseline['migrations']==21 else {'migration':'CreateNodiaAiProposalPersistence1792400000000','applied':0,'previously_applied':True}");
p=p.replace("'new_tables':4,'new_columns':40,'new_indexes':5", "'new_tables':4 if baseline['migrations']==21 else 0,'new_columns':40 if baseline['migrations']==21 else 0,'new_indexes':5 if baseline['migrations']==21 else 0");
fs.writeFileSync('.tmp/ai17-activate-delivery.py',p);
