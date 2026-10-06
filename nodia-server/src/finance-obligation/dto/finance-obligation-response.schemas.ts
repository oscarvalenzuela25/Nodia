import type { SchemaObject } from '@nestjs/swagger';
import {
  decimalStringSchema,
  financePageSchema,
  financeRecordProperties,
} from '../../finance-common/dto/finance-response.schemas.js';

const text: SchemaObject = { type: 'string', minLength: 1, maxLength: 255 };

export const FINANCE_OBLIGATION_SCHEMA: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    ...Object.keys(financeRecordProperties),
    'name',
    'key',
    'type',
    'amount',
    'description',
    'paid_amount',
    'remaining_amount',
    'initial_movement',
  ],
  properties: {
    ...financeRecordProperties,
    name: text,
    key: text,
    type: { type: 'string', enum: ['loan', 'debt'] },
    amount: {
      ...decimalStringSchema,
      pattern: '^[1-9][0-9]*$',
      description: 'Initial principal, never decremented by repayments.',
    },
    description: { type: 'string', nullable: true, maxLength: 5000 },
    paid_amount: {
      ...decimalStringSchema,
      description:
        'Sum of all confirmed repayments, including archived repayments and outside visible movement filters.',
    },
    remaining_amount: {
      ...decimalStringSchema,
      nullable: true,
      description:
        'Initial principal minus confirmed repayments; null when the initial movement has been cancelled.',
    },
    initial_movement: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'type', 'status', 'amount', 'category_id'],
      properties: {
        id: financeRecordProperties.id,
        type: {
          type: 'string',
          enum: ['income', 'expense'],
          description: 'Loan origin is expense; debt origin is income.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'received', 'paid', 'cancelled'],
        },
        amount: { ...decimalStringSchema, pattern: '^[1-9][0-9]*$' },
        category_id: financeRecordProperties.id,
      },
    },
  },
};

export const FINANCE_OBLIGATION_PAGE_SCHEMA = financePageSchema(
  FINANCE_OBLIGATION_SCHEMA,
);
