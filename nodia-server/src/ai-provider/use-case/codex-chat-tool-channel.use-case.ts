import type {
  CodexChatServerReply,
  CodexChatToolChannel,
  CodexServerRequestId,
} from '../../common/ai/codex/codex-chat-tool-channel.js';
import { codexError } from '../../common/ai/codex/codex-contract.js';

export interface CodexChatToolCall {
  callId: string;
  name: string;
  arguments: unknown;
}
export interface CodexChatToolChannelOptions {
  readonly threadId: string;
  readonly turnId: string;
  readonly toolNames: readonly string[];
  readonly deadlineAt: Date;
  readonly signal: AbortSignal;
  readonly limits: {
    readonly requests: number;
    readonly toolCalls: number;
    readonly argumentUtf8Bytes: number;
    readonly resultUtf8Bytes: number;
    readonly jsonDepth: number;
    readonly collectionItems: number;
  };
  /** Must check the caller's actual profile lease and durable fence. */
  readonly assertLease: (signal: AbortSignal) => Promise<void>;
  /**
   * Must persist the admitted request budget before dispatch, including rejects.
   * Transport overflow revokes locally; a caller's RPC observer counts all frames.
   */
  readonly beforeRequest: (count: number, signal: AbortSignal) => Promise<void>;
  /** Charge rejected/duplicate tool requests once, without going through the gateway. */
  readonly onUnforwardedRequest?: (signal: AbortSignal) => Promise<void>;
  /** The authorized NodiaAI gateway, never a SQL/shell callback. */
  readonly onToolCall: (
    call: CodexChatToolCall,
    signal: AbortSignal,
  ) => Promise<unknown>;
}

const rejected = (): CodexChatServerReply => ({
  error: { code: -32600, message: 'NodiaAI tool request rejected' },
});
const failed = (): CodexChatServerReply => ({
  error: { code: -32603, message: 'NodiaAI tool request failed' },
});
const validIdentity = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  Buffer.byteLength(value, 'utf8') <= 256 &&
  !Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/** Resource policy for one exact turn; it never grants tools or releases a slot. */
export class CodexChatToolChannelUseCase {
  execute(options: CodexChatToolChannelOptions): CodexChatToolChannel {
    const limitKeys = [
      'requests',
      'toolCalls',
      'argumentUtf8Bytes',
      'resultUtf8Bytes',
      'jsonDepth',
      'collectionItems',
    ] as const;
    if (
      !record(options.limits) ||
      Object.keys(options.limits).length !== limitKeys.length ||
      limitKeys.some(
        (key) =>
          !Object.hasOwn(options.limits, key) ||
          !Number.isSafeInteger(options.limits[key]) ||
          options.limits[key] < 1,
      )
    )
      throw codexError('codex_protocol_invalid', 502);
    const limits = { ...options.limits };
    if (
      !validIdentity(options.threadId) ||
      !validIdentity(options.turnId) ||
      !Number.isFinite(options.deadlineAt.getTime()) ||
      options.deadlineAt.getTime() <= Date.now() ||
      Object.values(limits).some(
        (value) => !Number.isSafeInteger(value) || value < 1,
      ) ||
      limits.requests > 4096 ||
      limits.toolCalls > limits.requests ||
      limits.argumentUtf8Bytes > 2 * 1024 * 1024 ||
      limits.resultUtf8Bytes > 2 * 1024 * 1024 - 1024 ||
      limits.jsonDepth > 128 ||
      limits.collectionItems > 100000 ||
      options.toolNames.length > 4096 ||
      new Set(options.toolNames).size !== options.toolNames.length ||
      options.toolNames.some((name) => !/^[a-z][a-z0-9_]{0,63}$/.test(name))
    )
      throw codexError('codex_protocol_invalid', 502);
    const threadId = options.threadId;
    const turnId = options.turnId;
    const deadline = options.deadlineAt.getTime();
    const names = new Set(options.toolNames);
    const controller = new AbortController();
    let requests = 0;
    let toolCalls = 0;
    let pending = 0;
    let tail: Promise<void> = Promise.resolve();
    const seen = new Set<string>();
    let timer: NodeJS.Timeout | undefined;
    const close = () => {
      if (controller.signal.aborted) return;
      controller.abort(codexError('codex_cancelled', 499));
      clearTimeout(timer);
      options.signal.removeEventListener('abort', close);
    };
    options.signal.addEventListener('abort', close, { once: true });
    if (options.signal.aborted) close();
    else
      timer = setTimeout(
        close,
        Math.min(2147483647, deadline - Date.now()),
      ).unref();

    const serialize = (value: unknown, ceiling: number): string => {
      let bytes = 0;
      const charge = (text: string) => {
        bytes += Buffer.byteLength(text, 'utf8');
        if (bytes > ceiling) throw codexError('codex_protocol_invalid', 502);
      };
      const walk = (entry: unknown, depth: number): void => {
        if (depth > limits.jsonDepth)
          throw codexError('codex_protocol_invalid', 502);
        if (typeof entry === 'string') {
          if (Buffer.byteLength(entry, 'utf8') > ceiling)
            throw codexError('codex_protocol_invalid', 502);
          charge(JSON.stringify(entry));
          return;
        }
        if (
          entry === null ||
          typeof entry === 'boolean' ||
          (typeof entry === 'number' && Number.isFinite(entry))
        ) {
          charge(JSON.stringify(entry));
          return;
        }
        if (Array.isArray(entry)) {
          if (entry.length > limits.collectionItems)
            throw codexError('codex_protocol_invalid', 502);
          charge('[]' + ','.repeat(Math.max(0, entry.length - 1)));
          for (let index = 0; index < entry.length; index++) {
            const descriptor = Object.getOwnPropertyDescriptor(
              entry,
              String(index),
            );
            if (!descriptor || !Object.hasOwn(descriptor, 'value'))
              throw codexError('codex_protocol_invalid', 502);
            walk(descriptor.value as unknown, depth + 1);
          }
          return;
        }
        if (!record(entry)) throw codexError('codex_protocol_invalid', 502);
        const keys = Object.keys(entry);
        if (keys.length > limits.collectionItems)
          throw codexError('codex_protocol_invalid', 502);
        charge('{}');
        let count = 0;
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(entry, key);
          if (
            !descriptor ||
            !Object.hasOwn(descriptor, 'value') ||
            Buffer.byteLength(key, 'utf8') > ceiling
          )
            throw codexError('codex_protocol_invalid', 502);
          charge(JSON.stringify(key) + ':' + (count++ ? ',' : ''));
          walk(descriptor.value as unknown, depth + 1);
        }
      };
      walk(value, 1);
      const text = JSON.stringify(value);
      if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > ceiling)
        throw codexError('codex_protocol_invalid', 502);
      return text;
    };
    const alive = () => {
      controller.signal.throwIfAborted();
      if (Date.now() >= deadline) {
        close();
        controller.signal.throwIfAborted();
      }
    };
    const guarded = async <T>(work: Promise<T>): Promise<T> => {
      controller.signal.throwIfAborted();
      let abort: (() => void) | undefined;
      try {
        return await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            abort = () => reject(controller.signal.reason);
            controller.signal.addEventListener('abort', abort, { once: true });
            if (controller.signal.aborted) abort();
          }),
        ]);
      } finally {
        if (abort) controller.signal.removeEventListener('abort', abort);
      }
    };

    return {
      close,
      handle: async (
        method: string,
        params: unknown,
        _requestId: CodexServerRequestId,
      ) => {
        if (controller.signal.aborted) return rejected();
        const ordinal = ++requests;
        if (ordinal > limits.requests || pending >= 32) {
          close();
          return rejected();
        }
        // Parse/copy before queueing, so later mutations cannot change dispatch.
        let parsed: CodexChatToolCall | undefined;
        try {
          if (
            method !== 'item/tool/call' ||
            !record(params) ||
            Object.keys(params).some(
              (key) =>
                ![
                  'arguments',
                  'callId',
                  'namespace',
                  'threadId',
                  'tool',
                  'turnId',
                ].includes(key),
            ) ||
            params.threadId !== threadId ||
            params.turnId !== turnId ||
            (params.namespace !== undefined && params.namespace !== null) ||
            !validIdentity(params.callId) ||
            typeof params.tool !== 'string' ||
            !names.has(params.tool) ||
            !record(params.arguments) ||
            seen.has(params.callId)
          )
            throw codexError('codex_protocol_invalid', 502);
          const argumentText = serialize(
            params.arguments,
            limits.argumentUtf8Bytes,
          );
          seen.add(params.callId);
          parsed = {
            callId: params.callId,
            name: params.tool,
            arguments: JSON.parse(argumentText) as unknown,
          };
        } catch {
          parsed = undefined;
        }
        pending++;
        const work = tail.then(async (): Promise<CodexChatServerReply> => {
          try {
            alive();
            await guarded(options.assertLease(controller.signal));
            alive();
            await guarded(options.beforeRequest(ordinal, controller.signal));
            alive();
            if (!parsed || toolCalls >= limits.toolCalls) {
              if (options.onUnforwardedRequest) {
                await guarded(options.onUnforwardedRequest(controller.signal));
                alive();
              }
              return rejected();
            }
            await guarded(options.assertLease(controller.signal));
            alive();
            toolCalls++;
            const value = await guarded(
              options.onToolCall(parsed, controller.signal),
            );
            alive();
            await guarded(options.assertLease(controller.signal));
            alive();
            if (!record(value)) return rejected();
            const text = serialize(value, limits.resultUtf8Bytes);
            // The JSON string is escaped once more inside the native frame.
            const reply: CodexChatServerReply = {
              result: {
                contentItems: [{ type: 'inputText', text }],
                success: true,
              },
            };
            if (
              Buffer.byteLength(JSON.stringify(reply), 'utf8') >
              2 * 1024 * 1024 - 1024
            )
              return rejected();
            return reply;
          } catch {
            close();
            return failed();
          }
        });
        tail = work.then(
          () => undefined,
          () => undefined,
        );
        try {
          return await guarded(work);
        } catch {
          return failed();
        } finally {
          pending--;
        }
      },
    };
  }
}
