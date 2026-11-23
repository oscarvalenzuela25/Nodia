import { describe, expect, it } from 'vitest';
import {
  flashcardDeckTitle,
  readFlashcardImage,
  readFlashcardPatch,
  readFlashcardSource,
} from './teacher-flashcards.js';

// 3×2 transparent synthetic WebP with a VP8X header and alpha chunk.
const webp =
  'UklGRlYAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAkZGRkZGRAFZQOCAoAAAAkAEAnQEqAwACAAFAJiWIAnS6AAOYAP70vu/R9cIsjL/G+IL2pMAAAA==';

describe('private flashcard images', () => {
  it('accepts and preserves bounded still WebP bytes', () => {
    const image = readFlashcardImage({ data: webp, side: 'answer' });
    expect(image?.side).toBe('answer');
    expect(image?.bytes.toString('base64')).toBe(webp);
  });

  it('accepts the extended profile layout used by Chromium canvas and checks its framing', () => {
    const original = Buffer.from(webp, 'base64');
    const profileSize = 132;
    const profile = Buffer.alloc(8 + profileSize);
    profile.write('ICCP', 0, 'ascii');
    profile.writeUInt32LE(profileSize, 4);
    profile.writeUInt32BE(profileSize, 8);
    profile.write('acsp', 44, 'ascii');
    const bytes = Buffer.concat([
      original.subarray(0, 30),
      profile,
      original.subarray(30),
    ]);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes[20] |= 0x20;
    expect(
      readFlashcardImage({ data: bytes.toString('base64'), side: 'answer' })
        ?.bytes,
    ).toEqual(bytes);

    bytes[20] &= ~0x20;
    expect(() =>
      readFlashcardImage({ data: bytes.toString('base64'), side: 'answer' }),
    ).toThrow('flashcard_invalid_image');
    bytes[20] |= 0x20;
    bytes.writeUInt32BE(profileSize + 1, 38);
    expect(() =>
      readFlashcardImage({ data: bytes.toString('base64'), side: 'answer' }),
    ).toThrow('flashcard_invalid_image');
  });

  it('rejects damaged framing, forged canvas dimensions, and unsupported data shapes', () => {
    const bytes = Buffer.from(webp, 'base64');
    const wrongSize = Buffer.from(bytes);
    wrongSize.writeUInt32LE(bytes.length, 4);
    const wrongDimensions = Buffer.from(bytes);
    wrongDimensions.writeUIntLE(4096, 24, 3);
    const trailing = Buffer.concat([bytes, Buffer.from('appendix')]);
    for (const data of [
      wrongSize.toString('base64'),
      wrongDimensions.toString('base64'),
      trailing.toString('base64'),
      'data:image/webp;base64,' + webp,
      'iVBORw0KGgo=',
    ]) {
      expect(() => readFlashcardImage({ data, side: 'question' })).toThrow(
        'flashcard_invalid_image',
      );
    }
  });
});

describe('flashcard field policy', () => {
  it('normalizes owner-independent deck title and reserves General', () => {
    expect(flashcardDeckTitle(' Lengua   Ｅspañola ')).toEqual({
      title: 'Lengua Española',
      normalizedTitle: 'lengua española',
    });
    expect(() => flashcardDeckTitle(' GENERAL ')).toThrow(
      'flashcard_deck_duplicate',
    );
  });

  it('distinguishes explicit removal, face-only changes, and invalid combined image intent', () => {
    expect(
      readFlashcardPatch({
        revision: 1,
        image: null,
        source: null,
        deck_id: null,
      }),
    ).toEqual({ revision: 1, image: null, source: null, deckId: null });
    expect(readFlashcardPatch({ revision: 1, image_side: 'answer' })).toEqual({
      revision: 1,
      imageSide: 'answer',
    });
    expect(() =>
      readFlashcardPatch({ revision: 1, image: null, image_side: 'question' }),
    ).toThrow('invalid_input');
    expect(() => readFlashcardPatch({ revision: 1 })).toThrow('invalid_input');
  });

  it('retains an exact anchor and rejects blank quotations', () => {
    const anchor = {
      session_id: '71fb7529-575a-431e-a47c-eb46f417083c',
      content_version_id: 'e67a4ade-43b0-47b9-8e18-d3d42e535755',
      block_id: 'block',
      selection: ' exact text ',
    };
    expect(readFlashcardSource({ label: 'Lección', anchor })).toEqual({
      label: 'Lección',
      anchor,
    });
    expect(() =>
      readFlashcardSource({
        label: 'Lección',
        anchor: { ...anchor, selection: ' ' },
      }),
    ).toThrow('invalid_anchor');
  });
});
