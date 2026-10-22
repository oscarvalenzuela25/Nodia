import { describe, expect, it } from 'vitest';
import { ListNodiaAiConversationsUseCase } from './list-nodia-ai-conversations.use-case.js';
import {
  conversationFixture,
  testIdentity,
} from './conversation-admission.fixture.js';
describe('ListNodiaAiConversationsUseCase', () => {
  it('defaults ordinary users to their own scope and rejects explicit all', async () => {
    const f = conversationFixture();
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    await subject.execute(testIdentity, {});
    expect(f.conversations.list.mock.calls[0][1]).toMatchObject({
      ownerId: '1',
    });
    await expect(
      subject.execute(testIdentity, { view: 'all' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('requires an explicit all view for a foreign owner even for super_admin', async () => {
    const f = conversationFixture();
    f.actor.isSuperAdmin = true;
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    await expect(
      subject.execute(testIdentity, { owner_user_id: '2' }),
    ).rejects.toMatchObject({ status: 400 });
    await subject.execute(testIdentity, { view: 'all', owner_user_id: '2' });
    expect(f.conversations.list.mock.calls[0][1]).toMatchObject({
      ownerId: '2',
    });
  });
  it('audits every foreign row and projects read_only without granting mutation identity', async () => {
    const f = conversationFixture();
    f.actor.isSuperAdmin = true;
    f.chat.owner_id = '2';
    f.conversations.list.mockResolvedValueOnce([f.chat]);
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    const page = await subject.execute(testIdentity, { view: 'all' });
    expect(page.items[0].read_only).toBe(true);
    expect(f.conversations.auditInspections).toHaveBeenCalledWith(
      f.manager,
      '1',
      testIdentity.sessionId,
      [f.chat.id],
      'list',
    );
  });
  it('batches only returned foreign rows, excluding own rows and the cursor sentinel', async () => {
    const f = conversationFixture();
    f.actor.isSuperAdmin = true;
    const foreign = {
      ...f.chat,
      id: 'af00670e-51f4-4239-b85f-717ce6deee21',
      owner_id: '2',
    };
    const sentinel = { ...foreign, id: 'af00670e-51f4-4239-b85f-717ce6deee22' };
    f.conversations.list.mockResolvedValueOnce([f.chat, foreign, sentinel]);
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    const page = await subject.execute(testIdentity, {
      view: 'all',
      page_limit: 2,
    });
    expect(page.items).toHaveLength(2);
    expect(f.conversations.auditInspections).toHaveBeenCalledExactlyOnceWith(
      f.manager,
      '1',
      testIdentity.sessionId,
      [foreign.id],
      'list',
    );
    expect(f.conversations.auditInspection).not.toHaveBeenCalled();
  });
  it('does not issue an audit write for an entirely owned page', async () => {
    const f = conversationFixture();
    f.conversations.list.mockResolvedValueOnce([f.chat]);
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    await subject.execute(testIdentity, {});
    expect(f.conversations.auditInspections).not.toHaveBeenCalled();
  });
  it('does not return foreign chat content if the transactional audit insert fails', async () => {
    const f = conversationFixture();
    f.actor.isSuperAdmin = true;
    f.conversations.list.mockResolvedValueOnce([{ ...f.chat, owner_id: '2' }]);
    f.conversations.auditInspections.mockRejectedValueOnce(
      new Error('synthetic SQL unavailable'),
    );
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    await expect(
      subject.execute(testIdentity, { view: 'all' }),
    ).rejects.toThrow('synthetic SQL unavailable');
  });
  it('rejects unbounded or malformed query envelopes before SQL', async () => {
    const f = conversationFixture();
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    for (const input of [
      { page_limit: 101 },
      { page_limit: '1e2' },
      { is_archived: 'no' },
      { search: 'á'.repeat(129) },
      { arbitrary: 'select' },
    ])
      await expect(subject.execute(testIdentity, input)).rejects.toThrow(
        'nodia_ai:invalid_input',
      );
    expect(f.conversations.transaction).not.toHaveBeenCalled();
  });
  it('binds pagination to the exact search, organization filters and actor session', async () => {
    const f = conversationFixture();
    f.conversations.list.mockResolvedValue([
      f.chat,
      { ...f.chat, id: 'af00670e-51f4-4239-b85f-717ce6deee21' },
    ]);
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    const page = await subject.execute(testIdentity, {
      search: 'Compra %_',
      is_archived: false,
      page_limit: 1,
    });
    expect(page.next_cursor).not.toBeNull();
    const base = {
      search: 'Compra %_',
      is_archived: false,
      cursor: page.next_cursor,
    };
    for (const query of [
      { ...base, search: 'Compra' },
      { ...base, is_archived: true },
      { ...base, is_pinned: true },
    ])
      await expect(subject.execute(testIdentity, query)).rejects.toThrow(
        'nodia_ai:invalid_cursor',
      );
    f.actor.sessionId = '552a7a1b-2f2f-41e0-b8bd-01ce4cf75b83';
    await expect(subject.execute(testIdentity, base)).rejects.toThrow(
      'nodia_ai:invalid_cursor',
    );
    expect(f.conversations.list).toHaveBeenCalledTimes(1);
  });
  it('passes current module routes and an unchanged literal search on each page', async () => {
    const f = conversationFixture();
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    const literal = "café %_\\'";
    await subject.execute(testIdentity, { search: literal });
    expect(f.conversations.list.mock.calls[0][1]).toMatchObject({
      search: literal,
      permittedRoutes: f.actor.modules.map((module) => module.route),
    });
    f.actor.modules = [];
    await subject.execute(testIdentity, { search: literal });
    expect(f.conversations.list.mock.calls[1][1]).toMatchObject({
      search: literal,
      permittedRoutes: [],
    });
  });
  it('rejects impossible calendar dates before a forged cursor reaches PostgreSQL', async () => {
    const f = conversationFixture();
    f.conversations.list.mockResolvedValue([f.chat, f.chat]);
    const subject = new ListNodiaAiConversationsUseCase(
      f.service,
      f.authorization,
      f.project,
      f.policy,
    );
    const page = await subject.execute(testIdentity, { page_limit: 1 });
    const decoded = JSON.parse(
      Buffer.from(page.next_cursor!, 'base64url').toString('utf8'),
    ) as { position: string[] };
    for (const date of [
      '2026-02-31T10:00:00.123456Z',
      '2026-04-31T10:00:00.123Z',
      '0000-01-01T10:00:00.123456Z',
      '2026-13-01T10:00:00.123456Z',
    ]) {
      decoded.position[0] = date;
      await expect(
        subject.execute(testIdentity, {
          cursor: Buffer.from(JSON.stringify(decoded)).toString('base64url'),
        }),
      ).rejects.toThrow('nodia_ai:invalid_cursor');
    }
    expect(f.conversations.list).toHaveBeenCalledTimes(1);
  });
});
