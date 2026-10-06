import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../config/api";
import { apiPath } from "../../../../config/apiPath";
import {
  ackSchema,
  propertySchema,
  overviewSchema,
} from "../../../../modules/rentals/infrastructure/schemas";
import {
  executeRentalCommand,
  getRentalList,
  getRentalRead,
  getRentalRecord,
  previewRentalCancellation,
  recoverRentalOperation,
  serializeRentalQuery,
  RentalMutationResponseError,
} from "../../../../modules/rentals/infrastructure/services";
import type {
  RentalCommand,
  RentalListResource,
  RentalPreviewInput,
  RentalQuery,
} from "../../../../modules/rentals/types";
import { examples, property, overview } from "./fixtures";
import useAuthStore from "../../../../store/authStore";
beforeEach(() =>
  useAuthStore.getState().login({
    token: "synthetic",
    expiresAt: Date.now() + 900000,
    user: { id: "1", name: "Synthetic" },
  }),
);
const original = mainInstance.defaults.adapter;
const key = "b18ac8f0-ec05-47b5-aa71-2a249d7cae38";
afterEach(() => {
  mainInstance.defaults.adapter = original;
  useAuthStore.getState().logout();
});
describe("rental verified HTTP contracts", () => {
  it.each(examples)("parses and routes $route", async (fixture) => {
    const url = new URL(fixture.url, "http://synthetic.test");
    const fixtureQuery = Object.fromEntries(
      [...url.searchParams].map(([name, value]) => [
        name,
        ["page", "limit"].includes(name) ? Number(value) : value,
      ]),
    ) as RentalQuery;
    const adapter = vi.fn(async (config) => ({
      config,
      data: fixture.response,
      status: fixture.status,
      statusText: "OK",
      headers: {},
    }));
    mainInstance.defaults.adapter = adapter;
    if (
      fixture.method !== "GET" &&
      !fixture.url.endsWith("cancellation-preview")
    ) {
      const ack = ackSchema.parse(fixture.response);
      const action = ack.operation.split(".")[1];
      const command = {
        operation: ack.operation,
        ...(action !== "create" ? { id: ack.resource_id } : {}),
        data: fixture.request,
      } as RentalCommand;
      expect(
        await executeRentalCommand(
          ack.operation === "property.create" ? undefined : ack.property_id,
          command,
          key,
        ),
      ).toEqual(ack);
      expect(adapter.mock.calls[0][0].headers.get("Idempotency-Key")).toBe(key);
    } else if (fixture.url.endsWith("cancellation-preview")) {
      await previewRentalCancellation(
        "1",
        fixture.url.split("/").at(-2)!,
        fixture.request as RentalPreviewInput,
      );
      expect(
        adapter.mock.calls[0][0].headers.get("Idempotency-Key"),
      ).toBeUndefined();
    } else if (fixture.url.includes("/operations/")) {
      // The recovered operation has its own recorded UUID; the path must retain it.
      await recoverRentalOperation("1", fixture.url.split("/").at(-1)!);
    } else {
      const parts = url.pathname.split("/").slice(5);
      const propertyId = parts[0];
      const resource = (parts[1] ?? "properties") as RentalListResource;
      if (["calendar", "availability", "overview"].includes(resource))
        await getRentalRead(
          resource as "calendar" | "availability" | "overview",
          propertyId,
          fixtureQuery,
        );
      else if (parts[2] || (propertyId && !parts[1]))
        await getRentalRecord(
          resource,
          resource === "properties" ? undefined : propertyId,
          parts[2] ?? propertyId,
        );
      else
        await getRentalList(
          resource,
          resource === "properties" ? undefined : propertyId,
          fixtureQuery,
        );
    }
    expect(adapter.mock.calls).toHaveLength(1);
    expect(adapter.mock.calls[0][0].url).toBe(
      apiPath(url.pathname.replace(/^\/api\/v1/, "")),
    );
    expect(adapter.mock.calls[0][0].method).toBe(fixture.method.toLowerCase());
  });
  it("serializes nested q and enum arrays with separate status and active", () => {
    const query = new URLSearchParams(
      serializeRentalQuery({
        q: { guest_name_cont: "Ana & Luis" },
        status_in: ["draft", "confirmed"],
        channel_in: ["whatsapp"],
        active: "inactive",
        page: 2,
        limit: 20,
      }),
    );
    expect(query.get("q[guest_name_cont]")).toBe("Ana & Luis");
    expect(query.get("status_in[1]")).toBe("confirmed");
    expect(query.get("active")).toBe("inactive");
  });
  it("rejects incomplete and incompatible payloads without manufacturing defaults", () => {
    expect(
      propertySchema.safeParse({ ...property, membership: undefined }).success,
    ).toBe(false);
    expect(propertySchema.safeParse({ ...property, id: 123 }).success).toBe(
      false,
    );
    expect(
      overviewSchema.safeParse({
        ...overview,
        cash: { ...overview.cash, net_amount: "1.25" },
      }).success,
    ).toBe(false);
  });
  it("treats a malformed 2xx acknowledgement as uncertain", async () => {
    mainInstance.defaults.adapter = async (config) => ({
      config,
      data: { id: "7" },
      status: 201,
      statusText: "Created",
      headers: {},
    });
    await expect(
      executeRentalCommand(
        "1",
        {
          operation: "payment.create",
          data: {
            reservation_id: "2",
            type: "payment",
            amount: "10",
            occurred_on: "2026-10-01",
          },
        },
        key,
      ),
    ).rejects.toBeInstanceOf(RentalMutationResponseError);
  });
});
