const operations = {
  users: ["create", "update"], roles: ["create", "update", "delete"], actions: ["create", "update", "delete"],
  business_actions: ["create", "update", "delete"], modules: ["create", "update", "delete"], module_groups: ["create", "update", "delete"],
} as const;
export const nodiaAiCoreResources = Object.keys(operations) as (keyof typeof operations)[];
export const nodiaAiCoreTool = (name: string) => nodiaAiCoreResources.some(resource => operations[resource].some(operation => name === `nodia_${resource}_prepare_${operation}`));
export const nodiaAiCoreRoute = (resource: string): string | undefined => ({ users: "/users", roles: "/roles", actions: "/actions", business_actions: "/actions", modules: "/modules", module_groups: "/modules" })[resource];
const fields = ["id", "name", "email", "image_url", "is_active", "key", "description", "has_description", "module_group_id", "link", "icon", "roles", "modules", "actions", "translates", "es", "en", "roles_details", "modules_details", "actions_details", "module_group_details", "access_impact", "affected_users", "removed_roles", "removed_modules", "removed_actions", "resolved_existing", "label", "assignment_active", "group_modules", "removed_associations", "deactivates_access", "deletion_mode"];
export const nodiaAiCoreFieldLabels: Record<string, string> = Object.fromEntries(fields.map(field => [field, `nodiaAi:proposal.core_fields.${field}`]));
const nativeErrors = ["users:last_super_admin", "users:invalid_associations", "roles:not_found", "roles:protected_role", "roles:protected_key", "roles:invalid_actions", "modules:immutable_key", "modules:groups.not_found", "modules:groups.delete_has_modules", "modules:not_found", "actions:not_found"];
export const nodiaAiCoreErrorKey = (value: unknown): string | undefined => value === "nodia_ai:core_translation_removal_unsupported" ? "nodiaAi:proposal.core_translation_removal_unsupported" : nativeErrors.find(key => key === value);
