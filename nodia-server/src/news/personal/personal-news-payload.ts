import { PersonalNewsProviderError } from './personal-news.types.js';

export const TAG_SLUG = /^[\p{L}\p{N}_-]{1,64}$/u;
const MAX_ARTICLE_TAGS = 8;

export function invalidResponse(): PersonalNewsProviderError {
  return new PersonalNewsProviderError('news:provider_invalid_response');
}

export function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeArticleTags(
  candidates: readonly unknown[],
  apiKey: string,
): string[] {
  const tags = new Set<string>();
  const credential = apiKey.toLowerCase();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const tag = candidate.trim().toLowerCase();
    if (tag.length > 64 || !TAG_SLUG.test(tag) || tag.includes(credential))
      continue;
    tags.add(tag);
    if (tags.size === MAX_ARTICLE_TAGS) break;
  }
  return [...tags];
}

export function publication(value: unknown): string | null {
  if (typeof value !== 'string' || !value.includes('T')) return null;
  const date = Date.parse(value);
  return Number.isFinite(date) ? new Date(date).toISOString() : null;
}

export function credentialFreeUrl(value: string, apiKey: string): boolean {
  // Protect both the literal link and encoded values embedded in its path or query.
  try {
    let decoded = value;
    for (let depth = 0; depth < 3; depth++) {
      if (decoded.includes(apiKey)) return false;
      const next = decodeURIComponent(decoded);
      if (next === decoded) return true;
      decoded = next;
    }
  } catch {
    return false;
  }
  return false;
}

export async function jsonBody(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const length = Number(response.headers.get('content-length'));
  if (
    !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/iu.test(
      contentType,
    ) ||
    length > maxBytes ||
    !response.body
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw invalidResponse();
  }
  const reader = response.body.getReader();
  const buffers: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw invalidResponse();
      }
      buffers.push(chunk.value);
    }
    try {
      return JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Buffer.concat(buffers, size),
        ),
      );
    } catch {
      throw invalidResponse();
    }
  } finally {
    reader.releaseLock();
  }
}
