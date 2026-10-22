from pathlib import Path
import json
root=Path('/home/operador/nodia-ai-verification/server/.tmp/ai15-publication-stage')
manifest=json.loads((root/'bundle/manifest.json').read_text())
pin=json.loads((root/'knowledge-runtime.json').read_text())
print(json.dumps({'capability_contracts':len(manifest['capability_contracts']),'fragment_files':len(list((root/'bundle/fragments').glob('*.md'))),'pin':pin},indent=2))
