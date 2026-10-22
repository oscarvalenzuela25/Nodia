import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScopeUsers } from "../../../components/UserScopeSelect/infrastructure/services";
import { mainInstance } from "../../../config/api";

vi.mock("../../../config/api", () => ({
  mainInstance: { defaults: { baseURL: "/api/v1" }, get: vi.fn() },
}));
const get = vi.mocked(mainInstance.get);
beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({
    data: {
      data: [
        {
          id: "2",
          name: null,
          email: "synthetic@example.invalid",
          is_active: false,
        },
      ],
      meta: { page: 1, total_pages: 1 },
    },
  });
});
describe("Owner catalog contract", () => {
  it("keeps inactive historical recipients and delegates bounded filtering to the API", async () => {
    const result = await getScopeUsers("synthetic", 1);
    expect(result.data[0].is_active).toBe(false);
    expect(get).toHaveBeenCalledWith(
      "/users",
      expect.objectContaining({
        params: {
          page: 1,
          limit: 20,
          includes: false,
          q: { email_cont: "synthetic" },
        },
      }),
    );
  });
  it("restricts new accommodation recipients to active users", async () => {
    await getScopeUsers("", 2, undefined, undefined, true);
    expect(get).toHaveBeenCalledWith(
      "/users",
      expect.objectContaining({
        params: {
          page: 2,
          limit: 20,
          includes: false,
          q: { is_active_eq: true },
        },
      }),
    );
  });
  it("resolves the selected identity independently of activity and search", async () => {
    await getScopeUsers("different", 1, "2", undefined, true);
    expect(get).toHaveBeenCalledWith(
      "/users",
      expect.objectContaining({
        params: expect.objectContaining({ q: { id_eq: "2" } }),
      }),
    );
  });
  it("rejects missing pagination and malformed remote users instead of accepting an empty result", async () => {
    get.mockResolvedValueOnce({ data: { data: [] } });
    await expect(getScopeUsers("", 1)).rejects.toThrow();
    get.mockResolvedValueOnce({
      data: { data: [{ id: "invalid" }], meta: { page: 1, total_pages: 1 } },
    });
    await expect(getScopeUsers("", 1)).rejects.toThrow();
  });
});
