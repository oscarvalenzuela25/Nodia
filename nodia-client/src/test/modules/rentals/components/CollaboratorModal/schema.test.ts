import { describe, expect, it } from "vitest";
import { collaboratorSchema } from "../../../../../modules/rentals/components/CollaboratorModal/schema";
describe("CollaboratorModal contract", () => {
  it("clears position with explicit null and keeps the user string ID", () =>
    expect(
      collaboratorSchema.parse({
        user_id: "9223372036854775807",
        position: " ",
        is_active: true,
      }),
    ).toEqual({
      user_id: "9223372036854775807",
      position: null,
      is_active: true,
    }));
  it.each(["", "0", "-1", "1.0", "9223372036854775808"])(
    "rejects invalid identity %s",
    (user_id) =>
      expect(
        collaboratorSchema.safeParse({ user_id, position: "", is_active: true })
          .success,
      ).toBe(false),
  );
});
