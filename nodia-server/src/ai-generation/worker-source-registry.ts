import { Injectable } from '@nestjs/common';
export interface GenerationWorkerSource {
  execute(workerId: string, signal: AbortSignal): Promise<boolean>;
  recover(): Promise<void>;
}
/** One worker lifecycle, one canonical capacity store; domains register work, not locks. */
@Injectable()
export class GenerationWorkerSourceRegistry {
  private readonly sources = new Map<
    'teacher' | 'flashcard-library',
    GenerationWorkerSource
  >();
  private next = 0;

  register(
    source: GenerationWorkerSource,
    domain: 'teacher' | 'flashcard-library' = 'teacher',
  ): void {
    const current = this.sources.get(domain);
    if (current && current !== source)
      throw Error('generation_worker_source_duplicate');
    this.sources.set(domain, source);
  }

  async execute(workerId: string, signal: AbortSignal): Promise<boolean> {
    const sources = [...this.sources.values()];
    if (sources.length === 0) return false;
    const start = this.next;
    this.next = (this.next + 1) % sources.length;
    for (let offset = 0; offset < sources.length && !signal.aborted; offset++) {
      if (
        await sources[(start + offset) % sources.length].execute(
          workerId,
          signal,
        )
      )
        return true;
    }
    return false;
  }

  async recover(): Promise<void> {
    let failure: unknown;
    for (const source of this.sources.values()) {
      try {
        await source.recover();
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  }
}
