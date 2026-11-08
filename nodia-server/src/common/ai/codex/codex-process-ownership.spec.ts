import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertCodexGroupEmpty,
  stopCodexGroup,
  type CodexProcessIdentity,
} from './codex-process-ownership.js';

const io = vi.hoisted(() => ({
  readFile: vi.fn<(...args: unknown[]) => Promise<string>>(),
  readdir: vi.fn<() => Promise<string[]>>(),
  delay: vi.fn<() => Promise<void>>(),
}));
vi.mock('node:fs/promises', () => ({ readFile: io.readFile, readdir: io.readdir }));
vi.mock('node:timers/promises', () => ({ setTimeout: io.delay }));

const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const leader = process.pid + 1000;
const vanished = leader + 1;
const child = leader + 2;
const identity: CodexProcessIdentity = {
  pid: leader, group: leader, birth: '12345', boot: 'synthetic-boot',
};
function errno(code: string) {
  return Object.assign(new Error('Synthetic procfs read failure'), { code });
}
function stat(pid: number, group: number, birth = '12345') {
  const fields = Array<string>(20).fill('0');
  fields[0] = 'S';
  fields[2] = String(group);
  fields[19] = birth;
  return `${pid} (synthetic worker) ${fields.join(' ')}`;
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
  io.delay.mockImplementation(async () => { throw Error('Unexpected wait'); });
});
afterEach(() => {
  Object.defineProperty(process, 'platform', platform);
  vi.restoreAllMocks();
});

describe('Codex process-group ownership', () => {
  it.each(['ENOENT', 'ESRCH'])('continues the full scan after %s from a vanished PID and still rejects a live owned child', async code => {
    io.readdir.mockResolvedValue([String(vanished), String(child)]);
    io.readFile.mockImplementation(async path => {
      if (path === `/proc/${vanished}/stat`) throw errno(code);
      if (path === `/proc/${child}/stat`) return stat(child, leader);
      throw Error('Unexpected procfs path');
    });
    await expect(assertCodexGroupEmpty(leader)).rejects.toMatchObject({ code: 'codex_login_unknown' });
    expect(io.readFile).toHaveBeenCalledWith(`/proc/${child}/stat`, 'utf8');
  });

  it('closes the owned group despite an unrelated ESRCH and waits for a child after its leader disappears', async () => {
    let leaderAlive = true;
    let childAlive = true;
    io.readdir.mockResolvedValue([String(vanished), String(leader), String(child)]);
    io.readFile.mockImplementation(async path => {
      if (path === '/proc/sys/kernel/random/boot_id') return identity.boot;
      if (path === `/proc/${vanished}/stat`) throw errno('ESRCH');
      if (path === `/proc/${leader}/stat`) {
        if (!leaderAlive) throw errno('ESRCH');
        return stat(leader, leader);
      }
      if (path === `/proc/${child}/stat`) {
        if (!childAlive) throw errno('ESRCH');
        return stat(child, leader);
      }
      throw Error('Unexpected procfs path');
    });
    const signal = vi.spyOn(process, 'kill').mockImplementation(() => {
      leaderAlive = false;
      return true;
    });
    io.delay.mockImplementation(async () => {
      expect(childAlive).toBe(true);
      childAlive = false;
    });
    await expect(stopCodexGroup(identity)).resolves.toBeUndefined();
    expect(signal).toHaveBeenCalledExactlyOnceWith(-leader, 'SIGTERM');
    expect(io.delay).toHaveBeenCalledTimes(1);
    expect(io.readFile.mock.calls.filter(([path]) => path === `/proc/${child}/stat`)).toHaveLength(3);
  });

  it('does not certify an empty group when an unreadable PID prevents the scan', async () => {
    const denied = errno('EACCES');
    io.readdir.mockResolvedValue([String(vanished), String(child)]);
    io.readFile.mockRejectedValue(denied);
    await expect(assertCodexGroupEmpty(leader)).rejects.toBe(denied);
  });

  it('rejects malformed process identity data instead of certifying closure', async () => {
    io.readdir.mockResolvedValue([String(child)]);
    io.readFile.mockResolvedValue('invalid synthetic procfs record');
    await expect(assertCodexGroupEmpty(leader)).rejects.toMatchObject({ code: 'codex_login_unknown' });
  });

  it('never signals a process group whose leader start ticks no longer match', async () => {
    io.readdir.mockResolvedValue([String(leader)]);
    io.readFile.mockImplementation(async path => path === '/proc/sys/kernel/random/boot_id'
      ? identity.boot : stat(leader, leader, '98765'));
    const signal = vi.spyOn(process, 'kill').mockReturnValue(true);
    await expect(stopCodexGroup(identity)).rejects.toMatchObject({ code: 'codex_login_unknown' });
    expect(signal).not.toHaveBeenCalled();
  });
});
