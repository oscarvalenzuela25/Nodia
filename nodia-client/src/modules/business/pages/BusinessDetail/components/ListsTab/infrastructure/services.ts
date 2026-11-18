import { isAxiosError } from "axios";
import { z } from "zod";
import { mainInstance } from "../../../../../../../config/api";
import { apiPath } from "../../../../../../../config/apiPath";
import { cashCatalogIdSchema, cashUuidSchema, cashVersionSchema } from "../../../../../infrastructure/cashSchemas";
import { getProducts } from "../../../../../infrastructure/services";

export const maxListItems = 500;
export const maxListName = 150;

const decimalQuantity = z.string().regex(/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,3})?$/).refine(value => /[1-9]/.test(value));
export const normalizeListQuantity = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  const parsed = decimalQuantity.safeParse(normalized);
  if (!parsed.success) return null;
  const [whole, fraction] = parsed.data.split(".");
  const significant = fraction?.replace(/0+$/, "");
  return significant ? `${whole}.${significant}` : whole;
};

const summarySchema = z.object({
  id: cashUuidSchema,
  name: z.string().min(1),
  is_active: z.boolean(),
  version: cashVersionSchema,
  item_count: z.int().min(0).max(maxListItems),
});

const markSchema = z.object({
  id: cashUuidSchema,
  checked: z.boolean(),
  check_version: cashVersionSchema,
});

const itemSchema = markSchema.extend({
  product_id: cashCatalogIdSchema,
  name: z.string().min(1),
  quantity: decimalQuantity,
  position: z.int().min(0).max(maxListItems - 1),
  available: z.boolean(),
});

const detailSchema = summarySchema.extend({
  items: z.array(itemSchema).max(maxListItems),
}).superRefine((list, context) => {
  const ids = new Set(list.items.map(item => item.id));
  const products = new Set(list.items.map(item => item.product_id));
  if (list.item_count !== list.items.length || ids.size !== list.items.length ||
      products.size !== list.items.length || list.items.some((item, index) => item.position !== index)) {
    context.addIssue({ code: "custom", message: "Invalid list composition" });
  }
});

const pageSchema = z.object({
  items: z.array(summarySchema).max(100),
  pagination: z.object({
    page: z.int().min(1),
    limit: z.int().min(1).max(100),
    total: z.int().min(0),
    total_pages: z.int().min(0),
  }),
});

const catalogPageSchema = z.object({
  data: z.array(z.object({ id: cashCatalogIdSchema, name: z.string().min(1), business_id: cashUuidSchema, is_active: z.boolean() })),
  meta: z.object({ page: z.int().min(1), total_pages: z.int().min(0) }),
});

export type ShoppingListSummary = z.infer<typeof summarySchema>;
export type ShoppingListItem = z.infer<typeof itemSchema>;
export type ShoppingListDetail = z.infer<typeof detailSchema>;
export type ShoppingListMark = z.infer<typeof markSchema>;
export type ShoppingListDraftItem = { product_id: string; quantity: string; item_id?: string };
export type ShoppingListDraft = { name: string; items: ShoppingListDraftItem[] };
export type ShoppingListCreate = { request_key: string; name: string; items: Omit<ShoppingListDraftItem, "item_id">[] };

const listPath = (businessId: string) => apiPath(`/businesses/${cashUuidSchema.parse(businessId)}/lists`);
const listDetailPath = (businessId: string, id: string) => `${listPath(businessId)}/${cashUuidSchema.parse(id)}`;

const parseDetail = (data: unknown, expectedId?: string) =>
  detailSchema.refine(detail => !expectedId || detail.id === expectedId).parse(data);

export const readLists = async (businessId: string, params: { page: number; limit: number; search?: string }, signal: AbortSignal) =>
  pageSchema.parse((await mainInstance.get<unknown>(listPath(businessId), { params, signal })).data);

export const readList = async (businessId: string, id: string, signal: AbortSignal) =>
  parseDetail((await mainInstance.get<unknown>(listDetailPath(businessId, id), { signal })).data, id);

export const createList = async (businessId: string, payload: ShoppingListCreate) =>
  parseDetail((await mainInstance.post<unknown>(listPath(businessId), payload)).data);

export const readListReceipt = async (businessId: string, requestKey: string) => {
  try {
    return parseDetail((await mainInstance.get<unknown>(`${listPath(businessId)}/requests/${cashUuidSchema.parse(requestKey)}`)).data);
  } catch (error) {
    if (shoppingListHttpStatus(error) === 404) return null;
    throw error;
  }
};

export const updateList = async (businessId: string, id: string, payload: ShoppingListDraft & { version: number }) =>
  parseDetail((await mainInstance.put<unknown>(listDetailPath(businessId, id), payload)).data, id);

export const updateListActivity = async (businessId: string, id: string, payload: { version: number; is_active: boolean }) =>
  parseDetail((await mainInstance.put<unknown>(`${listDetailPath(businessId, id)}/activity`, payload)).data, id);

export const updateListCheck = async (businessId: string, listId: string, itemId: string, payload: { check_version: number; checked: boolean }) => {
  const path = `${listDetailPath(businessId, listId)}/items/${cashUuidSchema.parse(itemId)}/check`;
  const result = (await mainInstance.put<unknown>(path, payload)).data;
  return markSchema.refine(mark => mark.id === itemId && mark.checked === payload.checked &&
    mark.check_version >= payload.check_version).parse(result);
};

export const shoppingListHttpStatus = (error: unknown) => isAxiosError(error) ? error.response?.status : undefined;

export const isShoppingListScopeError = (error: unknown) => {
  const status = shoppingListHttpStatus(error);
  return status === 401 || status === 403 || status === 404;
};

export const isUncertainListWrite = (error: unknown) => {
  const status = shoppingListHttpStatus(error);
  return status === undefined || status === 408 || status >= 500;
};

export const readListCatalog = async (businessId: string, page: number, search: string, signal: AbortSignal) => {
  const result = catalogPageSchema.parse(await getProducts({
    page,
    limit: 40,
    q: { business_id_eq: businessId, is_active_eq: true, name_cont: search || undefined, s: "name asc" },
  }, signal));
  return {
    ...result,
    data: result.data.filter(product => product.business_id === businessId && product.is_active),
  };
};
