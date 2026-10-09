import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisObservationsUseCase } from './analysis-observations.use-case.js';
const context = { business_id: '9601aa95-dd70-4af3-a5cf-50dd553a4ae9', ai_provider_id: '42', mode: 'api_key', model: 'synthetic' };
describe('analysis observation lifecycle', () => {
  afterEach(() => vi.useRealTimers());
  it('isolates actors and simultaneous runs and claims once', () => {
    const useCase = new AnalysisObservationsUseCase();
    const a = useCase.reserve('actor', context).id;
    const b = useCase.reserve('actor', context).id;
    expect(() => useCase.claim('other', a)).toThrow('Observación no disponible');
    const progress = useCase.claim('actor', a);
    expect(() => useCase.claim('actor', a)).toThrow('ya fue utilizada');
    expect(() => useCase.read('other', a, 0)).toThrow('Observación no disponible');
    progress.validateContext(context);
    expect(() => progress.validateContext({ ...context, mode: 'token_plan_web' })).toThrow('contexto reservado');
    progress.emit('model_checked');
    expect(useCase.read('actor', b, 0).events.map(event => event.stage)).toEqual(['reserved']);
    useCase.finish('actor', a, 'succeeded');
    progress.emit('failed');
    expect(useCase.read('actor', a, 2)).toMatchObject({ state: 'succeeded', events: [{ sequence: 3 }, { sequence: 4, stage: 'extraction_validated' }] });
  });
  it('bounds events, reports eviction gaps and rejects invalid cursors', () => {
    const useCase = new AnalysisObservationsUseCase();
    const id = useCase.reserve('actor', context).id;
    const progress = useCase.claim('actor', id);
    for (let i = 0; i < 1000; i++) progress.emit(i % 2 ? 'response_receiving' : 'turn_started');
    const snapshot = useCase.read('actor', id, 0);
    expect(snapshot.events).toHaveLength(256);
    expect(snapshot.gap).toBe(true);
    expect(snapshot.lastSequence).toBe(1002);
    expect(() => useCase.read('actor', id, Number.NaN)).toThrow('Cursor inválido');
    expect(() => useCase.read('actor', id, 1003)).toThrow('Cursor inválido');
    expect(JSON.stringify(snapshot).length).toBeLessThan(128 * 1024);
  });
  it('expires reservations and terminal data and enforces actor/global bounds', () => {
    vi.useFakeTimers();
    const useCase = new AnalysisObservationsUseCase();
    const reserved = useCase.reserve('actor', context).id;
    vi.advanceTimersByTime(120001);
    expect(() => useCase.claim('actor', reserved)).toThrow('Observación no disponible');
    const id = useCase.reserve('actor', context).id;
    useCase.claim('actor', id);
    useCase.finish('actor', id, 'failed');
    vi.advanceTimersByTime(300001);
    expect(() => useCase.read('actor', id, 0)).toThrow('Observación no disponible');
    for (let i = 0; i < 10; i++) useCase.reserve('actor', context);
    expect(() => useCase.reserve('actor', context)).toThrow('Límite de observaciones');
    for (let i = 0; i < 990; i++) useCase.reserve(`actor-${i}`, context);
    expect(() => useCase.reserve('new-actor', context)).toThrow('Límite de observaciones');
  });
  it('only stores safe labels, never arbitrary context/document data', () => {
    const useCase = new AnalysisObservationsUseCase();
    const id = useCase.reserve('actor', { ...context, secret: 'PRIVATE' } as typeof context).id;
    const progress = useCase.claim('actor', id);
    progress.resolve({ providerId: '42', provider: 'openai', mode: 'api_key', model: 'synthetic', prompt: 'PRIVATE' } as Parameters<typeof progress.resolve>[0]);
    expect(JSON.stringify(useCase.read('actor', id, 0))).not.toContain('PRIVATE');
  });
});
