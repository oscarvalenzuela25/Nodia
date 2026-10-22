// Four explicit, independent acceptance scenarios. This is test orchestration;
// native preparation never counts as a provider callback or tool publication.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export const C05_CASE_TOOLS = Object.freeze({
  reads: ['nodia_operations_get', 'nodia_attachments_describe'],
  preferences: ['nodia_preferences_prepare', 'nodia_preferences_list'],
  finance: ['nodia_finance_movements_prepare_create'],
  workflow: ['nodia_workflows_prepare'],
});

export async function runC05IndependentCase({ caseId, db, compiled, Prepare, identity, chat, category,
  turn, humanConfirm, http, semantic, check, report, save }) {
  assert.ok(Object.hasOwn(C05_CASE_TOOLS, caseId));
  const count = async table => Number((await db.query(`SELECT count(*)::int n FROM ${table}`))[0].n);
  const expectedMemory = { scope_key: 'finance', scope: {}, key: 'expense_category_id', value: category.id };
  const financePartial = (amount, name) => ({ owner_id: '1', name, amount, type: 'expense', status: 'paid', category_id: category.id });
  const bootstrap = async (toolName, partial) => {
    const prepared = await db.transaction(manager => compiled.get(Prepare).execute(manager, identity,
      { conversationId: chat.conversation_id, toolName, partial }));
    assert.equal(prepared.status, 'ready'); assert.ok(prepared.draft_id && prepared.proposal);
    const [draft] = await db.query('SELECT revision FROM nodia_ai_drafts WHERE id=$1', [prepared.draft_id]);
    assert.ok(Number.isSafeInteger(draft?.revision) && draft.revision > 0);
    report.bootstrap_preparations ??= [];
    report.bootstrap_preparations.push({ tool_name: toolName, draft_id: prepared.draft_id,
      draft_revision: draft.revision, proposal_id: prepared.proposal.proposal_id,
      proposal_revision: prepared.proposal.revision, proposal_hash: prepared.proposal.hash,
      method: 'native_preparer_authority_transaction_not_MCP', provider_callback: false,
      capability_acceptance: false }); save();
    return prepared;
  };
  const memoryFixture = () => bootstrap('nodia_preferences_prepare_create', expectedMemory);
  const metadataFixture = async () => {
    const attachment = randomUUID(), generation = randomUUID();
    await db.query(`INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,expires_at)
      VALUES($1,$2,$3,$4,'1','image','ready','synthetic-c05-metadata-only.png',$5,$6,128,128,'image/png',$7,clock_timestamp()+interval '89 days')`,
    [attachment, chat.conversation_id, randomUUID(), 'd'.repeat(64), `nodia-ai/${chat.conversation_id}/${attachment}/${generation}`, generation, 'e'.repeat(64)]);
    return attachment;
  };
  const preparedResult = (receipts, name) => {
    const prepared = receipts.find(item => item.tool_name === name && item.public_result.status === 'ready')?.public_result;
    assert.ok(prepared?.proposal); return prepared;
  };
  const exactMemoryDraft = async prepared => {
    const [draft] = await db.query('SELECT revision,partial_command FROM nodia_ai_drafts WHERE id=$1 AND conversation_id=$2 AND actor_id=1', [prepared.draft_id, chat.conversation_id]);
    assert.equal(draft.partial_command.schema_version, 1);
    assert.deepEqual(Object.keys(draft.partial_command).sort(), ['id', 'key', 'schema_version', 'scope', 'scope_key', 'value']);
    assert.match(draft.partial_command.id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    const fields = Object.fromEntries(['scope_key', 'scope', 'key', 'value'].map(key => [key, draft.partial_command[key]]));
    semantic('nodia_preferences_prepare', 'preference_draft_exact', { revision: prepared.draft_revision, partial: expectedMemory }, { revision: draft.revision, partial: fields });
  };
  const exactFinanceDraft = async prepared => {
    const [draft] = await db.query('SELECT partial_command FROM nodia_ai_drafts WHERE id=$1', [prepared.draft_id]);
    const template = draft.partial_command;
    assert.equal(template.schema_version, 1);
    assert.deepEqual(Object.keys(template).sort(), ['command', 'origins', 'owner_id', 'schema_version']);
    assert.deepEqual(Object.keys(template.origins).sort(), Object.keys(template.command).sort());
    assert.ok(Object.values(template.origins).every(origin => ['user', 'contract_default'].includes(origin)));
    const fields = { owner_id: template.owner_id, ...Object.fromEntries(['name', 'amount', 'type', 'status', 'category_id'].map(key => [key, template.command[key]])) };
    semantic('nodia_finance_movements_prepare_create', 'finance_preview_exact', financePartial('23450', 'Synthetic C05 lunch'), fields);
  };
  const receiptProjection = row => ({ state: row.state, resource_key: row.minimal_receipt?.resource_key, resource_id: row.minimal_receipt?.resource_id });
  let receipts;
  if (caseId === 'reads') {
    const memory = await memoryFixture();
    const execution = await humanConfirm(memory.proposal, 'bootstrap_fixture_not_capability_acceptance');
    const attachment = await metadataFixture();
    assert.equal(await count('finance_movements'), 0);
    receipts = await turn('independent_reads',
      `Consulta nodia_operations_get para execution_id ${execution}. Consulta sólo los metadatos del adjunto ${attachment} con nodia_attachments_describe: es una fila sintética sin bytes ni documento. Informa ambas lecturas; no prepares ni confirmes cambios.`, C05_CASE_TOOLS.reads);
    const operation = receipts.find(item => item.tool_name === 'nodia_operations_get')?.public_result;
    semantic('nodia_operations_get', 'operation_exact_execution_completed',
      { execution_id: execution, state: 'completed', step_count: 1, completed_with_refs: true },
      { execution_id: operation?.execution_id, state: operation?.state, step_count: operation?.steps?.length,
        completed_with_refs: operation?.steps?.every(step => step.state === 'completed' && step.result_refs.length > 0) });
    semantic('nodia_attachments_describe', 'attachment_exact_closed_metadata',
      { attachment_id: attachment, kind: 'image', state: 'ready', media_type: 'image/png', byte_count: 128, page_count: null, duration_seconds: null },
      receipts.find(item => item.tool_name === 'nodia_attachments_describe')?.public_result);
    check('read callbacks preserve the native bootstrap and create no finance effects', await count('finance_movements') === 0 && await count('nodia_ai_preferences') === 1);
  } else if (caseId === 'preferences') {
    receipts = await turn('independent_preferences',
      `Propón recordar mi categoría de gastos ${category.id} mediante nodia_preferences_prepare operation create, scope_key finance, scope {}, key expense_category_id, value ${category.id}. Después consulta nodia_preferences_list para comprobar que todavía no está aceptada. No aceptes ni confirmes cambios.`, C05_CASE_TOOLS.preferences);
    const memory = preparedResult(receipts, 'nodia_preferences_prepare');
    await exactMemoryDraft(memory);
    semantic('nodia_preferences_prepare', 'preference_unaccepted_before_confirmation', 0, await count('nodia_ai_preferences'));
    semantic('nodia_preferences_list', 'preferences_excludes_unaccepted', { items: [], next_cursor: null },
      receipts.find(item => item.tool_name === 'nodia_preferences_list')?.public_result);
    assert.equal(await count('finance_movements'), 0);
    const execution = await humanConfirm(memory.proposal);
    const [preference] = await db.query('SELECT id,owner_id::text,scope_key,scope,key,value FROM nodia_ai_preferences');
    const { id, ...fields } = preference;
    semantic('nodia_preferences_prepare', 'preference_exact_effect_once_after_confirmation',
      { count: 1, preference: { owner_id: '1', ...expectedMemory } }, { count: await count('nodia_ai_preferences'), preference: fields });
    const rows = await db.query('SELECT state,minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position', [execution]);
    assert.equal(rows.length, 1);
    semantic('nodia_preferences_prepare', 'preference_atomic_receipt',
      { state: 'completed', resource_key: 'nodia_ai_preferences', resource_id: id }, receiptProjection(rows[0]));
  } else if (caseId === 'finance') {
    receipts = await turn('independent_finance',
      `Prepara un gasto pagado de 23450 pesos para mi usuario, nombre «Synthetic C05 lunch», categoría existente ${category.id}, sin obligación asociada. Usa nodia_finance_movements_prepare_create. Muestra la propuesta exacta y no confirmes ni ejecutes cambios.`, C05_CASE_TOOLS.finance);
    const prepared = preparedResult(receipts, 'nodia_finance_movements_prepare_create');
    await exactFinanceDraft(prepared);
    semantic('nodia_finance_movements_prepare_create', 'finance_no_effect_before_confirmation', 0, await count('finance_movements'));
    const proposalRead = await http('/proposals/' + prepared.proposal.proposal_id);
    const identityFields = proposal => ({ proposal_id: proposal.proposal_id, revision: proposal.revision, hash: proposal.hash });
    assert.deepEqual(identityFields(proposalRead), identityFields(prepared.proposal));
    report.native_HTTP_checks = [{ id: 'proposal_exact_revision_hash', passed: true,
      expected: identityFields(prepared.proposal), observed: identityFields(proposalRead),
      provider_callback: false, MCP_capability_acceptance: false }]; save();
    const execution = await humanConfirm(prepared.proposal);
    const [movement] = await db.query('SELECT id::text,name,amount::text,type,status,category_id::text FROM finance_movements');
    const { id, ...fields } = movement;
    semantic('nodia_finance_movements_prepare_create', 'finance_exact_effect_once_after_confirmation',
      { count: 1, name: 'Synthetic C05 lunch', amount: '23450', type: 'expense', status: 'paid', category_id: category.id }, { count: await count('finance_movements'), ...fields });
    const rows = await db.query('SELECT state,minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1', [execution]);
    semantic('nodia_finance_movements_prepare_create', 'finance_atomic_receipt',
      [{ state: 'completed', resource_key: 'finance_movements', resource_id: id }], rows.map(receiptProjection));
    assert.equal(await count('nodia_ai_preferences'), 0);
  } else {
    const memory = await memoryFixture();
    const finance = await bootstrap('nodia_finance_movements_prepare_create', financePartial('1234', 'Synthetic C05 workflow snack'));
    assert.equal(await count('finance_movements'), 0); assert.equal(await count('nodia_ai_preferences'), 0);
    receipts = await turn('independent_workflow',
      `Usa nodia_workflows_prepare con catalog_version nodia-ai-ai23-workflow/1 para combinar, en este orden, los borradores propios ya preparados ${memory.draft_id} y ${finance.draft_id}, sin bindings. Muestra la propuesta combinada; no confirmes ni ejecutes cambios.`, C05_CASE_TOOLS.workflow);
    const workflow = preparedResult(receipts, 'nodia_workflows_prepare').proposal;
    const comparable = step => Object.fromEntries(['tool_name', 'kind', 'target', 'scope', 'changes', 'effect_key', 'output_bindings'].map(key => [key, step[key]]));
    semantic('nodia_workflows_prepare', 'workflow_exact_ordered_steps',
      [memory.proposal.steps[0], finance.proposal.steps[0]].map(comparable), workflow.steps.map(comparable));
    semantic('nodia_workflows_prepare', 'workflow_no_effect_before_confirmation', { preferences: 0, movements: 0 },
      { preferences: await count('nodia_ai_preferences'), movements: await count('finance_movements') });
    const execution = await humanConfirm(workflow);
    const [preference] = await db.query('SELECT id,owner_id::text,scope_key,scope,key,value FROM nodia_ai_preferences');
    const [movement] = await db.query('SELECT id::text,name,amount::text,type,status,category_id::text FROM finance_movements');
    const { id: preferenceId, ...preferenceFields } = preference, { id: movementId, ...movementFields } = movement;
    semantic('nodia_workflows_prepare', 'workflow_exact_effects_once_after_confirmation',
      { preference: { owner_id: '1', ...expectedMemory }, expense: { name: 'Synthetic C05 workflow snack', amount: '1234', type: 'expense', status: 'paid', category_id: category.id }, total_preferences: 1, total_movements: 1 },
      { preference: preferenceFields, expense: movementFields, total_preferences: await count('nodia_ai_preferences'), total_movements: await count('finance_movements') });
    const rows = await db.query('SELECT tool_name,state,minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position', [execution]);
    assert.deepEqual(rows.map(row => row.tool_name), workflow.steps.map(step => step.tool_name));
    semantic('nodia_workflows_prepare', 'workflow_native_step_receipts',
      [{ state: 'completed', resource_key: 'nodia_ai_preferences', resource_id: preferenceId }, { state: 'completed', resource_key: 'finance_movements', resource_id: movementId }], rows.map(receiptProjection));
  }
  for (const receipt of receipts) {
    if (receipt.tool_name === 'nodia_capabilities_select') continue;
    const recovered = await http('/tool-calls/' + receipt.id + '/result');
    assert.deepEqual(recovered, receipt.public_result, 'Confirmed effects cannot change an already completed tool receipt');
  }
  check('case domain receipts recover after confirmation without replay');
  const callbacks = report.turns.flatMap(item => item.generations.flatMap(generation => generation.callbacks))
    .filter(callback => callback.kind === 'capability');
  assert.deepEqual(callbacks.map(callback => callback.name).sort(), [...C05_CASE_TOOLS[caseId]].sort(),
    'Each independent case completes only its one or two requested business callbacks, once');
  check('only this independent case requested acceptance callbacks', C05_CASE_TOOLS[caseId].every(name => report.per_capability[name].successful_callbacks === 1));
  report.independent_case_completed = true; save();
}
