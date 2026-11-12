import { describe, expect, it } from 'vitest';
import { admittedEnrichmentCitations } from './teacher-enrichment-citations.js';
const sourceId = '10000000-0000-4000-8000-000000000001';
const citation = {
  source_id: sourceId,
  content_hash: 'a'.repeat(64),
  page: 1,
  quote: 'visible phrase',
};
const context = {
  sources: [
    {
      source_id: sourceId,
      content_hash: 'a'.repeat(64),
      pages: [
        {
          page: 1,
          text: 'A visible phrase in the admitted excerpt.',
          excerpt: true,
        },
      ],
    },
  ],
};
describe('Teacher citations against admitted evidence', () => {
  it('accepts an exact quotation on the page and hash actually sent to the model', () => {
    expect(admittedEnrichmentCitations([citation], context)).toEqual([
      citation,
    ]);
  });
  it('rejects an existing-source quotation outside the admitted excerpt or page', () => {
    expect(() =>
      admittedEnrichmentCitations(
        [{ ...citation, quote: 'excluded tail of the source' }],
        context,
      ),
    ).toThrow();
    expect(() =>
      admittedEnrichmentCitations([{ ...citation, page: 2 }], context),
    ).toThrow();
  });
  it('rejects a source removed by the budget and a different revision hash', () => {
    expect(() =>
      admittedEnrichmentCitations([citation], { sources: [] }),
    ).toThrow();
    expect(() => admittedEnrichmentCitations([citation], undefined)).toThrow();
    expect(() =>
      admittedEnrichmentCitations(
        [{ ...citation, content_hash: 'b'.repeat(64) }],
        context,
      ),
    ).toThrow();
    expect(admittedEnrichmentCitations([], undefined)).toEqual([]);
  });
});
