import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';

export interface ApiExecutorOwner {
  machine: string;
  boot: string;
  pid: number;
  birth: string;
  instance: string;
}

/** Linux field22, parsed after the final ')' because comm may itself contain spaces or parentheses. */
export function linuxProcessBirth(stat: string): string | null {
  const end = stat.lastIndexOf(')');
  if (end < 1) return null;
  const value = stat.slice(end + 1).trim().split(/\s+/)[19];
  return value && /^\d+$/.test(value) ? value : null;
}

const boot = process.platform === 'linux'
  ? readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()
  : 'non-linux';
const machineSource = process.platform === 'linux'
  ? readFileSync('/etc/machine-id', 'utf8').trim() + ':' + hostname()
  : hostname();
export const API_EXECUTOR_OWNER: Readonly<ApiExecutorOwner> = Object.freeze({
  machine: createHash('sha256').update(machineSource).digest('hex'),
  boot,
  pid: process.pid,
  birth: process.platform === 'linux'
    ? linuxProcessBirth(readFileSync('/proc/self/stat', 'utf8')) ?? 'unverifiable'
    : String(Date.now() - Math.floor(process.uptime() * 1000)),
  instance: randomUUID(),
});

/** Prove local ownership has ended; a deadline or expired lease alone is never sufficient. */
export function isApiExecutorProvenClosed(owner: ApiExecutorOwner): boolean {
  const current = API_EXECUTOR_OWNER;
  if (!/^[a-f0-9]{64}$/.test(owner.machine) || !Number.isSafeInteger(owner.pid) || owner.pid < 1) return false;
  if (owner.machine !== current.machine) return false;
  if (process.platform === 'linux') {
    if (!/^[a-f0-9-]{36}$/.test(owner.boot) || !/^\d+$/.test(owner.birth)) return false;
    if (owner.boot !== current.boot) return true;
  }
  if (owner.pid === current.pid)
    return process.platform === 'linux' && current.birth !== 'unverifiable' && owner.birth !== current.birth;
  if (process.platform === 'linux') {
    try {
      const birth = linuxProcessBirth(readFileSync(`/proc/${owner.pid}/stat`, 'utf8'));
      return birth !== null && birth !== owner.birth;
    } catch (error: unknown) {
      return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
    }
  }
  try { process.kill(owner.pid, 0); return false; }
  catch (error: unknown) {
    return !!error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH';
  }
}
