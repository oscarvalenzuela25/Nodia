import {
  FINANCE_CATEGORY_SCHEMA,
  FINANCE_CATALOG_PAGE_META_SCHEMA,
} from '../../finance-category/dto/finance-category-response.schemas.js';

export const FINANCE_CATEGORY_GROUP_SCHEMA = {
  ...FINANCE_CATEGORY_SCHEMA,
  required: [...FINANCE_CATEGORY_SCHEMA.required, 'category_count'],
  properties: {
    ...FINANCE_CATEGORY_SCHEMA.properties,
    category_count: { type: 'integer' as const, minimum: 0, maximum: 100 },
  },
};

export const FINANCE_CATEGORY_GROUP_DETAIL_SCHEMA = {
  ...FINANCE_CATEGORY_GROUP_SCHEMA,
  required: [...FINANCE_CATEGORY_GROUP_SCHEMA.required, 'categories'],
  properties: {
    ...FINANCE_CATEGORY_GROUP_SCHEMA.properties,
    categories: {
      type: 'array' as const,
      maxItems: 100,
      items: {
        type: 'object' as const,
        additionalProperties: false,
        required: ['id', 'name', 'key', 'is_active'],
        properties: {
          id: FINANCE_CATEGORY_SCHEMA.properties.id,
          name: FINANCE_CATEGORY_SCHEMA.properties.name,
          key: FINANCE_CATEGORY_SCHEMA.properties.key,
          is_active: FINANCE_CATEGORY_SCHEMA.properties.is_active,
        },
      },
    },
  },
};

export const FINANCE_CATEGORY_GROUP_PAGE_SCHEMA = {
  type: 'object' as const,
  required: ['data', 'meta'],
  additionalProperties: false,
  properties: {
    data: {
      type: 'array' as const,
      items: FINANCE_CATEGORY_GROUP_SCHEMA,
      maxItems: 100,
    },
    meta: FINANCE_CATALOG_PAGE_META_SCHEMA,
  },
};
