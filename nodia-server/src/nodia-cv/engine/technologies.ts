import { cvGenerationError } from '../policies/nodia-cv-generation-errors.js';
import type { CvTechnologyReview } from '../types/nodia-cv-generation.types.js';
import { normalizeCvText } from './evidence.js';
import type { CvTechnologyOption, CvTailoringDraft } from './types.js';

export const CV_MAX_TECHNOLOGIES = 64;
export const CV_TECHNOLOGY_NAME = /^[\p{L}\p{N}.][\p{L}\p{N} .+#()/&-]{0,79}$/u;

const offerSuggestions = [
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby',
  'PHP', 'Kotlin', 'Swift', 'SQL', 'React', 'React Native', 'Next.js', 'Vue.js',
  'Angular', 'Svelte', 'Node.js', 'NestJS', 'Express', 'FastAPI', 'Django',
  'Spring Boot', 'Laravel', '.NET', 'PostgreSQL', 'MySQL', 'SQL Server', 'SQLite',
  'MongoDB', 'Redis', 'DynamoDB', 'Supabase', 'Firebase', 'Docker', 'Kubernetes',
  'Terraform', 'AWS', 'Azure', 'GCP', 'Vercel', 'Git', 'GitHub Actions',
  'Jenkins', 'Kafka', 'RabbitMQ', 'GraphQL', 'REST', 'MCP', 'RAG',
  'Playwright', 'Cypress', 'Jest', 'Vitest', 'Storybook', 'Tailwind CSS',
] as const;

const aliases = new Map([
  ['postgres', 'postgresql'], ['postgresql', 'postgresql'],
  ['nodejs', 'node.js'], ['node.js', 'node.js'], ['node js', 'node.js'],
  ['nextjs', 'next.js'], ['next.js', 'next.js'],
  ['vue', 'vue.js'], ['vuejs', 'vue.js'], ['vue.js', 'vue.js'],
  ['k8s', 'kubernetes'], ['kubernetes', 'kubernetes'],
  ['golang', 'go'], ['go', 'go'],
]);

export function normalizeCvTechnologyName(name: string) {
  const value = name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
  return aliases.get(value) ?? value;
}

function escapeExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requirementRank(kind: CvTechnologyOption['kind']) {
  return { required: 0, preferred: 1, uncertain: 2, outside: 3 }[kind];
}

function technologyMatcher(matches: readonly string[]) {
  const patterns = matches.map((name) =>
    new RegExp(
      `(?<![\\p{L}\\p{N}+#])${escapeExpression(name)}(?![\\p{L}\\p{N}+#]|[.-][\\p{L}\\p{N}])`,
      name.toLowerCase() === 'go' ? 'u' : 'iu',
    ),
  );
  return (text: string) => patterns.some((pattern) => pattern.test(text));
}

const technologyHeading = /^(?:#{1,6}\s+)?(tech(?:nology)?\s+stack|stack(?:\s+técnico)?|tecnologías(?:\s+(?:deseables|valoradas|requeridas|obligatorias))?|(?:(?:required|preferred)\s+)?technologies)(?:\s*:\s*(.*))?$/iu;

function offerListNames(offer: string) {
  const result = new Map<string, CvTechnologyOption['kind']>();
  let category: CvTechnologyOption['kind'] | null = null;
  const collect = (list: string, kind: CvTechnologyOption['kind']) => {
    for (const term of list.split(/[,;|•]|\s+(?:y|o|and|or)\s+/iu)) {
      const name = term.trim().replace(/[.]$/u, '');
      if (!CV_TECHNOLOGY_NAME.test(name) || name.split(' ').length > 3 ||
          /\b(?:equivalentes?|similares?|otros?|otras?|other|similar|equivalent)\b/iu.test(name))
        continue;
      if (!result.has(name) && result.size < CV_MAX_TECHNOLOGIES) result.set(name, kind);
    }
  };
  for (const raw of offer.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = technologyHeading.exec(line);
    if (heading) {
      category = /deseables|valoradas|preferred/iu.test(heading[1]) ? 'preferred'
        : /requeridas|obligatorias|required/iu.test(heading[1]) ? 'required'
        : 'uncertain';
      if (heading[2]) collect(heading[2], category);
      continue;
    }
    const bullet = /^[-*•]\s+(.+)$/u.exec(line);
    if (category && bullet) collect(bullet[1], category);
    else category = null;
  }
  return result;
}

export function analyzeCvTechnologies(
  draft: CvTailoringDraft,
  offer: string,
): CvTechnologyOption[] {
  const candidates = new Map<string, { name: string; inProfile: boolean }>();
  const insert = (name: string, inProfile: boolean) => {
    const cleaned = normalizeCvText(name);
    if (!CV_TECHNOLOGY_NAME.test(cleaned)) return;
    const key = normalizeCvTechnologyName(cleaned);
    if (!candidates.has(key)) candidates.set(key, { name: cleaned, inProfile });
  };
  const facts = [...draft.selectedFacts, ...draft.remainingFacts];
  for (const fact of facts) {
    if (fact.field !== 'main_stack' && fact.field !== 'technologies') continue;
    for (const name of fact.text.split(/[,;|•\n]/u)) insert(name, true);
  }
  const explicit = new Map(
    [...offerListNames(offer)].map(([name, kind]) => [normalizeCvTechnologyName(name), { name, kind }]),
  );
  for (const name of [...offerSuggestions, ...[...explicit.values()].map((item) => item.name)]) insert(name, false);
  for (const fact of facts) {
    if (fact.field === 'skills' && candidates.has(normalizeCvTechnologyName(fact.text))) {
      const key = normalizeCvTechnologyName(fact.text);
      const candidate = candidates.get(key);
      if (candidate) candidate.inProfile = true;
    }
  }
  const result: CvTechnologyOption[] = [];
  for (const [key, candidate] of candidates) {
    const words = [candidate.name, ...[...aliases].filter(([, target]) => target === key).map(([name]) => name)];
    const matches = technologyMatcher([...new Set(words)]);
    const matching = draft.requirements.filter(({ quote }) => matches(quote));
    const rank = matching.reduce<CvTechnologyOption['kind']>(
      (current, next) => requirementRank(next.kind) < requirementRank(current) ? next.kind : current,
      explicit.get(key)?.kind ?? (matching.length || matches(offer) ? 'uncertain' : 'outside'),
    );
    if (rank === 'outside' && !candidate.inProfile) continue;
    result.push({
      name: candidate.name,
      kind: rank,
      in_profile: candidate.inProfile,
      requirement_ids: matching.map(({ id }) => id),
    });
  }
  return result.sort((a, b) => requirementRank(a.kind) - requirementRank(b.kind))
    .slice(0, CV_MAX_TECHNOLOGIES);
}

export function prepareCvTechnologyReview(
  options: readonly CvTechnologyOption[],
  selection: CvTechnologyReview,
): CvTechnologyReview {
  const available = new Map(options.map((item) => [normalizeCvTechnologyName(item.name), item]));
  const additions = new Map<string, CvTechnologyReview['additions'][number]>();
  for (const item of selection.additions) {
    const key = normalizeCvTechnologyName(item.name);
    const option = available.get(key);
    if (additions.has(key) || option?.in_profile)
      cvGenerationError('invalid_draft_review', 400);
    if (item.status === 'confirmed') {
      if (!item.source || !item.detail) cvGenerationError('invalid_draft_review', 400);
      additions.set(key, {
        name: option?.name ?? item.name, status: item.status,
        source: item.source, detail: item.detail,
      });
    } else {
      if (item.source !== undefined || item.detail !== undefined)
        cvGenerationError('invalid_draft_review', 400);
      additions.set(key, { name: option?.name ?? item.name, status: item.status });
    }
  }
  const included = new Map<string, string>();
  for (const name of selection.included) {
    const key = normalizeCvTechnologyName(name);
    const option = available.get(key);
    const addition = additions.get(key);
    if (included.has(key) || (!option?.in_profile && addition?.status !== 'confirmed'))
      cvGenerationError('invalid_draft_review', 400);
    included.set(key, option?.name ?? addition?.name ?? name);
  }
  return { included: [...included.values()], additions: [...additions.values()] };
}
