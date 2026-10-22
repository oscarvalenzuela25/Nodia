#!/usr/bin/env python3
"""Synthetic PTY login executable. Never reads any external credential store."""
import os
from pathlib import Path
import subprocess
import sys
import time

if "--version" in sys.argv:
    print("fixture")
    raise SystemExit(0)

# A descendant changes PGID inside its inherited SID. This must remain legal and
# still be closed after a supervisor SIGKILL by the real session containment.
child = subprocess.Popen([sys.executable, "-c", "import os,time;os.setpgid(0,0);time.sleep(240)"])
print("Select login method:\n> 1. Google OAuth", flush=True)
sys.stdin.readline()
print("https://accounts.google.com/o/oauth2/auth?redirect_uri=https%3A%2F%2Fantigravity.google%2Foauth-callback&response_type=code&code_challenge_method=S256&client_id=fixture&state=fixture&code_challenge=fixture&scope=fixture", flush=True)
print("copy the code displayed in the browser", flush=True)
sys.stdin.readline()  # discarded; fixtures never store the submitted code
Path("fixture-auth-completed").write_text("fixture")
time.sleep(240)
