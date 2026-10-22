// Explicit external-adapter metadata for synthetic integration providers only.
// The byte ceiling belongs to this fixture, not to a discovered real model.
// Runtime still performs its real budget, compaction and dispatch admission.
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
export async function measureSyntheticNodiaAiContext(request) {
  const diagnostic = process.env.NODIA_AI_TEST_CONTEXT_DIAGNOSTIC;
  if (diagnostic) {
    const destination = resolve(diagnostic);
    if (!destination.startsWith(resolve('.tmp') + sep)) throw Error('Synthetic diagnostic must stay inside fixture .tmp');
    if (!existsSync(destination)) writeFileSync(destination, JSON.stringify({ selection: request.selection, canonical_prompt: request.canonicalPrompt, tools: (request.tools ?? []).map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })) }), { flag: 'wx', mode: 0o600 });
  }
  const canonicalUtf8Bytes = Buffer.byteLength(request.canonicalPrompt, 'utf8');
  const tools = (request.tools ?? []).map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }));
  // This fictional adapter uses compact JSON. Count its actual catalog and
  // first JSON-RPC listing envelope instead of assuming two extra catalogs.
  // The native Python serializer is measured independently in AI-36 evidence.
  const catalogUtf8Bytes = tools.length ? Buffer.byteLength(JSON.stringify(tools), 'utf8') : 0;
  const overheadUtf8Bytes = 1000;
  const firstMcpListingUpperBoundUtf8Bytes = tools.length
    ? Buffer.byteLength(JSON.stringify({ jsonrpc: '2.0', id: '\0'.repeat(512), result: { tools } }) + '\n', 'utf8')
    : 0;
  return {
    measurementContractVersion: 'nodia-ai-context-budget/1',
    measurementScope: 'initial_native_prompt',
    measurementKind: 'upper_bound',
    canonicalUtf8Bytes,
    catalogUtf8Bytes,
    overheadUtf8Bytes,
    totalUtf8Bytes: canonicalUtf8Bytes + catalogUtf8Bytes + overheadUtf8Bytes,
    firstMcpListingUpperBoundUtf8Bytes,
    maxUtf8Bytes: 262144,
    modelContextTokens: null,
  };
}
