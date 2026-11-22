import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

const priceFields = [
  'name',
  'measurement_unit',
  'sale_price',
  'effective_price',
  'price_source',
] as const;

function isObject(
  value: NodiaAiJsonValue | undefined,
): value is NodiaAiJsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function productCatalogPricePage(
  result: NodiaAiJsonObject,
): NodiaAiJsonObject {
  const { data, meta } = result;
  if (!Array.isArray(data) || !isObject(meta) || !data.every(isObject))
    return result;

  return {
    ...result,
    data: data.map((product) =>
      Object.fromEntries<NodiaAiJsonValue>(
        priceFields
          .filter((key) => Object.hasOwn(product, key))
          .map((key) => [key, product[key]]),
      ),
    ),
  };
}
