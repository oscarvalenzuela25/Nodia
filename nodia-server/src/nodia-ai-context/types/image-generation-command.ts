import type { ContextHistoryItem } from '../use-case/build-nodia-ai-context.use-case.js';

/** Only the current owner's explicit command can enable native image tools. */
export function imageGenerationCommand(history: readonly ContextHistoryItem[], throughSeq: string): { prompt: string } | undefined {
  const current = history.find(item => item.seq === throughSeq && item.role === 'user');
  if (!current) return undefined;
  const text = current.parts.filter(part => part.kind === 'text').map(part => part.text ?? '').join('\n').trim();
  if (!/^\/imagen(?:\s|$)/u.test(text)) return undefined;
  const prompt = text.slice('/imagen'.length).trim();
  if (!prompt || Buffer.byteLength(prompt, 'utf8') > 8000 || current.parts.some(part => part.kind !== 'text'))
    throw new Error('nodia_ai:invalid_image_generation_request');
  return { prompt };
}
