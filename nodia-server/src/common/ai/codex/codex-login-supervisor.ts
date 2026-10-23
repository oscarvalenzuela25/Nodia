import { createServer, type Server, type Socket } from 'node:net';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { CodexRuntimeService } from './codex-runtime.service.js';
import {
  CodexLoginJournal,
  terminalCodexLogin,
  type CodexLoginRecord,
} from './codex-login-journal.js';
import { codexProcessIdentity } from './codex-process-ownership.js';
import { codexError, codexObject } from './codex-contract.js';

/** One bounded local child owns one native device login. Human codes never reach its journal. */
export async function runCodexLoginSupervisor(
  id: string,
  runtime = new CodexRuntimeService(),
  journal = new CodexLoginJournal(),
) {
  process.umask(0o077);
  let record = await journal.read(id);
  if (
    !record ||
    terminalCodexLogin(record.state) ||
    record.state !== 'reserved'
  )
    return;
  let human = journal.public(record),
    nativeLoginId: string | null = null;
  let finishing: Promise<void> | null = null,
    lease: Awaited<ReturnType<CodexRuntimeService['acquire']>> | null = null;
  const abort = new AbortController(),
    peers = new Set<Socket>();
  let timer: NodeJS.Timeout | undefined,
    server: Server | undefined,
    starting: Promise<void> | undefined;
  const owner = await codexProcessIdentity(process.pid);
  const paths = await journal.paths(id);
  const persist = async (
    state: CodexLoginRecord['state'],
    reason: string | null = null,
    native = record!.native,
  ) =>
    journal.locked(id, async () => {
      const latest = await journal.read(id);
      if (
        !latest ||
        latest.providerId !== record!.providerId ||
        latest.actorId !== record!.actorId
      )
        throw codexError('codex_login_unknown', 409);
      if (terminalCodexLogin(latest.state) && latest.state !== state)
        throw codexError('codex_login_unknown', 409);
      record = { ...latest, state, reason, native, owner };
      await journal.write(record);
    });
  const shutdown = async () => {
    clearTimeout(timer);
    for (const peer of peers) peer.end();
    await new Promise<void>((done) => {
      if (!server?.listening) {
        done();
        return;
      }
      server.close(() => done());
    });
    await rm(paths.socket, { force: true });
    await runtime.onModuleDestroy();
  };
  const finish = (
    state: 'succeeded' | 'failed' | 'cancelled',
    reason: string | null = null,
  ): Promise<void> => {
    finishing ??= (async () => {
      abort.abort();
      lease?.profile.rpc.off('notification', notification);
      lease?.profile.rpc.off('closed', closed);
      try {
        await runtime.stop(record!.providerId);
        lease?.release();
        lease = null;
        human = { id, state, reason, userCode: null, verificationUrl: null };
        await persist(state, reason, null);
      } catch {
        human = {
          id,
          state: 'running',
          reason: 'codex_login_unknown',
          userCode: null,
          verificationUrl: null,
        };
        await persist('unknown', 'codex_login_unknown').catch(() => undefined);
        throw codexError('codex_login_unknown', 409);
      }
      setTimeout(() => void shutdown().catch(() => undefined), 250).unref();
    })();
    return finishing;
  };
  const closed = () => {
    if (!finishing)
      void finish('failed', 'codex_runtime_unavailable').catch(() => undefined);
  };
  let early: unknown;
  const notification = (method: string, params: unknown) => {
    if (method !== 'account/login/completed' || finishing) return;
    if (!nativeLoginId) {
      early = params;
      return;
    }
    let value: Record<string, unknown>;
    try {
      value = codexObject(params);
    } catch {
      void finish('failed', 'codex_protocol_invalid').catch(() => undefined);
      return;
    }
    if (value.loginId !== nativeLoginId) return;
    if (value.success !== true) {
      void finish('failed', 'codex_login_failed').catch(() => undefined);
      return;
    }
    human = {
      id,
      state: 'verifying',
      reason: null,
      userCode: null,
      verificationUrl: null,
    };
    void (async () => {
      await persist('verifying');
      runtime.invalidate(record!.providerId);
      const session = await runtime.observe(
        record!.providerId,
        undefined,
        lease!.profile,
      );
      await finish(
        session.authenticated === true ? 'succeeded' : 'failed',
        session.authenticated === true ? null : 'codex_session_required',
      );
    })().catch(
      () =>
        void finish('failed', 'codex_runtime_unavailable').catch(
          () => undefined,
        ),
    );
  };
  const cancel = async () => {
    abort.abort();
    await starting?.catch(() => undefined);
    if (finishing) {
      await finishing;
      return;
    }
    try {
      if (nativeLoginId && lease)
        await lease.profile.rpc.request(
          'account/login/cancel',
          { loginId: nativeLoginId },
          3000,
        );
    } catch {
      /* Closing the certified owned group is the cancellation witness. */
    }
    await finish('cancelled');
  };
  server = createServer((peer) => {
    peers.add(peer);
    peer.once('close', () => peers.delete(peer));
    peer.setTimeout(12000, () => peer.destroy());
    let buffer = '',
      handled = false;
    peer.on('data', (chunk: Buffer) => {
      if (handled) return;
      buffer += chunk.toString('utf8');
      if (Buffer.byteLength(buffer) > 1024) {
        peer.destroy();
        return;
      }
      if (!buffer.includes('\n')) return;
      handled = true;
      void (async () => {
        const request = codexObject(JSON.parse(buffer.trim()));
        if (
          Object.keys(request).sort().join(',') !==
            'action,actorId,id,providerId,version' ||
          request.version !== 1 ||
          request.id !== id ||
          request.providerId !== record!.providerId ||
          request.actorId !== record!.actorId ||
          !['status', 'cancel'].includes(String(request.action))
        )
          throw codexError('codex_login_not_found', 404);
        if (request.action === 'cancel') await cancel();
        const latest = await journal.read(id);
        if (!latest || latest.state === 'unknown')
          throw codexError('codex_login_unknown', 409);
        // Socket kernel permissions admit only the owning UID/root; payload identity binds its authorized flow.
        peer.end(
          JSON.stringify({
            job: terminalCodexLogin(latest.state)
              ? journal.public(latest)
              : human,
          }) + '\n',
        );
      })().catch(() => peer.end('{"error":"codex_login_unknown"}\n'));
    });
  });
  server.on('error', () => {
    void cancel().catch(() => undefined);
  });
  await new Promise<void>((done, reject) => {
    server!.once('error', reject);
    server!.listen(paths.socket, done);
  });
  await journal.protectSocket(id);
  let admitted = false;
  await journal.locked(id, async () => {
    const latest = await journal.read(id);
    if (
      !latest ||
      latest.state !== 'reserved' ||
      Date.parse(latest.expiresAt) <= Date.now()
    )
      return;
    record = { ...latest, state: 'running', owner };
    await journal.write(record);
    admitted = true;
  });
  if (!admitted) {
    await shutdown();
    return;
  }
  timer = setTimeout(
    () => void cancel().catch(() => undefined),
    Math.max(1, Date.parse(record.expiresAt) - Date.now()),
  );
  starting = (async () => {
    try {
      lease = await runtime.acquire(
        record!.providerId,
        abort.signal,
        async (native) => {
          if (native.group !== native.pid)
            throw codexError('codex_login_unknown', 409);
          await persist('running', null, native);
        },
      );
      const pid = lease.profile.rpc.ownedPid;
      if (!pid) throw codexError('codex_login_unknown', 409);
      const native = await codexProcessIdentity(pid);
      if (native.group !== native.pid)
        throw codexError('codex_login_unknown', 409);
      await persist('running', null, native);
      if (abort.signal.aborted || Date.parse(record!.expiresAt) <= Date.now())
        return;
      await runtime.rotateChatGeneration(record!.providerId);
      lease.profile.rpc.on('notification', notification);
      lease.profile.rpc.on('closed', closed);
      const value = codexObject(
        await lease.profile.rpc.request(
          'account/login/start',
          { type: 'chatgptDeviceCode' },
          30000,
        ),
      );
      if (
        value.type !== 'chatgptDeviceCode' ||
        typeof value.loginId !== 'string' ||
        value.loginId.length < 1 ||
        value.loginId.length > 128 ||
        value.verificationUrl !== 'https://auth.openai.com/codex/device' ||
        typeof value.userCode !== 'string' ||
        !/^[A-Za-z0-9-]{4,32}$/.test(value.userCode)
      )
        throw codexError('codex_protocol_invalid', 502);
      nativeLoginId = value.loginId;
      if (!abort.signal.aborted && !finishing) {
        human = {
          id,
          state: 'waiting_authorization',
          verificationUrl: value.verificationUrl,
          userCode: value.userCode,
          reason: null,
        };
        await persist('waiting_authorization');
        if (early) notification('account/login/completed', early);
      }
    } catch {
      if (!abort.signal.aborted) await finish('failed', 'codex_login_failed');
    }
  })();
  // API/worker shutdown must not kill this bounded child; its own TERM verifies native closure first.
  process.once('SIGTERM', () => void cancel().catch(() => undefined));
  process.once('SIGINT', () => void cancel().catch(() => undefined));
  await starting;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  void runCodexLoginSupervisor(process.argv[2] ?? '').catch(() => {
    process.exitCode = 1;
  });
}
