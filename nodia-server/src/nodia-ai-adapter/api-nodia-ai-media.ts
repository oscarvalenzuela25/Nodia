import { createHash } from 'node:crypto';
import {
  decodeCodexChatImages,
  isCodexChatImageMime,
} from '../common/ai/codex/codex-chat-images.js';
import { decodeApiChatWav } from '../common/ai/api-chat-wav.js';
import {
  decodeCodexGeneratedImage,
  CODEX_GENERATED_IMAGE_FRAME_BYTES,
} from '../common/ai/codex/codex-generated-image.js';
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import {
  NodiaAiAdapterError,
  type NodiaAiAdapterRequest,
  type NodiaAiGeneratedImage,
} from './types/nodia-ai-adapter.types.js';
import {
  apiObject,
  type NodiaAiApiProvider,
} from './api-nodia-ai-credentials.service.js';

export { CODEX_GENERATED_IMAGE_FRAME_BYTES as API_GENERATED_IMAGE_RESPONSE_BYTES };
export const apiMediaSupported = (
  provider: NodiaAiApiProvider,
  kind: string,
  mime: string,
): boolean =>
  (kind === 'image' && isCodexChatImageMime(mime)) ||
  (kind === 'pdf' && mime === 'application/pdf') ||
  (provider === 'gemini' &&
    kind === 'audio' &&
    ['audio/wav', 'audio/ogg', 'audio/webm', 'audio/mpeg'].includes(mime));

/** Originals have already passed the attachment parser; independently bind inline bytes/hash/type/limits. */
export function validateApiMedia(
  provider: NodiaAiApiProvider,
  request: NodiaAiAdapterRequest,
  policy: NodiaAiRuntimePolicy,
): void {
  const files = request.attachments ?? [];
  if (
    !Array.isArray(files) ||
    files.length > policy.admission.files_per_message
  )
    throw new NodiaAiAdapterError('adapter_invalid_request', 'not_dispatched');
  let total = 0;
  for (const file of files) {
    if (
      !file ||
      !apiMediaSupported(provider, file.kind, file.media_type) ||
      typeof file.content_base64 !== 'string' ||
      !file.content_base64.length ||
      file.content_base64.length >
        4 * Math.ceil(policy.admission.file_bytes / 3) ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new NodiaAiAdapterError(
        'adapter_attachments_unverified',
        'not_dispatched',
      );
    const bytes = Buffer.from(file.content_base64, 'base64');
    total += bytes.length;
    if (
      !bytes.length ||
      bytes.length > policy.admission.file_bytes ||
      total > policy.admission.message_files_bytes ||
      bytes.toString('base64') !== file.content_base64 ||
      createHash('sha256').update(bytes).digest('hex') !== file.sha256
    )
      throw new NodiaAiAdapterError(
        'adapter_invalid_request',
        'not_dispatched',
      );
    try {
      if (isCodexChatImageMime(file.media_type))
        decodeCodexChatImages(
          [
            {
              mediaType: file.media_type,
              contentBase64: file.content_base64,
              sha256: file.sha256,
            },
          ],
          {
            count: policy.admission.files_per_message,
            fileBytes: policy.admission.file_bytes,
            totalBytes: policy.admission.message_files_bytes,
            pixels: policy.admission.image_pixels,
          },
        );
      else if (
        file.media_type === 'application/pdf' &&
        (!bytes.subarray(0, 8).toString('latin1').startsWith('%PDF-') ||
          !bytes.subarray(-1024).includes(Buffer.from('%%EOF')))
      )
        throw Error();
      else if (file.media_type === 'audio/wav')
        decodeApiChatWav(
          [
            {
              mediaType: 'audio/wav',
              contentBase64: file.content_base64,
              sha256: file.sha256,
            },
          ],
          {
            count: policy.admission.files_per_message,
            fileBytes: policy.admission.file_bytes,
            totalBytes: policy.admission.message_files_bytes,
            seconds: policy.admission.audio_seconds,
          },
        );
      else if (
        file.media_type === 'audio/ogg' &&
        bytes.toString('latin1', 0, 4) !== 'OggS'
      )
        throw Error();
      else if (
        file.media_type === 'audio/webm' &&
        bytes.subarray(0, 4).toString('hex') !== '1a45dfa3'
      )
        throw Error();
      else if (
        file.media_type === 'audio/mpeg' &&
        !(
          bytes.toString('latin1', 0, 3) === 'ID3' ||
          (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
        )
      )
        throw Error();
    } catch {
      throw new NodiaAiAdapterError(
        'adapter_invalid_request',
        'not_dispatched',
      );
    }
  }
}

export function initialApiHistory(
  provider: NodiaAiApiProvider,
  request: Pick<NodiaAiAdapterRequest, 'canonicalPrompt' | 'attachments'>,
): Record<string, unknown>[] {
  if (provider === 'gemini')
    return [
      {
        role: 'user',
        parts: [
          { text: request.canonicalPrompt },
          ...(request.attachments ?? []).map((file) => ({
            inlineData: {
              mimeType: file.media_type,
              data: file.content_base64,
            },
          })),
        ],
      },
    ];
  return [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: request.canonicalPrompt },
        ...(request.attachments ?? []).map((file) =>
          file.kind === 'pdf'
            ? {
                type: 'input_file',
                filename: 'attachment.pdf',
                file_data: `data:application/pdf;base64,${file.content_base64}`,
              }
            : {
                type: 'input_image',
                image_url: `data:${file.media_type};base64,${file.content_base64}`,
              },
        ),
      ],
    },
  ];
}

/** Inline output only. Provider URLs and saved paths are never downloaded. */
export function parseApiGeneratedImage(
  provider: NodiaAiApiProvider,
  response: Record<string, unknown>,
): { text: string; generatedImage: NodiaAiGeneratedImage } {
  let base64: unknown;
  let claimedMime: unknown;
  let text = '';
  if (provider === 'openai') {
    if (!Array.isArray(response.data) || response.data.length !== 1)
      throw new NodiaAiAdapterError('api_image_invalid', 'unknown');
    base64 = apiObject(response.data[0])?.b64_json;
  } else {
    const candidates = response.candidates;
    const candidate =
      Array.isArray(candidates) && candidates.length === 1
        ? apiObject(candidates[0])
        : null;
    const content = apiObject(candidate?.content);
    if (candidate?.finishReason !== 'STOP' || !Array.isArray(content?.parts))
      throw new NodiaAiAdapterError('api_image_invalid', 'unknown');
    const parts = content.parts.map(apiObject);
    const images = parts.filter((part) => part?.inlineData !== undefined);
    if (
      images.length !== 1 ||
      parts.some(
        (part) => !part || (typeof part.text !== 'string' && !part.inlineData),
      )
    )
      throw new NodiaAiAdapterError('api_image_invalid', 'unknown');
    const image = apiObject(images[0]!.inlineData);
    base64 = image?.data;
    claimedMime = image?.mimeType;
    text = parts
      .filter((part) => typeof part?.text === 'string' && part.thought !== true)
      .map((part) => part!.text)
      .join('');
  }
  try {
    const image = decodeCodexGeneratedImage({
      type: 'imageGeneration',
      status: 'completed',
      id: 'api-image-output',
      result: base64,
    });
    if (provider === 'gemini' && claimedMime !== image.mediaType) throw Error();
    return { text, generatedImage: image };
  } catch {
    throw new NodiaAiAdapterError('api_image_invalid', 'unknown');
  }
}
