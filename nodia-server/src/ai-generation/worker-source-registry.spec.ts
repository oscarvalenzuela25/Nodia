import { describe, expect, it, vi } from 'vitest';
import { GenerationWorkerSourceRegistry } from './worker-source-registry.js';

function source() {
  return {
    execute: vi.fn(async (_workerId: string, _signal: AbortSignal) => true),
    recover: vi.fn(async () => {}),
  };
}

describe('generation worker source boundary', () => {
  it('rotates successful claims across domains and tries the other after an empty queue', async () => {
    const registry = new GenerationWorkerSourceRegistry();
    const teacher = source();
    const library = source();
    registry.register(teacher);
    registry.register(library, 'flashcard-library');
    const signal = new AbortController().signal;
    expect(await registry.execute('worker', signal)).toBe(true);
    expect(teacher.execute).toHaveBeenCalledOnce();
    expect(library.execute).not.toHaveBeenCalled();
    expect(await registry.execute('worker', signal)).toBe(true);
    expect(library.execute).toHaveBeenCalledWith('worker', signal);
    teacher.execute.mockResolvedValueOnce(false);
    expect(await registry.execute('worker', signal)).toBe(true);
    expect(teacher.execute).toHaveBeenCalledTimes(2);
    expect(library.execute).toHaveBeenCalledTimes(2);
    expect(() => registry.register(source(), 'flashcard-library')).toThrow(
      'generation_worker_source_duplicate',
    );
  });

  it('recovers both domains when one fails and surfaces the failure', async () => {
    const registry = new GenerationWorkerSourceRegistry();
    const teacher = source();
    const library = source();
    registry.register(teacher);
    registry.register(library, 'flashcard-library');
    teacher.recover.mockRejectedValueOnce(new Error('teacher recovery failed'));
    await expect(registry.recover()).rejects.toThrow('teacher recovery failed');
    expect(library.recover).toHaveBeenCalledOnce();
  });
});
