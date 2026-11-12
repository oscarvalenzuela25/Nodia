import { z } from "zod";

export const learningObjectiveSchema = z.object({ objective_id: z.uuid(), description: z.string(), plan_revision_id: z.uuid(), section_id: z.uuid(), unit_ids: z.array(z.uuid()) });
export const learningObservationSchema = z.object({ id: z.uuid(), objective_id: z.uuid(), description: z.string(), answer_state: z.enum(["graded", "pending", "needs_review"]), earned_points: z.number().nullable(), max_points: z.number(), assisted: z.boolean(), independent: z.boolean(), self_explanation: z.string().nullable(), confidence: z.number().int().min(0).max(100).nullable(), observed_at: z.string(), attempt_id: z.uuid(), response_id: z.uuid() });
export const learningRecommendationSchema = z.object({ objective_id: z.uuid(), reason: z.enum(["reinforce", "independent_check", "retrieval", "insufficient_evidence"]), evidence_ids: z.array(z.uuid()), unit_id: z.uuid().nullable(), activity_mode: z.enum(["recall", "discrimination", "composition"]) });
export const diagnosticBlueprintSchema = z.object({ id: z.uuid(), revision: z.number().int().positive(), title: z.string(), dimensions: z.array(z.object({ id: z.uuid(), description: z.string() })), reviewed: z.boolean(), item_count: z.number().int().nonnegative() });
export const lessonInteractionSchema = z.object({ id: z.uuid(), content_version_id: z.uuid(), block_id: z.string(), kind: z.enum(["prediction", "check"]), text: z.string(), created_at: z.string() });
export type LessonInteraction = z.infer<typeof lessonInteractionSchema>;
export const learningSchema = z.object({ schema_version: z.literal(1), session_id: z.uuid(), revision: z.number().int().positive(), policy_version: z.literal("teacher-learning/1"), objectives: z.array(learningObjectiveSchema), observations: z.array(learningObservationSchema), recommendations: z.array(learningRecommendationSchema), interactions: z.array(z.object({ id: z.uuid(), content_version_id: z.uuid(), block_id: z.string(), kind: z.enum(["prediction", "check"]), text: z.string(), created_at: z.string() })), mappings: z.array(z.object({ blueprint_id: z.uuid(), dimension_id: z.uuid(), plan_revision_id: z.uuid(), objective_id: z.uuid() })), diagnostic_blueprint: diagnosticBlueprintSchema.nullable() });
export type Learning = z.infer<typeof learningSchema>;

export function parseDeclaredConfidence(value: string): number | null | undefined {
  if (!value.trim()) return null;
  if (!/^\d{1,3}$/.test(value.trim())) return undefined;
  const number = Number(value);
  return number >= 0 && number <= 100 ? number : undefined;
}
