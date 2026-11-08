"""Freeze a QA-passed local build and one private synthetic WAV; no provider call.

The legacy candidate manifest is reused unchanged, with additional WAV boundary
pins. Source hashes describe the Windows build, not a Linux recompilation.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile


def sha(value):
    return hashlib.sha256(value).hexdigest()


def freeze(args):
    assert re.fullmatch('r[0-9]{2}', args.revision) and args.build_exit_code == 0
    root = Path(__file__).resolve().parents[3]
    server = root / 'nodia-server'
    candidate_root = '/opt/nodia/verification/ai40-audio-candidate-' + args.revision
    private = json.loads(Path(args.private_fixture).read_bytes())
    assert private['synthetic'] is True and private['media_type'] == 'audio/wav'
    audio = Path(private['path']).read_bytes()
    assert sha(audio) == private['sha256'] and len(audio) == private['bytes']
    assert isinstance(private['expected_transcript'], str) and 0 < len(private['expected_transcript'].encode()) <= 512
    verify_script = """
import 'reflect-metadata';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeCodexChatAudio,normalizeCodexChatAudioTranscript} from './dist/common/ai/codex/codex-chat-audio.js';
import {ValidateNodiaAiRuntimePolicyUseCase as Validate} from './dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
const chunks=[];for await(const c of process.stdin)chunks.push(c);const fixture=JSON.parse(Buffer.concat(chunks));
const p=new Validate().execute(JSON.parse(readFileSync('./dist/nodia-ai-runtime/config/runtime-policy.json')));
const bytes=readFileSync(fixture.path);const [audio]=decodeCodexChatAudio([{mediaType:'audio/wav',sha256:fixture.sha256,contentBase64:bytes.toString('base64')}],{fileBytes:p.admission.file_bytes,totalBytes:p.admission.message_files_bytes,count:p.admission.files_per_message,seconds:p.admission.audio_seconds});
const normalized=normalizeCodexChatAudioTranscript(fixture.expected_transcript);if(normalized.split(' ').length<4)throw Error('oracle_invalid');
console.log(JSON.stringify({duration_seconds:audio.durationSeconds,normalized_expected_sha256:createHash('sha256').update(normalized).digest('hex'),production_decoder_accepted:true}));
"""
    result = subprocess.run(['node', '--input-type=module', '-e', verify_script], cwd=server,
                            input=json.dumps(private).encode(), capture_output=True, check=False, timeout=30)
    assert result.returncode == 0 and len(result.stdout) <= 2048, 'production_decoder_validation_failed'
    decoded = json.loads(result.stdout)
    assert decoded['normalized_expected_sha256'] == private['normalized_expected_sha256']
    files = {}
    for folder in ('dist', 'config'):
        for path in sorted((server / folder).rglob('*')):
            if path.is_file() and not path.is_symlink():
                relative = path.relative_to(server)
                assert not any(part.startswith('.env') or part in ('node_modules', '.tmp', '.cache') for part in relative.parts)
                files[relative.as_posix()] = path.read_bytes()
    for name in ('package.json', 'package-lock.json', 'test/nodia-ai.integration.fixture.mjs',
                 'test/nodia-ai-ai40-real-canary.mjs', 'test/nodia-ai-ai40-real-canary-parent.mjs',
                 'test/nodia-ai-ai40-audio-diagnostic.mjs'):
        files[name] = (server / name).read_bytes()
    sources = {path.relative_to(server).as_posix(): sha(path.read_bytes()) for path in sorted((server / 'src').rglob('*.ts'))
               if not path.name.endswith('.spec.ts')}
    public = (root / 'docs/evidence/scripts/nodia-ai-ai40-canary-input-r02.mjs').read_bytes()
    manifest = {'schema': 'nodia-ai-ai40-image-candidate-v1', 'local_build_command': 'npm run build',
                'local_build_exit_code': 0, 'source_sha256': sources, 'files': {name: sha(value) for name, value in files.items()},
                'public_input_sha256': sha(public),
                'knowledge_release': json.loads(files['dist/nodia-ai-context/config/knowledge-pin.json'])['release_id'],
                'operational_adoption': False, 'provider_requests': 0, 'credentials_included': False}
    raw = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    payloads = {'server/' + name: value for name, value in files.items()}
    payloads['candidate-manifest.json'], payloads['public-canary-input.mjs'] = raw, public
    payloads['fixtures/probe.wav'] = audio
    payloads['fixtures/private-audio-probe.json'] = (json.dumps({'path': candidate_root + '/fixtures/probe.wav',
        'media_type': 'audio/wav', 'sha256': sha(audio), 'expected_transcript': private['expected_transcript']}) + '\n').encode()
    archive_path = root / ('.tmp/ai40-audio-candidate-' + args.revision + '.tar.gz')
    with archive_path.open('xb') as stream, tarfile.open(fileobj=stream, mode='w:gz') as archive:
        for name, value in sorted(payloads.items()):
            member = tarfile.TarInfo(name)
            member.size, member.mode = len(value), 0o600 if name.startswith('fixtures/') else 0o644
            archive.addfile(member, io.BytesIO(value))
    summary = {'schema': 'nodia-ai-ai40-audio-freeze-v1', 'candidate_root': candidate_root,
               'candidate_manifest_sha256': sha(raw), 'archive_sha256': sha(archive_path.read_bytes()),
               'archive_bytes': archive_path.stat().st_size, 'source_hashes': len(sources), 'server_files': len(files),
               'dist_outputs': sum(name.startswith('dist/') for name in files), 'knowledge_release': manifest['knowledge_release'],
               'audio_fixture_sha256': sha(audio), 'audio_fixture_bytes': len(audio), **decoded,
               'private_expected_transcript_emitted': False, 'provider_requests': 0, 'operational_adoption': False}
    with (root / ('.tmp/ai40-audio-freeze-' + args.revision + '.json')).open('xb') as stream:
        stream.write((json.dumps(summary, indent=2) + '\n').encode())
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--private-fixture', required=True)
    parser.add_argument('--build-exit-code', type=int, choices=[0], required=True)
    print(json.dumps(freeze(parser.parse_args())))
