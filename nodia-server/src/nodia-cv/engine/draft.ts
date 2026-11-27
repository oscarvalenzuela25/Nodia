import type { JSONSchemaType } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { isStructuralCvFact, REDACTED_CV_DATA } from './evidence.js';
import {
  CV_TAILORING_MAX_RESPONSE_BYTES,
  CV_TAILORING_SCHEMA_VERSION,
  CvTailoringError,
  type CvDraftRequirement,
  type CvEvidenceFact,
  type CvRequirementCoverage,
  type CvRequirementKind,
  type CvTailoringDraft,
  type PreparedCvTailoring,
} from './types.js';

interface ModelRequirement {
  quote: string;
  kind: CvRequirementKind;
  relation: 'direct' | 'inferred' | 'absent';
  evidenceIds: string[];
}

interface ModelAnswer {
  requirements: ModelRequirement[];
  selectedEvidenceIds: string[];
}

const evidenceIdSchema = {
  type: 'string',
  pattern: '^e[1-9][0-9]{0,5}$',
} as const;
export const CV_TAILORING_OUTPUT_SCHEMA: JSONSchemaType<ModelAnswer> = {
  type: 'object',
  required: ['requirements', 'selectedEvidenceIds'],
  additionalProperties: false,
  properties: {
    requirements: {
      type: 'array',
      maxItems: 128,
      items: {
        type: 'object',
        required: ['quote', 'kind', 'relation', 'evidenceIds'],
        additionalProperties: false,
        properties: {
          quote: { type: 'string', minLength: 1, maxLength: 1000 },
          kind: {
            type: 'string',
            enum: ['required', 'preferred', 'uncertain'],
          },
          relation: { type: 'string', enum: ['direct', 'inferred', 'absent'] },
          evidenceIds: {
            type: 'array',
            maxItems: 16,
            uniqueItems: true,
            items: evidenceIdSchema,
          },
        },
      },
    },
    selectedEvidenceIds: {
      type: 'array',
      minItems: 1,
      maxItems: 160,
      uniqueItems: true,
      items: evidenceIdSchema,
    },
  },
};

const validateModelAnswer = new Ajv2020({ strict: true }).compile(
  CV_TAILORING_OUTPUT_SCHEMA,
);

function readModelAnswer(text: string): ModelAnswer {
  if (Buffer.byteLength(text) > CV_TAILORING_MAX_RESPONSE_BYTES)
    throw new CvTailoringError('invalid_model_output');
  let data: unknown;
  try {
    data = JSON.parse(text);
    // Compare decoded tokens so duplicate property names cannot be silently collapsed by JSON.parse.
    const tokens = text.replace(
      /"(?:[^"\\]|\\[\s\S])*"|[ \t\r\n]+/g,
      (token) =>
        token.startsWith('"') ? JSON.stringify(JSON.parse(token)) : '',
    );
    if (JSON.stringify(data) !== tokens) throw new Error();
  } catch {
    throw new CvTailoringError('invalid_model_output');
  }
  if (!validateModelAnswer(data))
    throw new CvTailoringError('invalid_model_output');
  return data;
}

function phrase(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+(?:[+#]+|(?:\.[\p{L}\p{N}]+)*)?/gu)
      ?.join(' ') ?? ''
  );
}

function containsPhrase(text: string, term: string): boolean {
  return term.length >= 2 && ` ${text} `.includes(` ${term} `);
}

function isDirectlyTraceable(quote: string, fact: CvEvidenceFact): boolean {
  const source = phrase(fact.text);
  const requirement = phrase(quote);
  if (source === requirement) return true;
  const negation = /\b(?:no|sin|not|never|without)\b/u;
  if (negation.test(source) !== negation.test(requirement)) return false;
  if (containsPhrase(source, requirement)) return true;
  if (/\b(?:y|o|and|or)\b/u.test(requirement) || quote.includes('/'))
    return false;
  const qualifiers =
    requirement.match(
      /\b(?:\d+|anos|years|months|meses|senior|junior|certification|certificacion|advanced|avanzado|intermediate|intermedio|fluent|fluido|b[12]|c[12])\b/gu,
    ) ?? [];
  const terms = new Set(source.split(' '));
  return (
    qualifiers.every((qualifier) => terms.has(qualifier)) &&
    containsPhrase(requirement, source)
  );
}

function coverageFor(
  requirement: ModelRequirement,
  facts: CvEvidenceFact[],
  selected: ReadonlySet<string>,
): CvRequirementCoverage {
  if (requirement.relation === 'absent') return 'gap';
  if (requirement.relation === 'inferred') return 'confirm';
  const directFacts = facts.filter((fact) =>
    isDirectlyTraceable(requirement.quote, fact),
  );
  if (!directFacts.length) return 'confirm';
  return directFacts.some((fact) => selected.has(fact.id))
    ? 'supported'
    : 'omitted';
}

export function buildCvDraft(
  prepared: PreparedCvTailoring,
  modelText: string,
): CvTailoringDraft {
  const output = readModelAnswer(modelText);
  const byId = new Map(prepared.evidence.map((fact) => [fact.id, fact]));
  const findEvidence = (id: string): CvEvidenceFact => {
    const fact = byId.get(id);
    if (!fact) throw new CvTailoringError('invalid_evidence');
    return fact;
  };

  const anchors = new Map<string, CvEvidenceFact[]>();
  for (const fact of prepared.evidence) {
    if (!isStructuralCvFact(fact)) continue;
    const group = anchors.get(fact.groupId) ?? [];
    group.push(fact);
    anchors.set(fact.groupId, group);
  }
  const selected = new Map<string, CvEvidenceFact>();
  for (const id of output.selectedEvidenceIds) {
    const fact = findEvidence(id);
    for (const anchor of anchors.get(fact.groupId) ?? [])
      selected.set(anchor.id, anchor);
    selected.set(fact.id, fact);
  }

  const citations = new Set<string>();
  const selectedIds = new Set(selected.keys());
  if (prepared.editRequirements && output.requirements.length)
    throw new CvTailoringError('invalid_model_output');
  const requirements = prepared.editRequirements
    ? prepared.editRequirements.map((requirement): CvDraftRequirement => {
        const { coverage, evidenceIds, quote } = requirement;
        if (coverage !== 'supported' && coverage !== 'omitted')
          return requirement;
        const selectedEvidence = evidenceIds
          .map(findEvidence)
          .some(
            (fact) =>
              selectedIds.has(fact.id) && isDirectlyTraceable(quote, fact),
          );
        return {
          ...requirement,
          coverage: selectedEvidence ? 'supported' : 'omitted',
        };
      })
    : output.requirements.map((requirement, index) => {
        const { quote, kind, relation, evidenceIds } = requirement;
        if (
          quote !== quote.trim() ||
          quote.includes(REDACTED_CV_DATA) ||
          citations.has(quote) ||
          !prepared.normalizedOffer.includes(quote) ||
          !prepared.providedOffer.includes(quote) ||
          !/[\p{L}\p{N}]/u.test(quote)
        ) {
          throw new CvTailoringError('invalid_citation');
        }
        citations.add(quote);
        if ((relation === 'absent') !== (evidenceIds.length === 0))
          throw new CvTailoringError('invalid_evidence');
        const evidence = evidenceIds.map(findEvidence);
        return {
          id: `r${index + 1}`,
          quote,
          kind,
          coverage: coverageFor(requirement, evidence, selectedIds),
          evidenceIds,
        };
      });
  return {
    locale: prepared.locale,
    schemaVersion: CV_TAILORING_SCHEMA_VERSION,
    requirements,
    selectedFacts: [...selected.values()],
    remainingFacts: prepared.evidence.filter((fact) => !selected.has(fact.id)),
    ...(prepared.editTechnologyOptions
      ? { technologyOptions: prepared.editTechnologyOptions }
      : {}),
  };
}
