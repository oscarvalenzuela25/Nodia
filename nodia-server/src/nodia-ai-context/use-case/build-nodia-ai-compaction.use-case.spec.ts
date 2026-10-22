import { describe, expect, it } from 'vitest';
import { BuildNodiaAiCompactionUseCase, type NodiaAiCompactionInput } from './build-nodia-ai-compaction.use-case.js';
import { NODIA_AI_COMPACTION_BUILDER_VERSION, type NodiaAiCompactionSnapshot, type NodiaAiCompactionSummary } from '../types/nodia-ai-compaction.types.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';

const policy = { results: {
  assembled_context_utf8_bytes: 262144, assistant_text_utf8_bytes: 32768, json_collection_items: 128,
} } as NodiaAiRuntimePolicy;
const summary = (): NodiaAiCompactionSummary => ({
  schema_version: 1, facts: [{ text: 'CLP 20.000', source_seqs: ['1'] }],
  decisions: [{ text: 'Necesito confirmar antes de registrar.', source_seqs: ['2'] }],
  questions: [], entities: [], requirements: [],
});
const fixture = (): NodiaAiCompactionInput => ({
  throughSeq: '2', sourceHash: 'a'.repeat(64), moduleRoutes: ['/finance'],
  history: [
    { seq: '1', role: 'user', scope: { schema_version: 1, module_routes: ['/finance'] },
      parts: [{ kind: 'text', text: 'Quizá gasté CLP 20.000 en comida.' }] },
    { seq: '2', role: 'assistant', scope: { schema_version: 1, module_routes: ['/finance'] },
      parts: [{ kind: 'text', text: 'Necesito confirmar antes de registrar.' }] },
  ],
});
const previous = (): NodiaAiCompactionSnapshot => ({
  id: 'd081c59c-c231-4fba-8413-1b810274e1f3', revision: 1, throughSeq: '2', sourceHash: 'b'.repeat(64),
  builderContractVersion: NODIA_AI_COMPACTION_BUILDER_VERSION,
  scopeManifest: { schema_version: 1, module_routes: ['/finance'] }, summary: summary(),
});

describe('BuildNodiaAiCompactionUseCase', () => {
  it('builds an extraction-only request with canonical roles, exact selection hash and no tools or accepted preferences', () => {
    const result = new BuildNodiaAiCompactionUseCase(policy).execute(fixture());
    const request = JSON.parse(result.prompt);
    expect(request.task).toBe('compact_conversation');
    expect(request.source_hash).toBe('a'.repeat(64));
    expect(request.messages).toEqual([
      { seq: '1', role: 'user', content: 'Quizá gasté CLP 20.000 en comida.' },
      { seq: '2', role: 'assistant', content: 'Necesito confirmar antes de registrar.' },
    ]);
    expect(request.instructions).toContain('no uses herramientas');
    expect(request.instructions).toContain('citas LITERALES');
    expect(request).not.toHaveProperty('accepted_preferences');
    expect(request).not.toHaveProperty('tools');
    expect(result.sourceBytes).toBe(Buffer.byteLength(result.prompt, 'utf8'));
  });
  it('accepts grounded extraction preserving unresolved intent and does not claim semantic completeness', () => {
    const result = new BuildNodiaAiCompactionUseCase(policy).parse({ ...fixture(), text: JSON.stringify(summary()) });
    expect(result).toEqual(summary());
    expect(result.facts[0].text).toBe('CLP 20.000');
    expect(result.decisions[0].source_seqs).toEqual(['2']);
  });
  it('rejects an otherwise grounded summary that drops an entire new decision message', () => {
    const input = fixture();
    input.history[0].parts[0].text = 'No canceles la reserva sin preguntarme.';
    input.history[1].parts[0].text = 'Prefiero azul.';
    const next = summary(); next.facts = [{ text: 'Prefiero azul.', source_seqs: ['2'] }]; next.decisions = [];
    const builder = new BuildNodiaAiCompactionUseCase(policy);
    expect(() => builder.parse({ ...input, text: JSON.stringify(next) })).toThrow('nodia_ai:compaction_invalid');
    next.decisions = [{ text: 'No canceles la reserva sin preguntarme.', source_seqs: ['1'] }];
    expect(builder.parse({ ...input, text: JSON.stringify(next) })).toEqual(next);
  });
  it('covers more than 128 small sources through multiple individually bounded citations', () => {
    const input = fixture();
    input.history = Array.from({ length: 129 }, (_, index) => ({ seq: String(index + 1), role: 'user',
      scope: { schema_version: 1, module_routes: [] }, parts: [{ kind: 'text', text: 'Todavía no he pagado.' }] }));
    input.throughSeq = '129';
    const next = summary(); next.decisions = [];
    next.facts = [{ text: 'Todavía no he pagado.', source_seqs: input.history.slice(0, 128).map((item) => item.seq) }];
    const builder = new BuildNodiaAiCompactionUseCase(policy);
    expect(() => builder.parse({ ...input, text: JSON.stringify(next) })).toThrow('nodia_ai:compaction_invalid');
    next.facts.push({ text: 'Todavía no he pagado.', source_seqs: ['129'] });
    expect(builder.parse({ ...input, text: JSON.stringify(next) })).toEqual(next);
    next.facts = [{ text: 'Todavía no he pagado.', source_seqs: input.history.map((item) => item.seq) }];
    expect(() => builder.parse({ ...input, text: JSON.stringify(next) })).toThrow('nodia_ai:compaction_invalid');
  });
  it('does not count old citations as coverage for a new visible source', () => {
    const input = fixture(); input.previousSnapshot = previous(); input.throughSeq = '3';
    input.history = [{ seq: '3', role: 'user', scope: { schema_version: 1, module_routes: [] },
      parts: [{ kind: 'text', text: 'La reserva aún requiere revisar el cupo.' }] }];
    expect(() => new BuildNodiaAiCompactionUseCase(policy).parse({ ...input, text: JSON.stringify(summary()) }))
      .toThrow('nodia_ai:compaction_invalid');
  });
  it('requires coverage for assistant-only visible text as a quote, without treating it as a verified result', () => {
    const input = fixture(); input.throughSeq = '1'; input.history = [{ ...input.history[0], role: 'assistant',
      parts: [{ kind: 'text', text: 'No se confirmó ningún gasto.' }] }];
    const next = summary(); next.facts = [{ text: 'No se confirmó ningún gasto.', source_seqs: ['1'] }]; next.decisions = [];
    expect(new BuildNodiaAiCompactionUseCase(policy).parse({ ...input, text: JSON.stringify(next) })).toEqual(next);
  });
  it('does not require invented citations for empty text, restricted sources or an untranscribed original', () => {
    const input = fixture(); input.throughSeq = '5';
    input.history = [...input.history,
      { seq: '3', role: 'user', scope: { schema_version: 1, module_routes: [] }, parts: [{ kind: 'text', text: ' \n ' }] },
      { seq: '4', role: 'assistant', scope: null, parts: [{ kind: 'text', text: 'Restricted source must not be quoted.' }] },
      { seq: '5', role: 'user', scope: { schema_version: 1, module_routes: [] }, parts: [{ kind: 'audio', text: null, attachment_id: 'native-audio' }] },
    ];
    expect(new BuildNodiaAiCompactionUseCase(policy).parse({ ...input, text: JSON.stringify(summary()) })).toEqual(summary());
  });
  it.each([
    ['paraphrase', { ...summary(), facts: [{ text: 'Se registró un gasto de 20000 pesos.', source_seqs: ['1'] }] }],
    ['unrelated source', { ...summary(), facts: [{ text: 'CLP 20.000', source_seqs: ['2'] }] }],
    ['partly unrelated sources', { ...summary(), facts: [{ text: 'CLP 20.000', source_seqs: ['1', '2'] }] }],
    ['missing source', { ...summary(), facts: [{ text: 'CLP 20.000', source_seqs: ['99'] }] }],
    ['empty citations', { ...summary(), facts: [{ text: 'CLP 20.000', source_seqs: [] }] }],
    ['duplicate citations', { ...summary(), facts: [{ text: 'CLP 20.000', source_seqs: ['1', '1'] }] }],
    ['unknown field', { ...summary(), confirm: true }],
    ['nested unknown field', { ...summary(), facts: [{ ...summary().facts[0], execute: true }] }],
    ['empty extraction', { schema_version: 1, facts: [], decisions: [], questions: [], entities: [], requirements: [] }],
    ['wrong schema', { ...summary(), schema_version: 2 }],
    ['duplicate entries', { ...summary(), facts: [summary().facts[0], summary().facts[0]] }],
  ])('rejects %s without inventing memory', (_name, value) => {
    expect(() => new BuildNodiaAiCompactionUseCase(policy).parse({ ...fixture(), text: JSON.stringify(value) }))
      .toThrow('nodia_ai:compaction_invalid');
  });
  it.each(['```json\n{}\n```', '{} trailing', '{"schema_version":1,"schema_version":1}', '{'])
    ('rejects noncanonical/duplicate JSON %s', (text) => {
      expect(() => new BuildNodiaAiCompactionUseCase(policy).parse({ ...fixture(), text }))
        .toThrow('nodia_ai:compaction_invalid');
    });
  it('does not accept a quote from a revoked source even when its raw text is provided', () => {
    const input = fixture(); input.moduleRoutes = [];
    const builder = new BuildNodiaAiCompactionUseCase(policy);
    expect(builder.execute(input).prompt).not.toContain('CLP 20.000');
    expect(() => builder.parse({ ...input, text: JSON.stringify(summary()) })).toThrow('nodia_ai:compaction_invalid');
  });
  it('accepts more than 128 small source messages without an arbitrary chat message limit', () => {
    const input = fixture();
    input.history = Array.from({ length: 160 }, (_, index) => ({
      seq: String(index + 1), role: 'user', scope: { schema_version: 1, module_routes: [] },
      parts: [{ kind: 'text', text: `Mensaje ${index + 1}` }],
    }));
    input.throughSeq = '160';
    expect(JSON.parse(new BuildNodiaAiCompactionUseCase(policy).execute(input).prompt).messages).toHaveLength(160);
  });
  it('preserves every previous categorized quote and permits grounded new memory', () => {
    const input = fixture(); input.previousSnapshot = previous();
    input.throughSeq = '3'; input.history = [{ seq: '3', role: 'user', scope: { schema_version: 1, module_routes: [] },
      parts: [{ kind: 'text', text: 'Todavía no he pagado.' }] }];
    const next = summary(); next.questions = [{ text: 'Todavía no he pagado.', source_seqs: ['3'] }];
    expect(new BuildNodiaAiCompactionUseCase(policy).parse({ ...input, text: JSON.stringify(next) })).toEqual(next);
    next.decisions = [];
    expect(() => new BuildNodiaAiCompactionUseCase(policy).parse({ ...input, text: JSON.stringify(next) }))
      .toThrow('nodia_ai:compaction_invalid');
  });
  it('rejects a previous snapshot whose scope was revoked', () => {
    const input = fixture(); input.previousSnapshot = previous(); input.throughSeq = '3'; input.history = [];
    input.moduleRoutes = [];
    expect(() => new BuildNodiaAiCompactionUseCase(policy).execute(input)).toThrow('nodia_ai:context_snapshot_invalid');
  });
  it('does not fabricate transcripts or resend historical file originals during extraction', () => {
    const input = fixture(); input.history[0].parts = [{ kind: 'audio', text: null, attachment_id: 'source-audio' }];
    const request = JSON.parse(new BuildNodiaAiCompactionUseCase(policy).execute(input).prompt);
    expect(request.messages[0].content).toContain('historical_file_not_resent');
    const next = summary(); next.facts = [{ text: 'source-audio', source_seqs: ['1'] }];
    expect(() => new BuildNodiaAiCompactionUseCase(policy).parse({ ...input, text: JSON.stringify(next) }))
      .toThrow('nodia_ai:compaction_invalid');
  });
  it('measures UTF-8 before accepting response or request and never truncates', () => {
    const builder = new BuildNodiaAiCompactionUseCase(policy);
    expect(() => builder.parse({ ...fixture(), text: 'ñ'.repeat(17000) })).toThrow('nodia_ai:compaction_invalid');
    const input = fixture(); input.history[0].parts[0].text = 'ñ'.repeat(140000);
    expect(() => builder.execute(input)).toThrow('nodia_ai:context_limit');
  });
  it.each([['2', '1'], ['1', '1'], ['0'], ['3']])('rejects noncanonical source sequences %j', (...seqs) => {
    const input = fixture(); input.history = seqs.map((seq) => ({ ...input.history[0], seq }));
    expect(() => new BuildNodiaAiCompactionUseCase(policy).execute(input)).toThrow('nodia_ai:invalid_history');
  });
});
