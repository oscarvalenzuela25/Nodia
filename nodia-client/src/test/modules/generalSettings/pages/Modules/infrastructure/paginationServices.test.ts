import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { mainInstance } from "../../../../../../config/api";
import { queryClient } from "../../../../../../config/reactQuery";
import useAuthStore from "../../../../../../store/authStore";
import { getModules, getModuleGroups } from "../../../../../../modules/generalSettings/pages/Modules/infrastructure/services";

const originalAdapter = mainInstance.defaults.adapter;
const page = { data: [], meta: { page: 1, limit: 5, total_items: 0, total_pages: 0 } };
let requests: InternalAxiosRequestConfig[];

beforeEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  useAuthStore.getState().login({
    token: "pagination-fixture", expiresAt: Date.now() + 900000,
    user: { id: "42", name: "Pagination fixture" },
  });
  requests = [];
  mainInstance.defaults.adapter = vi.fn(async (config) => {
    requests.push(config);
    return { config, data: page, status: 200, statusText: "OK", headers: {} };
  });
});

afterEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  mainInstance.defaults.adapter = originalAdapter;
});

describe.each([
  { resource: "modules", read: getModules },
  { resource: "module-groups", read: getModuleGroups },
])("$resource pagination transport", ({ resource, read }) => {
  it("sends size as canonical limit while preserving page and filters", async () => {
    const params = Object.freeze({ page: 2, size: 5, q: { is_active_eq: true } });
    await expect(read(params)).resolves.toEqual(page);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toMatch(new RegExp(`/${resource}$`));
    expect(requests[0].params).toEqual({ page: 2, limit: 5, q: params.q });
    expect(requests[0].params).not.toHaveProperty("size");
    expect(params.size).toBe(5);
  });

  it("gives an explicit limit precedence over size", async () => {
    await read({ page: 1, size: 5, limit: 2 });
    expect(requests[0].params).toEqual({ page: 1, limit: 2 });
    expect(requests[0].params).not.toHaveProperty("size");
  });

  it("keeps calls without parameters undefined", async () => {
    await read();
    expect(requests[0].params).toBeUndefined();
  });

  it("preserves all queries without inventing a pagination limit", async () => {
    await read({ all: true, q: { key_cont: "fixture" } });
    expect(requests[0].params).toEqual({ all: true, q: { key_cont: "fixture" } });
    expect(requests[0].params).not.toHaveProperty("limit");
  });

  it("leaves canonical pagination unchanged", async () => {
    await read({ page: 3, limit: 5, all: false });
    expect(requests[0].params).toEqual({ page: 3, limit: 5, all: false });
  });
});

it("uses the same canonical page size for the ordering locator", async () => {
  await expect(getModules({ ordering: true, locate_id: "12", size: 5, includes: true })).resolves.toEqual(page);
  expect(requests[0].params).toEqual({ ordering: true, locate_id: "12", limit: 5, includes: true });
  expect(requests[0].params).not.toHaveProperty("size");
});
