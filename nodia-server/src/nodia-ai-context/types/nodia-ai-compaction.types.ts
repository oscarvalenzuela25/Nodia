/** Extractive, cited memory. A category is model-selected; a quote is never authority. */
export const NODIA_AI_COMPACTION_BUILDER_VERSION = 'nodia-ai-compaction/1';
export const NODIA_AI_COMPACTION_CATEGORIES = [
  'facts', 'decisions', 'questions', 'entities', 'requirements',
] as const;
export type NodiaAiCompactionCategory = typeof NODIA_AI_COMPACTION_CATEGORIES[number];
export type NodiaAiCompactionCitation = {
  text: string;
  source_seqs: string[];
};
export type NodiaAiCompactionSummary = {
  schema_version: 1;
  facts: NodiaAiCompactionCitation[];
  decisions: NodiaAiCompactionCitation[];
  questions: NodiaAiCompactionCitation[];
  entities: NodiaAiCompactionCitation[];
  requirements: NodiaAiCompactionCitation[];
};
export interface NodiaAiCompactionSnapshot {
  id: string;
  revision: number;
  throughSeq: string;
  sourceHash: string;
  summary: NodiaAiCompactionSummary;
  scopeManifest: { schema_version: 1; module_routes: string[] };
  builderContractVersion: string;
}
export function isNodiaAiCompactionObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** The original sources are additionally checked when accepting a fresh model answer. */
export function isNodiaAiCompactionSummary(
  value: unknown,
  collectionLimit: number,
): value is NodiaAiCompactionSummary {
  if (!isNodiaAiCompactionObject(value) || value.schema_version !== 1 ||
    Object.keys(value).length !== NODIA_AI_COMPACTION_CATEGORIES.length + 1) return false;
  return NODIA_AI_COMPACTION_CATEGORIES.every((category) => {
    const entries = value[category];
    return Array.isArray(entries) && entries.length <= collectionLimit && entries.every((entry) => {
      if (!isNodiaAiCompactionObject(entry) || Object.keys(entry).length !== 2 ||
        typeof entry.text !== 'string' || !entry.text.trim() || !Array.isArray(entry.source_seqs) ||
        entry.source_seqs.length === 0 || entry.source_seqs.length > collectionLimit) return false;
      let previous = 0n;
      return entry.source_seqs.every((seq: unknown) => {
        if (typeof seq !== 'string' || !/^[1-9][0-9]*$/.test(seq) || BigInt(seq) <= previous) return false;
        previous = BigInt(seq);
        return true;
      });
    });
  });
}
