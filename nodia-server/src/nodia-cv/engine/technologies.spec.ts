import { describe, expect, it } from 'vitest';
import { analyzeCvTechnologies, prepareCvTechnologyReview } from './technologies.js';
import type { CvTailoringDraft } from './types.js';

const draft: CvTailoringDraft = {
  schemaVersion: 1,
  locale: 'es',
  requirements: [
    { id: 'r1', quote: 'React y TypeScript.', kind: 'required', coverage: 'supported', evidenceIds: ['e1'] },
    { id: 'r2', quote: 'Deseable Postgres y Kubernetes.', kind: 'preferred', coverage: 'confirm', evidenceIds: ['e2'] },
  ],
  selectedFacts: [
    { id: 'e1', section: 'profile', groupId: 'g1', field: 'main_stack', text: 'TypeScript, React, Vue.js' },
    { id: 'e2', section: 'project', groupId: 'g2', field: 'technologies', text: 'PostgreSQL' },
  ],
  remainingFacts: [],
};

describe('revisión de tecnologías del CV', () => {
  it('contrasta el perfil con citas de la oferta y encuentra términos de un stack abierto', () => {
    const offer = 'React y TypeScript.\nDeseable Postgres y Kubernetes.\nStack técnico: Dagger, .NET\n\nTecnologías valoradas\n\n- Temporal y Redis o equivalentes.';
    const result = analyzeCvTechnologies(draft, offer);
    expect(result).toEqual(expect.arrayContaining([
      { name: 'TypeScript', kind: 'required', in_profile: true, requirement_ids: ['r1'] },
      { name: 'PostgreSQL', kind: 'preferred', in_profile: true, requirement_ids: ['r2'] },
      { name: 'Kubernetes', kind: 'preferred', in_profile: false, requirement_ids: ['r2'] },
      { name: 'Vue.js', kind: 'outside', in_profile: true, requirement_ids: [] },
      { name: 'Dagger', kind: 'uncertain', in_profile: false, requirement_ids: [] },
      { name: '.NET', kind: 'uncertain', in_profile: false, requirement_ids: [] },
      { name: 'Temporal', kind: 'preferred', in_profile: false, requirement_ids: [] },
    ]));
    expect(result.some(({ name }) => ['SQL', 'Java', 'equivalentes'].includes(name))).toBe(false);
  });

  it('requiere evidencia de una tecnología nueva y conserva el estudio fuera del contenido', () => {
    const options = analyzeCvTechnologies(draft, '');
    const input = {
      included: ['postgres', 'Docker'],
      additions: [
        { name: 'k8s', status: 'study' as const },
        { name: 'Docker', status: 'confirmed' as const, source: 'Proyecto de pruebas', detail: 'Construí la imagen.' },
      ],
    };
    expect(prepareCvTechnologyReview(options, input)).toEqual({
      included: ['PostgreSQL', 'Docker'],
      additions: [
        { name: 'Kubernetes', status: 'study' },
        { name: 'Docker', status: 'confirmed', source: 'Proyecto de pruebas', detail: 'Construí la imagen.' },
      ],
    });
    expect(() => prepareCvTechnologyReview(options, { ...input, included: ['k8s'] })).toThrow();
    expect(() => prepareCvTechnologyReview(options, { included: ['Docker'], additions: [] })).toThrow();
    expect(() => prepareCvTechnologyReview(options, { included: ['postgres', 'PostgreSQL'], additions: [] })).toThrow();
  });
});
