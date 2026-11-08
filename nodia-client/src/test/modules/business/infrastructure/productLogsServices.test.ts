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
      }),
      { signal: undefined }
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
      payload,
      { signal: undefined }
    );
    expect(result).toEqual(mockResponse);
  });
  it.each([1, 11])('propagates the preparation cancellation signal with %i product IDs', async count => {
    const controller = new AbortController();
    const response = { data: [], meta: { total_items: 0 } };
    vi.mocked(mainInstance.get).mockResolvedValue({ data: response });
    vi.mocked(mainInstance.post).mockResolvedValue({ data: response });
    await getProductLogs({ q: { product_id_in: Array.from({ length: count }, (_, i) => String(i + 1)) } }, controller.signal);
    const configuration = count > 10 ? vi.mocked(mainInstance.post).mock.calls[0][2] : vi.mocked(mainInstance.get).mock.calls[0][1];
    expect(configuration?.signal).toBe(controller.signal);
    controller.abort();
    expect(configuration?.signal?.aborted).toBe(true);
  });
});
