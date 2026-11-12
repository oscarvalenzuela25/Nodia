import { describe, expect, it } from 'vitest';
import { conceptRelations, publicActivityData, publicVisualData } from './teacher-enrichment-projections.js';

describe('historical declarative learning data', () => {
  it('keeps an unsupported occurrence legible without exposing its private or executable payload', () => {
    expect(publicActivityData({ kind: 'remote_plugin', prompt: 'Historical task', schema_version: 9,
      payload: { script: 'run()', url: 'https://example.invalid' }, solution: 'private' })).toEqual({
      kind: 'remote_plugin', prompt: 'Historical task', schema_version: 9, objective_id: null,
      answered: false, assisted: true, independent: false, availability: 'unsupported', payload: {},
    });
    expect(publicVisualData({ kind: 'html', title: 'Old diagram', labels: ['secret'], values: [9], html: '<script>run()</script>' }))
      .toMatchObject({ kind: 'html', title: 'Old diagram', labels: [], values: [], availability: 'unsupported' });
  });
  it('treats an unsupported version or malformed supported payload as unavailable rather than substituting a renderer', () => {
    expect(publicActivityData({ kind: 'completion', prompt: 'Fill', payload: {}, solution: 'A', schema_version: 2 }).availability).toBe('unsupported');
    expect(publicVisualData({ kind: 'bar_chart', title: 'Broken', labels: ['A'], values: [Infinity] }).availability).toBe('unsupported');
    expect(publicActivityData({ kind: 'ordering', prompt: 'Order', payload: { items: ['A','A'] }, solution: ['A','A'] }).availability).toBe('unsupported');
  });
  it('preserves known historical data without requiring a fabricated version or leaking a solution', () => {
    expect(publicActivityData({ kind: 'completion', prompt: 'Fill', payload: {}, solution: 'private' }))
      .toEqual({ kind: 'completion', prompt: 'Fill', objective_id: null, answered: false,
        assisted: true, independent: false, availability: 'available', payload: {} });
    expect(publicVisualData({ kind: 'bar_chart', title: 'Count', labels: ['A'], values: [0], schema_version: 1 }))
      .toMatchObject({ availability: 'available', labels: ['A'], values: [0] });
  });
  it('retains joint all-of relationships as proposed user claims, without deducing truth or advancement', () => {
    const ids = ['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'];
    expect(conceptRelations([{ kind: 'derivation', target_concept_ids: ids }])).toEqual([
      { kind: 'derivation', target_concept_ids: ids, combination: 'all', status: 'proposed', origin: 'user_authored' },
    ]);
    expect(() => conceptRelations([{ kind: 'derivation', target_concept_ids: [ids[0],ids[0]] }])).toThrow();
    expect(() => conceptRelations([{ kind: 'exec', target_concept_ids: ids }])).toThrow();
    expect(() => conceptRelations([{ kind: 'support', target_concept_ids: ids, grants_verification: true }])).toThrow();
    expect(() => conceptRelations([{ kind: 'support', target_concept_ids: [] }])).toThrow();
    expect(() => conceptRelations(Array.from({length:9}, () => ({ kind: 'support', target_concept_ids: ids })))).toThrow();
  });
});
