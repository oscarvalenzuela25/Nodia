import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { API_EXECUTOR_OWNER, isApiExecutorProvenClosed, linuxProcessBirth } from './api-nodia-ai-runtime-owner.js';

describe('API HTTP executor ownership and closure', () => {
  it('does not mistake a live executor for a completed remote request', () => {
    expect(isApiExecutorProvenClosed({ ...API_EXECUTOR_OWNER })).toBe(false);
  });
  it('fails closed for another host, even when its PID matches this worker', () => {
    expect(isApiExecutorProvenClosed({ ...API_EXECUTOR_OWNER, machine: '0'.repeat(64), instance: randomUUID() })).toBe(false);
  });
  it('does not confuse another module instance in the same physical process with a dead executor', () => {
    expect(isApiExecutorProvenClosed({ ...API_EXECUTOR_OWNER, instance: randomUUID() })).toBe(false);
  });
  it.skipIf(process.platform !== 'linux')('recognizes a reused PID only with a different kernel process birth', () => {
    expect(isApiExecutorProvenClosed({ ...API_EXECUTOR_OWNER, birth: '0', instance: randomUUID() })).toBe(true);
  });
  it('does not use a different stored birth as proof that the current exact instance has closed', () => {
    expect(isApiExecutorProvenClosed({ ...API_EXECUTOR_OWNER, birth: 'invalid' })).toBe(false);
  });
  it('parses the kernel start ticks after a command name containing spaces and parentheses', () => {
    const fields = ['S', ...Array.from({ length: 18 }, (_, i) => String(i)), '123456789', '99'];
    expect(linuxProcessBirth(`40 (worker (with) spaces) ${fields.join(' ')}`)).toBe('123456789');
  });
  it.each(['', '1 broken', '1 (worker) S', `1 (worker) ${Array(20).fill('invalid').join(' ')}`])('refuses unverifiable process metadata %j', raw => {
    expect(linuxProcessBirth(raw)).toBeNull();
  });
});
