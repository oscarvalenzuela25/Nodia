import { z } from "zod";
import type { NodiaAiSelection } from "../../nodiaAi/infrastructure/types";

export const cvOfferMaxBytes = 24 * 1024;
const connectionId = z.string().regex(/^[1-9][0-9]{0,18}$/);
const mode = z.enum(["api_key", "agentic"]);
const factId = z.string().regex(/^e[1-9][0-9]*$/);
const requirementId = z.string().regex(/^r[1-9][0-9]*$/);

export const cvSelectionSchema = z.object({
  connection_id: connectionId,
  mode,
  model_id: z.string().min(1).max(1024),
  effort_id: z.string().min(1).max(256).nullable(),
});

const catalogMode = z.object({
  mode,
  configuration: z.enum(["configured", "incomplete", "disabled"]),
  authentication: z.literal("unknown"),
  inference: z.literal("unknown"),
  tools: z.enum(["unknown", "unsupported"]),
  observed_at: z.null(),
  block_reason: z.null(),
  configured_selection: cvSelectionSchema.nullable(),
  models: z
    .array(
      z.object({
        model_id: z.string().min(1).max(1024),
        label: z.string(),
        efforts: z.array(z.object({ effort_id: z.string(), label: z.string() })),
      }),
    )
    .max(200),
  cv_transport: z.enum(["available", "unsupported"]),
});

export const cvCatalogSchema = z.object({
  items: z.array(
    z.object({
      connection_id: connectionId,
      label: z.string(),
      provider_key: z.string(),
      is_active: z.boolean(),
      is_default: z.boolean().optional(),
      default_mode: mode.nullable().optional(),
      modes: z.array(catalogMode).max(2),
    }),
  ),
  next_cursor: connectionId.nullable(),
});

export const cvEligibilitySchema = z
  .object({
    selection: cvSelectionSchema,
    eligible: z.boolean(),
    configured: z.boolean().nullable(),
    qualified: z.boolean(),
    reason_code: z.enum([
      "qualified",
      "configuration_unavailable",
      "qualification_required",
      "agentic_transport_unavailable",
      "codex_runtime_unavailable",
      "codex_session_required",
      "codex_session_unverified",
      "codex_model_unavailable",
      "codex_effort_unavailable",
      "codex_profile_busy",
      "codex_usage_unavailable",
    ]),
    checked_at: z.iso.datetime().nullable(),
  })
  .refine((result) =>
    result.reason_code === "qualified"
      ? result.eligible && result.qualified && result.configured === true && result.checked_at !== null
      : !result.eligible && !result.qualified,
  );

const fact = z.object({
  id: factId,
  groupId: z.string().regex(/^g[1-9][0-9]*$/),
  section: z.enum([
    "profile",
    "experience",
    "project",
    "skills",
    "education",
    "certification",
    "language",
    "additional",
  ]),
  field: z.string().regex(/^[a-z_]+$/),
  text: z.string().min(1).max(8192),
});

const requirement = z.object({
  id: requirementId,
  quote: z.string().min(1).max(4096),
  kind: z.enum(["required", "preferred", "uncertain"]),
  coverage: z.enum(["supported", "confirm", "omitted", "gap"]),
  evidenceIds: z.array(factId),
});

const draft = z.object({
  schemaVersion: z.literal(1),
  locale: z.enum(["es", "en"]),
  requirements: z.array(requirement),
  selectedFacts: z.array(fact),
  remainingFacts: z.array(fact),
});

const declaredEvidence = z.object({
  requirement_id: requirementId,
  source: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(600),
});

const review = z.object({
  revision: z.int().positive(),
  included_fact_ids: z.array(factId),
  evidence: z.array(declaredEvidence),
});

function unique(values: readonly string[]) {
  return new Set(values).size === values.length;
}

export const cvGenerationSchema = z
  .object({
    id: z.uuidv4(),
    state: z.enum(["queued", "running", "ready", "failed", "unknown"]),
    profile_id: z.uuidv4(),
    profile_revision: z.int().positive(),
    language: z.enum(["es", "en"]),
    selection: cvSelectionSchema,
    created_at: z.iso.datetime(),
    expires_at: z.iso.datetime(),
    vacancy_title: z.string().nullable(),
    vacancy_company: z.string().nullable(),
    error_code: z
      .string()
      .regex(/^[a-z_]+$/)
      .nullable(),
    draft: draft.nullable(),
    review: review.nullable().optional(),
  })
  .refine((result) => {
    if (!result.draft) return result.state !== "ready" && !result.review;
    if (result.state !== "ready" || result.language !== result.draft.locale) return false;
    const facts = [...result.draft.selectedFacts, ...result.draft.remainingFacts];
    const knownFacts = new Set(facts.map((item) => item.id));
    const knownRequirements = new Set(result.draft.requirements.map((item) => item.id));
    return (
      knownFacts.size === facts.length &&
      knownRequirements.size === result.draft.requirements.length &&
      result.draft.requirements.every((item) => item.evidenceIds.every((id) => knownFacts.has(id))) &&
      (!result.review ||
        (unique(result.review.included_fact_ids) &&
          unique(result.review.evidence.map((item) => item.requirement_id)) &&
          result.review.included_fact_ids.every((id) => knownFacts.has(id)) &&
          result.review.evidence.every((item) => knownRequirements.has(item.requirement_id))))
    );
  });

const title = z.string().trim().max(160, "nodiaCv:validation.length");
export const cvOfferSchema = z.object({
  language: z.enum(["es", "en"]),
  vacancy_title: title,
  vacancy_company: title,
  offer_text: z
    .string()
    .trim()
    .min(1, "nodiaCv:validation.required")
    .refine(
      (value) => new TextEncoder().encode(value).byteLength <= cvOfferMaxBytes,
      "nodiaCv:generation_input_too_large",
    ),
});

export type CvOffer = z.output<typeof cvOfferSchema>;
export type CvDraft = z.output<typeof draft>;
export type CvDraftFact = z.output<typeof fact>;
export type CvRequirement = z.output<typeof requirement>;
export type CvReviewSave = z.output<typeof review>;
export type CvGeneration = z.output<typeof cvGenerationSchema>;
export type CvCatalog = z.output<typeof cvCatalogSchema>;
export type CvEligibility = z.output<typeof cvEligibilitySchema>;
export type CvGenerationInput = CvOffer & {
  request_key: string;
  profile_id: string;
  profile_revision: number;
  selection: NodiaAiSelection;
};

export function sameCvSelection(a: NodiaAiSelection | null, b: NodiaAiSelection | null) {
  return (
    a === b ||
    Boolean(
      a &&
      b &&
      a.connection_id === b.connection_id &&
      a.mode === b.mode &&
      a.model_id === b.model_id &&
      a.effort_id === b.effort_id,
    )
  );
}

export function cvInputIdentity(input: Omit<CvGenerationInput, "request_key">) {
  const { selection } = input;
  return JSON.stringify([
    input.profile_id,
    input.profile_revision,
    input.language,
    input.offer_text,
    input.vacancy_title,
    input.vacancy_company,
    selection.connection_id,
    selection.mode,
    selection.model_id,
    selection.effort_id,
  ]);
}

export function receivedCvIntent(receipt: CvGeneration, input: CvGenerationInput) {
  return (
    receipt.profile_id === input.profile_id &&
    receipt.profile_revision === input.profile_revision &&
    receipt.language === input.language &&
    receipt.vacancy_title === (input.vacancy_title || null) &&
    receipt.vacancy_company === (input.vacancy_company || null) &&
    sameCvSelection(receipt.selection, input.selection)
  );
}

export function cvPollInterval(
  state: CvGeneration["state"] | undefined,
  consecutiveReads: number,
  hasError: boolean,
): number | false {
  if (hasError || (state !== "queued" && state !== "running")) return false;
  return Math.min(8000, 1000 * 2 ** Math.min(Math.floor(consecutiveReads / 3), 3));
}
