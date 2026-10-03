import type { RansackPolicy } from '../types/ransack.type.js';

const common = {
  id: 'bigint',
  is_active: 'boolean',
  created_at: 'date',
  updated_at: 'date',
} as const;
const catalogue = { ...common, key: 'text' } as const;
const prices = {
  code: 'text',
  name: 'text',
  cost_price: 'number',
  cost_price_tax: 'number',
  profit_percentage: 'number',
  sale_price: 'number',
  stock: 'number',
} as const;

// Explicit public columns. Never derive this surface from every ORM column.
export const RANSACK_POLICIES = {
  user: { ...common, name: 'text', email: 'text' },
  role: catalogue,
  action: { ...catalogue, description: 'text' },
  module: {
    ...catalogue,
    module_group_id: 'bigint',
    link: 'text',
    icon: 'text',
  },
  module_group: catalogue,
  business_action: { ...catalogue, has_description: 'boolean' },
  business: {
    ...common,
    id: 'uuid',
    name: 'text',
    owner_id: 'bigint',
    has_description: 'boolean',
  },
  provider: { ...common, business_id: 'uuid', name: 'text', tax: 'number' },
  product: { ...common, ...prices, business_id: 'uuid', provider_id: 'bigint' },
  product_log: {
    id: 'bigint',
    created_at: 'date',
    updated_at: 'date',
    ...prices,
    product_id: 'bigint',
  },
  invoice: {
    ...common,
    business_id: 'uuid',
    provider_id: 'bigint',
    code: 'text',
    total_amount: 'number',
    path_storage: 'text',
  },
  ai_provider: {
    ...common,
    catalog_id: 'bigint',
    name: 'text',
    is_default: 'boolean',
    key: { kind: 'text', column: 'catalog.key' },
  },
  api_key: {
    ...common,
    provider_id: 'bigint',
    connection_id: { kind: 'bigint', column: 'api_key.provider_id' },
    label: 'text',
    sort_order: 'number',
    is_selected: 'boolean',
    health_state: 'text',
  },
  event: {
    ...common,
    provider_id: 'bigint',
    connection_id: { kind: 'bigint', column: 'event.provider_id' },
    api_key_id: 'bigint',
    actor_user_id: 'bigint',
    event_type: 'text',
    reason_code: 'text',
  },
} as const satisfies Record<string, RansackPolicy>;
