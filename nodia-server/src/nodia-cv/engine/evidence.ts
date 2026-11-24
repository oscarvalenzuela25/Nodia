import type { NodiaCvProfileDetail } from '../types/nodia-cv-profile.types.js';
import type { CvEvidenceFact, CvEvidenceSection } from './types.js';

export const REDACTED_CV_DATA = '⟦…⟧';

const contactPatterns = [
  /(?:[\p{L}\p{N}_.+!#$%&'*=/^{}|~-]+)@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu,
  /\b(?:[a-z][a-z0-9+.-]{1,20}:\/\/|www\.)[^\s<>"']+/giu,
  /\b(?:[a-z0-9-]+\.)+(?:com|org|net|edu|gov|io|dev|app|cl|mx|ar|es|co|uk)\/[^\s<>"']+/giu,
  /\b(?:phone|tel(?:efono|éfono)?|m[oó]vil|whatsapp)\s*[:=]\s*\+?\d(?:[ ().-]*\d){6,14}/giu,
  /(?<![\p{L}\p{N}])(?:\+\d(?:[ ().-]*\d){7,14}|\(?\d{2,4}\)?[ .-]\d{3,5}[ .-]\d{3,5})(?![\p{L}\p{N}])/gu,
];

const credentialPatterns = [
  /\b(?:api[ _-]*key|access[ _-]*token|token|client[ _-]*secret|secret|password|contrase(?:ñ|n)a)\s*[:=]\s*(?:"[^"\n]+"|'[^'\n]+'|[^\s,;]+)/giu,
  /\b(?:bearer\s+)[a-z\d._~+/=-]{12,}/giu,
  /\b(?:sk-[a-z\d_-]{16,}|gh[pousr]_[a-z\d]{20,}|github_pat_[a-z\d_]{20,}|AIza[a-z\d_-]{20,}|xox[baprs]-[\w-]{16,}|AKIA[A-Z0-9]{16})\b/giu,
  /\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/giu,
];

export function normalizeCvText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function minimizeCvText(profile: NodiaCvProfileDetail) {
  const knownValues = [profile.full_name, ...Object.values(profile.contact)]
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeCvText)
    .filter(Boolean)
    .sort((first, second) => second.length - first.length);
  const known = knownValues.length
    ? new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${knownValues.map(escapePattern).join('|')})(?![\\p{L}\\p{N}])`,
        'giu',
      )
    : undefined;
  return (value: string) => {
    let text = normalizeCvText(value);
    if (known) text = text.replace(known, REDACTED_CV_DATA);
    for (const pattern of [...credentialPatterns, ...contactPatterns]) {
      text = text.replace(pattern, REDACTED_CV_DATA);
    }
    return text;
  };
}

type EvidenceField = readonly [
  field: string,
  value: string | readonly string[] | undefined,
];

const structuralFields: Record<CvEvidenceSection, readonly string[]> = {
  profile: [],
  experience: [
    'company',
    'position',
    'location',
    'status',
    'start_month',
    'end_month',
  ],
  project: [
    'name',
    'role',
    'status',
    'validation_context',
    'start_month',
    'end_month',
  ],
  skills: ['name'],
  education: ['title', 'institution', 'start_year', 'end_year'],
  certification: ['name', 'issuer', 'year'],
  language: ['language', 'level', 'usage'],
  additional: ['title'],
};

export function isStructuralCvFact(fact: CvEvidenceFact): boolean {
  return structuralFields[fact.section].includes(fact.field);
}

export function indexCvEvidence(
  profile: NodiaCvProfileDetail,
  minimize: (value: string) => string,
): CvEvidenceFact[] {
  const facts: CvEvidenceFact[] = [];
  let groupIndex = 0;
  const addGroup = (
    section: CvEvidenceSection,
    fields: readonly EvidenceField[],
  ) => {
    const groupId = `g${++groupIndex}`;
    for (const [field, value] of fields) {
      for (const item of typeof value === 'string' ? [value] : (value ?? [])) {
        const text = minimize(item);
        if (!/[\p{L}\p{N}]/u.test(text)) continue;
        facts.push({
          id: `e${facts.length + 1}`,
          section,
          groupId,
          field,
          text,
        });
      }
    }
  };

  addGroup('profile', [
    ['professional_title', profile.professional_title],
    ['second_title', profile.second_title],
    ['summary', profile.summary],
    ['main_stack', profile.main_stack],
  ]);
  for (const row of profile.experiences)
    addGroup('experience', [
      ['company', row.company],
      ['position', row.position],
      ['location', row.location],
      ['status', row.status],
      ['start_month', row.start_month],
      ['end_month', row.end_month],
      ['highlights', row.highlights],
      ['technologies', row.technologies],
    ]);
  for (const row of profile.projects)
    addGroup('project', [
      ['name', row.name],
      ['role', row.role],
      ['status', row.status],
      ['validation_context', row.validation_context],
      ['start_month', row.start_month],
      ['end_month', row.end_month],
      ['contributions', row.contributions],
      ['technologies', row.technologies],
    ]);
  for (const row of profile.skill_areas)
    addGroup('skills', [
      ['name', row.name],
      ['skills', row.skills],
    ]);
  for (const row of profile.education)
    addGroup('education', [
      ['title', row.title],
      ['institution', row.institution],
      ['start_year', row.start_year],
      ['end_year', row.end_year],
      ['details', row.details],
    ]);
  for (const row of profile.certifications)
    addGroup('certification', [
      ['name', row.name],
      ['issuer', row.issuer],
      ['year', row.year],
    ]);
  for (const row of profile.languages)
    addGroup('language', [
      ['language', row.language],
      ['level', row.level],
      ['usage', row.usage],
    ]);
  for (const row of profile.additional_sections)
    addGroup('additional', [
      ['title', row.title],
      ['lines', row.lines],
    ]);
  return facts;
}
