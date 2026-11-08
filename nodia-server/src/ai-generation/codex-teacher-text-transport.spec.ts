import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { CodexRuntimeService } from '../common/ai/codex/codex-runtime.service.js';
import type { CodexChatRuntime } from '../common/ai/codex/codex-chat-runtime.js';
import type { CodexProfileLease } from '../common/ai/codex/codex-profile-lease.js';
import type { CodexProcessIdentity } from '../common/ai/codex/codex-process-ownership.js';
import { CodexTeacherJournal, decodeCodexTeacherEntry, type CodexTeacherEntry, type CodexTeacherRecord } from '../common/ai/codex/codex-teacher-journal.js';
import { CodexTeacherTextTransport, CODEX_TEACHER_CAPABILITIES, CODEX_TEACHER_POLICY_HASH, codexTeacherBinding,
  type CodexTeacherHostPorts } from './codex-teacher-text-transport.js';
import { TEACHER_AGENTIC_CONTRACT, agenticHash, agenticTextHash, teacherAgenticReference, type TeacherAgenticCommand } from './agentic-text-contract.js';

class MemoryJournal extends CodexTeacherJournal {
  readonly entries = new Map<string, CodexTeacherEntry>();
  readonly order: string[] = [];
  private pending = Promise.resolve();
  override async root() { return '/synthetic/profiles/teacher-jobs'; }
  override async read(id: string) { return structuredClone(this.entries.get(id) ?? null); }
  override async write(value: CodexTeacherEntry) {
    decodeCodexTeacherEntry(value);
    this.order.push(value.kind === 'ack' ? value.release ? 'tombstone' : 'redacted' : 'durable-' + value.state);
    this.entries.set(value.kind === 'ack' ? value.operation_id : value.reference.operation_id, structuredClone(value));
  }
  override async reserve(value: CodexTeacherRecord) {
    if (this.entries.has(value.reference.operation_id)) throw Error('duplicate synthetic journal');
    await this.write(value);
  }
  override async locked<T>(_id: string, work: () => Promise<T>): Promise<T> {
    const previous = this.pending;
    let release = () => {};
    this.pending = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  }
}
type Mode = 'completed' | 'eof' | 'emergency70' | 'silent' | 'descendant';
const nonce = '66666666-6666-4666-8666-666666666666';
function fixture(mode: Mode = 'completed') {
  const journal = new MemoryJournal(), order = journal.order;
  const owner: CodexProcessIdentity = { pid: process.pid, group: process.pid, birth: '101', boot: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const native: CodexProcessIdentity = { ...owner, pid: process.pid + 10000, group: process.pid + 10000, birth: '202' };
  let groupAlive = true, parentAlive = true, host: FakeHost | null = null;
  const lease = { profilePath: '/synthetic/profiles/4', cwd: '/synthetic/profiles/teacher-work-fixture',
    bindRuntime: vi.fn(async () => { order.push('lock-native'); }), release: vi.fn(async () => { order.push('release-profile'); }) } as unknown as CodexProfileLease;
  const profile = { resourceKey: 'codex-profile:' + 'a'.repeat(64), runtimeSessionId: 'b'.repeat(32) };
  const runtime = { releaseIdle: vi.fn(async () => {}), recoverClosedProfile: vi.fn(async () => { order.push('recover-profile'); }) };
  const chat = { observe: vi.fn(async () => ({ ...profile, session: { available: true, authenticated: true },
    models: [{ id: 'synthetic-model', supportedReasoningEfforts: ['synthetic-effort'] }] })),
  journal: { identity: vi.fn(async () => profile) } };
  let command: TeacherAgenticCommand;
  class FakeHost extends EventEmitter {
    readonly pid = native.pid;
    readonly stdout = new PassThrough(); readonly stderr = new PassThrough();
    readonly stdin: Writable;
    private closed = false;
    constructor() {
      super();
      this.stdin = new Writable({
        write: (chunk: Buffer, _encoding, callback) => {
          const input = JSON.parse(chunk.toString()) as Record<string, unknown>;
          if (input.event === 'cancel') {
            order.push('cancel-frame');
            this.frame({ event: 'terminal', status: 'error', code: 'cancelled', binding_hash: codexTeacherBinding(command),
              proof_nonce: nonce, remote_outcome: 'unknown', local_closed: false, retry: false });
            callback(); return;
          }
          order.push('input');
          expect(Object.keys(input).sort()).toEqual(['configuration_generation', 'deadline_at', 'effort_id', 'model_id',
            'operation_id', 'prompt', 'resource_key', 'session_generation']);
          callback();
          queueMicrotask(() => {
            this.frame({ event: 'started', operation_id: command.operation_id, binding_hash: codexTeacherBinding(command),
              proof_nonce: nonce, policy_hash: CODEX_TEACHER_POLICY_HASH });
            if (mode === 'eof') { this.finish(0); return; }
            if (mode === 'silent') return;
            if (mode === 'emergency70') {
              this.frame({ event: 'terminal', status: 'error', code: 'extra_request_forbidden', binding_hash: codexTeacherBinding(command),
                proof_nonce: nonce, remote_outcome: 'unknown', local_closed: false, retry: false });
            } else this.frame({ event: 'terminal', status: 'completed', binding_hash: codexTeacherBinding(command), proof_nonce: nonce,
              text: '{"synthetic":true}', text_hash: agenticTextHash('{"synthetic":true}'), local_closed: true, remote_outcome: 'completed' });
          });
        },
        final: callback => { callback(); queueMicrotask(() => this.finish(mode === 'emergency70' ? 70 : mode === 'silent' ? 1 : 0)); },
      });
    }
    frame(value: unknown) { this.stdout.write(JSON.stringify(value) + '\n'); }
    finish(code: number) {
      if (this.closed) return; this.closed = true;
      if (mode !== 'descendant') groupAlive = false;
      this.stdout.end(); this.stderr.end(); this.emit('close', code);
    }
  }
  const ports: CodexTeacherHostPorts = {
    metadata: vi.fn(async () => ({ path: '/synthetic/verified-host', sha512: 'd'.repeat(128), runtimeHash: 'c'.repeat(64), capabilities: CODEX_TEACHER_CAPABILITIES })),
    acquire: vi.fn(async () => lease), identity: vi.fn(async pid => pid === process.pid ? owner : native),
    same: vi.fn(async () => parentAlive),
    stop: vi.fn(async (identity, terminate) => {
      expect(identity).toEqual(native);
      if (groupAlive && !terminate) throw Error('synthetic owned child still alive');
      if (terminate) { groupAlive = false; host?.finish(1); }
    }),
    spawn: vi.fn((_file, args, options) => {
      expect(args).toContain('--workspace'); expect(options.detached).toBe(true);
      expect(options.env.CODEX_HOME).toBe(lease.profilePath);
      expect(Object.keys(options.env).every(k => ['CODEX_HOME', 'HOME', 'PATH', 'LANG', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'].includes(k))).toBe(true);
      const settings = JSON.parse(args[1]);
      expect(settings.features.unbounded_connection_retries).toBe(false);
      expect(settings.model_providers.nodia_codex.request_max_retries).toBe(0);
      host = new FakeHost(); return host as unknown as ChildProcessWithoutNullStreams;
    }),
  };
  const transport = new CodexTeacherTextTransport(runtime as unknown as CodexRuntimeService, chat as unknown as CodexChatRuntime, journal, ports);
  const unsigned = { contract: TEACHER_AGENTIC_CONTRACT, operation_id: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222', job_id: '33333333-3333-4333-8333-333333333333',
    attempt_id: '44444444-4444-4444-8444-444444444444', actor_id: '1', connection_id: '4', model_id: 'synthetic-model', effort_id: 'synthetic-effort',
    resource_key: profile.resourceKey, configuration_generation: 'f'.repeat(64), session_generation: profile.runtimeSessionId,
    runtime_hash: 'c'.repeat(64), policy_hash: CODEX_TEACHER_POLICY_HASH, prompt: 'Synthetic private educational input',
    deadline_at: new Date(Date.now() + 60000).toISOString() };
  command = { ...unsigned, request_hash: agenticHash(unsigned) };
  return { transport, journal, command, reference: teacherAgenticReference(command), lease, ports, runtime, chat, owner, native,
    closeGroup: () => { groupAlive = false; }, loseParent: () => { parentAlive = false; } };
}
async function settle(f: ReturnType<typeof fixture>) {
  await vi.waitFor(async () => { const value = await f.journal.read(f.command.operation_id); expect(value?.kind === 'active' && value.proof).toBeTruthy(); });
  return f.transport.status(f.reference, new AbortController().signal);
}

describe('Codex Teacher native ownership without accounts or SDK inference', () => {
  it('durably arms real Teacher identities and native birth/group before one input, then ACKs before releasing the profile', async () => {
    const f = fixture();
    try {
      await f.transport.start(f.command, new AbortController().signal);
      const result = await settle(f);
      expect(result.state).toBe('completed'); expect(result.text).toBe('{"synthetic":true}');
      expect(f.journal.order.indexOf('durable-armed')).toBeLessThan(f.journal.order.indexOf('input'));
      expect(JSON.stringify([...f.journal.entries.values()])).not.toContain(f.command.prompt);
      expect(JSON.stringify([...f.journal.entries.values()])).not.toContain('synthetic":true');
      expect(f.lease.release).not.toHaveBeenCalled();
      await f.transport.acknowledge(f.reference, result.terminal_proof!, new AbortController().signal);
      expect(f.journal.order.indexOf('tombstone')).toBeLessThan(f.journal.order.indexOf('release-profile'));
      const tomb = await f.journal.read(f.command.operation_id);
      expect(tomb?.kind === 'ack' && tomb.release === null).toBe(true);
      await expect(f.transport.start(f.command, new AbortController().signal)).rejects.toThrow('acknowledged');
      expect(f.ports.spawn).toHaveBeenCalledOnce();
      await f.transport.acknowledge(f.reference, result.terminal_proof!, new AbortController().signal);
    } finally { await f.transport.onModuleDestroy(); }
  });

  it.each(['eof', 'emergency70'] as const)('%s cannot become completed or trigger replay', async mode => {
    const f = fixture(mode);
    try {
      await f.transport.start(f.command, new AbortController().signal);
      const result = await settle(f);
      expect(result.state).toBe('unknown'); expect(result.text).toBeNull(); expect(result.terminal_proof?.process_closed).toBe(true);
      await f.transport.start(f.command, new AbortController().signal);
      expect(f.ports.spawn).toHaveBeenCalledOnce(); expect(f.lease.release).not.toHaveBeenCalled();
    } finally { await f.transport.onModuleDestroy(); }
  });

  it('a native terminal frame plus a missing leader never closes a live child group', async () => {
    const f = fixture('descendant');
    try {
      await f.transport.start(f.command, new AbortController().signal);
      await vi.waitFor(async () => expect((await f.transport.status(f.reference, new AbortController().signal)).state).toBe('unknown'));
      expect((await f.transport.status(f.reference, new AbortController().signal)).terminal_proof).toBeNull();
      expect(f.lease.release).not.toHaveBeenCalled();
      await expect(f.transport.reconcile(f.reference, new AbortController().signal)).rejects.toThrow();
      f.closeGroup();
      const closed = await f.transport.reconcile(f.reference, new AbortController().signal);
      expect(closed.terminal_proof?.remote_outcome).toBe('unknown'); expect(closed.text).toBeNull();
    } finally { await f.transport.onModuleDestroy(); }
  });

  it('abort sends the owned cancel frame and preserves unknown after verified group termination', async () => {
    const f = fixture('silent'), controller = new AbortController();
    try {
      await f.transport.start(f.command, controller.signal);
      await vi.waitFor(async () => { const r = await f.journal.read(f.command.operation_id); expect(r?.kind === 'active' && r.proof_nonce).toBe(nonce); });
      controller.abort();
      const result = await settle(f);
      expect(f.journal.order).toContain('cancel-frame'); expect(result.state).toBe('unknown'); expect(result.terminal_proof?.process_closed).toBe(true);
      expect(f.ports.spawn).toHaveBeenCalledOnce();
    } finally { await f.transport.onModuleDestroy(); }
  });

  it('does not ACK a foreign scope/proof and retains its durable barrier', async () => {
    const f = fixture();
    try {
      await f.transport.start(f.command, new AbortController().signal); const result = await settle(f);
      await expect(f.transport.acknowledge(f.reference, { ...result.terminal_proof!, request_hash: '0'.repeat(64) }, new AbortController().signal)).rejects.toThrow();
      expect((await f.journal.read(f.command.operation_id))?.kind).toBe('active'); expect(f.lease.release).not.toHaveBeenCalled();
    } finally { await f.transport.onModuleDestroy(); }
  });

  it('recovers a dead owner only after the entire native group is verifiably closed', async () => {
    const f = fixture('silent');
    try {
      const record: CodexTeacherRecord = { version: 1, kind: 'active', reference: f.reference,
        owner: f.owner, native: f.native, workspace: 'teacher-work-fixture', binding_hash: codexTeacherBinding(f.command),
        proof_nonce: nonce, state: 'armed', proof: null };
      await f.journal.reserve(record);
      f.loseParent();
      await expect(f.transport.reconcile(f.reference, new AbortController().signal)).rejects.toThrow();
      expect(f.runtime.recoverClosedProfile).not.toHaveBeenCalled();
      f.closeGroup();
      const recovered = await f.transport.reconcile(f.reference, new AbortController().signal);
      expect(recovered.state).toBe('unknown'); expect(recovered.text).toBeNull();
      expect(f.runtime.recoverClosedProfile).not.toHaveBeenCalled();
      await f.transport.acknowledge(f.reference, recovered.terminal_proof!, new AbortController().signal);
      expect(f.runtime.recoverClosedProfile).toHaveBeenCalledWith('4', f.owner, f.native);
      expect(f.ports.spawn).not.toHaveBeenCalled();
      expect((await f.journal.read(f.command.operation_id))?.kind).toBe('ack');
    } finally { await f.transport.onModuleDestroy(); }
  });

  it('a failed profile release retains recoverable release metadata behind a durable no-replay tombstone', async () => {
    const f = fixture();
    try {
      await f.transport.start(f.command, new AbortController().signal); const result = await settle(f);
      vi.mocked(f.lease.release).mockRejectedValueOnce(Error('synthetic release interruption'));
      await expect(f.transport.acknowledge(f.reference, result.terminal_proof!, new AbortController().signal)).rejects.toThrow('release interruption');
      const pending = await f.journal.read(f.command.operation_id);
      expect(pending?.kind === 'ack' && pending.release !== null).toBe(true);
      await expect(f.transport.start(f.command, new AbortController().signal)).rejects.toThrow('acknowledged');
      await f.transport.acknowledge(f.reference, result.terminal_proof!, new AbortController().signal);
      const finished = await f.journal.read(f.command.operation_id);
      expect(finished?.kind === 'ack' && finished.release === null).toBe(true);
      expect(f.ports.spawn).toHaveBeenCalledOnce();
    } finally { await f.transport.onModuleDestroy(); }
  });

  it('keeps a cross-process ACK pending until the original live owner has released its profile', async () => {
    const f = fixture();
    const receiver = new CodexTeacherTextTransport(f.runtime as unknown as CodexRuntimeService,
      f.chat as unknown as CodexChatRuntime, f.journal, f.ports);
    try {
      await f.transport.start(f.command, new AbortController().signal);
      const result = await settle(f);
      await expect(receiver.acknowledge(f.reference, result.terminal_proof!, new AbortController().signal))
        .rejects.toThrow('codex_ack_release_pending');
      const pending = await f.journal.read(f.command.operation_id);
      expect(pending?.kind === 'ack' && pending.release !== null).toBe(true);
      expect(f.lease.release).not.toHaveBeenCalled();
      await expect(receiver.start(f.command, new AbortController().signal)).rejects.toThrow('acknowledged');
      f.transport.onModuleInit();
      await vi.waitFor(async () => {
        const value = await f.journal.read(f.command.operation_id);
        expect(value?.kind === 'ack' && value.release === null).toBe(true);
      }, { timeout: 2000 });
      await receiver.acknowledge(f.reference, result.terminal_proof!, new AbortController().signal);
      expect(f.lease.release).toHaveBeenCalledOnce();
      expect(f.ports.spawn).toHaveBeenCalledOnce();
      expect(f.runtime.recoverClosedProfile).not.toHaveBeenCalled();
    } finally { await f.transport.onModuleDestroy(); await receiver.onModuleDestroy(); }
  });
});
