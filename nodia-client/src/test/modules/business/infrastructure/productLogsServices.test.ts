import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProductLogs,
  queryProductLogs,
} from "../../../../../src/modules/business/infrastructure/services";
import { mainInstance } from "../../../../../src/config/api";
import { apiPath } from "../../../../../src/config/apiPath";

vi.mock("../../../../../src/config/api", () => ({
  mainInstance: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Product Log Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses GET /product-logs when product_id_in has 10 or fewer items", async () => {
    const mockResponse = {
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 0 },
    };
    vi.mocked(mainInstance.get).mockResolvedValue({ data: mockResponse });

    const params = {
      all: true,
      q: {
        product_id_in: ["1", "2", "3"],
        s: "created_at desc",
      },
    };

    const result = await getProductLogs(params);

    expect(mainInstance.get).toHaveBeenCalledTimes(1);
    expect(mainInstance.get).toHaveBeenCalledWith(apiPath("/product-logs"), {
      params,
    });
    expect(mainInstance.post).not.toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });

  it("automatically switches to POST /product-logs/query when product_id_in has more than 10 items", async () => {
    const mockResponse = {
      data: [],
      meta: { total_items: 0, page: 1, limit: 15, total_pages: 0 },
    };
    vi.mocked(mainInstance.post).mockResolvedValue({ data: mockResponse });

    const productIds = [
      "55", "62", "61", "60", "59", "58", "57", "56", "49", "54", "53", "52",
    ];

    const params = {
      all: true,
      q: {
        product_id_in: productIds,
        s: "created_at desc",
      },
    };

    const result = await getProductLogs(params);

    expect(mainInstance.post).toHaveBeenCalledTimes(1);
    expect(mainInstance.post).toHaveBeenCalledWith(
      apiPath("/product-logs/query"),
      expect.objectContaining({
        product_ids: productIds,
        all: true,
        s: "created_at desc",
      })
    );
    expect(mainInstance.get).not.toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });

  it("executes queryProductLogs directly via POST /product-logs/query", async () => {
    const mockResponse = {
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 0 },
    };
    vi.mocked(mainInstance.post).mockResolvedValue({ data: mockResponse });

    const payload = {
      product_ids: ["101", "102"],
      all: true,
    };

    const result = await queryProductLogs(payload);

    expect(mainInstance.post).toHaveBeenCalledWith(
      apiPath("/product-logs/query"),
      payload
    );
    expect(result).toEqual(mockResponse);
  });
});
