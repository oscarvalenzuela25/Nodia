import { describe, expect, it } from 'vitest';
import type { EntityManager } from 'typeorm';
import type {
  TeacherGenerationJob,
  TeacherSessionRow,
} from '../types/teacher.types.js';
import { canonical } from '../policies/teacher-validation.js';
import {
  enrichmentGenerationContext,
  publishEnrichmentReply,
  validateEnrichmentCitations,
} from './teacher-enrichment-persistence.js';

const sourceId = '10000000-0000-4000-8000-000000000001';
const citation = {
  source_id: sourceId,
  content_hash: 'a'.repeat(64),
  page: 1,
  quote: 'visible phrase',
};
const admitted = {
  sources: [
    {
      source_id: sourceId,
      content_hash: 'a'.repeat(64),
      pages: [{ page: 1, text: 'visible phrase', excerpt: true }],
    },
  ],
};
describe('Teacher enrichment generation boundaries', () => {
  it('retains the observation instant as ISO text in the canonical generation snapshot', async () => {
    const observed = new Date('2026-11-11T18:24:31.123Z');
    const manager = {
      query: async (sql: string) =>
        sql.includes('SELECT DISTINCT ON')
          ? [
              {
                evidence_id: sourceId,
                observed_at: observed,
                answer_state: 'graded',
                assisted: true,
              },
            ]
          : [],
    } as unknown as EntityManager;
    const session = {
      id: sourceId,
      owner_user_id: '1',
      topic: 'SQL',
      objective: 'Joins',
      current_plan_revision_id: sourceId,
    } as TeacherSessionRow;
    const snapshot = await enrichmentGenerationContext(manager, session);
    const persisted = JSON.parse(canonical(snapshot)) as {
      mapped_evidence: { observed_at: unknown }[];
    };
    expect(persisted.mapped_evidence[0].observed_at).toBe(
      '2026-11-11T18:24:31.123Z',
    );
  });
  it('requires both admitted text and the immutable database source', async () => {
    const manager = {
      query: async () => [
        {
          id: sourceId,
          data: {
            content_hash: citation.content_hash,
            pages: [{ page: 1, text: 'visible phrase plus excluded tail' }],
          },
        },
      ],
    } as unknown as EntityManager;
    expect(
      await validateEnrichmentCitations(
        manager,
        sourceId,
        [citation],
        admitted,
      ),
    ).toEqual([citation]);
    await expect(
      validateEnrichmentCitations(
        manager,
        sourceId,
        [{ ...citation, quote: 'excluded tail' }],
        admitted,
      ),
    ).rejects.toThrow();
    const replaced = {
      query: async () => [
        {
          id: sourceId,
          data: {
            content_hash: 'b'.repeat(64),
            pages: [{ page: 1, text: 'visible phrase' }],
          },
        },
      ],
    } as unknown as EntityManager;
    await expect(
      validateEnrichmentCitations(replaced, sourceId, [citation], admitted),
    ).rejects.toThrow();
  });
  it('keeps the passage-only helper protocol from accepting external citation metadata', async () => {
    const manager = {
      query: async () => {
        throw new Error('no writes expected');
      },
    } as unknown as EntityManager;
    await expect(
      publishEnrichmentReply(
        manager,
        { session_id: sourceId } as TeacherGenerationJob,
        JSON.stringify({
          schema_version: 1,
          text: 'Explanation',
          citations: [citation],
        }),
      ),
    ).rejects.toThrow('teacher:invalid_input');
  });
});
