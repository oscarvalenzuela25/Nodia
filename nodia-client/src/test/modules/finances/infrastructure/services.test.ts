import { readFileSync } from "node:fs";
import { z, ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFinanceList,
  getFinanceOverview,
  getFinanceRecord,
  getFinanceSummary,
  saveFinanceRecord,
  serializeFinanceQuery,
} from "../../../../modules/finances/infrastructure/services";
import type { FinanceQuery } from "../../../../modules/finances/types";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  defaults: { baseURL: "/api/v1" },
}));
vi.mock("../../../../config/api", () => ({ mainInstance: mocks }));
const fixture: unknown = JSON.parse(
  readFileSync("../nodia-server/test/fixtures/finance-api.json", "utf8"),
);
const fixtures = z
  .object({
    synthetic: z.literal(true),
    responses: z.record(z.string(), z.unknown()),
  })
  .parse(fixture).responses;

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.put.mockReset();
  mocks.defaults.baseURL = "/api/v1";
});

describe("finance transport and boundary schemas", () => {
  it("starts bounded and active without inheriting unlimited legacy parameters", () => {
    expect(
      Object.fromEntries(new URLSearchParams(serializeFinanceQuery({}))),
    ).toEqual({ active: "active", page: "1", limit: "10" });
    expect(serializeFinanceQuery({})).not.toContain("all=");
  });

  it("serializes Ransack and domain arrays using nested brackets without losing special characters", () => {
    const query: FinanceQuery = {
      active: "all",
      page: 3,
      limit: 25,
      q: {
        name_cont: "Food & café",
        created_at_gteq: "2026-10-04T03:00:00.000Z",
        type_eq: "expense",
      },
      category_ids: ["2", "9007199254740993"],
      category_group_ids: ["7"],
      obligation_id: "19",
    };
    const params = new URLSearchParams(serializeFinanceQuery(query));
    expect(Object.fromEntries(params)).toEqual({
      active: "all",
      page: "3",
      limit: "25",
      "q[name_cont]": "Food & café",
      "q[created_at_gteq]": "2026-10-04T03:00:00.000Z",
      "q[type_eq]": "expense",
      "category_ids[0]": "2",
      "category_ids[1]": "9007199254740993",
      "category_group_ids[0]": "7",
      obligation_id: "19",
    });
    expect(
      serializeFinanceQuery({ category_ids: [], category_group_ids: [] }),
    ).not.toContain("category_ids");
  });

  it.each([
    { resource: "categories", fixtureKey: "categories" },
    { resource: "category-groups", fixtureKey: "category_groups" },
    { resource: "movements", fixtureKey: "movements" },
    { resource: "obligations", fixtureKey: "obligations" },
  ] as const)(
    "parses the real synthetic server page for $resource",
    async ({ resource, fixtureKey }) => {
      mocks.get.mockResolvedValue({ data: fixtures[fixtureKey] });
      const signal = new AbortController().signal;
      const result = await getFinanceList(
        resource,
        { active: "inactive", page: 2, limit: 10 },
        signal,
      );
      expect(result).toEqual(fixtures[fixtureKey]);
      expect(mocks.get).toHaveBeenCalledWith(
        `/finance/${resource}`,
        expect.objectContaining({
          params: { active: "inactive", page: 2, limit: 10 },
          signal,
        }),
      );
      const options = mocks.get.mock.calls[0][1] as {
        paramsSerializer: () => string;
      };
      expect(
        Object.fromEntries(new URLSearchParams(options.paramsSerializer())),
      ).toEqual({ active: "inactive", page: "2", limit: "10" });
    },
  );

  it("adds the API prefix when the shared instance has an origin-only base URL", async () => {
    mocks.defaults.baseURL = "https://synthetic.example";
    mocks.get.mockResolvedValue({ data: fixtures.category });
    await getFinanceRecord("categories", "1");
    expect(mocks.get).toHaveBeenCalledWith(
      "/api/v1/finance/categories/1",
      expect.any(Object),
    );
  });

  it.each([
    { resource: "categories", fixtureKey: "category" },
    { resource: "category-groups", fixtureKey: "category_group" },
    { resource: "movements", fixtureKey: "movement" },
    { resource: "obligations", fixtureKey: "obligation" },
  ] as const)(
    "hydrates the real synthetic $resource projection by encoded ID",
    async ({ resource, fixtureKey }) => {
      mocks.get.mockResolvedValue({ data: fixtures[fixtureKey] });
      expect(await getFinanceRecord(resource, "1/2")).toEqual(
        fixtures[fixtureKey],
      );
      expect(mocks.get).toHaveBeenCalledWith(
        `/finance/${resource}/1%2F2`,
        expect.any(Object),
      );
    },
  );

  it("creates and updates through distinct endpoints and preserves false in partial updates", async () => {
    mocks.post.mockResolvedValue({ data: fixtures.category });
    const create = { name: "Food", key: "food", is_active: true };
    expect(await saveFinanceRecord("categories", { data: create })).toEqual(
      fixtures.category,
    );
    expect(mocks.post).toHaveBeenCalledWith("/finance/categories", create);
    mocks.put.mockResolvedValue({ data: fixtures.category });
    await saveFinanceRecord("categories", {
      id: "1",
      data: { is_active: false },
    });
    expect(mocks.put).toHaveBeenCalledWith("/finance/categories/1", {
      is_active: false,
    });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("never retries a failed POST in the transport", async () => {
    const error = new Error("Synthetic timeout");
    mocks.post.mockRejectedValue(error);
    await expect(
      saveFinanceRecord("categories", { data: { name: "Food", key: "food" } }),
    ).rejects.toBe(error);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("parses real overview and category/group summary fixtures without narrowing aggregate money", async () => {
    mocks.get
      .mockResolvedValueOnce({ data: fixtures.overview })
      .mockResolvedValueOnce({ data: fixtures.overview_categories })
      .mockResolvedValueOnce({ data: fixtures.overview_category_groups });
    const query: FinanceQuery = { active: "active" };
    expect(await getFinanceOverview(query)).toEqual(fixtures.overview);
    expect(await getFinanceSummary("categories", query)).toEqual(
      fixtures.overview_categories,
    );
    expect(await getFinanceSummary("category-groups", query)).toEqual(
      fixtures.overview_category_groups,
    );
    expect(mocks.get.mock.calls.map((call) => call[0])).toEqual([
      "/finance/overview",
      "/finance/overview/categories",
      "/finance/overview/category-groups",
    ]);
  });

  it("keeps overview sums greater than bigint and negative net as exact strings", async () => {
    const overview = z.record(z.string(), z.unknown()).parse(fixtures.overview);
    mocks.get.mockResolvedValue({
      data: {
        ...overview,
        totals: {
          income_amount: "18446744073709551614",
          expense_amount: "18446744073709551615",
          net_amount: "-1",
          movement_count: 2,
          pending_count: 0,
          cancelled_count: 0,
        },
      },
    });
    const result = await getFinanceOverview({});
    expect(result.totals.income_amount).toBe("18446744073709551614");
    expect(result.totals.net_amount).toBe("-1");
  });

  it.each([100000, "0", "-1", "1.5", "9223372036854775808"])(
    "rejects malformed movement amount at the HTTP boundary: %s",
    async (amount) => {
      const movement = z
        .record(z.string(), z.unknown())
        .parse(fixtures.movement);
      mocks.get.mockResolvedValue({ data: { ...movement, amount } });
      await expect(getFinanceRecord("movements", "1")).rejects.toBeInstanceOf(
        ZodError,
      );
    },
  );

  it("rejects mismatched movement type/status and missing ownership rather than manufacturing defaults", async () => {
    const movement = z.record(z.string(), z.unknown()).parse(fixtures.movement);
    mocks.get.mockResolvedValueOnce({
      data: { ...movement, type: "expense", status: "received" },
    });
    await expect(getFinanceRecord("movements", "1")).rejects.toBeInstanceOf(
      ZodError,
    );
    const category = z.record(z.string(), z.unknown()).parse(fixtures.category);
    delete category.user_id;
    mocks.get.mockResolvedValueOnce({ data: category });
    await expect(getFinanceRecord("categories", "1")).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it("rejects invalid pagination and incomplete overview, preserving zero only when the server supplied it", async () => {
    const categories = z
      .record(z.string(), z.unknown())
      .parse(fixtures.categories);
    mocks.get.mockResolvedValueOnce({
      data: {
        ...categories,
        meta: { page: 0, limit: 1000, total_items: 1, total_pages: 1 },
      },
    });
    await expect(getFinanceList("categories")).rejects.toBeInstanceOf(ZodError);
    mocks.get.mockResolvedValueOnce({
      data: { totals: { income_amount: "0" } },
    });
    await expect(getFinanceOverview({})).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects unsafe numeric IDs instead of rounding their identity", async () => {
    const category = z.record(z.string(), z.unknown()).parse(fixtures.category);
    mocks.get.mockResolvedValue({
      data: { ...category, id: 9007199254740992 },
    });
    await expect(getFinanceRecord("categories", "1")).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it.each([
    { type: "loan", originType: "income", originStatus: "received" },
    { type: "debt", originType: "expense", originStatus: "paid" },
    { type: "loan", originType: "expense", originStatus: "received" },
  ])(
    "rejects inconsistent obligation initial direction or status: $type/$originType/$originStatus",
    async ({ type, originType, originStatus }) => {
      const obligation = z
        .record(z.string(), z.unknown())
        .parse(fixtures.obligation);
      const origin = z
        .record(z.string(), z.unknown())
        .parse(obligation.initial_movement);
      mocks.get.mockResolvedValue({
        data: {
          ...obligation,
          type,
          initial_movement: {
            ...origin,
            type: originType,
            status: originStatus,
          },
        },
      });
      await expect(getFinanceRecord("obligations", "1")).rejects.toBeInstanceOf(
        ZodError,
      );
    },
  );

  it("rejects divergent principal and manufactured obligation balance", async () => {
    const obligation = z
      .record(z.string(), z.unknown())
      .parse(fixtures.obligation);
    const origin = z
      .record(z.string(), z.unknown())
      .parse(obligation.initial_movement);
    mocks.get.mockResolvedValueOnce({
      data: { ...obligation, initial_movement: { ...origin, amount: "1" } },
    });
    await expect(getFinanceRecord("obligations", "1")).rejects.toBeInstanceOf(
      ZodError,
    );
    mocks.get.mockResolvedValueOnce({
      data: { ...obligation, remaining_amount: "999999" },
    });
    await expect(getFinanceRecord("obligations", "1")).rejects.toBeInstanceOf(
      ZodError,
    );
    mocks.get.mockResolvedValueOnce({
      data: { ...obligation, remaining_amount: null },
    });
    await expect(getFinanceRecord("obligations", "1")).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});
