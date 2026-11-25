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
    const cv = source();
    registry.register(teacher);
    registry.register(library, 'flashcard-library');
    registry.register(cv, 'cv');
    const signal = new AbortController().signal;
    expect(await registry.execute('worker', signal)).toBe(true);
    expect(teacher.execute).toHaveBeenCalledOnce();
    expect(library.execute).not.toHaveBeenCalled();
    expect(cv.execute).not.toHaveBeenCalled();
    expect(await registry.execute('worker', signal)).toBe(true);
    expect(library.execute).toHaveBeenCalledWith('worker', signal);
    expect(await registry.execute('worker', signal)).toBe(true);
    expect(cv.execute).toHaveBeenCalledWith('worker', signal);
    teacher.execute.mockResolvedValueOnce(false);
    expect(await registry.execute('worker', signal)).toBe(true);
    expect(teacher.execute).toHaveBeenCalledTimes(2);
    expect(library.execute).toHaveBeenCalledTimes(2);
    expect(cv.execute).toHaveBeenCalledOnce();
    expect(() => registry.register(source(), 'flashcard-library')).toThrow(
      'generation_worker_source_duplicate',
    );
  });

  it('recovers the other domains when one fails and surfaces the failure', async () => {
    const registry = new GenerationWorkerSourceRegistry();
    const teacher = source();
    const library = source();
    const cv = source();
    registry.register(teacher);
    registry.register(library, 'flashcard-library');
    registry.register(cv, 'cv');
    teacher.recover.mockRejectedValueOnce(new Error('teacher recovery failed'));
    await expect(registry.recover()).rejects.toThrow('teacher recovery failed');
    expect(library.recover).toHaveBeenCalledOnce();
    expect(cv.recover).toHaveBeenCalledOnce();
  });
});
