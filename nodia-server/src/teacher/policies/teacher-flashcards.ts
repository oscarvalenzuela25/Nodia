import { imageSize } from 'image-size';
import type {
  FlashcardCollectionTitle,
  FlashcardAnchor,
  FlashcardCreate,
  FlashcardDeckDefinition,
  FlashcardDeckPatch,
  FlashcardImage,
  FlashcardImageSide,
  FlashcardPatch,
  FlashcardSource,
} from '../types/teacher-flashcards.types.js';
import {
  object,
  requireUuid,
  teacherError,
  text,
} from './teacher-validation.js';

export const FLASHCARD_IMAGE_MAX_BYTES = 144 * 1024;
export const FLASHCARD_IMAGE_MAX_EDGE = 2048;
const maxBase64Length = 4 * Math.ceil(FLASHCARD_IMAGE_MAX_BYTES / 3);

export function flashcardDeckId(value: unknown): string | null {
  return value === 'general' ? null : requireUuid(value).toLowerCase();
}

function normalizeCollectionText(value: unknown, limit: number) {
  const result = text(value, 1, limit)
    .normalize('NFKC')
    .replace(/[\p{White_Space}\uFEFF]+/gu, ' ')
    .trim();
  return text(result, 1, limit);
}

export function flashcardCollectionTitle(
  value: unknown,
): FlashcardCollectionTitle {
  const title = normalizeCollectionText(value, 120);
  const normalizedTitle = title.toLocaleLowerCase('es').normalize('NFKC');
  text(normalizedTitle, 1, 160);
  return { title, normalizedTitle };
}

export function flashcardDeckTitle(value: unknown) {
  const definition = flashcardCollectionTitle(value);
  if (definition.normalizedTitle === 'general')
    teacherError('flashcard_deck_duplicate');
  return definition;
}

export function flashcardDeckDefinition(
  title: unknown,
  category: unknown,
): FlashcardDeckDefinition {
  return {
    ...flashcardDeckTitle(title),
    category:
      category === undefined ? null : normalizeCollectionText(category, 80),
  };
}

export function flashcardSetId(value: unknown) {
  return requireUuid(value).toLowerCase();
}

export function readFlashcardDeckPatch(input: unknown): FlashcardDeckPatch {
  const { title, category, set_id } = object(input, [
    'title',
    'category',
    'set_id',
  ]);
  if (title === undefined && category === undefined && set_id === undefined)
    teacherError('invalid_input', 400);
  return {
    ...(title !== undefined && flashcardDeckTitle(title)),
    ...(category !== undefined && {
      category:
        category === null ? null : normalizeCollectionText(category, 80),
    }),
    ...(set_id !== undefined && { setId: flashcardSetId(set_id) }),
  };
}

export function readFlashcardSource(value: unknown): FlashcardSource | null {
  if (value === null || value === undefined) return null;
  const input = object(value, ['label', 'anchor']);
  const label = text(input.label, 1, 200);
  return input.anchor === undefined
    ? { label }
    : { label, anchor: readFlashcardAnchor(input.anchor) };
}

export function readFlashcardAnchor(value: unknown): FlashcardAnchor {
  const anchor = object(value, [
    'session_id',
    'content_version_id',
    'block_id',
    'selection',
  ]);
  const selection = text(anchor.selection, 1, 2000, false);
  if (!selection.trim()) teacherError('invalid_anchor', 400);
  return {
    session_id: requireUuid(anchor.session_id).toLowerCase(),
    content_version_id: requireUuid(anchor.content_version_id).toLowerCase(),
    block_id: text(anchor.block_id, 1, 64),
    selection,
  };
}

function readImageSide(value: unknown): FlashcardImageSide {
  if (value !== 'question' && value !== 'answer')
    teacherError('invalid_input', 400);
  return value;
}

/** Allow one bounded still image with optional transparency and color profile. */
function isStillWebp(bytes: Buffer): boolean {
  if (
    bytes.length < 26 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.readUInt32LE(4) !== bytes.length - 8 ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  )
    return false;
  const alphaFlag = 0x10;
  const colorFlag = 0x20;
  let extended = false;
  let flags = 0;
  let colorChunk = false;
  let alphaChunk = false;
  let frame = false;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    if (frame) return false;
    const tag = bytes.toString('latin1', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    const next = payload + size + (size % 2);
    if (next > bytes.length || (size % 2 && bytes[next - 1] !== 0))
      return false;
    if (
      tag === 'VP8X' &&
      offset === 12 &&
      size === 10 &&
      (bytes[payload] & ~(alphaFlag | colorFlag)) === 0 &&
      bytes.readUIntLE(payload + 1, 3) === 0
    ) {
      extended = true;
      flags = bytes[payload];
    } else if (
      tag === 'ICCP' &&
      extended &&
      (flags & colorFlag) !== 0 &&
      offset === 30 &&
      size >= 132 &&
      bytes.readUInt32BE(payload) === size &&
      bytes.toString('ascii', payload + 36, payload + 40) === 'acsp'
    ) {
      colorChunk = true;
    } else if (
      tag === 'ALPH' &&
      extended &&
      !alphaChunk &&
      size > 1 &&
      (flags & alphaFlag) !== 0
    ) {
      alphaChunk = true;
    } else if (
      tag === 'VP8 ' &&
      size > 10 &&
      !(bytes[payload] & 1) &&
      bytes
        .subarray(payload + 3, payload + 6)
        .equals(Buffer.from([0x9d, 0x01, 0x2a]))
    ) {
      if (extended) {
        const width = bytes.readUIntLE(24, 3) + 1;
        const height = bytes.readUIntLE(27, 3) + 1;
        if (
          width !== (bytes.readUInt16LE(payload + 6) & 0x3fff) ||
          height !== (bytes.readUInt16LE(payload + 8) & 0x3fff)
        )
          return false;
        if (((flags & alphaFlag) !== 0) !== alphaChunk) return false;
      }
      frame = true;
    } else if (
      tag === 'VP8L' &&
      !alphaChunk &&
      size > 5 &&
      bytes[payload] === 0x2f
    ) {
      const dimensions = bytes.readUInt32LE(payload + 1);
      if (dimensions >>> 29) return false;
      if (
        extended &&
        (bytes.readUIntLE(24, 3) + 1 !== (dimensions & 0x3fff) + 1 ||
          bytes.readUIntLE(27, 3) + 1 !== ((dimensions >>> 14) & 0x3fff) + 1)
      )
        return false;
      frame = true;
    } else {
      return false;
    }
    offset = next;
  }
  return (
    frame &&
    offset === bytes.length &&
    ((flags & colorFlag) !== 0) === colorChunk
  );
}

export function readFlashcardImage(value: unknown): FlashcardImage | null {
  if (value === null || value === undefined) return null;
  const input = object(value, ['data', 'side']);
  const side = readImageSide(input.side);
  const data = input.data;
  if (
    typeof data !== 'string' ||
    !data.length ||
    data.length > maxBase64Length ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
  )
    teacherError('flashcard_invalid_image', 400);
  const bytes = Buffer.from(data, 'base64');
  if (
    bytes.length > FLASHCARD_IMAGE_MAX_BYTES ||
    bytes.toString('base64') !== data ||
    !isStillWebp(bytes)
  )
    teacherError('flashcard_invalid_image', 400);
  let size;
  try {
    size = imageSize(bytes);
  } catch {
    teacherError('flashcard_invalid_image', 400);
  }
  if (
    size.type !== 'webp' ||
    !size.width ||
    !size.height ||
    size.width > FLASHCARD_IMAGE_MAX_EDGE ||
    size.height > FLASHCARD_IMAGE_MAX_EDGE
  )
    teacherError('flashcard_invalid_image', 400);
  return { bytes, side };
}

export function readFlashcardCreate(value: unknown): FlashcardCreate {
  const input = object(value, [
    'request_key',
    'deck_id',
    'question',
    'answer',
    'source',
    'image',
  ]);
  return {
    deckId: input.deck_id === undefined ? null : flashcardDeckId(input.deck_id),
    question: text(input.question, 1, 2000),
    answer: text(input.answer, 1, 2000),
    source: readFlashcardSource(input.source),
    image: readFlashcardImage(input.image),
  };
}

export function readFlashcardPatch(value: unknown): FlashcardPatch {
  const input = object(value, [
    'revision',
    'deck_id',
    'question',
    'answer',
    'source',
    'image',
    'image_side',
  ]);
  if (
    typeof input.revision !== 'number' ||
    !Number.isInteger(input.revision) ||
    input.revision < 1 ||
    input.revision > 2147483647
  )
    teacherError('invalid_input', 400);
  const patch: FlashcardPatch = { revision: input.revision };
  if (input.deck_id !== undefined)
    patch.deckId =
      input.deck_id === null ? null : flashcardDeckId(input.deck_id);
  if (input.question !== undefined)
    patch.question = text(input.question, 1, 2000);
  if (input.answer !== undefined) patch.answer = text(input.answer, 1, 2000);
  if (input.source !== undefined)
    patch.source = readFlashcardSource(input.source);
  if (input.image !== undefined) patch.image = readFlashcardImage(input.image);
  if (input.image_side !== undefined) {
    if (input.image !== undefined) teacherError('invalid_input', 400);
    patch.imageSide = readImageSide(input.image_side);
  }
  if (Object.keys(patch).length === 1) teacherError('invalid_input', 400);
  return patch;
}
