import hashlib,json,re
from datetime import datetime,timezone
from pathlib import Path
r=Path(__file__).resolve().parents[1]
def read(path): return (r/path).read_text(encoding='utf-8-sig')
def hashed(path):
 b=(r/path).read_bytes();return {'path':path,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
def result(kind):
 log=read(f'nodia-client/.tmp/ai26-client-{kind}.log')
 files=re.search(r'Test Files\s+(\d+) passed \((\d+)\)',log);tests=re.search(r'Tests\s+(\d+) passed \((\d+)\)',log);duration=re.search(r'Duration\s+([\d.]+)s',log)
 assert files and tests and duration,kind
 assert files[1]==files[2] and tests[1]==tests[2]
 return {'tests':int(tests[1]),'files':int(files[1]),'workers':2,'duration_seconds':float(duration[1]),'exit_code':0}
full=result('full-release');focus=result('focused-final')
assert focus['tests']==260 and focus['files']==5
build=read('nodia-client/.tmp/ai26-client-build-final.log')
duration=float(re.search(r'built in ([\d.]+)s',build)[1])
paths=['infrastructure/rentalPresentation.ts','infrastructure/rentalReview.ts','infrastructure/useExecution.ts','infrastructure/useHumanProposal.ts','components/ProposalPreview/ProposalPreview.tsx','components/ProposalPreview/HumanProposalReview.tsx','components/ConfirmedExecution/ConfirmedExecution.tsx']
sources=[hashed('nodia-client/src/modules/nodiaAi/'+p) for p in paths]+[hashed(f'nodia-client/src/translate/{lang}/nodiaAi.json') for lang in ['es','en']]
sources += [hashed('nodia-client/src/test/modules/nodiaAi/'+p) for p in ['infrastructure/rentalMoneyPreparationFixtures.ts','infrastructure/rentalReview.test.ts','components/ProposalPreview/HumanProposalReview.test.tsx','components/ProposalPreview/ProposalPreview.test.tsx','components/ConfirmedExecution/ConfirmedExecution.test.tsx']]
sources += [hashed('nodia-client/src/test/manual/nodia-ai/fixtures.ts')]
docs=['docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md','docs/nodia-ai/knowledge/reservations/features/confirmed-money.md','docs/nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md','docs/nodia-ai/knowledge/reservations/README.md','docs/nodia-ai/knowledge/README.md']
links=0
for doc in docs:
 p=r/doc;s=p.read_text(encoding='utf-8')
 if s.startswith('---'):
  meta=json.loads(s.split('---',2)[1]);assert meta['document_status']=='draft' and meta['integration_status']=='unregistered' and meta['approval'] is None
  for source in meta['sources']:assert (r/source['path']).exists(),source
 for link in re.findall(r'\]\(([^)]+)\)',s):
  path=link.split('#')[0]
  if not path or ':' in path:continue
  assert (p.parent/path).resolve().exists(),(doc,path)
  links+=1
labels={}
for lang in ['es','en']:
 j=json.loads(read(f'nodia-client/src/translate/{lang}/nodiaAi.json'))
 fields=re.search(r'const fields = \[(.*?)\] as const;',read('nodia-client/src/modules/nodiaAi/infrastructure/rentalPresentation.ts'))[1]
 for field in re.findall(r'"([^"]+)"',fields):assert field in j['proposal']['rental_fields'],(lang,field)
 labels[lang]=len(j['proposal']['rental_fields'])
logs=[hashed(f'nodia-client/.tmp/ai26-client-{kind}.log') for kind in ['full-release','focused-final','typecheck-final','lint-final','build-final']]
assert 'error TS' not in read('nodia-client/.tmp/ai26-client-typecheck-final.log')
assert 'error ' not in read('nodia-client/.tmp/ai26-client-lint-final.log')
data={'stage':'AI-26','scope':'client_unit_and_synthetic_transport_no_database_or_provider','status':'passed','verified_at_utc':datetime.now(timezone.utc).isoformat(),'full_suite':full,'focused':focus,'typecheck':{'command':'npm run typecheck','exit_code':0},'lint':{'command':'npm run lint','exit_code':0},'build':{'command':'npm run build','vite_seconds':duration,'exit_code':0,'historical_large_chunk_warning':True},'checks':[
'Ten registered rental money/block/preparation actions and all rental field labels exist in Spanish and English; unknown arbitrary tool CRUD is not inferred',
'Payments and actual refunds are records of money already moved; void preserves history and does not imply a transfer or refund',
'Paying an existing pending expense does not create another expense or an external collection',
'Exact bigint money and IDs remain strings; zero is rejected when metadata minimum is one, while existing zero-allowed refund metadata is preserved',
'Money dates are civil days; block and readiness instants use the authoritative house timezone and preserve unedited offsets',
'Nullable linen uses a three-option shared select; null, false and true survive edits, retries and unrelated field changes independently',
'Planned/actual readiness and expense association retain explicit null without converting it to false, zero or an empty value',
'Native policy snapshots, same-day approvals and affected turnover IDs render as recursive readonly facts with localized field/value labels',
'Rejected writes retain inputs and show whitelisted native money/plan/readiness errors; no result is announced as committed',
'Only completed receipts for all four new resources invalidate the actor rental cache and link to the existing reservations route'],
'document_validation':{'status':'passed','markdown_files':len(docs),'local_links':links,'source_and_frontmatter_checks':'passed','rental_field_labels_per_locale':labels,'locales':['es','en'],'approval':'unchanged_null','new_tools_published':0,'broken_links':[]},'ui_evidence':'docs/evidence/nodia-ai-ai26-ui-validation.json','sources':sources,'logs':logs,'warnings':{'jsdom_navigation_messages':read('nodia-client/.tmp/ai26-client-full-release.log').count('Not implemented: navigation to another Document'),'other_observed_test_warnings':['Emotion first-child SSR warning','React Query undefined synthetic mock data','React Router HydrateFallback warning'],'failed_tests':0},'limits':['Unit mocks and browser QA do not establish SQL authorization, atomicity, real inference or published MCP writes','No physical phone or virtual keyboard acceptance','No model, dependency or route was added'],'approval_changed':False}
(r/'docs/evidence/nodia-ai-ai26-client-validation.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'full':full,'focused':focus,'document_links':links,'field_labels':labels}))
