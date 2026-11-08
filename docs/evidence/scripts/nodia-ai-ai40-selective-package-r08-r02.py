"""R08 final cohort: five Stop sources with CTE CAS, plus report observation.

Reuse the pinned offline packager; preserve its Stop-only preview and receipts.
"""
import argparse,contextlib,hashlib,importlib.util,io,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
PARENT=ROOT/'docs/evidence/scripts/nodia-ai-ai40-selective-package-r08.py'
PARENT_SHA='28415af1e7414257fb962f2b17c6a7fbf32757fe7a07c01bcb2d534aac8809e4'
def main(args):
 if PARENT.is_symlink()or hashlib.sha256(PARENT.read_bytes()).hexdigest()!=PARENT_SHA:raise ValueError('frozen_packager_changed')
 spec=importlib.util.spec_from_file_location('frozen_stop_packager',PARENT);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
 base.WORK=ROOT/'.tmp/ai40-r08-selective-r02';base.SERVER=base.WORK/'server';base.ARTIFACTS=ROOT/'ops/lab/artifacts/ai40-server-r08-r02'
 base.SOURCES=(*base.SOURCES,'src/nodia-ai-observation/use-case/observe-nodia-ai-run.use-case.ts')
 base.TEST_SHA='8fad0092341dbebfdf0e52b7e7d195b245df4e016f7a323ecd5d6305dacfecd6'
 base.__file__=str(Path(__file__).resolve());base.ARTIFACTS.mkdir(exist_ok=False)
 with contextlib.redirect_stdout(io.StringIO()):base.main(args)
 path=base.WORK/'frozen.json';receipt=json.loads(path.read_bytes());receipt.update(cohort='final_stop_CTE_and_report_observation',parent_packager_source=str(PARENT.relative_to(ROOT)).replace('\\','/'),parent_packager_sha256=PARENT_SHA,preliminary_stop_only_package_preserved=True,preliminary_original_CAS_diagnostic='c934548104a7d2ba4a1e7d06424160cecfc3e9eff7e3117c0dd99f2ee449b6ea')
 path.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8',newline='\n')
 catalog={'schema':'nodia-ai-ai40-r08-r02-local-artifact-catalog-v1','cohort':receipt['cohort'],'release':'/opt/nodia/releases/nodia-server-ai40-r08','base_manifest_sha256':receipt['base_manifest_sha256'],'manifest':{'path':'ai40-server-r08-manifest.json','sha256':receipt['manifest_sha256']},'archive':{'path':'ai40-server-r08.tar.gz','sha256':receipt['archive_sha256'],'bytes':receipt['archive_bytes']},'frozen_receipt':{'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()},'packager':{'path':str(Path(__file__).relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'parent_sha256':PARENT_SHA},'knowledge_release':receipt['knowledge_release'],'native_11_boundaries_policy_and_knowledge_unchanged':True,'deployed':False,'isolated_PG_acceptance':'pending'}
 (base.ARTIFACTS/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf8',newline='\n');print(json.dumps(receipt))
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--patch-root',type=Path,required=True);parser.add_argument('--source-pins',type=Path,required=True);parser.add_argument('--test-source',type=Path,required=True);main(parser.parse_args())
