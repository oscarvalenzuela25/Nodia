import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { DownloadNodiaAiArtifactUseCase } from './download-nodia-ai-artifact.use-case.js';
import { ExecuteNodiaAiArtifactUseCase } from './execute-nodia-ai-artifact.use-case.js';
import { AuthorizeNodiaAiUseCase } from '../../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiAuthorizationService } from '../../../nodia-ai/nodia-ai-authorization.service.js';
import type { NodiaAiAuthorizationSnapshot } from '../../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import type { NodiaAiConversationService } from '../../../nodia-ai-conversation/nodia-ai-conversation.service.js';
import type { StorageService } from '../../../common/storage/storage.service.js';
import type { NodiaAiRuntimePolicy } from '../../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiToolCall } from '../../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { canonicalKnowledge, knowledgeHash } from '../../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
const ref = '41bf2099-3a3a-435c-9257-b300fa836383';
const chat = 'af9014a7-00a4-4fe5-97fa-dcb14bf17c9a';
const business = '061b33d2-98c7-4ec1-b0d5-4bd207dc31de';
const identity = { userId: '1', sessionId: 'efec579b-8fba-4ddd-b9a0-0433814eb22c' };
function fixture() {
  const snapshot: NodiaAiAuthorizationSnapshot = { actorId: '1', sessionId: identity.sessionId, isSuperAdmin: false, actionKeys: [], modules: [
    { id: '1', key: 'nodia_ai', route: '/nodia-ai', assigned: true }, { id: '2', key: 'businesses', route: '/business', assigned: true },
  ] };
  const conversation = { id: chat, owner_id: '1', lifecycle: 'active', expires_at: new Date(Date.now() + 86_400_000) };
  const invoice = { id: '1', business_id: business, path_storage: `invoices/${business}/synthetic.pdf` };
  let call: Partial<NodiaAiToolCall> | null = { id: ref, conversation_id: chat, run_id: chat, tool_name: 'nodia_invoices_file', state: 'completed', completed_at: new Date(),
    arguments: { id: '1' }, arguments_hash: knowledgeHash(canonicalKnowledge({ id: '1' })), contract_hash: 'a'.repeat(64),
    public_result: { artifact: { reference: ref, semantics: 'current_on_download', access: 'authenticated_reauthorized' } } };
  let inTransaction = false;
  const authority = { visible: true };
  const invoiceRepository = { findOne: async () => invoice };
  const manager = { queryRunner: { isTransactionActive: true }, query: vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT u.id')) return [{
      actorId: snapshot.actorId, sessionId: snapshot.sessionId, isSuperAdmin: snapshot.isSuperAdmin,
    }];
    if (sql.startsWith('SELECT business.id::text')) return authority.visible ? [{ id: business }] : [];
    return [];
  }), getRepository: vi.fn((entity) => entity === NodiaAiToolCall ? { findOneBy: async () => call } : invoiceRepository) } as unknown as EntityManager;
  Object.assign(invoiceRepository, { manager });
  const source = { transaction: vi.fn(async (_isolation: string, work: (value: EntityManager) => Promise<unknown>) => {
    inTransaction = true;
    try { return await work(manager); } finally { inTransaction = false; }
  }) };
  const auth = { loadCurrentActor: vi.fn(async () => snapshot) };
  const authorize = new AuthorizeNodiaAiUseCase(auth as unknown as NodiaAiAuthorizationService);
  const chats = { find: vi.fn(async () => conversation), now: vi.fn(async () => new Date()), auditInspection: vi.fn() };
  const authorizeChat = new AuthorizeNodiaAiConversationUseCase(chats as unknown as NodiaAiConversationService, authorize);
  let external = async () => {};
  const storage = { downloadFile: vi.fn(async (_key, _bytes, signal: AbortSignal) => { expect(inTransaction).toBe(false); await external(); signal.throwIfAborted(); return Buffer.from('%PDF-synthetic'); }) };
  const policy = { admission: { file_bytes: 20 * 1024 * 1024 }, results: { list_max_rows: 100 }, timing: { domain_step_seconds: 30, read_query_seconds: 3 } } as NodiaAiRuntimePolicy;
  const subject = new DownloadNodiaAiArtifactUseCase(source as unknown as DataSource, authorize, authorizeChat, new ExecuteNodiaAiArtifactUseCase(), storage as unknown as StorageService, policy);
  return { subject, snapshot, conversation, invoice, source, manager, storage, policy, chats, authority, setExternal: (effect: () => Promise<void>) => { external = effect; }, deleteCall: () => { call = null; }, call: () => call! };
}
describe('NodiaAI private artifact downloads', () => {
  it('reauthorizes completed receipt and streams storage outside both SQL checkpoints', async () => {
    const f = fixture();
    expect(await f.subject.execute(identity, ref)).toEqual({ filename: 'invoice-1.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic') });
    expect(f.source.transaction).toHaveBeenCalledTimes(2);
    expect(f.storage.downloadFile).toHaveBeenCalledWith(f.invoice.path_storage, 10 * 1024 * 1024, expect.any(AbortSignal));
    expect(f.manager.query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '3000ms'");
  });
  it('does not expose another owner chat to an ordinary user', async () => {
    const f = fixture(); f.conversation.owner_id = '2';
    await expect(f.subject.execute(identity, ref)).rejects.toThrow('nodia_ai:conversation_not_found');
    expect(f.storage.downloadFile).not.toHaveBeenCalled();
  });
  it('allows super_admin inspection with the existing audit contract', async () => {
    const f = fixture(); f.snapshot.isSuperAdmin = true; f.conversation.owner_id = '2';
    await f.subject.execute(identity, ref);
    expect(f.chats.auditInspection).toHaveBeenCalledTimes(1);
  });
  it.each(['expired', 'purged', 'module_revoked', 'session_revoked', 'business_revoked', 'path_changed'] as const)('discards output after %s during storage I/O', async (change) => {
    const f = fixture();
    f.setExternal(async () => {
      if (change === 'expired') f.conversation.expires_at = new Date(0);
      if (change === 'purged') f.deleteCall();
      if (change === 'module_revoked') f.snapshot.modules[1].assigned = false;
      if (change === 'session_revoked') f.snapshot.sessionId = chat;
      if (change === 'business_revoked') f.authority.visible = false;
      if (change === 'path_changed') f.invoice.path_storage = `invoices/${business}/changed.pdf`;
    });
    await expect(f.subject.execute(identity, ref)).rejects.toThrow();
    expect(f.storage.downloadFile).toHaveBeenCalledTimes(1);
  });
  it('rejects a running or purged receipt without touching object storage', async () => {
    const f = fixture(); f.call().state = 'running';
    await expect(f.subject.execute(identity, ref)).rejects.toThrow('nodia_ai:artifact_not_found');
    f.deleteCall();
    await expect(f.subject.execute(identity, ref)).rejects.toThrow('nodia_ai:artifact_not_found');
    expect(f.storage.downloadFile).not.toHaveBeenCalled();
  });
  it('rejects tampered receipt arguments and arbitrary nonartifact operations', async () => {
    const f = fixture(); f.call().arguments = { id: '2' };
    await expect(f.subject.execute(identity, ref)).rejects.toThrow('nodia_ai:artifact_not_found');
    f.call().arguments = { id: '1' }; f.call().tool_name = 'nodia_users_list';
    await expect(f.subject.execute(identity, ref)).rejects.toThrow('nodia_ai:artifact_not_found');
    expect(f.storage.downloadFile).not.toHaveBeenCalled();
  });
  it('propagates request cancellation and never returns an already downloaded buffer', async () => {
    const f = fixture(), controller = new AbortController();
    f.setExternal(async () => { controller.abort(); });
    await expect(f.subject.execute(identity, ref, controller.signal)).rejects.toThrow();
    expect(f.source.transaction).toHaveBeenCalledTimes(1);
  });
  it('sanitizes storage errors rather than exposing SDK credentials or keys', async () => {
    const f = fixture(); f.storage.downloadFile.mockRejectedValue(new Error('secret key synthetic'));
    await expect(f.subject.execute(identity, ref)).rejects.toThrow('nodia_ai:artifact_storage_unavailable');
  });
  it('rejects invalid references before opening any database transaction', async () => {
    const f = fixture();
    await expect(f.subject.execute(identity, '../key')).rejects.toThrow('nodia_ai:artifact_not_found');
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
});
