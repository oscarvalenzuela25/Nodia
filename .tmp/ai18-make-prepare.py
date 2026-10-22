from pathlib import Path
p=Path('.tmp/ai17-prepare-close.py')
s=p.read_text().replace('ai17-20261016-close','ai18-20261017').replace('nodia-ai17-20261016','nodia-ai18-20261017')
Path('.tmp/ai18-prepare-lab.py').write_text(s)
