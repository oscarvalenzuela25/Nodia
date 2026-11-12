import {
  object,
  requireUuid,
  teacherError,
  text,
} from './teacher-validation.js';

export interface EnrichmentCitation {
  source_id: string;
  content_hash: string;
  page: number;
  quote: string;
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
/** A source existing in storage does not establish that the model received it. */
export function admittedEnrichmentCitations(
  value: unknown,
  admittedContext: unknown,
): EnrichmentCitation[] {
  if (!Array.isArray(value) || value.length > 16)
    teacherError('invalid_generated_content', 422);
  const sources = record(admittedContext)?.sources;
  return value.map((raw) => {
    const v = object(raw, ['source_id', 'content_hash', 'page', 'quote']);
    if (
      typeof v.page !== 'number' ||
      !Number.isInteger(v.page) ||
      v.page < 1 ||
      v.page > 12
    )
      teacherError('invalid_generated_content', 422);
    const citation = {
      source_id: requireUuid(v.source_id),
      content_hash: text(v.content_hash, 64, 64),
      page: v.page,
      quote: text(v.quote, 1, 1000, false),
    };
    if (!/^[a-f0-9]{64}$/.test(citation.content_hash))
      teacherError('invalid_generated_content', 422);
    const source = Array.isArray(sources)
      ? sources
          .map(record)
          .find(
            (s) =>
              s?.source_id === citation.source_id &&
              s.content_hash === citation.content_hash,
          )
      : null;
    const page =
      source && Array.isArray(source.pages)
        ? source.pages.map(record).find((p) => p?.page === citation.page)
        : null;
    if (
      !page ||
      typeof page.text !== 'string' ||
      !page.text.includes(citation.quote)
    )
      teacherError('invalid_generated_content', 422);
    return citation;
  });
}
