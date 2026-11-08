/**
 * Pinned private PostgreSQL volume preservation. REMOTE READS ONLY.
 * node ops/lab/teacher-vm-private-volumes.mjs --self-test
 * node ops/lab/teacher-vm-private-volumes.mjs --preserve
 * No remote deletion/prune operation exists in this program.
 * Private artifacts are DPAPI CurrentUser wrapped AES-256-GCM blobs; no plaintext tar.
 */
import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, '../..');
const STORE = join(HERE, 'artifacts/teacher-vm-deployment-20261101-r01/storage');
const DPAPI = join(HERE, 'teacher-vm-private-volumes-dpapi.py');
const VOLUMES = Object.freeze([
  '5e3f681d61e7fa1b31e6a912eab9c7cdea8e5c6c8a7d298aa1fb077e92761073',
  '01a1753bab92be8024b0e8a8a55eef77fccc19e2406898b1a0541e81a294cd44',
]);
// Exact transport copied from ops/lab/remote.py; no agent forwarding or host-key bypass.
const SSH = ['-i', 'C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab',
  '-o', 'UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts',
  '-o', 'HostKeyAlias=nodia-vps-lab', '-o', 'BatchMode=yes', 'operador@172.31.209.214'];
// Already present local test image. Never pull/build/start PostgreSQL or provider code.
const IMAGE = 'sha256:788c3ae3e89b91963639376d16a722ba59388cdac843888101c3ce72c901831c';
const FORMAT = 'nodia-private-volume-aes256gcm-dpapi-currentuser/1';
const LIMIT = 16 * 1024 * 1024;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value); // Python uses sorted keys, parse order preserved.
const fail = code => { throw new Error(code); };
const log = (event, details = {}) => process.stdout.write(`${JSON.stringify({ event, ...details })}\n`);

function start(command, args, input) {
  const child = spawn(command, args, { cwd: WORKSPACE, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let diagnostic = ''; // Bounded private RAM, never emitted.
  child.stderr.on('data', bytes => { if (diagnostic.length < 32768) diagnostic += bytes.toString().slice(0, 32768 - diagnostic.length); });
  child.stdin.on('error', () => {});
  let settled = false;
  const done = new Promise((ok, reject) => {
    child.on('error', () => { settled = true; reject(new Error('subprocess_start_failed')); });
    child.on('close', code => {
      if (!settled) {
        settled = true;
        const digestLine = diagnostic.split('\n').find(value => value.startsWith('NODIA_TAR_STREAM '));
        if (digestLine) { try { child.remoteDigest = JSON.parse(digestLine.slice(17)); } catch { /* asserted by the caller */ } }
        const category = /No space left/i.test(diagnostic) ? 'disk_full' : /Operation not permitted/i.test(diagnostic) ? 'operation_not_permitted' : /Permission denied/i.test(diagnostic) ? 'permission_denied' : /Read-only file system/i.test(diagnostic) ? 'readonly_filesystem' : /Unexpected EOF|Unexpected end/i.test(diagnostic) ? 'truncated_input' : /Cannot.*time|utime/i.test(diagnostic) ? 'mtime_failed' : /Cannot.*ownership/i.test(diagnostic) ? 'ownership_failed' : /xattr/i.test(diagnostic) ? 'xattr_failed' : 'unclassified';
        if (code === 0) { diagnostic = ''; ok(); }
        else {
          const error = new Error(`subprocess_exit_${code}_${category}`);
          error.privateDiagnostic = Buffer.from(diagnostic); diagnostic = ''; reject(error);
        }
      }
    });
  });
  // Attach immediately so an early subprocess failure never becomes an unhandled rejection.
  done.catch(() => {});
  if (input !== undefined) child.stdin.end(input);
  return { child, done };
}

async function collect(processHandle, limit = LIMIT) {
  let size = 0;
  const chunks = [];
  try {
    for await (const chunk of processHandle.child.stdout) {
      size += chunk.length;
      if (size > limit) fail('bounded_output_exceeded');
      chunks.push(chunk);
    }
    await processHandle.done;
    return Buffer.concat(chunks);
  } catch (error) {
    processHandle.child.kill();
    throw error;
  }
}

async function command(program, args, input = Buffer.alloc(0)) {
  return collect(start(program, args, input));
}

async function dpapi(operation, bytes) {
  return collect(start('python', [DPAPI, operation], bytes), 32768);
}

// Same manifest code executes remotely and in the local restore container.
const MANIFEST = String.raw`
import os,sys,json,stat,hashlib,base64,pathlib
def manifest(root):
 root=pathlib.Path(root)
 if not root.is_dir() or root.is_symlink() or str(root.resolve())!=str(root):raise ValueError('unsafe_root')
 output=[]
 for current,dirs,files in os.walk(root,followlinks=False):
  dirs.sort();files.sort()
  paths=[pathlib.Path(current)]+[pathlib.Path(current)/f for f in files]
  for p in paths:
   rel=p.relative_to(root).as_posix()
   if rel!='.' and (rel.startswith('/') or any(c in ('','..','.') for c in rel.split('/')) or chr(92) in rel or chr(0) in rel):raise ValueError('unsafe_member_path')
   before=p.lstat()
   if stat.S_ISLNK(before.st_mode) or not (stat.S_ISREG(before.st_mode) or stat.S_ISDIR(before.st_mode)):raise ValueError('unsafe_member_type')
   if stat.S_ISREG(before.st_mode) and before.st_nlink!=1:raise ValueError('hardlinked_member')
   item={'path':rel,'kind':'directory' if p.is_dir() else 'file','uid':before.st_uid,'gid':before.st_gid,'mode':stat.S_IMODE(before.st_mode),'mtime_ns':str(before.st_mtime_ns),'xattrs':{}}
   for attr in sorted(os.listxattr(p,follow_symlinks=False)):
    item['xattrs'][attr]=base64.b64encode(os.getxattr(p,attr,follow_symlinks=False)).decode('ascii')
   if item['kind']=='file':
    h=hashlib.sha256()
    with p.open('rb') as stream:
     for chunk in iter(lambda:stream.read(1024*1024),b''):h.update(chunk)
    after=p.lstat()
    if (before.st_size,before.st_mtime_ns,before.st_ino)!=(after.st_size,after.st_mtime_ns,after.st_ino):raise ValueError('member_changed_during_read')
    item.update(size=before.st_size,sha256=h.hexdigest())
   output.append(item)
   if len(output)>10000:raise ValueError('manifest_too_large')
  for d in dirs:
   if (pathlib.Path(current)/d).is_symlink():raise ValueError('symlink_directory')
 return sorted(output,key=lambda x:x['path'])
`;

const REMOTE = MANIFEST + String.raw`
import subprocess,re
PINNED=['5e3f681d61e7fa1b31e6a912eab9c7cdea8e5c6c8a7d298aa1fb077e92761073','01a1753bab92be8024b0e8a8a55eef77fccc19e2406898b1a0541e81a294cd44']
def run(args):
 return subprocess.check_output(args,stderr=subprocess.DEVNULL).decode()
def preflight(name):
 if name not in PINNED or not re.fullmatch('[0-9a-f]{64}',name):raise ValueError('volume_not_pinned')
 expected='/var/lib/docker/volumes/'+name+'/_data'
 info=json.loads(run(['docker','volume','inspect',name]))[0]
 if info['Name']!=name or info['Driver']!='local' or info.get('Options') or info['Mountpoint']!=expected or set((info.get('Labels') or {}).keys())!={'com.docker.volume.anonymous'}:raise ValueError('unexpected_volume_identity')
 if os.path.realpath(expected)!=expected or not os.path.isdir(expected):raise ValueError('unsafe_volume_realpath')
 ids=run(['docker','ps','-aq']).split()
 for c in json.loads(run(['docker','inspect']+ids)) if ids else []:
  for m in c.get('Mounts',[]):
   src=m.get('Source','')
   if m.get('Name')==name or src==expected or src.startswith(expected+'/') or expected.startswith(src.rstrip('/')+'/') and src:raise ValueError('container_reference')
 for proc in pathlib.Path('/proc').iterdir():
  if not proc.name.isdigit():continue
  for leaf in ('mountinfo','cmdline','maps'):
   try:
    if expected.encode() in (proc/leaf).read_bytes():raise ValueError('process_reference')
   except (FileNotFoundError,ProcessLookupError,PermissionError):pass
  for leaf in ('cwd','root','exe'):
   try:
    value=os.readlink(proc/leaf)
    if value==expected or value.startswith(expected+'/'):raise ValueError('process_reference')
   except (FileNotFoundError,ProcessLookupError,PermissionError):pass
  try:
   for fd in (proc/'fd').iterdir():
    try:
     value=os.readlink(fd)
     if value==expected or value.startswith(expected+'/'):raise ValueError('process_reference')
    except (FileNotFoundError,ProcessLookupError,PermissionError):pass
  except (FileNotFoundError,ProcessLookupError,PermissionError):pass
 for base in ('/etc/systemd/system','/usr/lib/systemd/system','/etc/nginx'):
  for current,dirs,files in os.walk(base):
   for file in files:
    try:
     if name.encode() in (pathlib.Path(current)/file).read_bytes():raise ValueError('configuration_reference')
    except (FileNotFoundError,PermissionError,IsADirectoryError):pass
 return expected,info
try:
 mode,name=sys.argv[1:]
 root,info=preflight(name)
 if mode=='manifest':
  entries=manifest(root)
  print(json.dumps({'entries':entries,'volume':name,'driver':info['Driver'],'labels':info['Labels'],'created_at':info.get('CreatedAt'),'source':root},sort_keys=True,separators=(',',':')))
 elif mode=='tar':
  manifest(root) # rejects traversal/symlink/special/hardlinked members before streaming
  producer=subprocess.Popen(['tar','--create','--file','-','--directory',root,'--numeric-owner','--format=pax','--blocking-factor=20','--pax-option=delete=atime,delete=ctime','--xattrs','--xattrs-include=*','--acls','.'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env={**os.environ,'TAR_OPTIONS':''})
  h=hashlib.sha256();total=0
  for chunk in iter(lambda:producer.stdout.read(1024*1024),b''):
   h.update(chunk);total+=len(chunk);sys.stdout.buffer.write(chunk)
  if producer.wait()!=0:raise ValueError('tar_producer_failed')
  sys.stdout.buffer.flush()
  sys.stderr.write('NODIA_TAR_STREAM '+json.dumps({'bytes':total,'sha256':h.hexdigest()})+'\n');sys.stderr.flush()
 elif mode=='references':print(json.dumps({'volume':name,'unreferenced':True,'driver':info['Driver'],'anonymous':True},sort_keys=True))
 else:raise ValueError('invalid_operation')
except Exception:
 sys.stderr.write('pinned_volume_read_failed\n');sys.exit(1)
`;

function remote(mode, volume) {
  assert(VOLUMES.includes(volume), 'volume_not_pinned');
  assert(['manifest', 'tar', 'references'].includes(mode), 'remote_operation_not_read_only');
  return start('ssh', [...SSH, `sudo -n python3 -B - ${mode} ${volume}`], REMOTE);
}

function validateManifest(data, volume) {
  assert.equal(data.volume, volume);
  assert.equal(data.driver, 'local');
  assert.deepEqual(Object.keys(data.labels), ['com.docker.volume.anonymous']);
  assert(Array.isArray(data.entries) && data.entries.length > 0 && data.entries.length <= 10000);
  const seen = new Set();
  for (const entry of data.entries) {
    const path = entry.path;
    assert(typeof path === 'string' && (path === '.' || (!path.startsWith('/') && !path.includes('\\') && !path.includes('\0') && path.split('/').every(v => v && v !== '..' && v !== '.'))), 'unsafe_member_path');
    assert(!seen.has(path), 'duplicate_member'); seen.add(path);
    assert(['file', 'directory'].includes(entry.kind), 'unsafe_member_type');
    for (const key of ['uid', 'gid', 'mode']) assert(Number.isSafeInteger(entry[key]) && entry[key] >= 0);
    assert(typeof entry.mtime_ns === 'string' && /^\d+$/.test(entry.mtime_ns), 'exact_mtime_required');
    assert(entry.mode <= 0o7777 && entry.xattrs && typeof entry.xattrs === 'object');
    if (entry.kind === 'file') assert(/^[0-9a-f]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.size) && entry.size >= 0);
  }
  assert(seen.has('.'), 'missing_root');
  return data;
}

async function inventory(volume) {
  const bytes = await collect(remote('manifest', volume));
  const data = validateManifest(JSON.parse(bytes), volume);
  return { data, bytes: Buffer.from(canonical(data)) };
}

function meter() {
  const hash = createHash('sha256'); let bytes = 0;
  const stream = new Transform({ transform(chunk, _encoding, callback) { hash.update(chunk); bytes += chunk.length; callback(null, chunk); } });
  return { stream, result: () => ({ bytes, sha256: hash.digest('hex') }) };
}

async function seal(sourceOrFactory, name, context, producerDone = Promise.resolve()) {
  const key = randomBytes(32); const iv = randomBytes(12);
  const file = join(STORE, `${name}.enc`); const envelope = join(STORE, `${name}.json`);
  const plain = meter(); const encrypted = meter();
  try {
    const wrapped = await dpapi('wrap', key);
    const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(context));
    const destination = createWriteStream(file, { flags: 'wx', mode: 0o600 });
    const producer = typeof sourceOrFactory === 'function' ? sourceOrFactory() : null;
    const source = producer ? producer.child.stdout : sourceOrFactory;
    // No await or flowing listener between spawn and this single binary pipeline.
    try { await Promise.all([pipeline(source, plain.stream, cipher, encrypted.stream, destination), producer?.done ?? producerDone]); }
    catch (error) { producer?.child.kill(); throw error; }
    const metadata = { format: FORMAT, context, cipher: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), key_protection: 'DPAPI-CurrentUser', wrapped_key: wrapped.toString('base64'), encrypted: encrypted.result(), plaintext: plain.result() };
    await writeFile(envelope, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return { file, envelope, metadata, remoteDigest: producer?.child.remoteDigest };
  } finally { key.fill(0); }
}

async function existingBlob(name, context) {
  const file = join(STORE, `${name}.enc`), envelope = join(STORE, `${name}.json`);
  try {
    const metadata = JSON.parse(await readFile(envelope, 'utf8'));
    assert.equal(metadata.context, context); assert.equal(metadata.format, FORMAT);
    return { file, envelope, metadata };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function plaintextBuffer(blob) {
  const chunks = []; let bytes = 0;
  await decrypt(blob, new Writable({ write(chunk, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > LIMIT) return callback(new Error('bounded_output_exceeded'));
    chunks.push(Buffer.from(chunk)); callback();
  } }));
  return Buffer.concat(chunks);
}

async function decrypt(blob, sink) {
  const metadata = JSON.parse(await readFile(blob.envelope, 'utf8'));
  assert.equal(metadata.format, FORMAT); assert.equal(metadata.context, blob.metadata.context);
  assert.equal(metadata.cipher, 'aes-256-gcm'); assert.equal(metadata.key_protection, 'DPAPI-CurrentUser');
  const key = await dpapi('unwrap', Buffer.from(metadata.wrapped_key, 'base64'));
  const encrypted = meter(); const plain = meter();
  try {
    assert.equal(key.length, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(metadata.iv, 'base64'));
    decipher.setAAD(Buffer.from(metadata.context)); decipher.setAuthTag(Buffer.from(metadata.tag, 'base64'));
    await pipeline(createReadStream(blob.file), encrypted.stream, decipher, plain.stream, sink);
    assert.deepEqual(encrypted.result(), metadata.encrypted, 'ciphertext_changed');
    assert.deepEqual(plain.result(), metadata.plaintext, 'plaintext_hash_mismatch');
  } finally { key.fill(0); }
}

const discard = () => new Writable({ write(_chunk, _encoding, callback) { callback(); } });
function dockerArgs(volume) {
  assert(/^template_teacher_vm_restore_[a-f0-9]{12}$/.test(volume), 'unsafe_restore_volume');
  return ['run', '--rm', '--pull', 'never', '--network', 'none', '--user', '0:0', '--read-only', '--security-opt', 'no-new-privileges', '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '--cap-add', 'FOWNER', '--cap-add', 'DAC_OVERRIDE', '--mount', `type=volume,src=${volume},dst=/restore`, '-i'];
}

async function tarContract(blob, before) {
  const script = String.raw`
import sys,tarfile,hashlib,json
out=[];seen=set()
with tarfile.open(fileobj=sys.stdin.buffer,mode='r|') as archive:
 for m in archive:
  name=m.name
  while name.startswith('./'):name=name[2:]
  if not name:name='.'
  if name.startswith('/') or chr(92) in name or chr(0) in name or name!='.' and any(p in ('','..','.') for p in name.split('/')):raise ValueError('unsafe_tar_path')
  if name in seen or not(m.isfile() or m.isdir()):raise ValueError('unsafe_tar_member')
  seen.add(name)
  row={'path':name,'kind':'file' if m.isfile() else 'directory','uid':m.uid,'gid':m.gid,'mode':m.mode}
  if m.isfile():
   h=hashlib.sha256();stream=archive.extractfile(m);size=0
   for chunk in iter(lambda:stream.read(1024*1024),b''):h.update(chunk);size+=len(chunk)
   if size!=m.size:raise ValueError('truncated_tar_member')
   row.update(size=size,sha256=h.hexdigest())
  out.append(row)
trailer_bytes=0;nonzero=False
for chunk in iter(lambda:sys.stdin.buffer.read(1024*1024),b''):
 trailer_bytes+=len(chunk);nonzero=nonzero or any(chunk)
print(json.dumps({'entries':sorted(out,key=lambda x:x['path']),'stats':{'members':len(out),'tar_offset':archive.offset,'trailer_bytes':trailer_bytes,'nonzero_trailer':nonzero}},sort_keys=True,separators=(',',':')))
`;
  const reader = start('python', ['-B', '-c', script]);
  const answer = collect(reader); answer.catch(() => {});
  let inputError;
  try { await decrypt(blob, reader.child.stdin); } catch (error) { inputError = error; }
  const response = await answer;
  if (inputError) throw inputError;
  const parsed = JSON.parse(response);
  log('tar_contract_stats', parsed.stats);
  assert.equal(parsed.stats.nonzero_trailer, false, 'unexpected_tar_trailer');
  const actual = parsed.entries;
  const expected = before.data.entries.map(({ path, kind, uid, gid, mode, size, sha256: hash }) => kind === 'file' ? { path, kind, uid, gid, mode, size, sha256: hash } : { path, kind, uid, gid, mode });
  assert.deepEqual(actual, expected, 'tar_members_contract_mismatch');
  return { members: actual.length, all_file_hashes_equal: true, safe_paths_and_regular_types_only: true };
}

async function restoreCheck(blob, before) {
  // Full tag and both hashes verified BEFORE any plaintext is sent to an extractor.
  await decrypt(blob, discard());
  const volume = `template_teacher_vm_restore_${randomBytes(6).toString('hex')}`;
  await command('docker', ['volume', 'create', '--label', 'nodia.teacher.disposable=restore-only', volume]);
  let complete = false;
  try {
    const extract = start('docker', [...dockerArgs(volume), '--entrypoint', '/usr/bin/tar', IMAGE, '--extract', '--file', '-', '--directory', '/restore', '--numeric-owner', '--same-owner', '--preserve-permissions', '--xattrs', '--xattrs-include=*', '--acls', '--delay-directory-restore']);
    extract.child.stdout.resume();
    await Promise.all([decrypt(blob, extract.child.stdin), extract.done]);
    const result = JSON.parse(await command('docker', [...dockerArgs(volume), '--entrypoint', '/usr/bin/python3', IMAGE, '-B', '-c', `${MANIFEST}\nprint(json.dumps(manifest('/restore'),sort_keys=True,separators=(',',':')))\n`]));
    assert.deepEqual(result, before.data.entries, 'restored_manifest_mismatch');
    complete = true;
    return { restored_volume: volume, entries: result.length, file_bytes: result.reduce((n, e) => n + (e.size ?? 0), 0), manifest_sha256: sha256(Buffer.from(canonical(result))), content_and_uid_gid_mode_mtime_xattrs_equal: true, network: 'none', postgres_started: false };
  } finally {
    // Only this operator's exact owned local volume. No recursive host filesystem deletion.
    await command('docker', ['volume', 'rm', volume]);
    log('local_restore_removed', { volume, verified: complete });
  }
}

async function selfTest() {
  const key = randomBytes(32); const wrapped = await dpapi('wrap', key); const unwrapped = await dpapi('unwrap', wrapped);
  assert.deepEqual(unwrapped, key); key.fill(0); unwrapped.fill(0);
  const fixture = { volume: VOLUMES[0], driver: 'local', labels: { 'com.docker.volume.anonymous': '' }, entries: [{ path: '.', kind: 'directory', uid: 0, gid: 0, mode: 0o700, mtime_ns: '1792373400123456789', xattrs: {} }] };
  validateManifest(fixture, VOLUMES[0]);
  for (const path of ['../escape', '/absolute', 'safe/../escape', 'safe\\escape', 'safe//escape', 'safe/./escape', 'bad\0name']) assert.throws(() => validateManifest({ ...fixture, entries: [{ ...fixture.entries[0], path }] }, VOLUMES[0]));
  assert.throws(() => validateManifest({ ...fixture, entries: [{ ...fixture.entries[0], kind: 'symlink' }] }, VOLUMES[0]));
  assert.throws(() => validateManifest({ ...fixture, entries: [...fixture.entries, ...fixture.entries] }, VOLUMES[0]));
  assert.throws(() => remote('remove', VOLUMES[0]));
  assert.throws(() => dockerArgs('unrelated'));
  const cipherKey = randomBytes(32), iv = randomBytes(12), aad = Buffer.from('test'), input = randomBytes(1024);
  const cipher = createCipheriv('aes-256-gcm', cipherKey, iv); cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]); const tag = cipher.getAuthTag();
  const check = (text, auth, context) => { const d = createDecipheriv('aes-256-gcm', cipherKey, iv); d.setAAD(context); d.setAuthTag(auth); return Buffer.concat([d.update(text), d.final()]); };
  assert.deepEqual(check(ciphertext, tag, aad), input);
  const changed = Buffer.from(ciphertext); changed[0] ^= 1;
  assert.throws(() => check(changed, tag, aad));
  assert.throws(() => check(ciphertext, tag, Buffer.from('wrong-context')));
  cipherKey.fill(0);
  await command('docker', ['image', 'inspect', IMAGE, '--format', '{{.Id}}']);
  const pythonTests = MANIFEST + String.raw`
p=pathlib.Path('/test/root');p.mkdir()
f=p/'item';f.write_bytes(b'contract-test');os.chmod(f,0o640);os.utime(f,ns=(1792373400123456789,1792373400123456789));os.setxattr(f,'user.contract',b'metadata')
entries=manifest(str(p));assert entries[1]['mtime_ns']=='1792373400123456789' and entries[1]['xattrs']=={'user.contract':'bWV0YWRhdGE='}
for kind in ('symlink','hardlink','fifo'):
 bad=p/'bad'
 if kind=='symlink':bad.symlink_to('/outside')
 elif kind=='hardlink':os.link(f,bad)
 else:os.mkfifo(bad)
 rejected=False
 try:manifest(str(p))
 except ValueError:rejected=True
 assert rejected
 bad.unlink()
print('python_manifest_contract_pass')
`;
  const contract = await command('docker', ['run', '--rm', '--pull', 'never', '--network', 'none', '--user', '0:0', '--read-only', '--tmpfs', '/test:rw,nosuid,nodev,noexec,size=2m', '--entrypoint', '/usr/bin/python3', IMAGE, '-B', '-c', pythonTests]);
  assert.equal(contract.toString().trim(), 'python_manifest_contract_pass');
  const synthetic = MANIFEST + String.raw`
p=pathlib.Path('/test/root');p.mkdir();f=p/'item';f.write_bytes(b'contract-only');os.chmod(f,0o600);os.chmod(p,0o700)
os.chown(f,70,70);os.chown(p,70,70);os.setxattr(f,'user.contract',b'metadata')
os.utime(f,ns=(1792373400123456789,1792373400123456789));os.utime(p,ns=(1792373400123456789,1792373400123456789))
`;
  const fixtureArgs = ['run', '--rm', '--pull', 'never', '--network', 'none', '--user', '0:0', '--read-only', '--tmpfs', '/test:rw,nosuid,nodev,noexec,size=2m', '--entrypoint', '/usr/bin/python3', IMAGE, '-B', '-c'];
  const expected = JSON.parse(await command('docker', [...fixtureArgs, synthetic + "print(json.dumps(manifest('/test/root'),sort_keys=True,separators=(',',':')))\n"]));
  await mkdir(STORE, { recursive: true });
  const source = start('docker', [...fixtureArgs, synthetic + "os.execvp('tar',['tar','--create','--file','-','--directory','/test/root','--numeric-owner','--format=pax','--pax-option=delete=atime,delete=ctime','--xattrs','--xattrs-include=*','--acls','.'])\n"], Buffer.alloc(0));
  const blob = await seal(source.child.stdout, `contract-${randomBytes(6).toString('hex')}`, `${FORMAT}:synthetic-contract`, source.done);
  try { await restoreCheck(blob, { data: { entries: expected } }); }
  finally { await unlink(blob.file); await unlink(blob.envelope); }
  log('self_test_pass', { dpapi_current_user_roundtrip: true, traversal_absolute_nul_backslash_duplicates_symlink_rejected: true, no_remote_mutation_operation: true, gcm_tamper_and_aad_rejected: true, local_image_present: true });
}

async function preserve() {
  assert.equal(process.platform, 'win32', 'dpapi_requires_windows');
  await mkdir(STORE, { recursive: true });
  const catalogPath = join(STORE, 'catalog.json');
  try { await access(catalogPath); fail('catalog_already_exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const results = [];
  for (const volume of VOLUMES) {
    log('volume_preflight_started', { volume });
    const before = await inventory(volume);
    const manifestName = `${volume}.manifest`, manifestContext = `${FORMAT}:${volume}:manifest`;
    const manifestBlob = await existingBlob(manifestName, manifestContext) ?? await seal(Readable.from([before.bytes]), manifestName, manifestContext);
    assert.deepEqual(await plaintextBuffer(manifestBlob), before.bytes, 'saved_source_manifest_changed');
    const archiveName = `${volume}.tar.r04`, archiveContext = `${FORMAT}:${volume}:archive`;
    let archiveBlob = await existingBlob(archiveName, archiveContext);
    if (!archiveBlob) {
      archiveBlob = await seal(() => remote('tar', volume), archiveName, archiveContext);
      log('transport_metrics', { remote: archiveBlob.remoteDigest, received: archiveBlob.metadata.plaintext });
      assert.deepEqual(archiveBlob.remoteDigest, archiveBlob.metadata.plaintext, 'ssh_stream_digest_mismatch');
      await writeFile(join(STORE, `${volume}.tar.r04.transport.json`), `${JSON.stringify({ remote_digest: archiveBlob.remoteDigest, received_digest: archiveBlob.metadata.plaintext, equal: true }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    }
    log('volume_archive_encrypted', { volume, encrypted_bytes: archiveBlob.metadata.encrypted.bytes });
    const after = await inventory(volume);
    assert.deepEqual(after.data, before.data, 'remote_source_changed');
    const tarValidation = await tarContract(archiveBlob, before);
    log('tar_contract_verified', { volume, ...tarValidation });
    const restored = await restoreCheck(archiveBlob, before);
    const references = JSON.parse(await collect(remote('references', volume)));
    assert.equal(references.unreferenced, true);
    const result = { volume, source: before.data.source, driver: before.data.driver, labels: before.data.labels, created_at: before.data.created_at, manifest_sha256: sha256(before.bytes), archive: { file: archiveBlob.file, envelope: archiveBlob.envelope, encrypted_sha256: archiveBlob.metadata.encrypted.sha256, encrypted_bytes: archiveBlob.metadata.encrypted.bytes, plaintext_tar_sha256: archiveBlob.metadata.plaintext.sha256 }, encrypted_manifest: { file: manifestBlob.file, envelope: manifestBlob.envelope, encrypted_sha256: manifestBlob.metadata.encrypted.sha256 }, remote_manifest_before_after_equal: true, remote_references_after: references, restore: restored };
    results.push(result);
    await writeFile(join(STORE, `${volume}.receipt.json`), `${JSON.stringify(result, null, 2)}\n`, { flag: 'w', mode: 0o600 });
    log('volume_preservation_verified', { volume, entries: restored.entries, file_bytes: restored.file_bytes });
  }
  const finalReferences = [];
  for (const volume of VOLUMES) finalReferences.push(JSON.parse(await collect(remote('references', volume))));
  const receipt = { schema: 'nodia-teacher-vm-private-volumes-preserved/1', completed_at: new Date().toISOString(), status: 'preserved_and_restored_locally_no_remote_deletion', operator_sha256: sha256(await readFile(fileURLToPath(import.meta.url))), dpapi_helper_sha256: sha256(await readFile(DPAPI)), remote_writes: 0, provider_requests: 0, remote_volume_deletions: 0, plaintext_archive_files: 0, sequential_restore: true, encryption: FORMAT, final_references: finalReferences, volumes: results };
  await writeFile(catalogPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  log('preservation_complete', { catalog: catalogPath, volumes: results.length, remote_writes: 0 });
}

try {
  if (process.argv.slice(2).join(' ') === '--self-test') await selfTest();
  else if (process.argv.slice(2).join(' ') === '--preserve') await preserve();
  else fail('expected_self_test_or_preserve');
} catch (error) {
  // Only explicit operator codes. Never print stdout/stderr, manifests, keys, or private paths from subprocesses.
  if (error.privateDiagnostic?.length) {
    const flags = ['does not look like', 'Skipping to next header', 'checksum', 'Cannot mkdir', 'File exists', 'Cannot stat', 'Cannot open', 'Cannot write', 'Cannot seek', 'Cannot utime', 'Cannot change', 'Invalid argument', 'No such file', 'Unexpected EOF', 'xattr', 'Permission denied', 'Operation not permitted', 'Exiting with failure', 'Unrecognized archive', 'memory', 'unexpected_tar_trailer', 'unsafe_tar_path', 'unsafe_tar_member', 'truncated_tar_member', 'invalid header', 'bad checksum', 'empty file', 'ReadError'].filter(value => error.privateDiagnostic.toString().toLowerCase().includes(value.toLowerCase()));
    try { await mkdir(STORE, { recursive: true }); await seal(Readable.from([error.privateDiagnostic]), `diagnostic-${randomBytes(6).toString('hex')}`, `${FORMAT}:private-diagnostic`); } catch { /* Original error retained; never print private diagnostic. */ }
    error.privateDiagnostic.fill(0);
    log('private_diagnostic_encrypted', { flags });
  }
  const code = error instanceof assert.AssertionError ? 'operator_assertion_failed' : /^[a-z0-9_]+$/.test(error.message) ? error.message : 'private_volume_operation_failed';
  log('failed', { code, error_type: /^[A-Za-z]+$/.test(error.name) ? error.name : 'Error', system_code: typeof error.code === 'string' && /^[A-Z_0-9]+$/.test(error.code) ? error.code : null });
  process.exitCode = 1;
}
