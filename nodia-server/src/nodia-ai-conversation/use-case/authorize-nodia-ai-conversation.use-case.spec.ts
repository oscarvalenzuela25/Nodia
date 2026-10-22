import { describe, expect, it } from 'vitest';
import {
  conversationFixture,
  testChatId,
  testIdentity,
  testNow,
} from './conversation-admission.fixture.js';
describe('AuthorizeNodiaAiConversationUseCase', () => {
  it('reads its current owner without renewing expiry or creating inspection audit', async () => {
    const f = conversationFixture();
    const result = await f.access.execute(
      f.manager,
      testIdentity,
      testChatId,
      'read',
      'detail',
    );
    expect(result.chat).toBe(f.chat);
    expect(f.conversations.save).not.toHaveBeenCalled();
    expect(f.conversations.auditInspection).not.toHaveBeenCalled();
  });
  it('hides foreign chats from ordinary users before exposing expiration', async () => {
    const f = conversationFixture();
    f.chat.owner_id = '2';
    f.chat.expires_at = testNow;
    await expect(
      f.access.execute(f.manager, testIdentity, testChatId, 'read', 'detail'),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.conversations.auditInspection).not.toHaveBeenCalled();
  });
  it('permits and audits super_admin inspection using the real actor and session', async () => {
    const f = conversationFixture();
    f.chat.owner_id = '2';
    f.actor.isSuperAdmin = true;
    await f.access.execute(
      f.manager,
      testIdentity,
      testChatId,
      'read',
      'messages',
    );
    expect(f.conversations.auditInspection).toHaveBeenCalledWith(
      f.manager,
      '1',
      testIdentity.sessionId,
      testChatId,
      'messages',
    );
    expect(f.chat.owner_id).toBe('2');
  });
  it('does not turn super_admin inspection into authority to send as the other owner', async () => {
    const f = conversationFixture();
    f.chat.owner_id = '2';
    f.actor.isSuperAdmin = true;
    await expect(
      f.access.execute(f.manager, testIdentity, testChatId, 'write'),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('returns 410 at the exact expiry boundary for the owner', async () => {
    const f = conversationFixture();
    f.chat.expires_at = testNow;
    await expect(
      f.access.execute(f.manager, testIdentity, testChatId, 'read'),
    ).rejects.toMatchObject({ status: 410 });
  });
  it('returns 404 for expired foreign inspection even to super_admin', async () => {
    const f = conversationFixture();
    f.chat.owner_id = '2';
    f.actor.isSuperAdmin = true;
    f.chat.expires_at = testNow;
    await expect(
      f.access.execute(f.manager, testIdentity, testChatId, 'read'),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('revalidates authorization before reading a chat', async () => {
    const f = conversationFixture();
    f.authorize.execute.mockRejectedValueOnce(new Error('revoked'));
    await expect(
      f.access.execute(f.manager, testIdentity, testChatId, 'read'),
    ).rejects.toThrow('revoked');
    expect(f.conversations.find).not.toHaveBeenCalled();
  });
});
