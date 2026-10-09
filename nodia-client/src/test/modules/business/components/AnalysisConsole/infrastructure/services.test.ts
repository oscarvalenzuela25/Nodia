import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainInstance } from '../../../../../../config/api';
import { readObservation, reserveObservation } from '../../../../../../modules/business/components/AnalysisConsole/infrastructure/services';
const id = '9601aa95-dd70-4af3-a5cf-50dd553a4ae9';
const snapshot = { version: 1, id, state: 'running', identity: null, events: [], lastSequence: 0, gap: false };
afterEach(() => vi.restoreAllMocks());
describe('analysis observation transport contract', () => {
  it('accepts unknown identity without manufacturing model or progress', async () => {
    vi.spyOn(mainInstance, 'get').mockResolvedValue({ data: snapshot });
    await expect(readObservation(id, 0, new AbortController().signal)).resolves.toEqual(snapshot);
  });
  it.each([{ ...snapshot, version: 2 }, { ...snapshot, id: crypto.randomUUID() }, { ...snapshot, state: 'thinking' },
    { ...snapshot, events: [{ version: 1, sequence: 1, stage: 'raw_stdout', severity: 'info', occurredAt: new Date().toISOString() }], lastSequence: 1 },
    { ...snapshot, events: [{ version: 1, sequence: 1, stage: 'file_validated', severity: 'info', occurredAt: 'invalid' }], lastSequence: 1 }])('rejects invalid snapshots %#', async data => {
    vi.spyOn(mainInstance, 'get').mockResolvedValue({ data });
    await expect(readObservation(id, 0, new AbortController().signal)).rejects.toThrow();
  });
  it('rejects regressing cursors and invalid reservations', async () => {
    vi.spyOn(mainInstance, 'get').mockResolvedValue({ data: snapshot });
    await expect(readObservation(id, 1, new AbortController().signal)).rejects.toThrow();
    vi.spyOn(mainInstance, 'post').mockResolvedValue({ data: { version: 1, id: 'not-uuid' } });
    await expect(reserveObservation({ business_id: id }, new AbortController().signal)).rejects.toThrow();
  });
});
