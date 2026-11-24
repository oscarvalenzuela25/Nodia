import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { protectNodiaCvDelete } from './nodia-cv-protected-delete.js';

function fixture() {
  const intent = {
    now: new Date('2026-11-24T10:00:00.000Z'),
    resource: { kind: 'cv_version' as const, version_id: randomUUID() },
  };
  const phases: string[] = [];
  const prepare = vi.fn(async () => { phases.push('preflight'); return intent; });
  const commit = vi.fn(async () => { phases.push('commit'); });
  const journal = {
    enabled: true,
    recordDeletions: vi.fn(),
    recordResources: vi.fn(async () => { phases.push('record'); }),
    assertResourcesRecorded: vi.fn(async () => { phases.push('observe'); }),
    confirmResources: vi.fn(async () => { phases.push('confirm'); }),
  };
  return { intent, phases, prepare, commit, journal, run: () => protectNodiaCvDelete(journal, prepare, commit) };
}

describe('Nodia CV protected deletion', () => {
  it('uses the existing local-only transaction when the optional journal is disabled', async () => {
    const f = fixture();
    f.journal.enabled = false;
    await f.run();
    expect(f.phases).toEqual(['commit']);
  });

  it('publishes only the preflight UUID and confirms it after commit', async () => {
    const f = fixture();
    await f.run();
    expect(f.phases).toEqual(['preflight', 'record', 'observe', 'commit', 'confirm']);
    expect(f.journal.recordResources).toHaveBeenCalledWith({
      resources: [f.intent.resource], deleted_at: f.intent.now.toISOString(),
    });
    expect(f.journal.confirmResources).toHaveBeenCalledWith([f.intent.resource]);
  });

  it('creates no witness when authority or revision already failed preflight', async () => {
    const f = fixture();
    f.prepare.mockRejectedValue(Error('stale_profile'));
    await expect(f.run()).rejects.toThrow('stale_profile');
    expect(f.journal.recordResources).not.toHaveBeenCalled();
    expect(f.commit).not.toHaveBeenCalled();
  });

  it('fails closed with sanitized feedback when the external witness cannot be observed', async () => {
    const f = fixture();
    f.journal.assertResourcesRecorded.mockRejectedValue(Error('private upstream diagnosis'));
    await expect(f.run()).rejects.toMatchObject({ status: 503, message: 'nodiaCv:request_failed' });
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.journal.confirmResources).not.toHaveBeenCalled();
  });

  it('keeps a concurrent stale transaction pending instead of claiming a deletion', async () => {
    const f = fixture();
    f.commit.mockRejectedValue(Error('stale_profile'));
    await expect(f.run()).rejects.toThrow('stale_profile');
    expect(f.journal.assertResourcesRecorded).toHaveBeenCalledWith([f.intent.resource]);
    expect(f.journal.confirmResources).not.toHaveBeenCalled();
  });

  it('returns committed success on lost journal confirmation without replaying SQL', async () => {
    const f = fixture();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    try {
      f.journal.confirmResources.mockRejectedValue(Error('private upstream diagnosis'));
      await expect(f.run()).resolves.toBeUndefined();
      expect(f.commit).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('nodia_ai:deletion_journal_confirmation_pending');
    } finally {
      warn.mockRestore();
    }
  });
});
