from pathlib import Path
import json
print(json.dumps({str(p):p.is_file() for p in [Path('/usr/lib/postgresql/16/bin/pg_dump'),Path('/usr/lib/postgresql/17/bin/pg_dump'),Path('/usr/bin/flock')]}))
