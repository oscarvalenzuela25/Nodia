import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { codexError } from './codex-contract.js';

export type CodexProcessIdentity = {
  pid: number;
  group: number;
  birth: string;
  boot: string;
};
async function stat(pid: number) {
  const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
  const end = raw.lastIndexOf(')');
  const fields = raw
    .slice(end + 2)
    .trim()
    .split(/\s+/);
  if (end < 1 || fields.length < 20 || !/^\d+$/.test(fields[19]))
    throw codexError('codex_login_unknown', 409);
  return { group: Number(fields[2]), birth: fields[19], state: fields[0] };
}
export async function codexProcessIdentity(
  pid: number,
): Promise<CodexProcessIdentity> {
  if (process.platform !== 'linux' || !Number.isSafeInteger(pid) || pid < 2)
    throw codexError('codex_runtime_unavailable');
  const [value, boot] = await Promise.all([
    stat(pid),
    readFile('/proc/sys/kernel/random/boot_id', 'utf8'),
  ]);
  return { pid, group: value.group, birth: value.birth, boot: boot.trim() };
}
export async function sameCodexProcess(
  value: CodexProcessIdentity,
): Promise<boolean> {
  try {
    const current = await codexProcessIdentity(value.pid);
    return (
      current.birth === value.birth &&
      current.boot === value.boot &&
      current.group === value.group
    );
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
function isMissing(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
async function members(group: number) {
  const entries = await readdir('/proc');
  if (entries.length > 65536) throw codexError('codex_login_unknown', 409);
  const result: number[] = [],
    deadline = Date.now() + 1500;
  for (const name of entries) {
    if (Date.now() > deadline) throw codexError('codex_login_unknown', 409);
    if (!/^\d+$/.test(name)) continue;
    try {
      const value = await stat(Number(name));
      if (value.group === group && !['Z', 'X'].includes(value.state))
        result.push(Number(name));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return result;
}
export async function assertCodexGroupEmpty(group: number) {
  if ((await members(group)).length)
    throw codexError('codex_login_unknown', 409);
}
/** A missing parent is never proof of closure: descendants share the owned PGID. */
export async function stopCodexGroup(
  identity: CodexProcessIdentity,
  terminate = true,
): Promise<void> {
  const boot = (
    await readFile('/proc/sys/kernel/random/boot_id', 'utf8')
  ).trim();
  if (boot !== identity.boot) return; // All processes of that boot are gone.
  let alive = await members(identity.group);
  if (!alive.length) return;
  if (identity.group !== identity.pid || identity.group === process.pid)
    throw codexError('codex_login_unknown', 409);
  // A reused leader is a different process group. Never signal it.
  try {
    const current = await codexProcessIdentity(identity.pid);
    if (current.birth !== identity.birth || current.group !== identity.group)
      throw codexError('codex_login_unknown', 409);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  if (!terminate) throw codexError('codex_login_unknown', 409);
  for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
    try {
      process.kill(-identity.group, signal);
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ESRCH'
      ))
        throw error;
    }
    const deadline = Date.now() + (signal === 'SIGTERM' ? 2000 : 1500);
    do {
      alive = await members(identity.group);
      if (!alive.length) return;
      await delay(50);
    } while (Date.now() < deadline);
  }
  throw codexError('codex_login_unknown', 409);
}
