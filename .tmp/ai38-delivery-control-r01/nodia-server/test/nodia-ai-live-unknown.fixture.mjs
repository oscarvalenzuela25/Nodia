// Explicit live cancellation diagnostic. All SQL records belong to the disposable fixture.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const boundedSettlement = async (operation, milliseconds) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(operation).then(
        () => ({ settled: true }),
        () => ({ settled: true }),
      ),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Live diagnostic transport did not settle after cancellation')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** Requires a successful explicit MCP probe of this exact selection before entry. */
export async function runUnknownMatrix({
  db, module, adapter, concrete, stage, create, admit, identity, operator,
  modeSelection, reserveGeneration, check, worker,
}) {
  assert.strictEqual(adapter, concrete, 'The production adapter port must use the concrete instance');
  assert.ok(operator?.userId && operator?.sessionId, 'An authenticated synthetic super_admin is required');
  const { ReconcileNodiaAiRuntimeUseCase } = await import(
    '../dist/nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case.js'
  );
  const { NodiaAiRuntimeReconciliationPort } = await import(
    '../dist/nodia-ai-runtime/types/reconciliation.types.js'
  );
  const reconcile = module.get(ReconcileNodiaAiRuntimeUseCase);
  const native = module.get(NodiaAiRuntimeReconciliationPort);
  const originalExecute = concrete.execute;
  const ownDescriptor = Object.getOwnPropertyDescriptor(concrete, 'execute');
  const controller = new AbortController();
  let inFlight;
  let jobId;
  let runId;
  let dispatchCount = 0;
  let callbackCount = 0;
  let terminalProof;
  let resolved = false;
  let primaryError;
  let cleanupError;
  const selection = modeSelection('token_plan_agentic');
  try {
    const observed = await adapter.observe(selection);
    check('unknown diagnostic requires exact verified MCP selection',
      observed.available && observed.supportsMcp && Boolean(observed.resourceKey));
    const chat = await create.execute(identity, {
      client_request_id: randomUUID(), selection,
    });
    const accepted = await admit.execute(identity, chat.conversation_id, {
      client_message_id: randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [{
        kind: 'text',
        text: 'Prueba técnica de cancelación: llama nodia_knowledge_index con {} antes de responder. No ejecutes otras acciones ni inventes fichas.',
      }],
    });
    runId = accepted.run.run_id;
    const [initial] = await db.query(
      'SELECT id,stage_key FROM nodia_ai_jobs WHERE run_id=$1 AND kind=$2', [runId, 'turn'],
    );
    assert.equal(initial?.stage_key, 'context');
    jobId = initial.id;
    assert.equal(await stage.execute(worker, AbortSignal.timeout(150000)), true);
    const [contextualized] = await db.query(
      'SELECT state,stage_key FROM nodia_ai_jobs WHERE id=$1', [jobId],
    );
    assert.equal(contextualized?.state, 'ready');
    assert.equal(contextualized.stage_key, 'inference');

    concrete.execute = function (request, signal) {
      dispatchCount++;
      assert.equal(dispatchCount, 1, 'Unknown diagnostic must never dispatch again');
      assert.ok(request.tools?.length && request.onToolCall, 'The real MCP transport is required');
      const originalCallback = request.onToolCall;
      inFlight = originalExecute.call(this, {
        ...request,
        async onToolCall(call, callbackSignal) {
          callbackCount++;
          assert.equal(callbackCount, 1, 'Cancel at the first real MCP callback');
          assert.equal(call.name, 'nodia_knowledge_index');
          assert.deepEqual(call.arguments, {});
          // Exercise the actual grant/fence checkpoint, then stop before sending its result to CLI.
          await originalCallback(call, callbackSignal);
          controller.abort(new Error('Synthetic diagnostic cancellation at MCP callback barrier'));
          throw new Error('Synthetic diagnostic callback cancelled before result delivery');
        },
      }, signal);
      return inFlight;
    };
    reserveGeneration();
    assert.equal(await stage.execute(worker, controller.signal), true);
    assert.ok(inFlight, 'The real adapter dispatch must have started');
    await boundedSettlement(inFlight, 20000);
    check('real MCP callback cancellation is observed before any result delivery',
      callbackCount === 1 && controller.signal.aborted);
    const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [runId]);
    const [job] = await db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1', [jobId]);
    const attempts = await db.query(
      'SELECT * FROM nodia_ai_job_attempts WHERE job_id=$1 AND external_operation_ref IS NOT NULL', [jobId],
    );
    const [slot] = await db.query(
      'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1', [observed.resourceKey],
    );
    check('cancelled live dispatch preserves SQL unknown without a fabricated answer',
      run?.state === 'unknown' && run.assistant_message_id === null &&
      job?.state === 'unknown' && attempts.length === 1 && attempts[0].phase === 'unknown');
    check('cancelled live dispatch quarantines the exact shared SQL slot',
      slot?.state === 'unknown' && slot.job_id === jobId &&
      slot.external_operation_ref === attempts[0].id);
    const attempt = attempts[0];
    check('unknown jobs are not replayed by another worker claim',
      (await stage.execute(worker, AbortSignal.timeout(5000))) === false && dispatchCount === 1);
    terminalProof = await native.reconcile({
      engine: 'agentic', attemptId: attempt.id, resourceKey: observed.resourceKey,
      sessionGeneration: observed.sessionGeneration, operationRef: attempt.external_operation_ref,
    }, AbortSignal.timeout(20000));
    check('native cancellation proves the exact CLI process closed without replay',
      terminalProof.attemptId === attempt.id && terminalProof.processClosed === true &&
      terminalProof.outcome === 'abandoned_unknown');
    const result = await reconcile.execute(operator, jobId);
    resolved = result.resolved === true && result.cleanup_pending === false;
    check('operator reconciliation commits and acknowledges the real native proof', resolved);
    const [after] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [runId]);
    const [released] = await db.query(
      'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1', [observed.resourceKey],
    );
    const [{ count }] = await db.query(
      'SELECT count(*)::text AS count FROM nodia_ai_jobs WHERE id=$1', [jobId],
    );
    check('reconciliation releases capacity and removes its minimal receipt delivery job',
      after?.state === 'failed' && after.assistant_message_id === null &&
      released?.state === 'free' && released.job_id === null && count === '0');
    const liveAfter = await adapter.observe(selection);
    check('native profile is reusable after verified reconciliation without inference replay',
      liveAfter.available && liveAfter.resourceKey === observed.resourceKey && dispatchCount === 1);
  } catch (error) {
    primaryError = error;
  } finally {
    controller.abort(new Error('Live diagnostic final cleanup'));
    if (inFlight) {
      try { await boundedSettlement(inFlight, 20000); } catch (error) { cleanupError = error; }
    }
    if (ownDescriptor) Object.defineProperty(concrete, 'execute', ownDescriptor);
    else delete concrete.execute;
    // Leave the shared account reusable even when a diagnostic assertion fails.
    if (jobId && !resolved) {
      try {
        const [pending] = await db.query('SELECT state,kind FROM nodia_ai_jobs WHERE id=$1', [jobId]);
        if (pending?.state === 'unknown' || pending?.kind === 'reconcile') {
          const result = await reconcile.execute(operator, jobId);
          if (result.cleanup_pending) throw new Error('Native proof acknowledgement remains pending');
        }
      } catch (error) { cleanupError = error; }
    }
  }
  if (primaryError && cleanupError)
    throw new AggregateError([primaryError, cleanupError], 'Live unknown diagnostic failed and native reconciliation needs operator attention');
  if (cleanupError) throw cleanupError;
  if (primaryError) throw primaryError;
  return {
    real_mcp_callback_cancellation: true,
    callbackCount, dispatchCount,
    terminalOutcome: terminalProof.outcome,
    nativeProofAcknowledged: resolved,
    configuredBusinessDatabaseModified: false,
  };
}
