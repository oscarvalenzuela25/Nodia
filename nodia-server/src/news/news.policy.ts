import { Parser } from 'htmlparser2';

/** Plain text only. HTML is parsed, never returned for rendering. */
export function newsPlainText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  let text = '';
  let excluded = 0;
  const blocked = new Set(['script', 'style', 'iframe', 'object', 'template']);
  const parser = new Parser(
    {
      onopentag(name) {
        if (blocked.has(name)) excluded++;
        else if (!excluded) text += ' ';
      },
      onclosetag(name) {
        if (blocked.has(name)) excluded = Math.max(0, excluded - 1);
        else if (!excluded) text += ' ';
      },
      ontext(value) {
        if (!excluded) text += value;
      },
    },
    { decodeEntities: true },
  );
  parser.end(value.slice(0, 16_384));
  const normalized = text.replace(/\s+/gu, ' ').trim();
  return normalized ? normalized.slice(0, max) : null;
}

/** Keep unknown query parameters: they can identify a different article. */
export function safeNewsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function newsRetryAt(value: string | undefined, now: Date): Date | null {
  if (!value || value.length > 100) return null;
  const milliseconds = /^\d+$/u.test(value)
    ? now.getTime() + Number(value) * 1000
    : Date.parse(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= now.getTime())
    return null;
  return new Date(Math.min(milliseconds, 253402300799000));
}
