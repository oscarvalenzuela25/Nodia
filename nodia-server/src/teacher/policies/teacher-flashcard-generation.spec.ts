import { describe, expect, it } from 'vitest';
import {
  readFlashcardGenerationRequest,
  readFlashcardTextProposal,
} from './teacher-flashcard-generation.js';

const request_key = '0f7bde12-c74b-4b34-8d95-feca49116df5';
const source = {
  session_id: 'a14e3d23-672d-4baa-93d9-0d7f13a08136',
  content_version_id: '925ee154-a344-4227-9e3f-aedd8fcb1a5b',
  block_id: 'example',
  selection: '  exact quote  ',
};
const selection = {
  connection_id: '17',
  mode: 'api_key',
  model_id: 'synthetic-fixture',
  effort_id: null,
};

describe('flashcard text generation boundary', () => {
  it('binds a literal quote and explicit selection or an exact card revision', () => {
    expect(
      readFlashcardGenerationRequest({ request_key, source, selection }),
    ).toEqual({
      key: request_key,
      source,
      selection,
    });
    expect(
      readFlashcardGenerationRequest({
        request_key,
        card_id: request_key,
        revision: 3,
        parts: 'text',
        selection,
      }),
    ).toEqual({
      key: request_key,
      card: { card_id: request_key, revision: 3 },
      selection,
    });
  });

  it('rejects mixed targets, missing selection, image requests and whitespace quotes', () => {
    for (const value of [
      { request_key, source, card_id: request_key, selection },
      { request_key, source },
      {
        request_key,
        card_id: request_key,
        revision: 3,
        parts: 'both',
        selection,
      },
      { request_key, source: { ...source, selection: '   ' }, selection },
    ]) {
      expect(() => readFlashcardGenerationRequest(value)).toThrow();
    }
  });

  it('projects only a bounded proposal and rejects extra fields or missing text', () => {
    expect(
      readFlashcardTextProposal(
        '{"schema_version":1,"question":" Q? ","answer":" A. "}',
      ),
    ).toEqual({
      question: 'Q?',
      answer: 'A.',
    });
    for (const value of [
      { schema_version: 1, question: 'Q?', answer: 'A.', image: 'asset' },
      { schema_version: 1, question: '', answer: 'A.' },
      { schema_version: 1, question: 'Q?', answer: 'a'.repeat(2001) },
      { schema_version: 2, question: 'Q?', answer: 'A.' },
    ]) {
      expect(() => readFlashcardTextProposal(JSON.stringify(value))).toThrow();
    }
  });
});
