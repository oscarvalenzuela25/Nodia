const money = { type: 'string' as const, pattern: '^\\d+$', example: '60000' };
const net = { type: 'string' as const, pattern: '^-?\\d+$', example: '-40000' };
const count = { type: 'integer' as const, minimum: 0 };
const id = { type: 'string' as const, pattern: '^[1-9]\\d*$' };

const scope = {
  type: 'object' as const,
  required: ['active', 'movement_filters', 'obligation_balances'],
  properties: {
    active: { type: 'string' as const, enum: ['active', 'inactive', 'all'] },
    movement_filters: {
      type: 'object' as const,
      required: ['q', 'category_ids', 'category_group_ids', 'obligation_id'],
      properties: {
        q: { type: 'object' as const, additionalProperties: true },
        category_ids: { type: 'array' as const, items: id, maxItems: 100 },
        category_group_ids: {
          type: 'array' as const,
          items: id,
          maxItems: 100,
        },
        obligation_id: { ...id, nullable: true },
      },
    },
    obligation_balances: {
      type: 'object' as const,
      required: [
        'active',
        'repayments',
        'includes_inactive_repayments',
        'ignores_movement_filters',
      ],
      properties: {
        active: {
          type: 'string' as const,
          enum: ['active', 'inactive', 'all'],
        },
        repayments: {
          type: 'string' as const,
          enum: ['all_confirmed_history'],
        },
        includes_inactive_repayments: {
          type: 'boolean' as const,
          enum: [true],
        },
        ignores_movement_filters: { type: 'boolean' as const, enum: [true] },
      },
    },
  },
};

export const FINANCE_OVERVIEW_SCHEMA = {
  type: 'object' as const,
  required: ['scope', 'totals', 'counts', 'obligations'],
  properties: {
    scope,
    totals: {
      type: 'object' as const,
      required: [
        'income_amount',
        'expense_amount',
        'net_amount',
        'movement_count',
        'pending_count',
        'cancelled_count',
      ],
      properties: {
        income_amount: money,
        expense_amount: money,
        net_amount: net,
        movement_count: count,
        pending_count: count,
        cancelled_count: count,
      },
    },
    counts: {
      type: 'object' as const,
      required: ['categories', 'category_groups', 'loans', 'debts'],
      properties: {
        categories: count,
        category_groups: count,
        loans: count,
        debts: count,
      },
    },
    obligations: {
      type: 'object' as const,
      required: ['loan_remaining_amount', 'debt_remaining_amount'],
      properties: {
        loan_remaining_amount: money,
        debt_remaining_amount: money,
      },
    },
  },
};

export const FINANCE_SUMMARY_SCHEMA = {
  type: 'object' as const,
  required: ['scope', 'data', 'meta'],
  properties: {
    scope,
    data: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: [
          'id',
          'name',
          'key',
          'is_active',
          'movement_count',
          'income_amount',
          'expense_amount',
          'net_amount',
        ],
        properties: {
          id,
          name: { type: 'string' as const },
          key: { type: 'string' as const },
          is_active: { type: 'boolean' as const },
          movement_count: count,
          income_amount: money,
          expense_amount: money,
          net_amount: net,
        },
      },
    },
    meta: {
      type: 'object' as const,
      required: ['page', 'limit', 'total_items', 'total_pages'],
      properties: {
        page: { type: 'integer' as const, minimum: 1, maximum: 1000000 },
        limit: { type: 'integer' as const, minimum: 1, maximum: 100 },
        total_items: count,
        total_pages: count,
      },
    },
  },
};

export const FINANCE_GROUP_SUMMARY_SCHEMA = {
  ...FINANCE_SUMMARY_SCHEMA,
  required: [...FINANCE_SUMMARY_SCHEMA.required, 'overlapping_groups'],
  properties: {
    ...FINANCE_SUMMARY_SCHEMA.properties,
    overlapping_groups: { type: 'boolean' as const, enum: [true] },
  },
};
