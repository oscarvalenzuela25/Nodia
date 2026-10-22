// Synthetic Linux native lifecycle proof: no account, DB, network or real CLI.
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

if (process.platform !== 'linux')
  throw new Error('Linux /proc and flock required');
const dist = resolve(process.env.CODEX_TEST_DIST ?? 'dist');
const url = (name) =>
  pathToFileURL(join(dist, 'common/ai/codex', name + '.js')).href;
const [{ CodexLoginControl }, { CodexLoginJournal }, ownership] =
  await Promise.all([
    import(url('codex-login-control')),
    import(url('codex-login-journal')),
    import(url('codex-process-ownership')),
  ]);
const root = await mkdtemp('/tmp/ncl-');
assert(root.startsWith('/tmp/ncl-'));
const tracked = new Map(),
  checks = [];
const track = (record) => {
  if (record.owner) tracked.set(record.owner.pid, record.owner);
  if (record.native) tracked.set(record.native.pid, record.native);
};
async function wait(work, timeout = 8000) {
  const end = Date.now() + timeout;
  let last;
  do {
    try {
      const value = await work();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await delay(30);
  } while (Date.now() < end);
  throw last ?? new Error('Synthetic fixture timed out');
}
async function child(script, args, env) {
  return new Promise((done, reject) => {
    const p = spawn(process.execPath, [script, ...args], {
      env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME ?? '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '',
      err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('exit', (code) =>
      code === 0
        ? done(JSON.parse(out))
        : reject(new Error(`Fixture failed ${code}: ${err.slice(0, 200)}`)),
    );
  });
}
async function setup(index, scenario = 'pending') {
  const dir = join(root, String(index));
  await mkdir(dir, { mode: 0o700 });
  const profile = join(dir, 'p'),
    journal = new CodexLoginJournal(profile);
  const peer = join(dir, 'peer'),
    helper = join(dir, 'supervisor.mjs'),
    script = join(dir, 'client.mjs'),
    marker = join(dir, 'started');
  await writeFile(
    peer,
    `#!${process.execPath}
import{createInterface}from'node:readline';import{writeFileSync}from'node:fs';import{spawn}from'node:child_process';import{CODEX_SETTINGS}from ${JSON.stringify(url('codex-contract'))};
writeFileSync(${JSON.stringify(marker)},'native-started',{mode:0o600});
const scenario=${JSON.stringify(scenario)};let logged=false;const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');
for await(const line of createInterface({input:process.stdin})){const m=JSON.parse(line);if(!('id'in m))continue;let result={};
if(m.method==='config/read')result={config:CODEX_SETTINGS};
if(m.method==='account/read')result={account:logged||scenario==='preexisting'?{type:'chatgpt',planType:'synthetic'}:null};
if(m.method==='account/login/start'){result={type:'chatgptDeviceCode',loginId:'SYNTHETIC-PRIVATE-ID',verificationUrl:scenario==='bad-url'?'https://evil.test/device':'https://auth.openai.com/codex/device',userCode:'TEST-ONLY'};
if(scenario==='success'||scenario==='early-success')setTimeout(()=>{logged=true;send({method:'account/login/completed',params:{loginId:'SYNTHETIC-PRIVATE-ID',success:true,access_token:'SYNTHETIC-SECRET'}});},scenario==='early-success'?0:300);
if(scenario==='failed')setTimeout(()=>send({method:'account/login/completed',params:{loginId:'SYNTHETIC-PRIVATE-ID',success:false,error:'SYNTHETIC-SECRET'}}),100);
if(scenario==='dead-leader'){const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});writeFileSync(${JSON.stringify(join(dir, 'descendant'))},String(child.pid));setTimeout(()=>process.exit(0),200);}}
send({id:m.id,result});}
`,
    { mode: 0o700 },
  );
  await writeFile(
    helper,
    `import{CodexRuntimeService}from ${JSON.stringify(url('codex-runtime.service'))};import{runCodexLoginSupervisor}from ${JSON.stringify(url('codex-login-supervisor'))};
const runtime=new CodexRuntimeService();runtime.executable=()=>${scenario === 'startup-failure' ? "'/missing-nodia-synthetic-executable'" : JSON.stringify(peer)};
const acquire=runtime.acquire.bind(runtime);runtime.acquire=(id,signal,hook)=>acquire(id,signal,async cert=>{
${scenario === 'kill-before-journal' ? "process.kill(process.pid,'SIGKILL');" : ''}
await hook(cert);
${scenario === 'kill-before-release' ? "process.kill(process.pid,'SIGKILL');" : ''}
});await runCodexLoginSupervisor(process.argv[2],runtime);`,
    { mode: 0o600 },
  );
  await writeFile(
    script,
    `import{CodexLoginControl}from ${JSON.stringify(url('codex-login-control'))};import{CodexLoginJournal}from ${JSON.stringify(url('codex-login-journal'))};const c=new CodexLoginControl(new CodexLoginJournal(${JSON.stringify(profile)}),new URL(${JSON.stringify(pathToFileURL(helper).href)}));try{const[a,id,deadline,actor='9007199254740993']=process.argv.slice(2);console.log(JSON.stringify({ok:true,value:await(a==='start'?c.start('42',actor,id,deadline):a==='status'?c.status('42',id,actor):a==='cancel'?c.cancel('42',id,actor):c.acknowledge('42',id,actor))}));}catch(e){console.log(JSON.stringify({ok:false,code:e.code,status:e.status}));}`,
    { mode: 0o600 },
  );
  const control = new CodexLoginControl(journal, pathToFileURL(helper)),
    id = randomUUID(),
    expiry = new Date(Date.now() + 120000).toISOString();
  return {
    dir,
    profile,
    journal,
    control,
    id,
    expiry,
    marker,
    invoke: (action, actor) =>
      child(script, [action, id, expiry, ...(actor ? [actor] : [])], {
        NODIA_CODEX_ENABLED: 'true',
      }),
  };
}

try {
  let t = await setup(0),
    response = await t.invoke('start');
  assert.equal(response.value.state, 'waiting_authorization');
  let record = await t.journal.read(t.id);
  track(record);
  assert.equal((await t.invoke('status')).value.userCode, 'TEST-ONLY');
  assert.equal((await t.invoke('status', '9007199254740992')).status, 404);
  assert.equal((await t.invoke('start')).value.id, t.id);
  assert.equal(
    (await readdir(join(t.profile, 'login-jobs'))).filter((n) =>
      n.endsWith('.json'),
    ).length,
    1,
  );
  assert(
    !(await readFile((await t.journal.paths(t.id)).file, 'utf8')).match(
      /TEST-ONLY|SYNTHETIC|https:/,
    ),
  );
  assert.equal((await stat(join(t.profile, 'login-jobs'))).mode & 0o777, 0o700);
  assert.equal(
    (await stat((await t.journal.paths(t.id)).socket)).mode & 0o777,
    0o600,
  );
  assert.equal((await t.invoke('cancel')).value.state, 'cancelled');
  await ownership.assertCodexGroupEmpty(record.native.group);
  checks.push(
    'Independent API and worker processes: ownership, private IPC/journal, no duplicate start and certified cancellation',
  );
  t = await setup(1, 'preexisting');
  response = await t.invoke('start');
  record = await t.journal.read(t.id);
  track(record);
  assert.equal(response.value.state, 'waiting_authorization');
  assert.equal((await t.invoke('cancel')).value.state, 'cancelled');
  checks.push('Preexisting authentication is not proof this attempt completed');
  t = await setup(2);
  await t.invoke('start');
  record = await t.journal.read(t.id);
  track(record);
  process.kill(record.owner.pid, 'SIGKILL');
  await delay(100);
  assert.equal((await t.invoke('status')).code, 'codex_login_unknown');
  assert.equal((await t.invoke('cancel')).value.state, 'cancelled');
  await ownership.assertCodexGroupEmpty(record.native.group);
  await assert.rejects(readFile(join(t.profile, '42', 'nodia.lock')), {
    code: 'ENOENT',
  });
  checks.push(
    'Supervisor SIGKILL after admission: unknown until group closure and exact profile-lock retirement',
  );
  for (const [index, scenario] of [
    [3, 'kill-before-journal'],
    [4, 'kill-before-release'],
  ]) {
    t = await setup(index, scenario);
    const pending = t.invoke('start');
    await wait(async () => {
      const r = await t.journal.read(t.id);
      return r?.owner ? r : null;
    });
    await delay(500);
    record = await t.journal.read(t.id);
    assert.equal((await t.invoke('cancel')).value.state, 'cancelled');
    assert.equal((await t.invoke('status')).value.state, 'cancelled');
    assert(
      !(await readFile(t.marker).then(
        () => true,
        () => false,
      )),
    );
    if (record.native)
      await ownership.assertCodexGroupEmpty(record.native.group);
    assert.equal((await pending).value.state, 'cancelled');
    checks.push(
      `Exec gate ${scenario}: native never executed; restart recovers exact lock certificate`,
    );
  }
  for (const [index, scenario, expected] of [
    [5, 'success', 'succeeded'],
    [6, 'failed', 'failed'],
    [7, 'bad-url', 'failed'],
    [8, 'startup-failure', 'failed'],
    [9, 'early-success', 'succeeded'],
  ]) {
    t = await setup(index, scenario);
    await t.invoke('start');
    record = await wait(async () => {
      const r = await t.journal.read(t.id);
      return ['succeeded', 'failed'].includes(r?.state) ? r : null;
    });
    assert.equal(record.state, expected);
    assert.equal(record.native, null);
    assert(!JSON.stringify(record).includes('SYNTHETIC'));
    assert.equal((await t.invoke('ack')).value.acknowledged, true);
    await t.journal.locked(t.id, async () => {
      const r = await t.journal.read(t.id);
      await t.journal.write({ ...r, expiresAt: new Date(0).toISOString() });
    });
    await t.journal.prune();
    assert.equal(await t.journal.read(t.id), null);
    assert.equal((await t.invoke('ack')).value.acknowledged, true);
    checks.push(
      `${scenario}: terminal evidence, closure, ACK/prune and lost ACK retry`,
    );
  }
  t = await setup(10, 'dead-leader');
  await t.invoke('start');
  record = await wait(async () => {
    const r = await t.journal.read(t.id);
    return r?.native ? r : null;
  });
  track(record);
  await wait(async () =>
    ['failed', 'cancelled'].includes((await t.journal.read(t.id))?.state),
  );
  await ownership.assertCodexGroupEmpty(record.native.group);
  checks.push(
    'Leader exit alone is insufficient: owned PGID descendant is also stopped',
  );
  t = await setup(11);
  assert.equal((await t.invoke('cancel')).value.state, 'cancelled');
  assert.equal((await t.invoke('start')).value.state, 'cancelled');
  assert(
    !(await readFile(t.marker).then(
      () => true,
      () => false,
    )),
  );
  checks.push('Cross-process cancellation tombstone fences delayed start');
  for (let n = 0; n < 100; n++) {
    const id = randomUUID();
    await t.journal.locked(id, () =>
      t.journal.reserve({
        version: 1,
        id,
        providerId: '42',
        actorId: '1',
        expiresAt: new Date(0).toISOString(),
        state: 'failed',
        reason: null,
        owner: null,
        native: null,
        acknowledged: true,
      }),
    );
  }
  assert.equal(await t.journal.prune(), 1);
  checks.push(
    '100 expired ACK records and guards prune without admission deadlock',
  );
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: checks.length,
        evidence: checks,
        scope:
          'Synthetic Linux processes only. No real account, CLI or DB. PGID proof covers non-escaping descendants.',
      },
      null,
      2,
    ),
  );
} finally {
  for (const cert of tracked.values()) {
    try {
      if (cert.group === cert.pid) await ownership.stopCodexGroup(cert);
      else if (await ownership.sameCodexProcess(cert))
        process.kill(cert.pid, 'SIGTERM');
    } catch {}
  }
  await rm(root, { recursive: true, force: true });
}
