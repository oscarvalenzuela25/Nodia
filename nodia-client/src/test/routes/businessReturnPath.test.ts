import { describe, expect, it } from "vitest";
import { businessReturnPath } from "../../routes/businessReturnPath";

const path = "/business/9601aa95-dd70-4af3-a5cf-50dd553a4ae9";

describe("businessReturnPath", () => {
  it("accepts the canonical path from login navigation state", () => {
    expect(businessReturnPath({ businessReturnPath: path })).toBe(path);
  });

  it.each([
    null, undefined, {}, path, { businessReturnPath: `${path}/` },
    { businessReturnPath: `${path}\n` }, { businessReturnPath: `${path}?section=sales` },
    { businessReturnPath: `https://example.com${path}` }, { businessReturnPath: `/${path}` },
    { businessReturnPath: path.replace("/business", "/tools/business") },
    { businessReturnPath: path.replace("9", "%39") },
  ])("rejects a state outside the business route contract (%j)", (state) => {
    expect(businessReturnPath(state)).toBeUndefined();
  });
});
