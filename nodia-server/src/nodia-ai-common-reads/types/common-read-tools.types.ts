export const NODIA_AI_COMMON_READ_TOOLS = Object.freeze([
  'nodia_proposals_get',
  'nodia_operations_get',
  'nodia_attachments_describe',
  'nodia_preferences_list',
] as const);
export type NodiaAiCommonReadTool = (typeof NODIA_AI_COMMON_READ_TOOLS)[number];
