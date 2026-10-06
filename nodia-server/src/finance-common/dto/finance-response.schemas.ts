import type { SchemaObject } from '@nestjs/swagger';

export const decimalStringSchema: SchemaObject = {
  type: 'string',
  pattern: '^[0-9]+$',
  example: '100000',
};
export const financeRecordProperties: Record<string, SchemaObject> = {
  id: { type: 'string', pattern: '^[1-9][0-9]*$', example: '1' },
  user_id: { type: 'string', pattern: '^[1-9][0-9]*$', example: '1' },
  is_active: { type: 'boolean' },
  created_at: { type: 'string', format: 'date-time' },
  updated_at: { type: 'string', format: 'date-time' },
};

export function financePageSchema(item: SchemaObject): SchemaObject {
  return {
    type: 'object',
    required: ['data', 'meta'],
    properties: {
      data: { type: 'array', items: item },
      meta: {
        type: 'object',
        required: ['page', 'limit', 'total_items', 'total_pages'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          total_items: { type: 'integer', minimum: 0 },
          total_pages: { type: 'integer', minimum: 0 },
        },
      },
    },
  };
}
