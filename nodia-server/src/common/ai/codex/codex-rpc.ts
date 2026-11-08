import {
  type ChildProcessWithoutNullStreams,
  spawn,
  execFile,
} from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { EventEmitter } from 'node:events';
import {
  codexProcessIdentity,
  stopCodexGroup,
  assertCodexGroupEmpty,
  type CodexProcessIdentity,
} from './codex-process-ownership.js';
import {
  CODEX_SETTINGS,
  CODEX_PROVIDER,
  codexError,
  codexObject,
} from './codex-contract.js';
import type {
  CodexChatToolChannel,
  CodexServerRequestId,
} from './codex-chat-tool-channel.js';
import { CODEX_GENERATED_IMAGE_FRAME_BYTES } from './codex-generated-image.js';

const MAX_FRAME = 2 * 1024 * 1024;
type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: NodeJS.Timeout;
};
export interface CodexProtocolProgress {
  frames: number;
  requests: number;
  bytes: number;
  /** Includes requests rejected before the private channel can admit them. */
  unforwardedRequests: number;
  overflow: boolean;
}

/** One versioned JSONL connection. No stderr/payload is ever logged or returned. */
export class CodexRpc extends EventEmitter {
  private maxFrame = MAX_FRAME;
  private maxObservedBytes = 16 * 1024 * 1024;
  /** One private owner opts in before the image-only thread starts. */
  allowImageGenerationOutput(): void {
    if (this.closed || !this.protocolObserver)
      throw codexError('codex_runtime_unavailable');
    this.maxFrame = CODEX_GENERATED_IMAGE_FRAME_BYTES;
    this.maxObservedBytes = 2 * CODEX_GENERATED_IMAGE_FRAME_BYTES + 16 * 1024 * 1024;
  }
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, Pending>();
  private readonly decoder = new StringDecoder('utf8');
  private buffer = '';
  private nextId = 0;
  private closed = false;
  private experimentalChatApi = false;
  private chatToolChannel: CodexChatToolChannel | undefined;
  private readonly pendingChatRequests = new Set<CodexServerRequestId>();
  private protocolObserver:
    ((progress: CodexProtocolProgress) => Promise<void>) | undefined;
  private protocolTail: Promise<void> = Promise.resolve();
  private protocolQueued = 0;
  private protocolOverflow = false;
  private protocolProgress: CodexProtocolProgress = {
    frames: 0,
    requests: 0,
    bytes: 0,
    unforwardedRequests: 0,
    overflow: false,
  };
  private protocolReceived = { frames: 0, requests: 0, bytes: 0 };
  get ownedPid() {
    return this.child.pid ?? null;
  }
  releaseStartGate() {
    const gate = this.child.stdio[3];
    if (gate && 'end' in gate) gate.end('nodia-start\n');
  }
  get alive() {
    return !this.closed;
  }
  private readonly exited: Promise<void>;
  private readonly memoryTimer: NodeJS.Timeout;
  private measuring = false;
  private readonly processIdentity: Promise<CodexProcessIdentity | null>;
  constructor(
    executable: string,
    cwd: string,
    profile: string,
    home: string,
    gated = false,
  ) {
    super();
    const args = [
      'app-server',
      '--listen',
      'stdio://',
      ...Object.entries(CODEX_SETTINGS).flatMap(([key, value]) => [
        '-c',
        `${key}=${toml(value)}`,
      ]),
    ];
    const gate = process.platform === 'linux' && gated;
    this.child = spawn(
      gate ? '/bin/sh' : executable,
      gate
        ? [
            '-c',
            'IFS= read -r permit <&3 && [ "$permit" = nodia-start ] && exec 3<&- && exec "$@"',
            'nodia-codex-gate',
            executable,
            ...args,
          ]
        : args,
      {
        cwd,
        shell: false,
        detached: process.platform !== 'win32',
        env: {
          CODEX_HOME: profile,
          HOME: home,
          PATH: '/usr/bin:/bin',
          LANG: 'en_US.UTF-8',
          // Linux service accounts need their private session bus to use the OS
          // keyring. Keep the allowlist explicit; never inherit API credentials.
          ...(process.platform === 'linux' &&
          process.env.DBUS_SESSION_BUS_ADDRESS
            ? { DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS }
            : {}),
          ...(process.platform === 'linux' && process.env.XDG_RUNTIME_DIR
            ? { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR }
            : {}),
          ...(process.platform === 'win32' && process.env.SystemRoot
            ? { SystemRoot: process.env.SystemRoot }
            : {}),
        },
        stdio: gate
          ? ['pipe', 'pipe', 'pipe', 'pipe']
          : ['pipe', 'pipe', 'pipe'],
      },
    );
    this.processIdentity =
      process.platform === 'linux' && this.child.pid
        ? codexProcessIdentity(this.child.pid).catch(() => null)
        : Promise.resolve(null);
    this.exited = new Promise((resolve) =>
      this.child.once('close', () => {
        this.fail();
        resolve();
      }),
    );
    this.child.once('error', () => this.fail());
    this.child.stdin.on('error', () => this.fail());
    this.child.stderr.resume();
    // Supervised RSS ceiling (512 MiB), not an OS hard memory quota. OCR tools
    // are disabled, so the native runtime is the only long-lived child here.
    this.memoryTimer = setInterval(() => {
      if (
        this.closed ||
        this.measuring ||
        !this.child.pid ||
        process.platform === 'win32'
      )
        return;
      this.measuring = true;
      execFile(
        '/bin/ps',
        ['-o', 'rss=', '-p', String(this.child.pid)],
        { timeout: 1500, maxBuffer: 1024, env: { PATH: '/usr/bin:/bin' } },
        (error, output) => {
          this.measuring = false;
          if (this.closed) return;
          const rss = output.trim();
          if (error || !/^\d+$/.test(rss) || Number(rss) > 512 * 1024) {
            this.fail(codexError('codex_resource_limit'));
            void this.close().catch(() => undefined);
          }
        },
      );
    }, 5000).unref();
    this.child.stdout.on('data', (chunk: Buffer) => {
      try {
        this.buffer += this.decoder.write(chunk);
        // Bound each frame before parsing, including partial JSON/UTF-8.
        let newline: number;
        while ((newline = this.buffer.indexOf('\n')) >= 0) {
          const raw = this.buffer.slice(0, newline);
          this.buffer = this.buffer.slice(newline + 1);
          if (this.protocolObserver) this.observedFrame(raw);
          else {
            if (Buffer.byteLength(raw) > this.maxFrame)
              throw codexError('codex_protocol_invalid');
            if (raw.trim()) this.receive(codexObject(JSON.parse(raw)));
          }
        }
        if (Buffer.byteLength(this.buffer) > this.maxFrame) {
          if (this.protocolObserver) {
            this.observedFrame(this.buffer, true);
            this.buffer = '';
          } else throw codexError('codex_protocol_invalid');
        }
      } catch {
        this.fail(codexError('codex_protocol_invalid', 502));
        void this.close().catch(() => undefined);
      }
    });
  }
  /** One owner installs a content-free, awaited observer before any chat RPC. */
  observeProtocol(
    observer: (progress: CodexProtocolProgress) => Promise<void>,
  ): () => Promise<void> {
    if (this.closed || this.protocolObserver)
      throw codexError('codex_runtime_unavailable');
    this.protocolObserver = observer;
    return async () => {
      await this.protocolTail;
      if (this.protocolObserver === observer) this.protocolObserver = undefined;
    };
  }
  private observedFrame(raw: string, partial = false) {
    if (this.protocolOverflow || this.closed) return;
    const bytes = Buffer.byteLength(raw);
    let message: Record<string, unknown> | undefined;
    try {
      if (!partial && bytes <= this.maxFrame && raw.trim())
        message = codexObject(JSON.parse(raw));
    } catch {
      /* Persist invalid frame before closing. */
    }
    const request =
      !!message &&
      typeof message.method === 'string' &&
      Object.hasOwn(message, 'id');
    const overflow =
      partial ||
      bytes > this.maxFrame ||
      this.protocolReceived.frames >= 10000 ||
      this.protocolReceived.bytes + bytes > this.maxObservedBytes;
    this.protocolOverflow ||= overflow;
    this.protocolReceived = {
      frames: this.protocolReceived.frames + 1,
      requests: this.protocolReceived.requests + (request ? 1 : 0),
      bytes: this.protocolReceived.bytes + bytes,
    };
    const snapshot = { ...this.protocolReceived, overflow };
    const observer = this.protocolObserver!;
    this.protocolQueued++;
    this.protocolTail = this.protocolTail
      .then(async () => {
        this.protocolProgress = {
          ...snapshot,
          unforwardedRequests:
            this.protocolProgress.unforwardedRequests +
            (request && (overflow || !this.chatToolChannel) ? 1 : 0),
        };
        await observer({ ...this.protocolProgress });
        if (overflow || (!message && raw.trim()))
          throw codexError('codex_protocol_invalid', 502);
        if (!this.closed && message) this.receive(message);
      })
      .catch(() => {
        this.fail(codexError('codex_protocol_invalid', 502));
        void this.close().catch(() => undefined);
      })
      .finally(() => {
        this.protocolQueued--;
      });
  }
  /** Called only for an admitted request which never reached the Nodia gateway. */
  recordUnforwardedRequest(): Promise<void> {
    if (!this.protocolObserver || this.closed)
      return Promise.reject(codexError('codex_runtime_unavailable'));
    const observer = this.protocolObserver;
    const work = this.protocolTail.then(async () => {
      this.protocolProgress.unforwardedRequests++;
      if (
        this.protocolProgress.unforwardedRequests >
        this.protocolProgress.requests
      )
        throw codexError('codex_protocol_invalid', 502);
      await observer({ ...this.protocolProgress });
    });
    this.protocolTail = work.catch(() => {
      this.fail(codexError('codex_protocol_invalid', 502));
      void this.close().catch(() => undefined);
    });
    return work;
  }
  private receive(message: Record<string, unknown>) {
    if (typeof message.method === 'string') {
      if ('id' in message) {
        if (this.chatToolChannel) {
          this.receiveChatRequest(message);
          return;
        }
        // OCR owns no interactive tools, permissions or dynamic tool outputs.
        this.send({
          id: message.id,
          error: {
            code: -32601,
            message: 'Tools disabled for invoice extraction',
          },
        });
        this.emit('toolRejected');
      } else this.emit('notification', message.method, message.params);
      return;
    }
    if (typeof message.id !== 'number')
      throw codexError('codex_protocol_invalid');
    const p = this.pending.get(message.id);
    if (!p) return;
    this.pending.delete(message.id);
    clearTimeout(p.timer);
    if ('error' in message) p.reject(codexError('codex_runtime_unavailable'));
    else if ('result' in message) p.resolve(message.result);
    else p.reject(codexError('codex_protocol_invalid', 502));
  }
  /**
   * Caller must own the physical profile lease and bind an exact thread/turn.
   * initialize's capability alone never opens this channel. OCR never calls it.
   */
  openChatToolChannel(channel: CodexChatToolChannel): () => void {
    if (this.closed || !this.experimentalChatApi || this.chatToolChannel)
      throw codexError('codex_runtime_unavailable');
    this.chatToolChannel = channel;
    return () => {
      if (this.chatToolChannel !== channel) return;
      this.chatToolChannel = undefined;
      channel.close();
    };
  }
  private receiveChatRequest(message: Record<string, unknown>): void {
    const channel = this.chatToolChannel!;
    const id = message.id;
    if (
      !(
        (typeof id === 'string' &&
          id.length > 0 &&
          Buffer.byteLength(id) <= 128) ||
        (typeof id === 'number' && Number.isSafeInteger(id))
      ) ||
      this.pendingChatRequests.size >= 32 ||
      this.pendingChatRequests.has(id)
    ) {
      // A duplicate in-flight RPC ID cannot receive two contradictory replies.
      this.protocolOverflow = true;
      this.chatToolChannel?.close();
      const close = () => {
        this.fail(codexError('codex_protocol_invalid', 502));
        void this.close().catch(() => undefined);
      };
      if (this.protocolObserver)
        void this.recordUnforwardedRequest()
          .finally(close)
          .catch(() => undefined);
      else close();
      return;
    }
    this.pendingChatRequests.add(id);
    void Promise.resolve()
      .then(() => channel.handle(String(message.method), message.params, id))
      .then((reply) => {
        if (this.closed || this.chatToolChannel !== channel) return;
        this.send({ id, ...reply });
        if ('error' in reply) this.emit('toolRejected');
      })
      .catch(() => {
        if (this.closed || this.chatToolChannel !== channel) return;
        try {
          this.send({
            id,
            error: { code: -32603, message: 'Tool request failed' },
          });
        } catch {
          this.fail(codexError('codex_protocol_invalid', 502));
        }
      })
      .finally(() => this.pendingChatRequests.delete(id));
  }
  private send(value: unknown) {
    if (this.closed || !this.child.stdin.writable)
      throw codexError('codex_runtime_unavailable');
    this.child.stdin.write(JSON.stringify(value) + '\n');
  }
  request(
    method: string,
    params: unknown = {},
    timeoutMs = 15000,
  ): Promise<unknown> {
    if (this.closed || this.pending.size >= 32)
      return Promise.reject(codexError('codex_runtime_unavailable'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(codexError('codex_timeout', 504));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  async initialize(options?: { experimentalChatApi?: boolean }) {
    await this.request('initialize', {
      clientInfo: { name: 'nodia', title: 'Nodia', version: '0.0.1' },
      ...(options?.experimentalChatApi === true
        ? { capabilities: { experimentalApi: true } }
        : {}),
    });
    this.send({ method: 'initialized', params: {} });
    const config = codexObject(
      codexObject(await this.request('config/read', { includeLayers: false }))
        .config,
    );
    const features = codexObject(config.features);
    const provider = codexObject(
      codexObject(config.model_providers)[CODEX_PROVIDER],
    );
    if (
      config.cli_auth_credentials_store !== 'keyring' ||
      config.web_search !== 'disabled' ||
      Object.keys(CODEX_SETTINGS.features as object).some(
        (key) => features[key] !== false,
      ) ||
      config.model_provider !== CODEX_PROVIDER ||
      provider.request_max_retries !== 0 ||
      provider.stream_max_retries !== 0 ||
      provider.supports_websockets !== false ||
      provider.requires_openai_auth !== true ||
      provider.base_url != null ||
      Object.keys(codexObject(config.mcp_servers ?? {})).length > 0
    ) {
      throw codexError('codex_runtime_unavailable');
    }
    this.experimentalChatApi = options?.experimentalChatApi === true;
  }
  private fail(error: unknown = codexError('codex_runtime_unavailable')) {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.memoryTimer);
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
    this.chatToolChannel?.close();
    this.chatToolChannel = undefined;
    this.pendingChatRequests.clear();
    this.emit('closed');
  }
  async close() {
    this.fail();
    if (process.platform === 'linux' && this.child.pid) {
      const identity = await this.processIdentity;
      if (identity) await stopCodexGroup(identity);
      else await assertCodexGroupEmpty(this.child.pid);
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          this.exited,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(codexError('codex_login_unknown', 409)),
              5000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      return;
    }
    const signal = (name: NodeJS.Signals) => {
      try {
        if (process.platform !== 'win32' && this.child.pid)
          process.kill(-this.child.pid, name);
        else this.child.kill(name);
      } catch {
        /* Process already exited. */
      }
    };
    signal('SIGTERM');
    const timer = setTimeout(() => signal('SIGKILL'), 2000);
    try {
      await this.exited;
    } finally {
      clearTimeout(timer);
    }
  }
}

function toml(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return `{ ${Object.entries(value)
      .map(([key, v]) => `${JSON.stringify(key)} = ${toml(v)}`)
      .join(', ')} }`;
  return JSON.stringify(value);
}
