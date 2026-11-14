import { Inject, Injectable, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { constants } from 'node:fs';
import { open, realpath, readFile, lstat, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { CodexRuntimeService } from '../common/ai/codex/codex-runtime.service.js';
import { CodexChatRuntime } from '../common/ai/codex/codex-chat-runtime.js';
import { CODEX_SETTINGS, CODEX_VERSION } from '../common/ai/codex/codex-contract.js';
import { acquireCodexProfileLease, type CodexProfileLease } from '../common/ai/codex/codex-profile-lease.js';
import { codexProcessIdentity, stopCodexGroup, sameCodexProcess, type CodexProcessIdentity } from '../common/ai/codex/codex-process-ownership.js';
import { CodexTeacherJournal, assertCodexTeacherReference, type CodexTeacherRecord, type CodexTeacherTombstone, type CodexTeacherEntry } from '../common/ai/codex/codex-teacher-journal.js';
import type { AiSelection } from './ai-selection.js';
import { TEACHER_AGENTIC_CONTRACT, TeacherAgenticClosedError, agenticHash, agenticTextHash, agenticHex, agenticUuid,
  agenticRecord, agenticWellFormedText, teacherAgenticReference, parseTeacherAgenticProof,
  type TeacherAgenticCommand, type TeacherAgenticReference, type TeacherAgenticProof, type TeacherAgenticTransport,
  type TeacherAgenticObservation, type TeacherAgenticSnapshot } from './agentic-text-contract.js';

export const CODEX_TEACHER_SOURCE_COMMIT = '979011409de0a60b52f179721948e65531d26144';
const HOST_POLICY = 'teacher-text/1;tool-policy=empty;isolation=isolated;environments=empty;dynamic-tools=empty;attachments=empty;extensions=response-firewall;one-turn;retries=0;prompt=131072;result=32768';
export const CODEX_TEACHER_POLICY_HASH = agenticTextHash(HOST_POLICY);
export const CODEX_TEACHER_CAPABILITIES = Object.freeze({ protocol: 'nodia-teacher-codex-host/1', purpose: 'teacher-text/1',
  source_commit: CODEX_TEACHER_SOURCE_COMMIT, policy_hash: CODEX_TEACHER_POLICY_HASH, compiled_native: true, provider_id: 'nodia_codex',
  tools: [], attachments: [], maximum_prompt_utf8_bytes: 131072, maximum_result_utf8_bytes: 32768,
  maximum_request_frame_bytes: 800000, maximum_terminal_frame_bytes: 262144, retries: 0, qualification: 'required_per_selection_and_epoch' });
export interface CodexTeacherHostMetadata { path: string; sha512: string; runtimeHash: string; capabilities: typeof CODEX_TEACHER_CAPABILITIES; }
interface HostSpawnOptions { cwd: string; env: NodeJS.ProcessEnv; detached: true; shell: false; }
export interface CodexTeacherHostPorts {
  metadata(signal: AbortSignal): Promise<CodexTeacherHostMetadata>;
  acquire(id: string, signal: AbortSignal): Promise<CodexProfileLease>;
  identity(pid: number): Promise<CodexProcessIdentity>;
  same(identity: CodexProcessIdentity): Promise<boolean>;
  stop(identity: CodexProcessIdentity, terminate: boolean): Promise<void>;
  spawn(path: string, args: string[], options: HostSpawnOptions): ChildProcessWithoutNullStreams;
}
function settings(): Record<string, unknown> {
  const result = structuredClone(CODEX_SETTINGS);
  result.features = { ...agenticRecord(result.features), unbounded_connection_retries: false };
  return result;
}
export function codexTeacherEnvironment(profile: string): NodeJS.ProcessEnv {
  return { CODEX_HOME: profile, HOME: homedir(), PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8',
    ...(process.env.DBUS_SESSION_BUS_ADDRESS ? { DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS } : {}),
    ...(process.env.XDG_RUNTIME_DIR ? { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR } : {}) };
}
export async function codexTeacherHostMetadata(signal: AbortSignal): Promise<CodexTeacherHostMetadata> {
  signal.throwIfAborted();
  const path = process.env.NODIA_CODEX_TEACHER_HOST, expected = process.env.NODIA_CODEX_TEACHER_HOST_SHA512;
  if (process.platform !== 'linux' || CODEX_VERSION !== '0.161.0' || !path || !isAbsolute(path) || !agenticHex(expected, 128)
      || await realpath(path) !== path) throw Error('teacher:codex_host_unconfigured');
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const hash = createHash('sha512');
  try {
    const before = await h.stat();
    if (!before.isFile() || ![0, process.getuid?.()].includes(before.uid) || (before.mode & 0o022) !== 0 || (before.mode & 0o111) === 0)
      throw Error('teacher:codex_host_unverified');
    const stream = h.createReadStream({ autoClose: false });
    for await (const chunk of stream) { signal.throwIfAborted(); hash.update(chunk); }
    const after = await h.stat(), current = await lstat(path);
    if (before.ino !== after.ino || before.dev !== after.dev || before.size !== after.size || before.mtimeMs !== after.mtimeMs
        || current.isSymbolicLink() || current.ino !== before.ino || current.dev !== before.dev) throw Error('teacher:codex_host_unverified');
  } finally { await h.close(); }
  const actual = hash.digest('hex');
  if (actual !== expected) throw Error('teacher:codex_host_unverified');
  const { stdout } = await promisify(execFile)(path, ['--capabilities'], { encoding: 'utf8', timeout: 5000, maxBuffer: 16384,
    env: { PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' }, signal });
  const caps: unknown = JSON.parse(stdout);
  if (agenticHash(caps) !== agenticHash(CODEX_TEACHER_CAPABILITIES)) throw Error('teacher:codex_host_unverified');
  const urls = [import.meta.url, new URL('../common/ai/codex/codex-teacher-journal.js', import.meta.url),
    new URL('../common/ai/codex/codex-profile-lease.js', import.meta.url), new URL('../common/ai/codex/codex-process-ownership.js', import.meta.url),
    new URL('../common/ai/codex/codex-runtime.service.js', import.meta.url)];
  const sources = await Promise.all(urls.map(async url => createHash('sha256').update(await readFile(fileURLToPath(url))).digest('hex')));
  return { path, sha512: actual, capabilities: CODEX_TEACHER_CAPABILITIES,
    runtimeHash: agenticHash({ contract: TEACHER_AGENTIC_CONTRACT, host: actual, capabilities: caps, settings: settings(), sources }) };
}
const defaultPorts: CodexTeacherHostPorts = { metadata: codexTeacherHostMetadata,
  acquire: (id, signal) => acquireCodexProfileLease(id, true, signal, true), identity: codexProcessIdentity,
  same: sameCodexProcess, stop: stopCodexGroup, spawn: (path, args, options) => spawn(path, args, { ...options, stdio: 'pipe' }) };
export function codexTeacherBinding(command: TeacherAgenticCommand): string {
  return agenticHash({ configuration_generation: command.configuration_generation, deadline_at: command.deadline_at,
    effort_id: command.effort_id, model_id: command.model_id, operation_id: command.operation_id,
    policy_hash: CODEX_TEACHER_POLICY_HASH, prompt_hash: agenticTextHash(command.prompt), resource_key: command.resource_key,
    session_generation: command.session_generation, source_commit: CODEX_TEACHER_SOURCE_COMMIT });
}
interface OwnedHost {
  record: CodexTeacherRecord; lease: CodexProfileLease; child: ChildProcessWithoutNullStreams;
  exited: Promise<void>; exitCode: number | null; task: Promise<void> | null;
  running: boolean; cancelled: boolean; terminal: boolean; completedText: string | null;
  abort: () => void; signal: AbortSignal; timer: NodeJS.Timeout;
}
const sameReference = (a: TeacherAgenticReference, b: TeacherAgenticReference) => agenticHash(a) === agenticHash(b);

/** One native Teacher operation, never a fabricated NodiaAI chat owner. */
@Injectable()
export class CodexTeacherTextTransport implements TeacherAgenticTransport, OnModuleInit, OnModuleDestroy {
  private readonly owned = new Map<string, OwnedHost>();
  private timer: NodeJS.Timeout | null = null;
  private stopping = false;
  constructor(private readonly runtime: CodexRuntimeService, private readonly chat: CodexChatRuntime,
    @Optional() @Inject('CODEX_TEACHER_JOURNAL') readonly journal = new CodexTeacherJournal(),
    @Optional() @Inject('CODEX_TEACHER_HOST_PORTS') private readonly ports: CodexTeacherHostPorts = defaultPorts) {}
  onModuleInit() { this.timer = setInterval(() => { void this.maintain().catch(() => undefined); }, 500).unref(); }
  async observe(selection: AiSelection, _configuration: string, signal: AbortSignal): Promise<TeacherAgenticObservation> {
    if (selection.mode !== 'agentic') throw Error('teacher:agentic_selection_invalid');
    const host = await this.ports.metadata(signal), observed = await this.chat.observe(selection.connection_id, signal);
    const model = observed.models.filter(item => item.id === selection.model_id);
    const available = observed.session.available && observed.session.authenticated === true && model.length === 1
      && (selection.effort_id === null || model[0].supportedReasoningEfforts.includes(selection.effort_id));
    return { contract: TEACHER_AGENTIC_CONTRACT, available,
      reason: available ? null : observed.session.reason === 'codex_profile_busy' ? 'codex_profile_busy'
        : observed.session.authenticated !== true ? 'codex_session_required' : 'codex_model_unavailable',
      observed_at: new Date().toISOString(), resource_key: observed.resourceKey, session_generation: observed.runtimeSessionId,
      runtime_hash: host.runtimeHash, binary_sha512: host.sha512, policy_hash: host.capabilities.policy_hash,
      tool_policy: 'none', native_io: false };
  }
  private snapshot(record: CodexTeacherEntry, reference: TeacherAgenticReference): TeacherAgenticSnapshot {
    if (record.kind === 'ack') throw Error('teacher:codex_operation_acknowledged');
    if (!sameReference(record.reference, reference)) throw Error('teacher:agentic_protocol_invalid');
    const local = this.owned.get(reference.operation_id);
    return { contract: TEACHER_AGENTIC_CONTRACT, operation_id: reference.operation_id,
      state: record.proof ? record.proof.remote_outcome : local?.running ? 'running' : 'unknown',
      text: record.proof?.remote_outcome === 'completed' ? local?.completedText ?? null : null, terminal_proof: record.proof };
  }
  async start(command: TeacherAgenticCommand, signal: AbortSignal): Promise<TeacherAgenticSnapshot> {
    const reference = teacherAgenticReference(command);
    assertCodexTeacherReference(reference);
    const { request_hash, ...unsigned } = command;
    if (request_hash !== agenticHash(unsigned) || typeof command.prompt !== 'string' || !command.prompt.trim()
        || !agenticWellFormedText(command.prompt) || Buffer.byteLength(command.prompt) > 131072
        || !Number.isFinite(Date.parse(command.deadline_at))) throw Error('teacher:agentic_protocol_invalid');
    return this.journal.locked(reference.operation_id, async () => {
      const existing = await this.journal.read(reference.operation_id);
      if (existing) return this.snapshot(existing, reference);
      let lease: CodexProfileLease | null = null, admitted = false;
      try {
        if (this.stopping || this.owned.size >= 64) throw Error('teacher:codex_runtime_unavailable');
        signal.throwIfAborted();
        const observed = await this.observe({ connection_id: reference.connection_id, mode: 'agentic', model_id: reference.model_id,
          effort_id: reference.effort_id }, reference.configuration_generation, signal);
        if (!observed.available || observed.resource_key !== reference.resource_key || observed.session_generation !== reference.session_generation
            || observed.runtime_hash !== reference.runtime_hash || observed.policy_hash !== reference.policy_hash) throw Error('teacher:configuration_changed');
        const host = await this.ports.metadata(signal);
        if (host.runtimeHash !== reference.runtime_hash || host.capabilities.policy_hash !== reference.policy_hash) throw Error('teacher:configuration_changed');
        await this.runtime.releaseIdle(reference.connection_id);
        lease = await this.ports.acquire(reference.connection_id, signal);
        const identity = await this.chat.journal.identity(reference.connection_id, false, false);
        if (identity.resourceKey !== reference.resource_key || identity.runtimeSessionId !== reference.session_generation) throw Error('teacher:configuration_changed');
        const remaining = Date.parse(command.deadline_at) - Date.now();
        if (remaining <= 0 || remaining > 600000) throw Error('teacher:deadline_expired');
        const record: CodexTeacherRecord = { version: 1, kind: 'active', reference, owner: await this.ports.identity(process.pid),
          native: null, workspace: basename(lease.cwd), binding_hash: codexTeacherBinding(command), proof_nonce: null,
          state: 'reserved', proof: null };
        await this.journal.reserve(record);
        admitted = true;
        const child = this.ports.spawn(host.path, ['--config-json', JSON.stringify(settings()), '--workspace', lease.cwd],
          { cwd: lease.cwd, env: codexTeacherEnvironment(lease.profilePath), detached: true, shell: false });
        let exitCode: number | null = null;
        const exited = new Promise<void>(resolve => { child.once('close', code => { exitCode = code; resolve(); }); });
        child.once('error', () => undefined);
        child.stdin.on('error', () => undefined);
        child.stderr.resume();
        const entry: OwnedHost = { record, lease, child, exited, get exitCode() { return exitCode; }, task: null,
          running: true, cancelled: false, terminal: false, completedText: null, abort: () => {}, signal,
          timer: setTimeout(() => { void this.cancel(entry); }, remaining).unref() };
        this.owned.set(reference.operation_id, entry);
        entry.abort = () => { void this.cancel(entry); };
        signal.addEventListener('abort', entry.abort, { once: true });
        if (!child.pid) throw Error('teacher:codex_native_identity_unverified');
        const native = await this.ports.identity(child.pid);
        if (native.pid !== child.pid || native.group !== native.pid) throw Error('teacher:codex_native_identity_unverified');
        record.native = native; record.state = 'armed';
        await lease.bindRuntime(child.pid, native);
        await this.journal.write(record); // Durable identities precede the only stdin release.
        entry.task = this.run(entry);
        entry.task.catch(() => undefined);
        signal.throwIfAborted();
        const input = { operation_id: command.operation_id, model_id: command.model_id, effort_id: command.effort_id,
          prompt: command.prompt, deadline_at: command.deadline_at, configuration_generation: command.configuration_generation,
          session_generation: command.session_generation, resource_key: command.resource_key };
        await new Promise<void>((resolve, reject) => child.stdin.write(JSON.stringify(input) + '\n', error => error ? reject(error) : resolve()));
        return this.snapshot(record, reference);
      } catch (error) {
        if (!admitted) {
          await lease?.release();
          throw new TeacherAgenticClosedError({ provider: 'openai', reference }, null, true, 'codex_preflight_failed');
        }
        const entry = this.owned.get(reference.operation_id);
        if (entry) { void this.cancel(entry); if (!entry.task && entry.record.native) { entry.task = this.run(entry); entry.task.catch(() => undefined); } }
        throw error;
      }
    });
  }
  private async cancel(entry: OwnedHost): Promise<void> {
    entry.cancelled = true;
    entry.completedText = null;
    if (!entry.child.stdin.destroyed && !entry.child.stdin.writableEnded)
      entry.child.stdin.end(JSON.stringify({ event: 'cancel', operation_id: entry.record.reference.operation_id }) + '\n');
    if (entry.record.native) await this.ports.stop(entry.record.native, true).catch(() => undefined);
  }
  private async frame(entry: OwnedHost, value: unknown): Promise<void> {
    const v = agenticRecord(value), record = entry.record;
    if (entry.terminal) throw Error('teacher:codex_protocol_invalid');
    if (v.event === 'started') {
      if (Object.keys(v).sort().join(',') !== 'binding_hash,event,operation_id,policy_hash,proof_nonce'
          || record.proof_nonce !== null || v.operation_id !== record.reference.operation_id || v.binding_hash !== record.binding_hash
          || v.policy_hash !== record.reference.policy_hash || !agenticUuid(v.proof_nonce)) throw Error('teacher:codex_protocol_invalid');
      record.proof_nonce = v.proof_nonce;
      await this.journal.locked(record.reference.operation_id, () => this.journal.write(record));
      return;
    }
    if (v.event !== 'terminal') throw Error('teacher:codex_protocol_invalid');
    if (v.status === 'completed') {
      if (Object.keys(v).sort().join(',') !== 'binding_hash,event,local_closed,proof_nonce,remote_outcome,status,text,text_hash'
          || !record.proof_nonce || v.proof_nonce !== record.proof_nonce || v.binding_hash !== record.binding_hash
          || v.local_closed !== true || v.remote_outcome !== 'completed' || typeof v.text !== 'string' || !v.text.trim()
          || !agenticWellFormedText(v.text) || Buffer.byteLength(v.text) > 32768 || v.text_hash !== agenticTextHash(v.text)) throw Error('teacher:codex_protocol_invalid');
      JSON.parse(v.text); // The restricted host returns educational JSON text, never a tool envelope.
      if (!entry.cancelled) entry.completedText = v.text;
    } else {
      const keys = record.proof_nonce ? 'binding_hash,code,event,local_closed,proof_nonce,remote_outcome,retry,status'
        : 'binding_hash,code,event,local_closed,remote_outcome,retry,status';
      if (v.status !== 'error' || Object.keys(v).sort().join(',') !== keys || v.retry !== false
          || typeof v.code !== 'string' || !/^[a-z_]{1,100}$/.test(v.code) || typeof v.local_closed !== 'boolean'
          || (record.proof_nonce ? v.proof_nonce !== record.proof_nonce || v.binding_hash !== record.binding_hash || v.remote_outcome !== 'unknown'
            : v.binding_hash !== null || v.remote_outcome !== 'not_dispatched')) throw Error('teacher:codex_protocol_invalid');
      entry.completedText = null;
    }
    entry.terminal = true;
    entry.child.stdin.end(); // Release Tokio's stdin reader before waiting for process closure.
  }
  private async run(entry: OwnedHost): Promise<void> {
    let failed = false;
    try {
      let pending = Buffer.alloc(0), total = 0, frames = 0;
      for await (const raw of entry.child.stdout) {
        if (!Buffer.isBuffer(raw)) throw Error('teacher:codex_protocol_invalid');
        total += raw.length;
        if (total > 524288) throw Error('teacher:codex_protocol_invalid');
        pending = Buffer.concat([pending, raw]);
        for (;;) {
          const newline = pending.indexOf(10);
          if (newline < 0) break;
          if (newline > 262144 || ++frames > 2) throw Error('teacher:codex_protocol_invalid');
          const text = new TextDecoder('utf-8', { fatal: true }).decode(pending.subarray(0, newline));
          pending = pending.subarray(newline + 1);
          await this.frame(entry, JSON.parse(text));
        }
        if (pending.length > 262144) throw Error('teacher:codex_protocol_invalid');
      }
      if (pending.length || !entry.terminal) throw Error('teacher:codex_protocol_invalid');
    } catch { failed = true; entry.completedText = null; await this.cancel(entry); }
    try {
      if (!entry.record.native) throw Error('teacher:codex_native_identity_unverified');
      await Promise.race([entry.exited, delay(5000).then(() => { throw Error('teacher:codex_close_unverified'); })]);
      await this.ports.stop(entry.record.native, failed || entry.cancelled);
      const completed = !failed && !entry.cancelled && entry.exitCode === 0 && entry.completedText !== null;
      const proof: TeacherAgenticProof = { ...entry.record.reference, terminal_proof_id: randomUUID(), process_closed: true,
        remote_outcome: completed ? 'completed' : 'unknown', response_hash: completed ? agenticTextHash(entry.completedText as string) : null,
        observed_at: new Date().toISOString() };
      entry.record.state = 'closed'; entry.record.proof = proof;
      await this.journal.locked(entry.record.reference.operation_id, () => this.journal.write(entry.record));
      if (!completed) entry.completedText = null;
    } catch { entry.completedText = null; }
    finally { entry.running = false; clearTimeout(entry.timer); entry.signal.removeEventListener('abort', entry.abort); }
  }
  async status(reference: TeacherAgenticReference, signal: AbortSignal): Promise<TeacherAgenticSnapshot> {
    assertCodexTeacherReference(reference); signal.throwIfAborted();
    const record = await this.journal.read(reference.operation_id);
    if (!record) throw Error('teacher:codex_operation_missing');
    return this.snapshot(record, reference);
  }
  async reconcile(reference: TeacherAgenticReference, signal: AbortSignal): Promise<TeacherAgenticSnapshot> {
    assertCodexTeacherReference(reference); signal.throwIfAborted();
    return this.journal.locked(reference.operation_id, async () => {
      const record = await this.journal.read(reference.operation_id);
      if (!record || record.kind === 'ack' || !sameReference(record.reference, reference)) throw Error('teacher:codex_operation_missing');
      if (record.proof) return this.snapshot(record, reference);
      const local = this.owned.get(reference.operation_id);
      if (local?.running || !record.native || !local && await this.ports.same(record.owner)) throw Error('teacher:codex_close_unverified');
      if (local) await Promise.race([local.exited, delay(100).then(() => { throw Error('teacher:codex_close_unverified'); })]);
      await this.ports.stop(record.native, false); // No absent-PID shortcut and no signalling another owner.
      record.state = 'closed'; record.proof = { ...reference, terminal_proof_id: randomUUID(), process_closed: true,
        remote_outcome: 'unknown', response_hash: null, observed_at: new Date().toISOString() };
      await this.journal.write(record);
      return this.snapshot(record, reference);
    });
  }
  async acknowledge(reference: TeacherAgenticReference, proof: TeacherAgenticProof, signal: AbortSignal): Promise<void> {
    assertCodexTeacherReference(reference); parseTeacherAgenticProof(proof, reference); signal.throwIfAborted();
    await this.journal.locked(reference.operation_id, async () => {
      const record = await this.journal.read(reference.operation_id);
      if (!record) throw Error('teacher:codex_operation_missing');
      if (record.kind === 'ack') {
        if (record.reference_hash !== agenticHash(reference) || record.ack_hash !== agenticHash(proof)) throw Error('teacher:codex_proof_mismatch');
        await this.release(record);
        return;
      }
      if (!sameReference(record.reference, reference) || !record.proof || agenticHash(record.proof) !== agenticHash(proof)) throw Error('teacher:codex_proof_mismatch');
      if (!record.native) throw Error('teacher:codex_close_unverified');
      await this.ports.stop(record.native, false);
      const tombstone = await this.journal.acknowledge(reference, proof, { owner: record.owner, native: record.native,
        connection_id: reference.connection_id, workspace: record.workspace });
      await this.release(tombstone);
    });
  }
  private async release(tombstone: CodexTeacherTombstone): Promise<void> {
    const operation = tombstone.operation_id, release = tombstone.release;
    if (!release) return;
    const local = this.owned.get(operation);
    if (local) {
      if (local.running || !local.record.native || agenticHash({ owner: local.record.owner, native: local.record.native,
        connection_id: local.record.reference.connection_id, workspace: local.record.workspace }) !== agenticHash(release)) throw Error('teacher:codex_close_unverified');
      await this.ports.stop(release.native, false);
      await local.lease.release();
    } else if (!await this.ports.same(release.owner)) {
      await this.ports.stop(release.native, false);
      await this.runtime.recoverClosedProfile(release.connection_id, release.owner, release.native);
      const directory = join(dirname(await this.journal.root()), release.workspace);
      const info = await lstat(directory).catch(error => {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
        throw error;
      });
      if (info) {
        if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.() || await realpath(directory) !== directory) throw Error('teacher:codex_workspace_unverified');
        await rm(directory, { recursive: true });
      }
    } else throw Error('teacher:codex_ack_release_pending'); // The live original owner must release its maintained claim before ACK completes.
    await this.journal.write({ ...tombstone, release: null });
    this.owned.delete(operation);
  }
  private async maintain(): Promise<void> {
    for (const [operation, local] of this.owned) {
      if (local.running) continue;
      await this.journal.locked(operation, async () => {
        const record = await this.journal.read(operation);
        if (record?.kind === 'ack') await this.release(record);
      }).catch(() => undefined);
    }
  }
  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.owned.values()].map(async entry => {
      const record = await this.journal.read(entry.record.reference.operation_id);
      if (record?.kind === 'active' && !record.proof) {
        await this.cancel(entry);
        if (entry.task) await entry.task;
        await this.reconcile(entry.record.reference, AbortSignal.timeout(5000)).catch(() => undefined);
      }
    }));
    await this.maintain(); // Unacknowledged/unknown claims retain their durable profile barrier.
  }
}
