import type { SchemaObject } from '@nestjs/swagger';
import {
  decimalStringSchema,
  financePageSchema,
  financeRecordProperties,
} from '../../finance-common/dto/finance-response.schemas.js';

const id = financeRecordProperties.id;
const text: SchemaObject = { type: 'string', minLength: 1, maxLength: 255 };

export const FINANCE_MOVEMENT_SCHEMA: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    ...Object.keys(financeRecordProperties),
    'name',
    'amount',
    'type',
    'status',
    'category_id',
    'obligation_id',
    'category',
    'obligation',
  ],
  properties: {
    ...financeRecordProperties,
    name: text,
    amount: { ...decimalStringSchema, pattern: '^[1-9][0-9]*$' },
    type: { type: 'string', enum: ['income', 'expense'] },
    status: {
      type: 'string',
      enum: ['pending', 'received', 'paid', 'cancelled'],
      description:
        'Income admits pending/received/cancelled; expense admits pending/paid/cancelled.',
    },
    category_id: id,
    obligation_id: { ...id, nullable: true },
    category: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'key'],
      properties: { id, name: text, key: text },
    },
    obligation: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      required: ['id', 'name', 'type'],
      properties: {
        id,
        name: text,
        type: { type: 'string', enum: ['loan', 'debt'] },
      },
    },
  },
};

export const FINANCE_MOVEMENT_PAGE_SCHEMA = financePageSchema(
  FINANCE_MOVEMENT_SCHEMA,
);
