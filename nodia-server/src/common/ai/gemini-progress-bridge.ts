import { setTimeout as delay } from 'node:timers/promises';
import { analysisStages, type AnalysisProgress, type AnalysisStage } from './analysis-progress.js';

/** Private observer failure never changes or replays the principal inference. */
export function observeGeminiProgress(baseUrl: string, headers: Record<string, string>, id: string, progress: AnalysisProgress) {
  const cancellation = new AbortController();
  let after = 0;
  let failures = 0;
  let warned = false;
  const warn = () => { if (!warned) { warned = true; progress.emit('observation_unavailable'); } };
  const read = async (signal: AbortSignal) => {
    const response = await fetch(`${baseUrl}/analysis-observations/${id}?after=${after}`, {
      headers, signal,
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Progress unavailable'); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Invalid progress');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if ((size += chunk.value.length) > 128 * 1024) throw new Error('Invalid progress');
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || !('version' in body) || body.version !== 1 || !('id' in body) || body.id !== id ||
      !('events' in body) || !Array.isArray(body.events) || body.events.length > 256) throw new Error('Invalid progress');
    for (const event of body.events) {
      if (!event || typeof event !== 'object' || !Number.isSafeInteger(event.sequence) || event.sequence <= after ||
        !analysisStages.includes(event.stage)) throw new Error('Invalid progress');
      after = event.sequence;
      progress.emit(event.stage as AnalysisStage);
    }
    if ('gap' in body && body.gap === true) progress.reportGap?.();
    failures = 0;
  };
  const task = (async () => {
    while (!cancellation.signal.aborted) {
      try {
        await delay(Math.min(2000 * 2 ** failures, 16000), undefined, { signal: cancellation.signal });
        await read(AbortSignal.any([cancellation.signal, AbortSignal.timeout(4000)]));
      } catch {
        if (!cancellation.signal.aborted && ++failures >= 3) warn();
      }
    }
  })();
  return async (finalSnapshot = true) => {
    // One final snapshot catches short executions; never wait for a retry episode.
    cancellation.abort();
    await task;
    if (finalSnapshot) try { await read(AbortSignal.timeout(4000)); } catch { warn(); }
  };
}
