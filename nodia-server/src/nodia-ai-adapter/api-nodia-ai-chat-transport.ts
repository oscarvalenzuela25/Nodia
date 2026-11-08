import {
  NodiaAiAdapterError,
  isNodiaAiMcpToolDescriptorValid,
  nodiaAiMcpCatalogUtf8Bytes,
  NODIA_AI_MCP_CATALOG_LIMITS,
  type NodiaAiAdapterRequest,
  type NodiaAiAdapterToolCall,
  type NodiaAiAdapterTool,
} from './types/nodia-ai-adapter.types.js';
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import {
  apiObject,
  type NodiaAiApiProvider,
} from './api-nodia-ai-credentials.service.js';
import {
  initialApiHistory,
  parseApiGeneratedImage,
  API_GENERATED_IMAGE_RESPONSE_BYTES,
} from './api-nodia-ai-media.js';

const fail = (code: string): never => {
  throw new NodiaAiAdapterError(code, 'unknown');
};
const utf8 = (text: string) => Buffer.byteLength(text, 'utf8');
export function apiJsonBounded(
  value: unknown,
  maxBytes: number,
  policy: NodiaAiRuntimePolicy,
): string {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return fail('api_json_invalid');
  }
  if (typeof encoded !== 'string' || utf8(encoded) > maxBytes)
    return fail('api_payload_limit');
  const stack = [{ value, depth: 0 }];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.depth > policy.results.json_depth)
      return fail('api_json_limit');
    if (typeof current.value === 'number' && !Number.isFinite(current.value))
      return fail('api_json_invalid');
    if (current.value !== null && typeof current.value === 'object') {
      const entries = Array.isArray(current.value)
        ? current.value
        : Object.values(current.value);
      if (entries.length > policy.results.json_collection_items)
        return fail('api_json_limit');
      for (const item of entries)
        stack.push({ value: item, depth: current.depth + 1 });
    } else if (
      !['string', 'number', 'boolean'].includes(typeof current.value) &&
      current.value !== null
    )
      return fail('api_json_invalid');
  }
  return encoded;
}

export function validateApiPayload(
  request: {
    canonicalPrompt: string;
    tools?: NodiaAiAdapterRequest['tools'];
    attachments?: readonly unknown[];
    imageGeneration?: NodiaAiAdapterRequest['imageGeneration'];
  },
  policy: NodiaAiRuntimePolicy,
): void {
  if (
    request.imageGeneration &&
    (typeof request.imageGeneration.prompt !== 'string' ||
      !request.imageGeneration.prompt.trim() ||
      utf8(request.imageGeneration.prompt) >
        policy.results.assembled_context_utf8_bytes ||
      request.attachments?.length ||
      request.tools?.length)
  )
    throw new NodiaAiAdapterError('adapter_invalid_request', 'not_dispatched');
  if (
    typeof request.canonicalPrompt !== 'string' ||
    !request.canonicalPrompt.trim() ||
    utf8(request.canonicalPrompt) > policy.results.assembled_context_utf8_bytes
  )
    throw new NodiaAiAdapterError('adapter_invalid_request', 'not_dispatched');
  const tools = request.tools ?? [];
  if (
    !Array.isArray(tools) ||
    tools.length > NODIA_AI_MCP_CATALOG_LIMITS.tools ||
    new Set(tools.map((tool) => tool.name)).size !== tools.length ||
    tools.some(
      (tool) =>
        !apiObject(tool) ||
        !apiObject(tool.inputSchema) ||
        !isNodiaAiMcpToolDescriptorValid(tool),
    ) ||
    nodiaAiMcpCatalogUtf8Bytes(tools) > NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes
  )
    throw new NodiaAiAdapterError('mcp_catalog_invalid', 'not_dispatched');
}

/** The whole response is streamed under a byte ceiling before parsing. No upstream error text escapes. */
async function apiPost(
  provider: NodiaAiApiProvider,
  model: string,
  secret: string,
  body: unknown,
  policy: NodiaAiRuntimePolicy,
  signal: AbortSignal,
  beforeExchange: () => Promise<void>,
  imageGeneration = false,
  attachments = false,
): Promise<Record<string, unknown>> {
  const payload = JSON.stringify(body);
  const requestLimit = attachments
    ? 4 * Math.ceil(policy.admission.message_files_bytes / 3) +
      policy.results.provider_stream_bytes
    : policy.results.provider_stream_bytes;
  if (utf8(payload) > requestLimit) return fail('api_payload_limit');
  signal.throwIfAborted();
  await beforeExchange();
  signal.throwIfAborted();
  const url =
    provider === 'openai'
      ? imageGeneration
        ? 'https://api.openai.com/v1/images/generations'
        : 'https://api.openai.com/v1/responses'
      : 'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model.replace(/^models\//, '')) +
        ':generateContent';
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(provider === 'openai'
        ? { Authorization: 'Bearer ' + secret }
        : { 'x-goog-api-key': secret }),
    },
    body: payload,
  });
  if (!response.ok) {
    await response.body?.cancel();
    return fail(
      response.status === 429
        ? 'api_provider_rate_limited'
        : response.status === 401 || response.status === 403
          ? 'api_provider_credential_rejected'
          : 'api_provider_rejected',
    );
  }
  const reader = response.body?.getReader();
  if (!reader) return fail('api_response_invalid');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (
        bytes >
        (imageGeneration
          ? API_GENERATED_IMAGE_RESPONSE_BYTES
          : policy.results.provider_stream_bytes)
      )
        return fail('api_response_limit');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  let result: unknown;
  try {
    result = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    );
  } catch {
    return fail('api_response_invalid');
  }
  const record = apiObject(result);
  if (!record) return fail('api_response_invalid');
  return record;
}

function call(
  callId: unknown,
  name: unknown,
  args: unknown,
  policy: NodiaAiRuntimePolicy,
): NodiaAiAdapterToolCall {
  if (
    typeof callId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(callId) ||
    typeof name !== 'string' ||
    !/^[a-z][a-z0-9_]{0,63}$/.test(name) ||
    !apiObject(args)
  )
    return fail('mcp_call_invalid');
  apiJsonBounded(args, policy.results.tool_arguments_utf8_bytes, policy);
  return { callId, name, arguments: args };
}
interface ApiParsedStep {
  text: string;
  calls: NodiaAiAdapterToolCall[];
  history: Record<string, unknown>[];
}
/** Wire projection only; the original Server schema/grant/hash remains unchanged.
 * Google FunctionDeclaration permits omitting parameters for a parameterless
 * function: https://googleapis.github.io/js-genai/release_docs/interfaces/types.FunctionDeclaration.html
 * Other constraints/compositions are deliberately not guessed to be empty. */
export function isExplicitApiZeroArgumentSchema(
  schema: Record<string, unknown>,
): boolean {
  const properties = apiObject(schema.properties);
  return (
    schema.type === 'object' &&
    schema.additionalProperties === false &&
    properties !== null &&
    Object.keys(properties).length === 0 &&
    (!Object.hasOwn(schema, 'required') ||
      (Array.isArray(schema.required) && schema.required.length === 0)) &&
    Object.keys(schema).every((key) =>
      ['type', 'additionalProperties', 'properties', 'required'].includes(key),
    )
  );
}
export function apiChatBody(
  provider: NodiaAiApiProvider,
  request: NodiaAiAdapterRequest,
  history: Record<string, unknown>[],
): Record<string, unknown> {
  const tools = request.tools ?? [];
  const effort = request.selection.effort_id;
  return provider === 'openai'
    ? {
        model: request.selection.model_id,
        store: false,
        include: ['reasoning.encrypted_content'],
        input: history,
        tools: tools.map((tool) => ({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: false,
        })),
        parallel_tool_calls: false,
        ...(effort === null ? {} : { reasoning: { effort } }),
      }
    : {
        contents: history,
        ...(tools.length
          ? {
              tools: [
                {
                  functionDeclarations: tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    ...(isExplicitApiZeroArgumentSchema(tool.inputSchema)
                      ? {}
                      : { parametersJsonSchema: tool.inputSchema }),
                  })),
                },
              ],
              toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
            }
          : {}),
        ...(effort === null
          ? {}
          : {
              generationConfig: {
                thinkingConfig: { thinkingLevel: effort.toUpperCase() },
              },
            }),
      };
}
export function parseOpenAiStep(
  response: Record<string, unknown>,
  policy: NodiaAiRuntimePolicy,
): ApiParsedStep {
  if (
    response.status !== 'completed' ||
    response.error != null ||
    response.incomplete_details != null ||
    !Array.isArray(response.output) ||
    response.output.length < 1 ||
    response.output.length > policy.results.json_collection_items
  )
    return fail('api_response_incomplete');
  const calls: NodiaAiAdapterToolCall[] = [];
  const texts: string[] = [];
  const history: Record<string, unknown>[] = [];
  for (const raw of response.output) {
    const item = apiObject(raw);
    if (!item) return fail('api_response_invalid');
    if (item.type === 'function_call') {
      if (
        typeof item.arguments !== 'string' ||
        utf8(item.arguments) > policy.results.tool_arguments_utf8_bytes
      )
        return fail('mcp_call_invalid');
      let args: unknown;
      try {
        args = JSON.parse(item.arguments);
      } catch {
        return fail('mcp_call_invalid');
      }
      calls.push(call(item.call_id, item.name, args, policy));
    } else if (item.type === 'message') {
      if (
        item.role !== 'assistant' ||
        !Array.isArray(item.content) ||
        item.content.length > policy.results.json_collection_items
      )
        return fail('api_response_invalid');
      for (const rawPart of item.content) {
        const part = apiObject(rawPart);
        if (part?.type !== 'output_text' || typeof part.text !== 'string')
          return fail('api_response_invalid');
        texts.push(part.text);
      }
    } else if (item.type !== 'reasoning') return fail('api_response_invalid');
    // All output items, including encrypted reasoning, remain byte-for-value intact in this turn.
    history.push(item);
  }
  return { text: texts.join(''), calls, history };
}
export function parseGeminiStep(
  response: Record<string, unknown>,
  policy: NodiaAiRuntimePolicy,
  exchange: number,
  tools?: readonly NodiaAiAdapterTool[],
): ApiParsedStep {
  if (!Array.isArray(response.candidates) || response.candidates.length !== 1)
    return fail('api_response_invalid');
  const candidate = apiObject(response.candidates[0]);
  const content = apiObject(candidate?.content);
  if (
    candidate?.finishReason !== 'STOP' ||
    content?.role !== 'model' ||
    !Array.isArray(content.parts) ||
    content.parts.length < 1 ||
    content.parts.length > policy.results.json_collection_items
  )
    return fail('api_response_incomplete');
  const calls: NodiaAiAdapterToolCall[] = [];
  const texts: string[] = [];
  for (const [index, rawPart] of content.parts.entries()) {
    const part = apiObject(rawPart);
    if (!part) return fail('api_response_invalid');
    if (part.functionCall !== undefined) {
      const fn = apiObject(part.functionCall);
      if (!fn) return fail('mcp_call_invalid');
      const descriptor = tools?.find((tool) => tool.name === fn.name);
      const zeroArgument =
        descriptor !== undefined &&
        isExplicitApiZeroArgumentSchema(descriptor.inputSchema);
      const args = !Object.hasOwn(fn, 'args') && zeroArgument ? {} : fn.args;
      const argumentObject = apiObject(args);
      // An absent proto Struct is {} only for an explicitly closed zero-arg
      // function. Null/arrays/unknown fields or missing required keys are errors.
      if (
        !argumentObject ||
        (zeroArgument && Object.keys(argumentObject).length !== 0) ||
        (descriptor &&
          Array.isArray(descriptor.inputSchema.required) &&
          descriptor.inputSchema.required.some(
            (key) =>
              typeof key !== 'string' || !Object.hasOwn(argumentObject, key),
          ))
      )
        return fail('mcp_call_invalid');
      calls.push(
        call(fn.id ?? `api_call_${exchange}_${index}`, fn.name, args, policy),
      );
    } else if (typeof part.text === 'string') {
      if (part.thought !== true) texts.push(part.text);
    } else return fail('api_response_invalid');
  }
  // Keep the entire model Content. Never reconstruct or move thoughtSignature parts.
  return { text: texts.join(''), calls, history: [content] };
}

function selectionAck(
  call: NodiaAiAdapterToolCall,
  result: Record<string, unknown>,
): boolean {
  const args = apiObject(call.arguments);
  if (
    call.name !== 'nodia_capabilities_select' ||
    !args ||
    Object.keys(args).sort().join(',') !== 'capability_ids,catalog_version' ||
    typeof args.catalog_version !== 'string' ||
    !Array.isArray(args.capability_ids) ||
    args.capability_ids.length < 1 ||
    !args.capability_ids.every(
      (id) => typeof id === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(id),
    ) ||
    new Set(args.capability_ids).size !== args.capability_ids.length ||
    Object.keys(result).sort().join(',') !==
      'business_effects,next_action,selected_capability_ids,status' ||
    result.status !== 'selection_requested' ||
    result.business_effects !== false ||
    result.next_action !== 'finish_current_generation' ||
    !Array.isArray(result.selected_capability_ids)
  )
    return false;
  return (
    JSON.stringify([...args.capability_ids].sort()) ===
    JSON.stringify([...result.selected_capability_ids].sort())
  );
}

/** A persisted OCR request hands ownership to the common worker after planner ACK.
 * Its final narrative would be discarded, so do not spend another POST on it.
 * This is only a transport stop: ProcessNodiaAiStage rechecks the durable request
 * bound to this attempt before scheduling OCR. It never confirms a write.
 */
function invoiceOcrHandoff(
  request: NodiaAiAdapterRequest,
  call: NodiaAiAdapterToolCall,
  result: Record<string, unknown>,
): boolean {
  const uuid = (value: unknown) =>
    typeof value === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value,
    );
  const args = apiObject(call.arguments),
    selection = apiObject(result.selection),
    source = apiObject(result.source);
  if (
    call.name !== 'nodia_invoices_ocr' ||
    !args ||
    args.action !== 'request' ||
    Object.keys(args).sort().join(',') !== 'action,analysis_id,provider_id' ||
    !uuid(args.analysis_id) ||
    typeof args.provider_id !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(args.provider_id) ||
    BigInt(args.provider_id) > 9223372036854775807n ||
    Object.keys(result).sort().join(',') !==
      'analysis_id,attachment_id,business_id,compare_prices,comparison_observed_at,provider_id,request_id,review_required,selection,source,status' ||
    result.status !== 'requested' ||
    result.analysis_id !== args.analysis_id ||
    result.provider_id !== args.provider_id ||
    !uuid(result.request_id) ||
    !uuid(result.business_id) ||
    !uuid(result.attachment_id) ||
    result.review_required !== true ||
    typeof result.compare_prices !== 'boolean' ||
    result.comparison_observed_at !== null ||
    !selection ||
    Object.keys(selection).sort().join(',') !==
      'connection_id,effort_id,mode,model_id' ||
    selection.mode !== 'api_key' ||
    selection.mode !== request.selection.mode ||
    selection.connection_id !== request.selection.connection_id ||
    selection.model_id !== request.selection.model_id ||
    selection.effort_id !== request.selection.effort_id ||
    !source ||
    Object.keys(source).sort().join(',') !==
      'attachment_id,byte_count,kind,media_type' ||
    source.attachment_id !== result.attachment_id ||
    !Number.isSafeInteger(source.byte_count) ||
    Number(source.byte_count) < 1 ||
    Number(source.byte_count) > 10485760 ||
    (source.kind === 'pdf'
      ? source.media_type !== 'application/pdf'
      : source.kind !== 'image' ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(
          String(source.media_type),
        ))
  )
    return false;
  return true;
}

/** Function-calling only. No hosted tools, automatic SDK execution, provider fallback or retries. */
export async function executeApiChat(input: {
  provider: NodiaAiApiProvider;
  secret: string;
  request: NodiaAiAdapterRequest;
  policy: NodiaAiRuntimePolicy;
  signal: AbortSignal;
  beforeExchange: () => Promise<void>;
}): Promise<string> {
  const { provider, request, policy, signal } = input;
  const tools = request.tools ?? [];
  const seen = new Set<string>();
  let totalCalls = 0;
  let history: Record<string, unknown>[] = initialApiHistory(provider, request);
  try {
    for (
      let exchange = 0;
      exchange < policy.budget.provider_dispatches_per_run;
      exchange++
    ) {
      signal.throwIfAborted();
      await request.onLeaseCheck!(signal);
      const body = apiChatBody(provider, request, history);
      const response = await apiPost(
        provider,
        request.selection.model_id,
        input.secret,
        body,
        policy,
        signal,
        input.beforeExchange,
        false,
        !!request.attachments?.length,
      );
      signal.throwIfAborted();
      const parsed =
        provider === 'openai'
          ? parseOpenAiStep(response, policy)
          : parseGeminiStep(response, policy, exchange, tools);
      if (utf8(parsed.text) > policy.results.assistant_text_utf8_bytes)
        return fail('api_response_limit');
      if (!parsed.calls.length) {
        if (!parsed.text.trim()) return fail('api_response_invalid');
        await request.onProtocolProgress!(exchange + 1, signal, 0);
        await request.onLeaseCheck!(signal);
        return parsed.text;
      }
      if (
        !request.onToolCall ||
        parsed.calls.length + totalCalls > policy.budget.tool_calls_per_run
      ) {
        await request.onProtocolProgress!(
          exchange + 1,
          signal,
          parsed.calls.length,
        );
        return fail('api_tool_budget_exhausted');
      }
      // Validate the complete batch before forwarding even its first callback.
      for (const next of parsed.calls) {
        if (
          seen.has(next.callId) ||
          !tools.some((tool) => tool.name === next.name)
        ) {
          await request.onProtocolProgress!(
            exchange + 1,
            signal,
            parsed.calls.length,
          );
          return fail('mcp_call_invalid');
        }
        seen.add(next.callId);
      }
      await request.onProtocolProgress!(exchange + 1, signal, 0);
      history.push(...parsed.history);
      const results: Record<string, unknown>[] = [];
      for (const [index, next] of parsed.calls.entries()) {
        signal.throwIfAborted();
        await request.onLeaseCheck!(signal);
        totalCalls++;
        const requested = structuredClone(next);
        const result = await request.onToolCall(structuredClone(next), signal);
        signal.throwIfAborted();
        const encoded = apiJsonBounded(
          result,
          policy.results.tool_result_utf8_bytes,
          policy,
        );
        if (selectionAck(requested, result)) return '';
        // Never leave another callback in the current provider batch unprocessed.
        if (
          parsed.calls.length === 1 &&
          invoiceOcrHandoff(request, requested, result)
        )
          return '';
        if (provider === 'openai')
          results.push({
            type: 'function_call_output',
            call_id: next.callId,
            output: encoded,
          });
        else {
          const fn = apiObject(
            (parsed.history[0].parts as unknown[])
              .map(apiObject)
              .filter((part) => part?.functionCall !== undefined)[index]
              ?.functionCall,
          );
          results.push({
            functionResponse: {
              name: next.name,
              ...(typeof fn?.id === 'string' ? { id: fn.id } : {}),
              response: result,
            },
          });
        }
      }
      history.push(
        ...(provider === 'openai'
          ? results
          : [{ role: 'user', parts: results }]),
      );
    }
    return fail('api_exchange_budget_exhausted');
  } finally {
    history.length = 0;
    input.secret = '';
  }
}

/** Separate explicit owner-command lane; never registered as a hosted chat tool. */
export async function executeApiImage(
  input: Parameters<typeof executeApiChat>[0],
) {
  const { request, provider, signal, policy } = input;
  if (
    !request.imageGeneration ||
    request.attachments?.length ||
    request.tools?.length
  )
    throw new NodiaAiAdapterError('adapter_invalid_request', 'not_dispatched');
  if (provider === 'openai' && request.selection.effort_id !== null)
    throw new NodiaAiAdapterError(
      'api_image_effort_unsupported',
      'not_dispatched',
    );
  await request.onLeaseCheck!(signal);
  signal.throwIfAborted();
  const body =
    provider === 'openai'
      ? {
          model: request.selection.model_id,
          prompt: request.imageGeneration.prompt,
          n: 1,
        }
      : {
          contents: [
            { role: 'user', parts: [{ text: request.imageGeneration.prompt }] },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(request.selection.effort_id === null
              ? {}
              : {
                  thinkingConfig: {
                    thinkingLevel: request.selection.effort_id.toUpperCase(),
                  },
                }),
          },
        };
  const response = await apiPost(
    provider,
    request.selection.model_id,
    input.secret,
    body,
    policy,
    signal,
    input.beforeExchange,
    true,
  );
  signal.throwIfAborted();
  const parsed = parseApiGeneratedImage(provider, response);
  if (utf8(parsed.text) > policy.results.assistant_text_utf8_bytes)
    return fail('api_response_limit');
  await request.onLeaseCheck!(signal);
  return parsed;
}
