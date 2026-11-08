import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiJsonObject } from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { ExecuteNodiaAiArtifactUseCase } from './execute-nodia-ai-artifact.use-case.js';
import { createNodiaAiArtifactsFamily } from '../artifacts.family.js';
import { readFileSync } from 'node:fs';

const chat = '927c421c-393b-4166-8873-a70b8da44b57';
const ref = 'f2444064-d9f7-4c76-9c2a-558f740811fc';
const business = '78b9ca37-196d-447e-b067-a4e7a17f46e8';
const invalidInputs: NodiaAiJsonObject[] = [{ id: '9223372036854775808' }, { id: '1', path: '../../secret' }, { id: 1 }];
function fixture() {
  const invoice = { id: '1', business_id: business, path_storage: `invoices/${business}/synthetic.pdf` };
  const repository = { findOne: vi.fn(async () => invoice) };
  const authority = { current: true, visible: true };
  const manager = {
    queryRunner: { isTransactionActive: true },
    getRepository: vi.fn(() => repository),
    query: vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT u.id')) return authority.current ? [{
        actorId: '1', sessionId: chat, isSuperAdmin: false,
      }] : [];
      if (sql.startsWith('SELECT business.id::text'))
        return authority.visible ? [{ id: business }] : [];
      if (sql.startsWith('SELECT resource.id::text'))
        return authority.visible ? [{ id: '1' }] : [];
      return [];
    }),
  } as unknown as EntityManager;
  Object.assign(repository, { manager });
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: { actorId: '1', sessionId: chat, isSuperAdmin: false, modules: [{ id: '1', key: 'businesses', route: '/business' }] },
    moduleRoutes: ['/business'], conversationId: chat, toolCallId: ref,
  };
  return { invoice, repository, context, authority, subject: new ExecuteNodiaAiArtifactUseCase() };
}
describe('NodiaAI regenerable artifact references', () => {
  it('issues an opaque authenticated invoice reference without storage keys, data or URLs', async () => {
    const f = fixture();
    const prepared = await f.subject.prepare('invoices_file', { id: '1' }, f.context);
    expect(prepared.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    const result = await prepared.execute(new AbortController().signal);
    expect(result.artifact).toEqual({ reference: ref, kind: 'invoice_file', filename: 'invoice-1.pdf', mime_type: 'application/pdf', semantics: 'current_on_download', access: 'authenticated_reauthorized' });
    expect(JSON.stringify(result)).not.toMatch(/invoices\/|https?:|path_storage|generated_at|size/);
    await prepared.verify(f.context);
  });
  it('does not create or retain an export payload at reference issuance', async () => {
    const f = fixture();
    const prepared = await f.subject.prepare('products_export_csv', {}, f.context);
    expect(await prepared.execute(new AbortController().signal)).toMatchObject({ artifact: { reference: ref, filename: 'products.csv', semantics: 'current_on_download' } });
    expect(f.context.manager.getRepository).not.toHaveBeenCalled();
    expect(prepared.discard).toBeUndefined();
  });
  it('rejects changed invoice paths after the external phase', async () => {
    const f = fixture();
    const prepared = await f.subject.prepare('invoices_file', { id: '1' }, f.context);
    f.invoice.path_storage = `invoices/${business}/different.pdf`;
    await expect(prepared.verify(f.context)).rejects.toThrow('nodia_ai:artifact_changed');
  });
  it('rejects an invoice reference when business membership or the session is revoked', async () => {
    const f = fixture();
    const prepared = await f.subject.prepare('invoices_file', { id: '1' }, f.context);
    f.authority.visible = false;
    await expect(prepared.verify(f.context)).rejects.toThrow('business:resource_not_found');
    f.authority.visible = true;
    f.authority.current = false;
    await expect(prepared.verify(f.context)).rejects.toThrow('auth:session_expired');
  });
  it('rechecks explicit CSV business and supplier identities before issuing or reusing references', async () => {
    const f = fixture();
    const prepared = await f.subject.prepare('providers_export_csv', { business_id: business, ids: ['1'] }, f.context);
    f.authority.visible = false;
    await expect(prepared.verify(f.context)).rejects.toThrow('business:resource_not_found');
    await expect(f.subject.prepare('products_export_csv', { business_id: business }, f.context))
      .rejects.toThrow('business:resource_not_found');
  });
  it.each(['invoices_file', 'products_export_csv', 'providers_export_csv'] as const)('rejects revoked destination for %s even for a cached result', async (operation) => {
    const f = fixture();
    await expect(f.subject.verifyAuthority(operation, operation === 'invoices_file' ? { id: '1' } : {}, { ...f.context, moduleRoutes: [] })).rejects.toThrow('nodia_ai:module_not_allowed');
  });
  it('rejects aborted preparation/execution and never accesses storage', async () => {
    const f = fixture(), controller = new AbortController();
    const prepared = await f.subject.prepare('invoices_file', { id: '1' }, f.context);
    controller.abort();
    await expect(prepared.execute(controller.signal)).rejects.toThrow();
    await expect(f.subject.prepare('invoices_file', { id: '1' }, { ...f.context, signal: controller.signal })).rejects.toThrow();
  });
  it.each(['../../secret.pdf', `invoices/${business}/../secret.pdf`, `invoices/${business}/file.pdf?token=private`, `invoices/${chat}/file.pdf`, `https://example.invalid/invoice.pdf`, ''])('refuses an invalid persisted invoice key: %s', async (key) => {
    const f = fixture(); f.invoice.path_storage = key;
    await expect(f.subject.prepare('invoices_file', { id: '1' }, f.context)).rejects.toThrow('nodia_ai:invoice_file_unavailable');
  });
  it('requires a transaction and backend-owned chat/call identities', async () => {
    const f = fixture();
    await expect(f.subject.prepare('products_export_csv', {}, { ...f.context, toolCallId: undefined })).rejects.toThrow('nodia_ai:artifact_context_required');
    await expect(f.subject.verifyAuthority('products_export_csv', {}, { ...f.context, manager: { queryRunner: { isTransactionActive: false } } as unknown as EntityManager })).rejects.toThrow('authorization:transaction_required');
  });
  it.each(invalidInputs)('rejects untrusted invoice arguments before a query', async (input) => {
    const f = fixture();
    await expect(f.subject.prepare('invoices_file', input, f.context)).rejects.toThrow('nodia_ai:invalid_tool_input');
    expect(f.repository.findOne).not.toHaveBeenCalled();
  });
  it('binds replayed artifacts to the exact tool call', async () => {
    const f = fixture();
    await expect(f.subject.verifyResultAuthority('products_export_csv', {}, { artifact: { reference: chat } }, f.context)).rejects.toThrow('nodia_ai:artifact_reference_invalid');
  });
  it('exports exactly three closed candidate registrations and no generic artifact invocation', () => {
    const source = readFileSync(new URL('../../contracts/artifacts.schema.json', import.meta.url), 'utf8');
    const family = createNodiaAiArtifactsFamily(source);
    expect(family.capabilities.map((cap) => cap.toolName)).toEqual(['nodia_invoices_file', 'nodia_products_export_csv', 'nodia_providers_export_csv']);
    expect(family.capabilities.map((cap) => [cap.toolName, cap.revision])).toEqual([
      ['nodia_invoices_file', 1], ['nodia_products_export_csv', 2], ['nodia_providers_export_csv', 1],
    ]);
    expect(family.capabilities.every((cap) => cap.kind === 'read_artifact' && cap.external && cap.actionKeys.length === 0)).toBe(true);
    expect(new Set(family.resources.map((resource) => resource.key)).size).toBe(3);
  });
});
