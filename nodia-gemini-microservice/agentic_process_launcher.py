"""Windows handshake: native CLI cannot start before its job is assigned."""
import os
import subprocess
import sys

if __name__ == "__main__":
    if os.read(sys.stdin.fileno(), 1) != b"\x01":
        raise SystemExit(1)
    # Raw stdin has not been buffered; the remaining stream belongs to the CLI.
    result = subprocess.run(sys.argv[1:], stdin=sys.stdin, stdout=sys.stdout,
                            stderr=sys.stderr, shell=False, check=False)
    raise SystemExit(result.returncode)
