import type {
  CvEvidenceFact,
  CvEvidenceSection,
  CvTailoringDraft,
} from '../engine/index.js';
import { normalizeCvTechnologyName } from '../engine/technologies.js';
import type {
  CvDraftReviewContent,
  CvDraftReviewEvidence,
} from '../types/nodia-cv-generation.types.js';
import type { NodiaCvProfileDetail } from '../types/nodia-cv-profile.types.js';
import {
  CV_PDF_LIMITS,
  CvPdfError,
  normalizeCvPdfText,
  type CvPdfBlock,
  type CvPdfDocument,
  type CvPdfLanguage,
} from './nodia-cv-pdf-contract.js';

export interface CvPdfSource {
  language: CvPdfLanguage;
  profile: NodiaCvProfileDetail;
  draft: CvTailoringDraft;
  review: CvDraftReviewContent;
}

export interface CvPdfSourceSnapshot {
  language: CvPdfLanguage;
  profile: Pick<
    NodiaCvProfileDetail,
    'full_name' | 'professional_title' | 'contact'
  >;
  facts: CvEvidenceFact[];
  evidence: CvDraftReviewEvidence[];
  section_order?: CvEvidenceSection[];
  technologies?: NonNullable<CvDraftReviewContent['technologies']>;
}

const headings = {
  es: {
    profile: 'Perfil',
    experience: 'Experiencia profesional',
    project: 'Proyectos',
    skills: 'Competencias',
    technologies: 'Tecnologías',
    education: 'Formación',
    certification: 'Certificaciones',
    language: 'Idiomas',
    additional: 'Información adicional',
    evidence: 'Aportes confirmados',
  },
  en: {
    profile: 'Profile',
    experience: 'Professional experience',
    project: 'Projects',
    skills: 'Skills',
    technologies: 'Technical skills',
    education: 'Education',
    certification: 'Certifications',
    language: 'Languages',
    additional: 'Additional information',
    evidence: 'Confirmed additions',
  },
} as const;
const chronology = {
  es: {
    start: 'Inicio',
    end: 'Fin',
    status: 'Estado',
    current: 'Actualidad',
    finished: 'Finalizado',
  },
  en: {
    start: 'Start',
    end: 'End',
    status: 'Status',
    current: 'Present',
    finished: 'Finished',
  },
} as const;

const sections: readonly CvEvidenceSection[] = [
  'profile',
  'experience',
  'project',
  'skills',
  'education',
  'certification',
  'language',
  'additional',
];
const primaryFields = new Set(['position', 'title', 'name', 'language']);

function snapshotTechnologies(
  technologies: CvDraftReviewContent['technologies'],
): CvPdfSourceSnapshot['technologies'] {
  if (!technologies) return undefined;
  const included = new Set(
    technologies.included.map(normalizeCvTechnologyName),
  );
  return {
    included: [...technologies.included],
    additions: technologies.additions
      .filter(
        ({ name, status }) =>
          status === 'confirmed' &&
          included.has(normalizeCvTechnologyName(name)),
      )
      .map((entry) => ({ ...entry })),
  };
}

export function snapshotCvPdfSource(source: CvPdfSource): CvPdfSourceSnapshot {
  const { profile, draft, review } = source;
  if (source.language !== draft.locale)
    throw new CvPdfError('pdf_render_failed');

  const ids = new Set(review.included_fact_ids);
  if (ids.size !== review.included_fact_ids.length)
    throw new CvPdfError('pdf_render_failed');
  const byId = new Map(
    [...draft.selectedFacts, ...draft.remainingFacts].map((fact) => [
      fact.id,
      fact,
    ]),
  );
  const facts = review.included_fact_ids.map((id) => {
    const fact = byId.get(id);
    if (!fact) throw new CvPdfError('pdf_render_failed');
    return fact;
  });

  const {
    full_name,
    professional_title,
    contact: {
      location,
      email,
      phone,
      linkedin_url,
      github_url,
      portfolio_url,
    },
  } = profile;
  const technologies = snapshotTechnologies(review.technologies);
  return {
    language: source.language,
    profile: {
      full_name,
      ...(professional_title ? { professional_title } : {}),
      contact: {
        location,
        email,
        phone,
        linkedin_url,
        github_url,
        portfolio_url,
      },
    },
    facts,
    evidence: review.evidence.map(({ requirement_id, source, detail }) => ({
      requirement_id,
      source,
      detail,
    })),
    ...(review.section_order
      ? { section_order: [...review.section_order] }
      : {}),
    ...(technologies ? { technologies } : {}),
  };
}

function presentationUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    // A historical value can still be shown as plain text.
  }
}

function formatMonth(value: string | undefined) {
  if (value === undefined) return undefined;
  const parts = /^(?!0000)(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!parts) throw new CvPdfError('pdf_render_failed');
  return `${parts[2]}/${parts[1]}`;
}

const experienceAnchorFields = new Set([
  'company',
  'position',
  'start_month',
  'end_month',
  'status',
]);

function experienceBlocks(
  facts: CvEvidenceFact[],
  language: CvPdfLanguage,
): CvPdfBlock[] {
  const labels = chronology[language];
  const fields = new Map(facts.map(({ field, text }) => [field, text]));
  const start = formatMonth(fields.get('start_month'));
  const end = formatMonth(fields.get('end_month'));
  const status = fields.get('status');
  const anchors = [fields.get('company'), fields.get('position')];
  if (start && end) {
    anchors.push(`${start} - ${end}`);
  } else if (start && status === 'current') {
    anchors.push(`${start} - ${labels.current}`);
  } else {
    if (start) anchors.push(`${labels.start}: ${start}`);
    if (end) anchors.push(`${labels.end}: ${end}`);
    if (!end && (status === 'finished' || status === 'current'))
      anchors.push(`${labels.status}: ${labels[status]}`);
  }
  const headings = anchors.filter((text): text is string => text !== undefined);
  const remaining = facts.filter(
    ({ field }) => !experienceAnchorFields.has(field),
  );
  return [
    ...headings.map((text, index): CvPdfBlock => ({
      kind: index === 0 ? 'group' : 'body',
      text,
      keepWithNext:
        index < headings.length - 1 ||
        (headings.length === 1 && remaining.length > 0),
    })),
    ...remaining.map(({ text }): CvPdfBlock => ({ kind: 'body', text })),
  ];
}

export function composeCvPdfDocument(
  snapshot: CvPdfSourceSnapshot,
): CvPdfDocument {
  const { language, profile, facts, evidence, section_order, technologies } =
    snapshot;
  const { email, phone, location, linkedin_url, github_url, portfolio_url } =
    profile.contact;
  const labels = headings[language];
  const blocks: CvPdfBlock[] = [{ kind: 'title', text: profile.full_name }];
  if (profile.professional_title)
    blocks.push({ kind: 'subtitle', text: profile.professional_title });
  const contact = [location, email, phone].filter(
    (text): text is string => !!text,
  );
  if (contact.length)
    blocks.push({ kind: 'contact', text: contact.join(' · ') });
  for (const text of [linkedin_url, github_url, portfolio_url]) {
    if (text)
      blocks.push({ kind: 'contact', text, url: presentationUrl(text) });
  }
  for (const block of blocks.slice(0, -1)) block.keepWithNext = true;

  const bySection = new Map<CvEvidenceSection, Map<string, CvEvidenceFact[]>>();
  for (const fact of facts) {
    if (
      fact.section === 'profile' &&
      fact.field === 'professional_title' &&
      fact.text === profile.professional_title
    )
      continue;
    const isMainStack =
      fact.section === 'profile' && fact.field === 'main_stack';
    if (isMainStack && technologies) continue;
    const section = isMainStack ? 'skills' : fact.section;
    const groups =
      bySection.get(section) ?? new Map<string, CvEvidenceFact[]>();
    const group = groups.get(fact.groupId) ?? [];
    group.push(fact);
    groups.set(fact.groupId, group);
    bySection.set(section, groups);
  }

  const orderedSections = new Set([...(section_order ?? []), ...sections]);
  let hasSectionContent = false;
  for (const section of orderedSections) {
    if (section === 'skills' && technologies?.included.length) {
      blocks.push(
        { kind: 'section', text: labels.technologies, keepWithNext: true },
        { kind: 'body', text: technologies.included.join(' · ') },
      );
      hasSectionContent = true;
    }
    const groups = bySection.get(section);
    if (!groups) continue;
    const content: CvPdfBlock[] = [];
    for (const group of groups.values()) {
      if (section === 'experience') {
        content.push(...experienceBlocks(group, language));
        continue;
      }
      const main = group.find((fact) => primaryFields.has(fact.field));
      if (main)
        content.push({
          kind: 'group',
          text: main.text,
          keepWithNext: group.length > 1,
        });
      for (const fact of group) {
        if (fact !== main) content.push({ kind: 'body', text: fact.text });
      }
    }
    if (!content.length) continue;
    if (section !== 'profile' || hasSectionContent)
      blocks.push({
        kind: 'section',
        text: labels[section],
        keepWithNext: true,
      });
    blocks.push(...content);
    hasSectionContent = true;
  }

  const technologyEvidence =
    technologies?.additions.flatMap(({ name, source, detail }): CvPdfBlock[] =>
      source && detail
        ? [
            { kind: 'group', text: `${name} · ${source}`, keepWithNext: true },
            { kind: 'body', text: detail },
          ]
        : [],
    ) ?? [];
  if (evidence.length || technologyEvidence.length) {
    blocks.push({ kind: 'section', text: labels.evidence, keepWithNext: true });
    for (const entry of evidence) {
      blocks.push(
        { kind: 'group', text: entry.source, keepWithNext: true },
        { kind: 'body', text: entry.detail },
      );
    }
    blocks.push(...technologyEvidence);
  }

  for (const block of blocks) {
    block.text = normalizeCvPdfText(block.text);
    if (!block.text) throw new CvPdfError('pdf_text_mismatch');
  }
  if (
    blocks.length > CV_PDF_LIMITS.blocks ||
    blocks.reduce((total, block) => total + block.text.length, 0) >
      CV_PDF_LIMITS.textUnits
  )
    throw new CvPdfError('pdf_limits');

  return {
    language,
    blocks,
    missing_contact: ![
      email,
      phone,
      linkedin_url,
      github_url,
      portfolio_url,
    ].some(Boolean),
  };
}
