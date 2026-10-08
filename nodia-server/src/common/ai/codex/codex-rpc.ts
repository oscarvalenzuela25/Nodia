import {
  type ChildProcessWithoutNullStreams,
  spawn,
  execFile,
} from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { EventEmitter } from 'node:events';
import {
  CODEX_SETTINGS,
  CODEX_PROVIDER,
  codexError,
  codexObject,
} from './codex-contract.js';

const MAX_FRAME = 2 * 1024 * 1024;
type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: NodeJS.Timeout;
};

/** One versioned JSONL connection. No stderr/payload is ever logged or returned. */
export class CodexRpc extends EventEmitter {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, Pending>();
  private readonly decoder = new StringDecoder('utf8');
  private buffer = '';
  private nextId = 0;
  private closed = false;
  get ownedPid() {
    return this.child.pid ?? null;
  }
  get alive() {
    return !this.closed;
  }
  private readonly exited: Promise<void>;
  private readonly memoryTimer: NodeJS.Timeout;
  private measuring = false;
  constructor(executable: string, cwd: string, profile: string, home: string) {
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
    this.child = spawn(executable, args, {
      cwd,
      shell: false,
      detached: process.platform !== 'win32',
      env: {
        CODEX_HOME: profile,
        HOME: home,
        PATH: '/usr/bin:/bin',
        LANG: 'en_US.UTF-8',
        ...(process.platform === 'win32' && process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
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
            void this.close();
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
          if (Buffer.byteLength(this.buffer.slice(0, newline)) > MAX_FRAME)
            throw codexError('codex_protocol_invalid');
          const raw = this.buffer.slice(0, newline);
          this.buffer = this.buffer.slice(newline + 1);
          if (raw.trim()) this.receive(codexObject(JSON.parse(raw)));
        }
        if (Buffer.byteLength(this.buffer) > MAX_FRAME)
          throw codexError('codex_protocol_invalid');
      } catch {
        this.fail(codexError('codex_protocol_invalid', 502));
        void this.close();
      }
    });
  }
  private receive(message: Record<string, unknown>) {
    if (typeof message.method === 'string') {
      if ('id' in message) {
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
  async initialize() {
    await this.request('initialize', {
      clientInfo: { name: 'nodia', title: 'Nodia', version: '0.0.1' },
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
    this.emit('closed');
  }
  async close() {
    this.fail();
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
