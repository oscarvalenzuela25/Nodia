import { financeRecordProperties } from '../../finance-common/dto/finance-response.schemas.js';

export const FINANCE_CATEGORY_SCHEMA = {
  type: 'object' as const,
  required: [
    'id',
    'user_id',
    'name',
    'key',
    'is_active',
    'created_at',
    'updated_at',
  ],
  additionalProperties: false,
  properties: {
    ...financeRecordProperties,
    id: { type: 'string' as const, pattern: '^[1-9]\\d{0,18}$', example: '42' },
    name: { type: 'string' as const, minLength: 1, maxLength: 255 },
    key: { type: 'string' as const, minLength: 1, maxLength: 255 },
    is_active: { type: 'boolean' as const },
    created_at: { type: 'string' as const, format: 'date-time' },
    updated_at: { type: 'string' as const, format: 'date-time' },
  },
};

export const FINANCE_CATALOG_PAGE_META_SCHEMA = {
  type: 'object' as const,
  required: ['page', 'limit', 'total_items', 'total_pages'],
  additionalProperties: false,
  properties: {
    page: { type: 'integer' as const, minimum: 1, maximum: 1000000 },
    limit: { type: 'integer' as const, minimum: 1, maximum: 100 },
    total_items: { type: 'integer' as const, minimum: 0 },
    total_pages: { type: 'integer' as const, minimum: 0 },
  },
};

export const FINANCE_CATEGORY_PAGE_SCHEMA = {
  type: 'object' as const,
  required: ['data', 'meta'],
  additionalProperties: false,
  properties: {
    data: {
      type: 'array' as const,
      items: FINANCE_CATEGORY_SCHEMA,
      maxItems: 100,
    },
    meta: FINANCE_CATALOG_PAGE_META_SCHEMA,
  },
};

export const FINANCE_CATALOG_ERROR_SCHEMA = {
  type: 'object' as const,
  required: ['statusCode', 'timestamp', 'path', 'method', 'error', 'message'],
  properties: {
    statusCode: { type: 'integer' as const },
    timestamp: { type: 'string' as const, format: 'date-time' },
    path: { type: 'string' as const },
    method: { type: 'string' as const },
    error: { type: 'string' as const },
    message: {
      oneOf: [
        { type: 'string' as const },
        { type: 'array' as const, items: { type: 'string' as const } },
      ],
    },
  },
};
