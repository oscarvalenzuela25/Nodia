// Synthetic PostgreSQL only. Uses the original C01 compiled pipeline and HTTP
// fixture, never a provider account, configured database or production button.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';

export async function runDomainWriteVariants({
  db,
  category,
  receipt,
  runScenario,
  call,
  humanConfirm,
  http,
  count,
  check,
}) {
  const movementId = receipt.minimal_receipt.resource_id;
  assert.match(movementId, /^[1-9][0-9]*$/u);
  const movement = async () =>
    (
      await db.query(
        'SELECT id::text,user_id::text,category_id::text,obligation_id::text,name,amount::text,type,status,is_active FROM finance_movements WHERE id=$1',
        [movementId],
      )
    )[0];
  const original = await movement();
  assert.equal(original.category_id, category.id);
  const oneReceipt = async (executionId, resource, operation, id) => {
    const rows = await db.query(
      'SELECT state,minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1',
      [executionId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, 'completed');
    const value = rows[0].minimal_receipt;
    assert.equal(value.resource_key, resource);
    assert.equal(value.operation, operation);
    assert.equal(value.resource_id, id);
    assert.equal(value.subject_user_id, '1');
    return value;
  };
  let update;
  await runScenario(async (request) => {
    update = await call(request, 'nodia_finance_movements_prepare_update', {
      partial: { id: movementId, name: 'Synthetic changed through MCP' },
    });
    assert.equal(update.status, 'ready');
    const changes = update.proposal.steps[0].changes;
    check(
      'C05 update preview contains the explicit new name and preserves the domain before fixture human confirmation',
      changes.some(
        (c) =>
          c.field_key === 'name' &&
          c.before === original.name &&
          c.after === 'Synthetic changed through MCP',
      ) && isDeepStrictEqual(await movement(), original),
    );
  });
  const updateExecution = await humanConfirm(update.proposal),
    updated = await movement();
  await oneReceipt(updateExecution, 'finance_movements', 'update', movementId);
  check(
    'C05 native update changes only the reviewed ordinary field with one atomic receipt',
    updated.name === 'Synthetic changed through MCP' &&
      isDeepStrictEqual({ ...updated, name: original.name }, original),
  );

  let deletion;
  await runScenario(async (request) => {
    const before = await count('nodia_ai_proposals');
    await assert.rejects(
      call(request, 'nodia_finance_categories_prepare_delete', {
        partial: { id: category.id },
      }),
      /finance:category_has_movements/u,
    );
    check(
      'C05 physical category deletion is denied while a movement references it without a proposal or partial effect',
      (await count('finance_categories', 'id=$1', [category.id])) === 1 &&
        (await count('nodia_ai_proposals')) === before &&
        isDeepStrictEqual(await movement(), updated),
    );
    const args = { partial: { id: movementId } },
      callId = randomUUID();
    deletion = await call(
      request,
      'nodia_finance_movements_prepare_delete',
      args,
      callId,
    );
    const replay = await call(
      request,
      'nodia_finance_movements_prepare_delete',
      args,
      callId,
    );
    check(
      'C05 delete preparation replay returns one exact reviewed proposal and never deletes the target',
      deletion.status === 'ready' &&
        isDeepStrictEqual(replay, deletion) &&
        (await count('finance_movements', 'id=$1', [movementId])) === 1 &&
        (await count('nodia_ai_proposals', 'id=$1', [
          deletion.proposal.proposal_id,
        ])) === 1,
    );
  });
  const deletionExecution = await humanConfirm(deletion.proposal);
  const deletionReceipt = await oneReceipt(
    deletionExecution,
    'finance_movements',
    'delete',
    movementId,
  );
  const executionBefore = await count('nodia_ai_executions'),
    stepsBefore = await count('nodia_ai_execution_steps');
  const historicalProposal = await http(
    `/proposals/${deletion.proposal.proposal_id}`,
  );
  const historicalOperation = await http(`/operations/${deletionExecution}`);
  check(
    'C05 confirmed deletion physically removes only the reviewed movement and retains an authorized historical receipt',
    (await count('finance_movements', 'id=$1', [movementId])) === 0 &&
      (await count('finance_categories', 'id=$1', [category.id])) === 1 &&
      historicalProposal.state === 'confirmed' &&
      historicalOperation.state === 'completed' &&
      historicalOperation.steps.length === 1 &&
      historicalOperation.steps[0].result_refs.some(
        (ref) => ref.id === movementId,
      ),
  );
  await http(`/operations/${deletionExecution}`);
  check(
    'C05 reading the deleted target receipt twice neither recreates the target nor reexecutes the effect',
    (await count('nodia_ai_executions')) === executionBefore &&
      (await count('nodia_ai_execution_steps')) === stepsBefore &&
      (await count('finance_movements', 'id=$1', [movementId])) === 0 &&
      deletionReceipt.resource_id === movementId,
  );

  let categoryDeletion;
  await runScenario(async (request) => {
    categoryDeletion = await call(
      request,
      'nodia_finance_categories_prepare_delete',
      { partial: { id: category.id } },
    );
    check(
      'C05 category delete becomes a reviewable proposal only after its actual domain reference is gone',
      categoryDeletion.status === 'ready' &&
        (await count('finance_categories', 'id=$1', [category.id])) === 1,
    );
  });
  const categoryExecution = await humanConfirm(categoryDeletion.proposal);
  await oneReceipt(
    categoryExecution,
    'finance_categories',
    'delete',
    category.id,
  );
  check(
    'C05 category physical deletion and exact receipt commit after a separate fixture human confirmation',
    (await count('finance_categories', 'id=$1', [category.id])) === 0 &&
      (await count('providers')) === 1,
  );
}
