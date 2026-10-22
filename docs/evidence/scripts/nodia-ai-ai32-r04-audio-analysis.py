"""Offline, bounded FFmpeg/libav inspection of three exact synthetic fixtures."""
from pathlib import Path
import base64
import hashlib
import json
import shutil
import subprocess
import time

fixtures = {
    'wav':('/tmp/ai32-r01-synthetic-spanish.wav','abd96e103b7396b7c9506b9df3654ce110da2d951f579911cef34ba4795c8f91'),
    'webm':('/tmp/ai32-r01-synthetic-spanish-opus.webm','43e3eed276cee137f2c9d7245659e3b0cce947a21beb5b4c8d827d60910bf82b'),
    'ogg':('/tmp/ai32-r01-synthetic-spanish-opus.ogg','001a04b752e46c40422d2ae057f97f13d510795099e1e0ef86d46f71fc7e7efc'),
}
inputs = {}
for name,(source,expected) in fixtures.items():
    path=Path(source)
    assert path.is_file() and not path.is_symlink() and path.stat().st_size<=200000
    raw=path.read_bytes()
    assert hashlib.sha256(raw).hexdigest()==expected
    inputs[name]={'content':base64.b64encode(raw).decode('ascii'),'sha256':expected,'bytes':len(raw)}
image=subprocess.check_output(['docker','inspect','--format','{{.Image}}','nodia-gemini-microservice'],text=True).strip()
code=r'''
import array,av,base64,hashlib,io,json,math,sys
sources=json.loads(sys.stdin.buffer.read(1000000));results={};pcms={}
def ratio(n,d):return None if not d else round(n/d,8)
def energy(samples):
 rms=math.sqrt(sum(v*v for v in samples)/len(samples))/32768 if samples else 0
 peak=max((abs(v) for v in samples),default=0)/32768
 return {'rms_full_scale':round(rms,8),'peak_full_scale':round(peak,8)}
for name,fixture in sources.items():
 raw=base64.b64decode(fixture['content'],validate=True)
 assert hashlib.sha256(raw).hexdigest()==fixture['sha256']
 with av.open(io.BytesIO(raw),'r') as original:
  streams=list(original.streams)
  assert len(streams)==1 and streams[0].type=='audio'
  stream=streams[0];ctx=stream.codec_context
  metadata={'container_format':original.format.name,'codec':ctx.name,
   'sample_rate':ctx.sample_rate,'channels':len(ctx.layout.channels),'layout':ctx.layout.name,
   'sample_format':ctx.format.name,'container_duration_us':original.duration,
   'stream_duration':stream.duration,'stream_time_base':str(stream.time_base),
   'stream_start_time':stream.start_time,'codec_delay':ctx.delay,
   'extradata_bytes':len(ctx.extradata or b''),
   'extradata_sha256':hashlib.sha256(ctx.extradata or b'').hexdigest()}
  resampler=av.AudioResampler(format='s16',layout='mono',rate=48000)
  pcm=bytearray();count=0;native_samples=0;native_duration=0
  first_pts=None;last_pts=None
  for frame in original.decode(audio=0):
   count+=1;native_samples+=frame.samples;native_duration+=frame.samples/frame.sample_rate
   if first_pts is None:first_pts=frame.pts
   last_pts=frame.pts
   assert count<=2000 and native_duration<=10
   for converted in resampler.resample(frame):pcm.extend(bytes(converted.planes[0])[:converted.samples*2])
  for converted in resampler.resample(None):pcm.extend(bytes(converted.planes[0])[:converted.samples*2])
 assert len(pcm)<=1000000
 samples=array.array('h');samples.frombytes(pcm)
 assert sys.byteorder=='little'
 pcms[name]=samples
 packet_digest=hashlib.sha256();packet_count=0;packet_bytes=0
 with av.open(io.BytesIO(raw),'r') as packets:
  for packet in packets.demux(audio=0):
   payload=bytes(packet)
   if payload:
    packet_digest.update(len(payload).to_bytes(4,'big'));packet_digest.update(payload)
    packet_count+=1;packet_bytes+=len(payload)
 windows=[]
 for offset in range(0,len(samples),960):
  chunk=samples[offset:offset+960];metric=energy(chunk)
  windows.append(metric['rms_full_scale'])
 results[name]={'file_bytes':fixture['bytes'],'file_sha256':fixture['sha256'],**metadata,
   'decoded_frames':count,'decoded_samples':native_samples,'decoded_duration_seconds':round(native_duration,8),
   'first_frame_pts':first_pts,'last_frame_pts':last_pts,
   'canonical_pcm':{'format':'s16le','channels':1,'sample_rate':48000,'bytes':len(pcm),'samples':len(samples),
     'duration_seconds':round(len(samples)/48000,8),'sha256':hashlib.sha256(pcm).hexdigest(),**energy(samples),
     'nonzero_sample_fraction':ratio(sum(v!=0 for v in samples),len(samples)),
     'clipped_sample_count':sum(v in [-32768,32767] for v in samples),
     'energy_windows_ms':20,'energy_window_count':len(windows),
     'energy_windows_above_rms_0_01':sum(v>=0.01 for v in windows),
     'energy_windows_above_rms_0_001':sum(v>=0.001 for v in windows),
     'energy_histogram_rms':{'below_0_001':sum(v<0.001 for v in windows),'from_0_001_to_0_01':sum(0.001<=v<0.01 for v in windows),
       'from_0_01_to_0_1':sum(0.01<=v<0.1 for v in windows),'at_least_0_1':sum(v>=0.1 for v in windows)}},
   'encoded_packets':{'count':packet_count,'payload_bytes':packet_bytes,'length_delimited_payload_sha256':packet_digest.hexdigest()}}
comparisons={}
for left,right in [('webm','ogg'),('wav','webm'),('wav','ogg')]:
 a,b=pcms[left],pcms[right];n=min(len(a),len(b));diff=[a[i]-b[i] for i in range(n)]
 ea=sum(v*v for v in a[:n]);eb=sum(v*v for v in b[:n]);cross=sum(a[i]*b[i] for i in range(n))
 comparisons[left+'_vs_'+right]={'canonical_pcm_identical':a==b,'sample_count_delta':len(a)-len(b),
   'comparison_aligned_from_first_decoded_sample':True,'aligned_sample_count':n,
   'rms_difference_full_scale':round(math.sqrt(sum(d*d for d in diff)/n)/32768,8) if n else None,
   'peak_difference_full_scale':round(max((abs(d) for d in diff),default=0)/32768,8),
   'uncentered_correlation':round(cross/math.sqrt(ea*eb),8) if ea and eb else None,
   'encoded_packet_payloads_identical':results[left]['encoded_packets']['length_delimited_payload_sha256']==results[right]['encoded_packets']['length_delimited_payload_sha256']}
print(json.dumps({'decoder':'PyAV/FFmpeg libav','pyav_version':av.__version__,
 'libav_versions':{key:list(value) for key,value in av.library_versions.items()},
 'files':results,'comparisons':comparisons}))
'''
command=['docker','run','--rm','-i','--network','none','--read-only',
    '--tmpfs','/tmp:rw,size=16m,nosuid,nodev,noexec','--memory','256m','--cpus','1',
    '--pids-limit','32','--cap-drop','ALL','--security-opt','no-new-privileges',
    image,'python','-c',code]
process=subprocess.run(command,input=json.dumps(inputs).encode(),capture_output=True,timeout=35)
if process.returncode:
    raise RuntimeError('bounded_synthetic_decoder_failed')
result=json.loads(process.stdout)
report={'stage':'AI-32-R04','scope':'offline_exact_synthetic_audio_container_and_pcm_comparison',
    'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
    'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'image':image,'provider_generations':0,'configured_database_modified':False,
    'original_fixture_files_modified':False,'execution_transcoding_enabled':False,
    'private_user_audio_used':False,'physical_microphone_recording':False,
    'ffprobe_cli_available_on_host':shutil.which('ffprobe') is not None,
    'ffmpeg_cli_available_on_host':shutil.which('ffmpeg') is not None,
    'isolation':{'network':'none','read_only_root':True,'memory_bytes':256*1024*1024,
      'cpus':1,'pids_limit':32,'capabilities':'all_dropped','no_new_privileges':True,
      'maximum_file_bytes':200000,'maximum_decoded_seconds_per_file':10,
      'maximum_files':3,'timeout_seconds':35,'profile_or_credential_mounts':False},
    'interpretation_limits':['Energy thresholds do not classify speech or prove intelligibility.',
      'Canonical resampling is offline measurement only, never provider execution.',
      'Lossy Opus need not match WAV PCM exactly. Equal WebM/Ogg encoded packets isolate container transport differences.',
      'Aligned correlation uses first decoded samples, without temporal alignment search.'],**result}
print(json.dumps(report,indent=2))
