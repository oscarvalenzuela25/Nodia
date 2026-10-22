import type { NodiaAiPublicProposal, NodiaAiProposalReview, NodiaAiReviewValue } from "../../../../modules/nodiaAi/infrastructure/types";
import { proposal, readonlyReview, stepId } from "./proposalFixtures";

// Synthetic Core records. Never imported by the production route.
export const coreArray = (items: NodiaAiReviewValue[]): NodiaAiReviewValue => ({ kind: "array", items });
export const coreObject = (fields: Record<string, NodiaAiReviewValue>): NodiaAiReviewValue => ({ kind: "object", fields: Object.entries(fields).map(([field_key, value]) => ({ field_key, value })) });
const derived = new Set(["roles_details", "modules_details", "actions_details", "module_group_details", "access_impact", "resolved_existing", "deletion_mode"]);
const change = (field_key: string, after: NodiaAiReviewValue) => ({ field_key, after, before: derived.has(field_key) ? null : after, before_present: !derived.has(field_key), after_present: true, origin: derived.has(field_key) ? "database" as const : "user" as const });
export const coreUserProposal: NodiaAiPublicProposal = { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_users_prepare_update", scope: {}, target: { resource_key: "users", id: "9007199254740993", label: "[QA] Persona" }, changes: [
  change("name", "[QA] Persona"), change("email", "synthetic@example.invalid"), change("roles", coreArray(["9007199254740993"])), change("modules", coreArray(["9007199254740994"])),
  change("roles_details", coreArray([coreObject({ id: "9007199254740993", key: "[QA] manager" })])), change("modules_details", coreArray([coreObject({ id: "9007199254740994", key: "[QA] finances" })])),
  change("access_impact", coreObject({ affected_users: coreArray([coreObject({ id: "9007199254740993", name: "[QA] Persona", email: "synthetic@example.invalid" })]), removed_modules: coreArray([coreObject({ id: "9007199254740995", key: "[QA] reservations" })]) })),
] }] };
const field = (field_key: string, kind: "text" | "core_id_list" | "core_translations") => ({ step_id: stepId, field_key, label_key: `nodiaAi:proposal.core_fields.${field_key}`, kind, nullable: false, max_length: kind === "text" ? 255 : null, minimum: kind === "text" ? null : "0", maximum: kind === "text" ? null : "100", options: [] });
export const coreUserReview: NodiaAiProposalReview = { ...readonlyReview, read_only: false, editable_fields: [field("name", "text"), field("email", "text"), field("roles", "core_id_list"), field("modules", "core_id_list")], confirmation: { available: false, reason: "nodia_ai:execution_unavailable" } };
export const coreRoleProposal: NodiaAiPublicProposal = { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_roles_prepare_create", scope: {}, changes: [change("key", "qa_role"), change("translates", coreArray([coreObject({ key: "name", es: "Rol sintético", en: "Synthetic role" })])), change("resolved_existing", false)] }] };
export const coreRoleReview: NodiaAiProposalReview = { ...coreUserReview, editable_fields: [field("key", "text"), field("translates", "core_translations")] };
export const coreDeleteProposal: NodiaAiPublicProposal = { ...coreUserProposal, steps: [{ ...coreUserProposal.steps[0], tool_name: "nodia_modules_prepare_delete", target: { resource_key: "modules", id: "9007199254740995", label: "[QA] reservations" }, changes: [...coreUserProposal.steps[0].changes.filter(change => change.field_key === "access_impact"), change("deletion_mode", "delete")] }] };
export const coreDeleteReview: NodiaAiProposalReview = { ...readonlyReview, read_only: false, editable_fields: [], confirmation: { available: true, reason: null } };
