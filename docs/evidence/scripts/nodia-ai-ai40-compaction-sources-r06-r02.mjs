// Operator-only synthetic history. Importing this module performs no I/O or inference.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const COMPACTION_SOURCE_BYTES = 26 * 1024;
export const COMPACTION_FIRST_REQUEST = 'Responde exclusivamente con el codigo de continuidad que te pedi recordar al inicio. No agregues explicaciones, no uses herramientas ni consultes datos externos.';
export const COMPACTION_REUSE_REQUEST = 'Responde exclusivamente con el nombre de la casa de prueba que mencione en la conversacion anterior. No agregues explicaciones, no uses herramientas ni consultes datos externos.';
export const COMPACTION_EXPECTED_HOUSE = 'Refugio Faro';
const filler = ' Texto sintetico de relleno sin instrucciones ni datos de negocio reales.';
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** Guard the actual queue contract, not the run's display phase alone. No stage is executed here. */
export function assertCompactionTurnStage(run, job, chatId, runId, dispatchLimit, compactions) {
  assert.equal(run.id, runId); assert.equal(run.conversation_id, chatId); assert.equal(run.state, 'queued');
  assert.ok(job); assert.equal(job.kind, 'turn'); assert.equal(job.state, 'ready');
  assert.equal(job.conversation_id, chatId); assert.equal(job.run_id, runId); assert.equal(job.lease_owner, null);
  assert.ok(['context', 'inference'].includes(job.stage_key), 'Only the source context and its direct inference are authorized');
  assert.ok(Number.isSafeInteger(run.provider_dispatches_used) && run.provider_dispatches_used >= 0 && run.provider_dispatches_used < dispatchLimit);
  assert.equal(run.tool_calls_used, 0);
  if (job.stage_key === 'context') {
    // Admission is queued; a known pre-dispatch retry may retain display phase context.
    assert.ok(['queued', 'context'].includes(run.phase));
    assert.equal(run.provider_dispatches_used, 0); assert.equal(run.compactions_used, 0);
  } else {
    assert.equal(run.phase, 'inference'); assert.equal(run.compactions_used, compactions);
    assert.equal(run.provider_dispatches_used, compactions, 'No previous answer may be replayed');
  }
  return job.stage_key;
}

export function compactionSources(code) {
  assert.match(code, /^[A-F0-9]{32}$/u);
  const facts = [
    `El codigo de continuidad que debes recordar es ${code}.`,
    `La casa de prueba se llama ${COMPACTION_EXPECTED_HOUSE}.`,
    'La moneda de prueba es CLP.',
    'El proveedor de prueba se llama Mercado Prueba.',
    'La categoria de prueba es Alimentacion.',
    'La fecha de referencia de prueba es 2026-10-23.',
  ];
  return facts.map((fact, index) => {
    const text = (fact + filler.repeat(Math.ceil(COMPACTION_SOURCE_BYTES / filler.length)))
      .slice(0, COMPACTION_SOURCE_BYTES);
    assert.equal(Buffer.byteLength(text), COMPACTION_SOURCE_BYTES);
    return { seq: String(index + 1), role: 'user', scope: { schema_version: 1, module_routes: ['/tools/nodia-ai'] },
      parts: [{ kind: 'text', text }] };
  });
}

export function verifyCompactionSources(history, code, policy) {
  assert.equal(history.length, 6);
  assert.equal(COMPACTION_FIRST_REQUEST.includes(code), false);
  assert.equal(COMPACTION_REUSE_REQUEST.includes(code), false);
  assert.equal(history.filter(item => JSON.stringify(item).includes(code)).length, 1);
  for (const [index, item] of history.entries()) {
    assert.equal(item.seq, String(index + 1)); assert.equal(item.role, 'user');
    assert.equal(item.parts.length, 1); assert.equal(item.parts[0].kind, 'text');
    assert.equal(Buffer.byteLength(item.parts[0].text), COMPACTION_SOURCE_BYTES);
    assert.ok(Buffer.byteLength(item.parts[0].text) <= policy.admission.message_text_utf8_bytes);
  }
  const textBytes = history.reduce((sum, item) => sum + Buffer.byteLength(item.parts[0].text), 0);
  const historyBytes = Buffer.byteLength(JSON.stringify(history));
  const threshold = policy.results.assembled_context_utf8_bytes / 2;
  const loadWindow = Math.floor(policy.results.assembled_context_utf8_bytes * 3 / 4);
  assert.equal(textBytes, 159744);
  assert.ok(historyBytes >= threshold && historyBytes < loadWindow);
  assert.ok(policy.budget.compactions_per_run >= 1);
  assert.ok(policy.budget.provider_dispatches_per_run >= 2);
  return { source_messages: 6, source_text_utf8_bytes: textBytes, history_json_utf8_bytes: historyBytes,
    threshold_utf8_bytes: threshold, history_load_window_utf8_bytes: loadWindow,
    assembly_ceiling_utf8_bytes: policy.results.assembled_context_utf8_bytes,
    oracle_sha256: sha256(code), source_first_text_sha256: sha256(history[0].parts[0].text),
    current_requests_contain_oracle: false, synthetic_assistant_messages_seeded: 0 };
}

export function verifyCompactionSummary(summary, history, code) {
  const categories = ['facts', 'decisions', 'questions', 'entities', 'requirements'];
  assert.equal(summary.schema_version, 1);
  assert.deepEqual(Object.keys(summary).sort(), ['schema_version', ...categories].sort());
  const bySeq = new Map(history.map(item => [item.seq, item.parts[0].text]));
  const covered = new Set(); const citations = [];
  for (const category of categories) {
    assert.ok(Array.isArray(summary[category]));
    for (const item of summary[category]) {
      assert.equal(typeof item.text, 'string'); assert.ok(item.text.trim());
      assert.ok(Array.isArray(item.source_seqs) && item.source_seqs.length > 0);
      for (const seq of item.source_seqs) {
        assert.ok(bySeq.get(seq)?.includes(item.text), 'Every cited fragment must be literal in each indicated source');
        covered.add(seq);
      }
      citations.push(item.text);
    }
  }
  assert.deepEqual([...covered].sort(), ['1', '2', '3', '4', '5', '6']);
  assert.ok(citations.some(text => text.includes(code)), 'The first-source oracle must survive compaction');
  assert.ok(citations.some(text => text.includes(COMPACTION_EXPECTED_HOUSE)), 'The house must survive for independent snapshot reuse');
  return { covered_source_sequences: [...covered].sort(), citation_count: citations.length,
    literal_grounding_verified: true, code_preserved: true, house_preserved: true,
    summary_sha256: sha256(JSON.stringify(summary)), summary_utf8_bytes: Buffer.byteLength(JSON.stringify(summary)) };
}
