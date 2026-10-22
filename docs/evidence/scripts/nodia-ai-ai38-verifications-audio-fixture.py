"""Convert one synthetic PCM WAV to WebM Opus; no app imports or provider calls.

VM: python3 DRIVER /tmp/speech.wav /tmp/ai38-synthetic-speech.webm
Only PyAV runs in an isolated docker-exec process, with binary audio on stdin.
Existing output is never overwritten. No profile, env file or app is imported.
"""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys


CONVERT = r'''
import av,base64,hashlib,io,json,sys
assert av.__version__=='19.0.1'
raw=sys.stdin.buffer.read(1048577)
assert 0<len(raw)<=1048576 and raw.startswith(b'RIFF') and raw[8:12]==b'WAVE'
destination=io.BytesIO()
with av.open(io.BytesIO(raw),mode='r',format='wav') as source:
 assert len(source.streams.audio)==1
 with av.open(destination,mode='w',format='webm') as target:
  stream=target.add_stream('libopus',rate=48000)
  stream.layout='mono';stream.bit_rate=64000;stream.codec_context.format='flt'
  resampler=av.AudioResampler(format='flt',layout='mono',rate=48000)
  for frame in source.decode(audio=0):
   for converted in resampler.resample(frame):
    for packet in stream.encode(converted):target.mux(packet)
  for converted in resampler.resample(None):
   for packet in stream.encode(converted):target.mux(packet)
  for packet in stream.encode(None):target.mux(packet)
content=destination.getvalue()
assert 0<len(content)<=1048576 and content.startswith(b'\x1aE\xdf\xa3')
with av.open(io.BytesIO(content),mode='r') as checked:
 assert len(checked.streams.audio)==1 and checked.streams.audio[0].codec_context.name=='opus'
 frames=list(checked.decode(audio=0))
 assert frames and all(frame.sample_rate==48000 for frame in frames)
 duration=sum(frame.samples/frame.sample_rate for frame in frames)
 assert 0<duration<=300
print(json.dumps({'input_sha256':hashlib.sha256(raw).hexdigest(),
 'output_sha256':hashlib.sha256(content).hexdigest(),'output_bytes':len(content),
 'decoded_duration_seconds':duration,'codec':'opus','media_type':'audio/webm',
 'pyav_version':av.__version__,'base64':base64.b64encode(content).decode()}))
'''


def main():
    assert len(sys.argv) == 3
    source, target = map(Path, sys.argv[1:])
    assert source == Path('/tmp/speech.wav') and target == Path('/tmp/ai38-synthetic-speech.webm')
    assert source.is_file() and not source.is_symlink() and source.stat().st_size <= 1048576
    assert not target.exists()
    raw = source.read_bytes()
    converted = subprocess.run(['docker', 'exec', '-i', '--user', '10001:10001',
                                'nodia-gemini-microservice', 'python', '-c', CONVERT],
                               input=raw, capture_output=True, timeout=20, check=True)
    assert len(converted.stdout) <= 1500000
    value = json.loads(converted.stdout)
    assert value['input_sha256'] == hashlib.sha256(raw).hexdigest()
    content = base64.b64decode(value.pop('base64'), validate=True)
    assert value['output_sha256'] == hashlib.sha256(content).hexdigest()
    with target.open('xb') as output:
        output.write(content)
    print(json.dumps({'stage': 'AI-38', 'scope': 'synthetic_audio_fixture_conversion_only',
                      'provider_generations': 0, 'application_imports': False, **value}))


if __name__ == '__main__':
    main()
