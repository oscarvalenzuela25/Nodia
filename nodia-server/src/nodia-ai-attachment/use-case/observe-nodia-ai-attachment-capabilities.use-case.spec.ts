import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ObserveNodiaAiAttachmentCapabilitiesUseCase } from './observe-nodia-ai-attachment-capabilities.use-case.js';
import type { NodiaAiAttachmentService } from '../nodia-ai-attachment.service.js';
import type { ManageNodiaAiAttachmentUseCase } from './manage-nodia-ai-attachment.use-case.js';
import type { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import type { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';

function fixture() {
  const base = {
    limits: { file_bytes: 20971520 },
    reviewed_text: true,
    native_modalities: { image: null, pdf: null, audio: null },
  };
  const chat = {
    revision: 1,
    selected_connection_id: '2',
    selected_mode: 'agentic',
    selected_model_id: 'fixture-live-model',
    selected_effort_id: null,
  };
  const manager = {
    query: vi.fn().mockResolvedValue([]),
  } as unknown as EntityManager;
  const attachments = {
    transaction: vi.fn(async (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const manage = { capabilities: vi.fn().mockResolvedValue(base) };
  const access = {
    execute: vi.fn().mockImplementation(async () => ({ chat })),
  };
  const adapter = {
    observe: vi.fn().mockResolvedValue({
      available: true,
      verifiedModalities: ['image'],
      verifiedAttachmentMediaTypes: ['image/png'],
    }),
  };
  const subject = new ObserveNodiaAiAttachmentCapabilitiesUseCase(
    attachments as unknown as NodiaAiAttachmentService,
    manage as unknown as ManageNodiaAiAttachmentUseCase,
    access as unknown as AuthorizeNodiaAiConversationUseCase,
    adapter as unknown as NodiaAiAdapterPort,
  );
  return { base, chat, attachments, access, adapter, subject };
}
const identity = { userId: '1', sessionId: 'synthetic-session' };
describe('AI-32 exact attachment modality evidence', () => {
  it('has no inference or presumed availability without a selected chat', async () => {
    const f = fixture();
    expect(await f.subject.execute(identity)).toEqual(f.base);
    expect(f.adapter.observe).not.toHaveBeenCalled();
  });
  it('observes exact current selection outside transactions and exposes only proved kinds', async () => {
    const f = fixture();
    const result = await f.subject.execute(identity, 'chat');
    expect(result.native_media_types).toEqual(['image/png']);
    expect(result.native_modalities).toEqual({
      image: true,
      pdf: null,
      audio: null,
    });
    expect(f.adapter.observe).toHaveBeenCalledWith({
      connection_id: '2',
      mode: 'agentic',
      model_id: 'fixture-live-model',
      effort_id: null,
    });
    expect(f.access.execute).toHaveBeenCalledTimes(2);
  });
  it('keeps historical category-only observations unknown', async () => {
    const f = fixture();
    f.adapter.observe.mockResolvedValue({
      available: true,
      verifiedModalities: ['image', 'audio'],
    });
    const result = await f.subject.execute(identity, 'chat');
    expect(result.native_media_types).toEqual([]);
    expect(result.native_modalities).toEqual({
      image: null,
      pdf: null,
      audio: null,
    });
  });
  it('returns unknown when provider is unavailable without inventing metadata', async () => {
    const f = fixture();
    f.adapter.observe.mockRejectedValue(Error('private error'));
    expect(await f.subject.execute(identity, 'chat')).toEqual(f.base);
  });
  it('discards evidence if the selection changes during observation', async () => {
    const f = fixture();
    f.adapter.observe.mockImplementation(async () => {
      f.chat.revision++;
      return {
        available: true,
        verifiedModalities: ['image'],
        verifiedAttachmentMediaTypes: ['image/png'],
      };
    });
    expect(await f.subject.execute(identity, 'chat')).toEqual(f.base);
  });
  it('does not release evidence after current authority is revoked', async () => {
    const f = fixture();
    f.access.execute
      .mockResolvedValueOnce({ chat: f.chat })
      .mockRejectedValueOnce(Error('revoked'));
    await expect(f.subject.execute(identity, 'chat')).rejects.toThrow(
      'revoked',
    );
  });
  it('keeps API formats unknown when observation is not an API identity', async () => {
    const f = fixture();
    f.chat.selected_mode = 'api_key';
    expect(await f.subject.execute(identity, 'chat')).toEqual(f.base);
    expect(f.adapter.observe).toHaveBeenCalledOnce();
  });
});

it.each([
  { mediaTypes: [] },
  { mediaTypes: ['image/png'] },
  { mediaTypes: ['application/pdf'] },
  { mediaTypes: ['audio/wav'] },
])(
  'exposes only API formats qualified for the exact current identity: $mediaTypes',
  async ({ mediaTypes }) => {
    const f = fixture();
    f.chat.selected_mode = 'api_key';
    f.adapter.observe.mockResolvedValue({
      available: true,
      source: 'api_configuration_and_catalog',
      adapterContractVersion: 'nodia-ai-api-chat/1',
      resourceKey: 'api-connection:' + 'a'.repeat(64),
      sessionGeneration: 'b'.repeat(32),
      supportsMcp: false,
      supportsTools: true,
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-api-chat/1',
        connectionId: '2',
      },
      verifiedAttachmentMediaTypes: [...mediaTypes],
    });
    const result = await f.subject.execute(identity, 'chat');
    expect(result.native_media_types).toEqual(mediaTypes);
    expect(result.native_modalities).toEqual({
      image: mediaTypes.includes('image/png') ? true : null,
      pdf: mediaTypes.includes('application/pdf') ? true : null,
      audio: mediaTypes.includes('audio/wav') ? true : null,
    });
    expect(f.adapter.observe).toHaveBeenCalledExactlyOnceWith({
      connection_id: '2',
      mode: 'api_key',
      model_id: 'fixture-live-model',
      effort_id: null,
    });
  },
);
