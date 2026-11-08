import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { toolFixture } from '../../../test/fixtures/nodia-ai-tools.fixture.js';
import type { NodiaAiReportToolsUseCase } from './nodia-ai-report-tools.use-case.js';

afterEach(() => vi.restoreAllMocks());
function fixture() {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  const reports = {
    handles: (name: string) => name === 'nodia_reports_run',
    descriptors: () => [
      {
        name: 'nodia_reports_run',
        description: 'Synthetic report',
        inputSchema: { type: 'object', additionalProperties: false },
      },
    ],
    contractHash: () => 'a'.repeat(64),
    validateInput: vi.fn((_name, value) => value),
    assertGranted: vi.fn(),
    execute: vi.fn(async () => ({ synthetic_report: true })),
    verifyResult: vi.fn(async () => {}),
  };
  const f = toolFixture({
    reportTools: reports as unknown as NodiaAiReportToolsUseCase,
  });
  return {
    ...f,
    reports,
    call: {
      callId: 'report-synthetic',
      name: 'nodia_reports_run',
      arguments: {},
    },
  };
}
describe('NodiaAI technical report callback lifecycle', () => {
  it('persists one receipt/event and reauthorizes replay without rerunning aggregates', async () => {
    const f = fixture();
    expect(await f.subject.descriptors(f.claim, f.context)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'nodia_reports_run' }),
      ]),
    );
    await f.subject.execute(f.claim, f.context, f.call);
    await f.subject.execute(f.claim, f.context, f.call);
    expect(f.reports.execute).toHaveBeenCalledOnce();
    expect(f.reports.verifyResult).toHaveBeenCalledTimes(2);
    expect(f.receipts.get(f.call.callId)?.state).toBe('completed');
    expect(f.journal.events).toHaveLength(1);
    expect(f.spent()).toBe(2);
  });
  it('does not reexecute an uncertain read with the same adapter call id', async () => {
    const f = fixture();
    f.reports.execute.mockRejectedValueOnce(Error('synthetic:unavailable'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'synthetic:unavailable',
    );
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'request_conflict',
    );
    expect(f.reports.execute).toHaveBeenCalledOnce();
    expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
    expect(f.journal.events).toHaveLength(0);
  });
  it('rejects a new grant, changed contract or Web execution before reading sources', async () => {
    for (const mode of ['grant', 'hash', 'retired']) {
      const f = fixture();
      if (mode === 'grant') f.grant.allowed_operations = [];
      if (mode === 'hash')
        (f.run.context_manifest.tool_contracts as Record<string, string>)[
          f.call.name
        ] = 'b'.repeat(64);
      if (mode === 'retired') f.run.selection_snapshot.mode = 'token_plan_web' as never;
      await expect(
        f.subject.execute(f.claim, f.context, f.call),
      ).rejects.toThrow();
      expect(f.reports.execute).not.toHaveBeenCalled();
      expect(f.receipts.size).toBe(0);
    }
  });
  it('never publishes results when authority is revoked during composition', async () => {
    const f = fixture();
    f.reports.execute.mockImplementationOnce(async () => {
      f.grant.revoked_at = new Date();
      return { synthetic_report: true };
    });
    await expect(
      f.subject.execute(f.claim, f.context, f.call),
    ).rejects.toThrow();
    expect(f.receipts.get(f.call.callId)?.state).toBe('validated');
    expect(f.journal.events).toHaveLength(0);
  });
  it('does not publish a result rejected by the final per-source authority check', async () => {
    const f = fixture();
    f.reports.verifyResult.mockRejectedValueOnce(Error('synthetic:revoked'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'synthetic:revoked',
    );
    expect(f.journal.events).toHaveLength(0);
    expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
  });
});
