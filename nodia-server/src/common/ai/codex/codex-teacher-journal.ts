import { constants } from 'node:fs';
import { lstat, open, mkdir, realpath, rename, link, rm, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, relative, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { codexProcessIdentity, sameCodexProcess, type CodexProcessIdentity } from './codex-process-ownership.js';
import { agenticHash, agenticHex, agenticUuid, agenticRecord, agenticWellFormedText,
  TEACHER_AGENTIC_CONTRACT, parseTeacherAgenticProof,
  type TeacherAgenticReference, type TeacherAgenticProof } from '../../../ai-generation/agentic-text-contract.js';

export interface CodexTeacherRecord {
  version: 1; kind: 'active'; reference: TeacherAgenticReference;
  owner: CodexProcessIdentity; native: CodexProcessIdentity | null;
  workspace: string; binding_hash: string; proof_nonce: string | null;
  state: 'reserved' | 'armed' | 'closed'; proof: TeacherAgenticProof | null;
}
export interface CodexTeacherTombstone {
  version: 1; kind: 'ack'; operation_id: string; reference_hash: string; ack_hash: string;
  release: CodexTeacherRelease | null;
}
export interface CodexTeacherRelease { owner: CodexProcessIdentity; native: CodexProcessIdentity; connection_id: string; workspace: string; }
export type CodexTeacherEntry = CodexTeacherRecord | CodexTeacherTombstone;
const decimal = (value: unknown) => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const exact = (value: unknown, maximum: number) => typeof value === 'string' && value.trim() === value && value.length > 0
  && Buffer.byteLength(value, 'utf8') <= maximum && agenticWellFormedText(value) && ![...value].some(c => c.charCodeAt(0) < 32);
const invalid = () => Error('teacher:codex_journal_unverified');
const missing = (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
export function assertCodexTeacherReference(value: unknown): asserts value is TeacherAgenticReference {
  const v = agenticRecord(value);
  if (Object.keys(v).sort().join(',') !== 'actor_id,attempt_id,configuration_generation,connection_id,contract,effort_id,job_id,model_id,operation_id,policy_hash,request_hash,resource_key,runtime_hash,session_generation,session_id'
      || v.contract !== TEACHER_AGENTIC_CONTRACT || !['operation_id', 'session_id', 'job_id', 'attempt_id'].every(k => agenticUuid(v[k]))
      || !decimal(v.actor_id) || !decimal(v.connection_id) || !exact(v.model_id, 1024) || !(v.effort_id === null || exact(v.effort_id, 256))
      || !['configuration_generation', 'runtime_hash', 'policy_hash', 'request_hash'].every(k => agenticHex(v[k]))
      || !agenticHex(v.session_generation, 32) || typeof v.resource_key !== 'string' || !/^codex-profile:[a-f0-9]{64}$/.test(v.resource_key)) throw invalid();
}
export function codexTeacherProcess(value: unknown): value is CodexProcessIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as CodexProcessIdentity;
  return Object.keys(v).sort().join(',') === 'birth,boot,group,pid' && Number.isSafeInteger(v.pid) && v.pid > 1
    && Number.isSafeInteger(v.group) && v.group > 1 && typeof v.birth === 'string' && /^\d{1,32}$/.test(v.birth) && agenticUuid(v.boot);
}
export function decodeCodexTeacherEntry(value: unknown): CodexTeacherEntry {
  const v = agenticRecord(value);
  if (v.version !== 1) throw invalid();
  if (v.kind === 'ack') {
    if (Object.keys(v).sort().join(',') !== 'ack_hash,kind,operation_id,reference_hash,release,version'
        || !agenticUuid(v.operation_id) || !agenticHex(v.reference_hash) || !agenticHex(v.ack_hash)) throw invalid();
    if (v.release !== null) {
      const release = agenticRecord(v.release);
      if (Object.keys(release).sort().join(',') !== 'connection_id,native,owner,workspace' || !codexTeacherProcess(release.owner)
          || !codexTeacherProcess(release.native) || release.native.pid !== release.native.group || !decimal(release.connection_id)
          || typeof release.workspace !== 'string' || !/^teacher-work-[A-Za-z0-9]+$/.test(release.workspace)) throw invalid();
    }
    return v as unknown as CodexTeacherTombstone;
  }
  if (v.kind !== 'active' || Object.keys(v).sort().join(',') !== 'binding_hash,kind,native,owner,proof,proof_nonce,reference,state,version,workspace'
      || !codexTeacherProcess(v.owner) || !(v.native === null || codexTeacherProcess(v.native) && v.native.pid === v.native.group)
      || !agenticHex(v.binding_hash) || !(v.proof_nonce === null || agenticUuid(v.proof_nonce))
      || typeof v.workspace !== 'string' || !/^teacher-work-[A-Za-z0-9]+$/.test(v.workspace)
      || !['reserved', 'armed', 'closed'].includes(String(v.state))) throw invalid();
  assertCodexTeacherReference(v.reference);
  if ((v.state === 'reserved' && (v.native !== null || v.proof !== null || v.proof_nonce !== null))
      || (v.state !== 'reserved' && v.native === null) || (v.state === 'closed') !== (v.proof !== null)) throw invalid();
  if (v.proof !== null) parseTeacherAgenticProof(v.proof, v.reference);
  return v as unknown as CodexTeacherRecord;
}

/** Neutral owner journal: no prompts, answers, account data or synthetic chat IDs. */
export class CodexTeacherJournal {
  constructor(private readonly configuredRoot?: string) {}
  async root(): Promise<string> {
    if (process.platform !== 'linux' || process.getuid?.() === undefined) throw invalid();
    const profile = resolve(this.configuredRoot ?? process.env.NODIA_CODEX_PROFILE_ROOT ?? join(homedir(), '.local/share/nodia/codex'));
    if (!relative(resolve(process.cwd(), '..'), profile).startsWith('..') || profile === homedir()) throw invalid();
    const root = join(profile, 'teacher-jobs');
    for (const path of [profile, root]) {
      await mkdir(path, { recursive: true, mode: 0o700 });
      const s = await lstat(path);
      if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid?.() || (s.mode & 0o077) !== 0 || await realpath(path) !== path) throw invalid();
    }
    return root;
  }
  private async path(operation: string) {
    if (!agenticUuid(operation)) throw invalid();
    return join(await this.root(), operation + '.json');
  }
  private async readPrivate(file: string, maximum: number): Promise<{ raw: string; ino: number; dev: number } | null> {
    let h;
    try { h = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW); } catch (error) { if (missing(error)) return null; throw error; }
    try {
      const s = await h.stat();
      if (!s.isFile() || s.uid !== process.getuid?.() || (s.mode & 0o077) !== 0 || s.size > maximum) throw invalid();
      return { raw: new TextDecoder('utf-8', { fatal: true }).decode(await h.readFile()), ino: s.ino, dev: s.dev };
    } finally { await h.close(); }
  }
  async read(operation: string): Promise<CodexTeacherEntry | null> {
    const input = await this.readPrivate(await this.path(operation), 16384);
    if (!input) return null;
    const value = decodeCodexTeacherEntry(JSON.parse(input.raw));
    if ((value.kind === 'ack' ? value.operation_id : value.reference.operation_id) !== operation) throw invalid();
    return value;
  }
  async write(value: CodexTeacherEntry, exclusive = false): Promise<void> {
    decodeCodexTeacherEntry(value);
    const operation = value.kind === 'ack' ? value.operation_id : value.reference.operation_id;
    const file = await this.path(operation), temporary = file + '.' + randomUUID() + '.tmp';
    const h = await open(temporary, 'wx', 0o600);
    try {
      try { await h.writeFile(JSON.stringify(value)); await h.sync(); } finally { await h.close(); }
      if (exclusive) await link(temporary, file); else await rename(temporary, file);
      const d = await open(dirname(file), 'r');
      try { await d.sync(); } finally { await d.close(); }
    } finally { await rm(temporary, { force: true }); }
  }
  async reserve(value: CodexTeacherRecord): Promise<void> {
    const names = await readdir(await this.root());
    if (names.length >= 10000) throw Error('teacher:codex_journal_capacity');
    await this.write(value, true);
  }
  async acknowledge(reference: TeacherAgenticReference, proof: TeacherAgenticProof, release: CodexTeacherRelease): Promise<CodexTeacherTombstone> {
    assertCodexTeacherReference(reference); parseTeacherAgenticProof(proof, reference);
    const tombstone: CodexTeacherTombstone = { version: 1, kind: 'ack', operation_id: reference.operation_id,
      reference_hash: agenticHash(reference), ack_hash: agenticHash(proof), release };
    await this.write(tombstone);
    return tombstone;
  }
  async locked<T>(operation: string, work: () => Promise<T>): Promise<T> {
    const file = (await this.path(operation)) + '.guard', deadline = Date.now() + 2000;
    let guard;
    while (!guard) {
      try { guard = await open(file, 'wx', 0o600); }
      catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error;
        const current = await this.readPrivate(file, 4096);
        if (current) {
          const owner: unknown = JSON.parse(current.raw);
          if (!codexTeacherProcess(owner)) throw invalid();
          if (!await sameCodexProcess(owner)) {
            const s = await lstat(file);
            if (s.ino !== current.ino || s.dev !== current.dev) throw invalid();
            await rm(file);
            continue;
          }
        }
        if (Date.now() >= deadline) throw Error('teacher:codex_journal_busy');
        await delay(25);
      }
    }
    try {
      await guard.writeFile(JSON.stringify(await codexProcessIdentity(process.pid)));
      await guard.sync();
      return await work();
    } finally { await guard.close(); await rm(file); }
  }
}
