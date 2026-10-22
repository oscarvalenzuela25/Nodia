export const nodiaAiFinanceResources = ["finance_movements", "finance_categories", "finance_category_groups", "finance_obligations"] as const;
export function nodiaAiFinanceTool(name: string): boolean {
  return nodiaAiFinanceResources.some(resource => ["create", "update", "delete"].some(operation => name === `nodia_${resource}_prepare_${operation}`));
}
export const nodiaAiFinanceFieldLabels: Record<string, string> = {
  id: "finance:id", user_id: "nodiaAi:proposal.financial_fields.user_id", name: "finance:name", key: "finance:key",
  amount: "finance:amount", type: "finance:type", status: "finance:status", description: "finance:description",
  category_id: "finance:category", category_ids: "finance:categories", category_group_id: "finance:category_groups",
  obligation_id: "finance:obligation", is_active: "finance:active", updated_at: "nodiaAi:proposal.financial_fields.updated_at",
  initial_movement: "nodiaAi:proposal.financial_fields.initial_movement", "initial_movement.amount": "nodiaAi:proposal.financial_fields.initial_amount",
  paid_amount: "finance:paid_amount", remaining_amount: "finance:remaining_amount",
  memberships: "nodiaAi:proposal.financial_fields.memberships", category_references: "nodiaAi:proposal.financial_fields.category_references",
};
