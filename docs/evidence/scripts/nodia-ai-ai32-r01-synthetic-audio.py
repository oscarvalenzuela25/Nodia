"""Offline encode the explicitly supplied synthetic WAV as browser-like Opus.

Runs in the existing private parser container; never reads a session or calls AI.
Only generated fixture bytes leave the child process through its private pipe.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--synthetic-speech-wav", type=Path, required=True)
    parser.add_argument("--output-prefix", type=Path, required=True)
    args = parser.parse_args()
    targets = {"webm": Path(str(args.output_prefix) + ".webm"), "ogg": Path(str(args.output_prefix) + ".ogg")}
    if any(path.exists() for path in targets.values()):
        parser.error("output exists; preserve earlier fixture bytes")
    source = args.synthetic_speech_wav.read_bytes()
    if len(source) > 20 * 1024 * 1024 or not source.startswith(b"RIFF"):
        parser.error("expected explicitly supplied bounded synthetic WAV")
    code = r'''
import av,base64,io,json,sys
source=base64.b64decode(sys.stdin.buffer.read(),validate=True)
results={}
for container_format in ['webm','ogg']:
    target=io.BytesIO()
    with av.open(io.BytesIO(source),'r') as original:
        with av.open(target,'w',format=container_format) as encoded:
            stream=encoded.add_stream('libopus',rate=48000)
            stream.layout='mono'
            resampler=av.AudioResampler(format='s16',layout='mono',rate=48000)
            for frame in original.decode(audio=0):
                for converted in resampler.resample(frame):
                    for packet in stream.encode(converted):encoded.mux(packet)
            for converted in resampler.resample(None):
                for packet in stream.encode(converted):encoded.mux(packet)
            for packet in stream.encode(None):encoded.mux(packet)
    content=target.getvalue()
    with av.open(io.BytesIO(content),'r') as decoded:
        frames=list(decoded.decode(audio=0))
        duration=sum(frame.samples/frame.sample_rate for frame in frames)
    results[container_format]={'content_base64':base64.b64encode(content).decode(),'duration_seconds':round(duration,4),'decoded_frames':len(frames)}
print(json.dumps(results))
'''
    process = subprocess.run(["docker", "exec", "-i", "--user", "10001:10001", "nodia-gemini-microservice",
                              "python", "-c", code], input=base64.b64encode(source), capture_output=True,
                             timeout=30, check=False)
    if process.returncode:
        raise RuntimeError("offline_synthetic_audio_encoding_failed")
    values = json.loads(process.stdout)
    report = {"scope": "offline_synthetic_voice_encoding", "provider_calls": 0,
              "source_sha256": hashlib.sha256(source).hexdigest(), "formats": {}}
    for key, path in targets.items():
        content = base64.b64decode(values[key]["content_base64"], validate=True)
        path.write_bytes(content)
        report["formats"][key] = {"path": str(path), "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(), "duration_seconds": values[key]["duration_seconds"],
            "decoded_frames": values[key]["decoded_frames"], "codec": "opus"}
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
