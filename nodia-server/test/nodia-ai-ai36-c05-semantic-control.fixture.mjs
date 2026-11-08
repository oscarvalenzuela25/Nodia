// Explicit SQL acceptance-driver control. Only adapter/terminal proofs are fake;
// the production publication, selection, gateway, preparers and writers execute.
// This fixture neither reads operational configuration nor contacts a provider.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
export const syntheticOriginal = Object.freeze({
  id: '2',
  updated_at: new Date('2026-10-19T00:00:00Z'),
  model_id: 'synthetic-c05-semantic-control',
  effort_id: null,
  mode_fields: Object.freeze({
    selected_model: 'synthetic-c05-semantic-control',
  }),
});

export function createC05SemanticControl({
  db,
  report,
  save,
  getActiveTurn,
  getRegistry,
}) {
  const completed = new Map();
  report.synthetic_provider_transport = true;
  report.synthetic_proof_transport = true;
  report.real_provider_requests = 0;
  report.synthetic_adapter_generations = 0;
  const proofs = {
    async acknowledge(proof) {
      const original = completed.get(proof.attemptId);
      assert.ok(
        original,
        'Synthetic ACK requires this fixture completed attempt',
      );
      assert.equal(original.terminalProofId, proof.terminalProofId);
      if (
        !report.native_terminal_ACKs.some(
          (item) => item.attempt_id === proof.attemptId,
        )
      ) {
        report.native_terminal_ACKs.push({
          attempt_id: proof.attemptId,
          terminal_proof_sha256: hash(proof.terminalProofId),
          acknowledged_at_utc: new Date().toISOString(),
          synthetic_fixture_only: true,
        });
        save();
      }
    },
    async reconcile(request) {
      const proof = completed.get(request.attemptId);
      assert.ok(
        proof,
        'No synthetic completion may be inferred for an unfinished attempt',
      );
      for (const key of [
        'engine',
        'resourceKey',
        'sessionGeneration',
        'operationRef',
      ]) {
        assert.equal(
          proof[key],
          request[key],
          'Synthetic proof must retain exact attempt identity',
        );
      }
      return proof;
    },
  };
  const adapter = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe(selection) {
      assert.equal(selection.mode, 'agentic');
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey: 'gemini-profile:' + 'b'.repeat(64),
        configurationGeneration: 'c'.repeat(64),
        sessionGeneration: 'd'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        reason: null,
      };
    },
    async verifyConfiguration(_selection, generation) {
      assert.equal(generation, 'c'.repeat(64));
    },
    async execute(request, signal) {
      assert.equal(signal?.aborted ?? false, false);
      assert.equal(request.selection.mode, 'agentic');
      const turn = getActiveTurn();
      assert.ok(turn?.run_id && Array.isArray(turn.required_tools));
      const [run] = await db.query(
        'SELECT conversation_id,context_manifest FROM nodia_ai_runs WHERE id=$1',
        [turn.run_id],
      );
      assert.ok(run);
      const phase = run.context_manifest.tool_selection.phase;
      assert.ok(['discovery', 'execution'].includes(phase));
      const call = async (name, args) => {
        assert.equal(signal?.aborted ?? false, false);
        assert.ok(
          request.tools.some((tool) => tool.name === name),
          'Use only this generation frozen tools',
        );
        return request.onToolCall(
          { callId: randomUUID(), name, arguments: args },
          signal,
        );
      };
      if (phase === 'discovery') {
        const registry = getRegistry();
        const visible = registry.list([
          '/nodia-ai',
          '/finances-personal',
        ]);
        const capabilityIds = turn.required_tools.map((name) => {
          const tool = visible.find((item) => item.toolName === name);
          assert.ok(
            tool,
            'Synthetic driver must select a registered published capability',
          );
          return tool.capabilityId;
        });
        const selected = await call('nodia_capabilities_select', {
          catalog_version: registry.catalogVersion,
          capability_ids: capabilityIds,
        });
        assert.equal(selected.status, 'selection_requested');
        assert.equal(selected.business_effects, false);
      } else {
        const [category] = await db.query(
          "SELECT id::text FROM finance_categories WHERE user_id=1 AND key='ai36_c05_food'",
        );
        assert.ok(category);
        const finance = async (amount, name) => {
          const result = await call('nodia_finance_movements_prepare_create', {
            partial: {
              owner_id: '1',
              name,
              amount,
              type: 'expense',
              status: 'paid',
              category_id: category.id,
            },
          });
          assert.equal(result.status, 'ready');
          return result;
        };
        if (turn.label === 'independent_finance') {
          await finance('23450', 'Synthetic C05 lunch');
        } else if (turn.label === 'independent_reads') {
          const [execution] = await db.query(
            "SELECT id FROM nodia_ai_executions WHERE conversation_id=$1 AND state='completed' ORDER BY created_at,id LIMIT 1",
            [run.conversation_id],
          );
          const [attachment] = await db.query(
            "SELECT id FROM nodia_ai_attachments WHERE conversation_id=$1 AND state='ready' ORDER BY created_at,id LIMIT 1",
            [run.conversation_id],
          );
          assert.ok(execution && attachment);
          await call('nodia_operations_get', { execution_id: execution.id });
          await call('nodia_attachments_describe', {
            attachment_id: attachment.id,
          });
        } else if (turn.label === 'independent_preferences') {
          const prepared = await call('nodia_preferences_prepare', {
            operation: 'create',
            partial: {
              scope_key: 'finance',
              scope: {},
              key: 'expense_category_id',
              value: category.id,
            },
          });
          assert.equal(prepared.status, 'ready');
          await call('nodia_preferences_list', {});
        } else if (turn.label === 'independent_workflow') {
          const drafts = await db.query(
            "SELECT id,tool_name FROM nodia_ai_drafts WHERE conversation_id=$1 AND state='ready' ORDER BY created_at,id",
            [run.conversation_id],
          );
          const memory = drafts.find(
            (draft) => draft.tool_name === 'nodia_preferences_prepare_create',
          );
          const financeDraft = drafts.find(
            (draft) =>
              draft.tool_name === 'nodia_finance_movements_prepare_create',
          );
          assert.ok(memory && financeDraft);
          const workflow = await call('nodia_workflows_prepare', {
            catalog_version: 'nodia-ai-ai23-workflow/1',
            draft_ids: [memory.id, financeDraft.id],
          });
          assert.equal(workflow.status, 'ready');
        } else {
          assert.fail('Unknown synthetic semantic-control turn');
        }
      }
      const proof = {
        engine: 'agentic',
        attemptId: request.attemptId,
        resourceKey: request.resourceKey,
        sessionGeneration: request.sessionGeneration,
        operationRef: request.attemptId,
        terminalProofId: randomUUID(),
        processClosed: true,
        outcome: 'completed',
        observedAt: new Date(),
      };
      assert.equal(
        completed.has(request.attemptId),
        false,
        'Synthetic transport never repeats a generation',
      );
      completed.set(request.attemptId, proof);
      report.synthetic_adapter_generations++;
      save();
      return {
        kind: 'answer',
        text: 'Synthetic SQL semantic-driver control completed.',
        terminalProof: proof,
      };
    },
  };
  return { adapter, proofs };
}
