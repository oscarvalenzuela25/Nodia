import { describe, expect, it } from 'vitest';
import type { CvEvidenceSection } from '../engine/index.js';
import {
  composeCvPdfDocument,
  snapshotCvPdfSource,
  type CvPdfSource,
} from './nodia-cv-pdf-source.js';

const date = new Date('2026-11-26T12:00:00Z');
const source: CvPdfSource = {
  language: 'es',
  profile: {
    id: 'd7ae1840-e244-4f85-9cfd-b1f1275466b1',
    profile_name: 'Perfil de prueba',
    revision: 1,
    schema_version: 1,
    created_at: date,
    updated_at: date,
    full_name: 'Candidata de prueba',
    professional_title: 'Ingeniera de software',
    contact: { email: 'qa@example.invalid' },
    main_stack: [],
    experiences: [],
    projects: [],
    skill_areas: [],
    education: [],
    certifications: [],
    languages: [],
    additional_sections: [],
  },
  draft: {
    schemaVersion: 1,
    locale: 'es',
    requirements: [],
    selectedFacts: [
      {
        id: 'e1',
        section: 'profile',
        groupId: 'g1',
        field: 'summary',
        text: 'Resumen autorizado',
      },
      {
        id: 'e2',
        section: 'profile',
        groupId: 'g1',
        field: 'main_stack',
        text: 'TypeScript',
      },
      {
        id: 'e3',
        section: 'experience',
        groupId: 'g2',
        field: 'company',
        text: 'Empresa de prueba',
      },
      {
        id: 'e4',
        section: 'education',
        groupId: 'g3',
        field: 'name',
        text: 'Centro de prueba',
      },
    ],
    remainingFacts: [
      {
        id: 'e5',
        section: 'certification',
        groupId: 'g4',
        field: 'name',
        text: 'Certificado omitido',
      },
    ],
  },
  review: { included_fact_ids: ['e1', 'e2', 'e3', 'e4'], evidence: [] },
};

describe('CV PDF section order', () => {
  it('keeps historical reviews in canonical order and leaves the leading profile unlabelled', () => {
    const snapshot = snapshotCvPdfSource(source);
    expect(snapshot).not.toHaveProperty('section_order');
    const document = composeCvPdfDocument(snapshot);
    expect(document.blocks.map(({ text }) => text)).toEqual([
      'Candidata de prueba',
      'Ingeniera de software',
      'qa@example.invalid',
      'Resumen autorizado',
      'Experiencia profesional',
      'Empresa de prueba',
      'Competencias',
      'TypeScript',
      'Formación',
      'Centro de prueba',
    ]);
  });

  it('snapshots the revised order of selected evidence and keeps the fixed heading and contact', () => {
    const sectionOrder: CvEvidenceSection[] = [
      'certification',
      'skills',
      'profile',
    ];
    const snapshot = snapshotCvPdfSource({
      ...source,
      review: { ...source.review, section_order: sectionOrder },
    });
    sectionOrder.reverse();

    expect(snapshot.section_order).toEqual([
      'certification',
      'skills',
      'profile',
    ]);
    const document = composeCvPdfDocument(snapshot);
    expect(document.blocks.map(({ text }) => text)).toEqual([
      'Candidata de prueba',
      'Ingeniera de software',
      'qa@example.invalid',
      'Competencias',
      'TypeScript',
      'Perfil',
      'Resumen autorizado',
      'Experiencia profesional',
      'Empresa de prueba',
      'Formación',
      'Centro de prueba',
    ]);
  });
});
