import { z } from "zod";
import { learningObservationSchema } from "./learningSchemas";

export const reviewCardSchema = z.object({ id: z.uuid(), revision: z.number().int(), objective_id: z.string().nullable(), question: z.string(), answer: z.string(), due_at: z.string(), timezone: z.string(), state: z.enum(["new", "learning", "review"]), interval_days: z.number(), reviews: z.number().int(), policy_version: z.string().optional() });
export const clarificationThreadSchema = z.object({ id: z.uuid(), content_version_id: z.uuid(), block_id: z.string(), selection: z.string(), created_at: z.string() });
export const learningSourceSchema = z.object({ id: z.uuid(), title: z.string(), media_type: z.string(), content_hash: z.string(), page_count: z.number().int(), notices: z.array(z.string()), created_at: z.string() });
const supportedActivitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ordering"), payload: z.object({ items: z.array(z.string()) }) }),
  z.object({ kind: z.literal("classification"), payload: z.object({ items: z.array(z.string()), categories: z.array(z.string()) }) }),
  z.object({ kind: z.literal("error_location"), payload: z.object({ lines: z.array(z.string()) }) }),
  z.object({ kind: z.literal("completion"), payload: z.object({}) }),
]).and(z.object({ id: z.uuid(), objective_id: z.string().nullable(), prompt: z.string(), revision: z.number().int(), answered: z.boolean(), availability: z.literal("available").default("available") }));
const unsupportedActivitySchema = z.object({ id: z.uuid(), objective_id: z.string().nullable(), prompt: z.string(), revision: z.number().int(), answered: z.boolean(), kind: z.string(), availability: z.literal("unsupported") });
export const activitySchema = z.union([supportedActivitySchema, unsupportedActivitySchema]);
const evidenceOriginSchema = z.object({ observation_id: z.uuid(), response_id: z.uuid(), attempt_id: z.uuid(), question_id: z.uuid() });
const conceptLearningStateSchema = z.object({ policy_version: z.literal("teacher-concept-observations/1"), visited: z.object({ kind: z.literal("material_visit"), unit_id: z.uuid(), content_version_id: z.uuid(), observed_at: z.string() }).nullable(), immediate_check: learningObservationSchema.nullable(), independent_application: learningObservationSchema.nullable(), retention: z.null(), section_verification: z.object({ verification_id: z.uuid(), source_attempt_id: z.uuid(), verified_at: z.string() }).nullable(), latest_evidence: z.array(learningObservationSchema), evidence_origins: z.array(evidenceOriginSchema).optional(), grants_verification: z.literal(false) });
const conceptRelationSchema = z.object({ kind: z.enum(["support", "derivation", "contradiction", "prerequisite"]), combination: z.literal("all"), status: z.literal("proposed"), origin: z.literal("user_authored"), target_concept_ids: z.array(z.uuid()), targets: z.array(z.object({ id: z.uuid(), session_id: z.uuid(), label: z.string(), statement: z.string(), conditions: z.string(), objective_id: z.uuid().nullable(), plan_revision_id: z.uuid().nullable() })), grants_verification: z.literal(false) });
const sourceReferenceSchema = z.object({ source_id: z.uuid(), content_hash: z.string(), page: z.number().int(), quote: z.string() });
export const conceptSchema = z.object({ id: z.uuid(), label: z.string(), statement: z.string(), conditions: z.string(), learning_state: conceptLearningStateSchema.optional(), relations: z.array(conceptRelationSchema).optional(), source_refs: z.array(sourceReferenceSchema).optional(), equivalence_history: z.array(z.object({ id: z.uuid(), equivalence_id: z.uuid(), observed_at: z.string(), actor_id: z.string(), previous_state: z.string().nullable(), next_state: z.string(), previous_revision: z.number().nullable(), from_concept_id: z.uuid(), to_concept_id: z.uuid() })).optional() });
export type LearningConcept = z.infer<typeof conceptSchema>;
export const equivalenceSchema = z.object({ id: z.uuid(), from_concept_id: z.uuid(), to_concept_id: z.uuid(), state: z.enum(["proposed", "accepted", "rejected"]), revision: z.number().int() });
const supportedVisualSchema = z.object({ id: z.uuid(), kind: z.enum(["bar_chart", "timeline"]), title: z.string(), labels: z.array(z.string()).min(1).max(24), values: z.array(z.number().finite()).min(1).max(24), availability: z.literal("available").default("available") }).refine(value => value.labels.length === value.values.length);
const unsupportedVisualSchema = z.object({ id: z.uuid(), kind: z.string(), title: z.string(), availability: z.literal("unsupported") });
export const visualSchema = z.union([supportedVisualSchema, unsupportedVisualSchema]);
export const enrichmentSchema = z.object({ schema_version: z.literal(1), revision: z.number().int(), policy_version: z.literal("teacher-intervals/1"), review_cards: z.array(reviewCardSchema), threads: z.array(clarificationThreadSchema), sources: z.array(learningSourceSchema), activities: z.array(activitySchema), concepts: z.array(conceptSchema), equivalences: z.array(equivalenceSchema), accepted_equivalences: z.array(z.object({ id: z.uuid(), from_concept_id: z.uuid(), to_concept_id: z.uuid(), from_label: z.string(), to_label: z.string(), to_statement: z.string(), target_session_id: z.uuid(), grants_verification: z.literal(false) })), visuals: z.array(visualSchema), has_more: z.boolean() });
export const threadSchema = z.object({ thread: clarificationThreadSchema, messages: z.array(z.object({ id: z.uuid(), role: z.enum(["user", "assistant"]), text: z.string(), job_id: z.string().nullable(), created_at: z.string() })) });
export const sourceContentSchema = z.object({ id: z.uuid(), title: z.string(), content_hash: z.string().optional(), pages: z.array(z.object({ page: z.number().int(), text: z.string() })), notices: z.array(z.string()) });
export type Enrichment = z.infer<typeof enrichmentSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type LearningVisual = z.infer<typeof visualSchema>;
export type ReviewCard = z.infer<typeof reviewCardSchema>;

export function fileToBase64(bytes: Uint8Array) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}
