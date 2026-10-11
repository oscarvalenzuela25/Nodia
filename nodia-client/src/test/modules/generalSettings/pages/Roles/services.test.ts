import { beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../config/api";
import { deleteRole } from "../../../../../modules/generalSettings/pages/Roles/infrastructure/services";
vi.mock("../../../../../config/api", () => ({
  mainInstance: { defaults: { baseURL: "" }, delete: vi.fn() },
}));
describe("deleteRole transport", () => {
  beforeEach(() =>
    vi.mocked(mainInstance.delete).mockResolvedValue({ status: 204 }),
  );
  it.each(["http://localhost", "http://localhost/api/v1"])(
    "uses one API version and preserves exact IDs for %s",
    async (baseURL) => {
      mainInstance.defaults.baseURL = baseURL;
      await expect(deleteRole("9007199254740993")).resolves.toBeUndefined();
      expect(mainInstance.delete).toHaveBeenCalledWith(
        baseURL.endsWith("/api/v1")
          ? "/role/9007199254740993"
          : "/api/v1/role/9007199254740993",
      );
    },
  );
});
