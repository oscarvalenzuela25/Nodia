import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import useAuthStore from "../../../../store/authStore";
import { mainInstance } from "../../../../config/api";
import { notifyHttpError } from "../../../../config/httpFeedback";
import i18n from "../../../../translate";
import {
  rentalKeys,
  useRentalList,
  useRentalMutation,
  useRentalRecord,
  invalidateRentalMutation,
} from "../../../../modules/rentals/infrastructure/useServices";
import {
  clearRentalIntents,
  rentalPendingCount,
} from "../../../../modules/rentals/infrastructure/intents";
import type {
  RentalAck,
  RentalCommand,
} from "../../../../modules/rentals/types";
import { property, payment } from "./fixtures";
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const original = mainInstance.defaults.adapter;
const command: RentalCommand = {
  operation: "payment.create",
  data: {
    reservation_id: "2",
    type: "payment",
    amount: "20000",
    occurred_on: "2026-10-01",
  },
};
const ack: RentalAck = {
  operation: "payment.create",
  property_id: "1",
  resource_type: "payment",
  resource_id: "7",
  status: "confirmed",
  updated_at: "2026-10-04T12:00:00Z",
};
let client: QueryClient;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, data, status, statusText: "OK", headers: {} });
const reject = (
  config: InternalAxiosRequestConfig,
  status: number,
  message: string,
) =>
  new AxiosError(
    message,
    undefined,
    config,
    undefined,
    response(config, { message }, status),
  );
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function login(id = "1") {
  useAuthStore.getState().login({
    token: "synthetic",
    expiresAt: Date.now() + 900000,
    user: { id, name: "Synthetic" },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    queryCache: new QueryCache({ onError: notifyHttpError }),
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clearRentalIntents();
  login();
});
afterEach(() => {
  client.clear();
  mainInstance.defaults.adapter = original;
  useAuthStore.getState().logout();
});
describe("rental write intents", () => {
  it("preserves the frozen payment and its UUID through a 401 session renewal", async () => {
    const sent: { key: unknown; body: unknown; authorization: unknown }[] = [];
    let refreshes = 0;
    mainInstance.defaults.adapter = async (config) => {
      if (config.url?.endsWith("/auth/refresh")) {
        refreshes++;
        return response(config, {
          token: "renewed-synthetic",
          expiresAt: Date.now() + 900000,
          user: { id: "1", name: "Synthetic" },
        });
      }
      sent.push({
        key: config.headers.get("Idempotency-Key"),
        body: config.data,
        authorization: config.headers.get("Authorization"),
      });
      if (sent.length === 1) throw reject(config, 401, "auth:session_expired");
      return response(config, ack, 201);
    };
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    await act(async () => {
      expect(await result.current.execute(command)).toEqual(ack);
    });
    expect(refreshes).toBe(1);
    expect(sent).toHaveLength(2);
    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[1].body).toBe(sent[0].body);
    expect(JSON.parse(String(sent[1].body))).toEqual(command.data);
    expect(sent.map((row) => row.authorization)).toEqual([
      "Bearer synthetic",
      "Bearer renewed-synthetic",
    ]);
    expect(result.current.isUncertain).toBe(false);
    expect(result.current.intent).toBeUndefined();
    expect(
      vi
        .mocked(sileo.success)
        .mock.calls.filter(
          ([message]) => message.title === i18n.t("rental:saved"),
        ),
    ).toHaveLength(1);
    expect(sileo.success).toHaveBeenCalledWith({
      title: i18n.t("auth:refresh_success"),
    });
    expect(sileo.error).not.toHaveBeenCalled();
  });
  it("keeps a confirmed write successful when its subsequent read fails", async () => {
    let reads = 0;
    let writes = 0;
    mainInstance.defaults.adapter = async (config) => {
      if (config.method === "post") {
        writes++;
        return response(config, ack, 201);
      }
      reads++;
      if (reads > 1) throw reject(config, 503, "rental:unavailable");
      return response(config, {
        data: [payment],
        meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
      });
    };
    const { result } = renderHook(
      () => ({
        list: useRentalList("payments", "1", {}),
        write: useRentalMutation("1"),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data?.data).toHaveLength(1));
    expect(result.current.list.isError).toBe(false);
    await act(async () => {
      expect(await result.current.write.execute(command)).toEqual(ack);
    });
    await waitFor(() => expect(result.current.list.isError).toBe(true));
    expect(result.current.list.data?.data).toEqual([payment]);
    expect(result.current.write.intent).toBeUndefined();
    expect(result.current.write.isUncertain).toBe(false);
    expect(rentalPendingCount("1", "1")).toBe(0);
    expect(writes).toBe(1);
    expect(sileo.success).toHaveBeenCalledOnce();
    expect(sileo.error).toHaveBeenCalledOnce();
  });
  it("freezes the command, blocks a second submission and retries the identical UUID after a lost response", async () => {
    const adapter = vi.fn(async (config) => {
      if (adapter.mock.calls.length === 1)
        throw new AxiosError("Timeout", "ECONNABORTED", config);
      return response(config, ack);
    });
    mainInstance.defaults.adapter = adapter;
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    const input = structuredClone(command);
    await act(async () => {
      expect(await result.current.execute(input)).toBeUndefined();
    });
    expect(result.current.isUncertain).toBe(true);
    expect(rentalPendingCount("1", "1")).toBe(1);
    input.data.amount = "999";
    await act(async () => {
      expect(await result.current.execute(input)).toBeUndefined();
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(await result.current.retry()).toEqual(ack);
    });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[1][0].headers.get("Idempotency-Key")).toBe(
      adapter.mock.calls[0][0].headers.get("Idempotency-Key"),
    );
    expect(adapter.mock.calls[1][0].data).toBe(adapter.mock.calls[0][0].data);
    expect(JSON.parse(adapter.mock.calls[1][0].data).amount).toBe("20000");
    expect(result.current.intent).toBeUndefined();
    expect(sileo.success).toHaveBeenCalledTimes(1);
  });
  it("deduplicates immediate double clicks while a request is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    mainInstance.defaults.adapter = async (config) =>
      response(
        config,
        await new Promise((resolve) => {
          finish = resolve;
        }),
      );
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    let first: Promise<RentalAck | undefined>;
    await act(async () => {
      first = result.current.execute(command);
      expect(await result.current.execute(command)).toBeUndefined();
    });
    await act(async () => {
      finish(ack);
      expect(await first!).toEqual(ack);
    });
    expect(sileo.success).toHaveBeenCalledTimes(1);
  });
  it("keeps malformed 2xx responses pending until a verified operation recovers", async () => {
    mainInstance.defaults.adapter = async (config) =>
      response(
        config,
        config.method === "get"
          ? { schema_version: 1, http_status: 201, body: ack }
          : { id: "7" },
      );
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    await act(async () => {
      await result.current.execute(command);
    });
    expect(result.current.isUncertain).toBe(true);
    await act(async () => {
      expect(await result.current.recover()).toEqual(ack);
    });
    expect(result.current.isUncertain).toBe(false);
  });
  it("a recovery 404 or a later rejected replay does not authorize a new key", async () => {
    let calls = 0;
    mainInstance.defaults.adapter = async (config) => {
      calls++;
      if (calls === 1) throw new AxiosError("Offline", undefined, config);
      if (config.url?.endsWith("/1")) return response(config, property);
      throw reject(config, 404, "rental:not_found");
    };
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    await act(async () => {
      await result.current.execute(command);
    });
    const key = result.current.intent?.key;
    await act(async () => {
      await result.current.recover();
    });
    expect(result.current.intent?.key).toBe(key);
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.intent?.key).toBe(key);
    expect(result.current.isUncertain).toBe(true);
  });
  it("a localized idempotency conflict remains uncertain", async () => {
    mainInstance.defaults.adapter = async (config) => {
      throw reject(config, 409, "rental:idempotency_conflict");
    };
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    await act(async () => {
      await result.current.execute(command);
    });
    expect(result.current.isUncertain).toBe(true);
    expect(sileo.error).toHaveBeenCalledTimes(1);
    expect(sileo.success).not.toHaveBeenCalled();
  });
  it("a known initial rejection allows a corrected command with a fresh key", async () => {
    const adapter = vi.fn(async (config) => {
      if (adapter.mock.calls.length === 1)
        throw reject(config, 409, "rental:overpayment");
      return response(config, ack);
    });
    mainInstance.defaults.adapter = adapter;
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    await act(async () => {
      await result.current.execute(command);
    });
    expect(result.current.intent).toBeUndefined();
    await act(async () => {
      expect(await result.current.execute(command)).toEqual(ack);
    });
    expect(adapter.mock.calls[1][0].headers.get("Idempotency-Key")).not.toBe(
      adapter.mock.calls[0][0].headers.get("Idempotency-Key"),
    );
  });
  it("ignores an old actor's late acknowledgement after logout", async () => {
    let finish: (value: unknown) => void = () => {};
    mainInstance.defaults.adapter = async (config) =>
      response(
        config,
        await new Promise((resolve) => {
          finish = resolve;
        }),
      );
    const { result } = renderHook(() => useRentalMutation("1"), { wrapper });
    let first: Promise<RentalAck | undefined>;
    await act(async () => {
      first = result.current.execute(command);
    });
    act(() => {
      useAuthStore.getState().logout();
      login("2");
    });
    await act(async () => {
      finish(ack);
      expect(await first!).toBeUndefined();
    });
    expect(sileo.success).not.toHaveBeenCalled();
    expect(rentalPendingCount("1")).toBe(0);
    expect(result.current.intent).toBeUndefined();
  });
  it("property creation without an ID replays the same creation key for recovery", async () => {
    const createAck: RentalAck = {
      ...ack,
      operation: "property.create",
      resource_type: "property",
      resource_id: "1",
      status: "active",
    };
    const adapter = vi.fn(async (config) => {
      if (adapter.mock.calls.length === 1)
        throw new AxiosError("Timeout", undefined, config);
      return response(config, createAck);
    });
    mainInstance.defaults.adapter = adapter;
    const { result } = renderHook(() => useRentalMutation(), { wrapper });
    await act(async () => {
      await result.current.execute({
        operation: "property.create",
        data: {
          name: "Casa",
          timezone: "America/Santiago",
          max_guests: 4,
          check_in_time: "15:00",
          check_out_time: "11:00",
        },
      });
    });
    await act(async () => {
      expect(await result.current.recover()).toEqual(createAck);
    });
    expect(adapter.mock.calls.map(([config]) => config.method)).toEqual([
      "post",
      "post",
    ]);
    expect(adapter.mock.calls[0][0].headers.get("Idempotency-Key")).toBe(
      adapter.mock.calls[1][0].headers.get("Idempotency-Key"),
    );
  });
});
describe("rental scope cache", () => {
  it("does not retain a previous house's rows as placeholder data", async () => {
    mainInstance.defaults.adapter = async (config) =>
      response(config, {
        data: [{ ...property, id: config.url?.endsWith("/2") ? "2" : "1" }],
        meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
      });
    // Keys must isolate the actor, house, resource and all filter parameters.
    expect(rentalKeys.list("1", "1", "payments", { page: 1 })).not.toEqual(
      rentalKeys.list("1", "2", "payments", { page: 1 }),
    );
    const { result, rerender } = renderHook(
      ({ id }) => useRentalList("properties", id, {}),
      { wrapper, initialProps: { id: "1" } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    rerender({ id: "2" });
    expect(result.current.data).toBeUndefined();
  });
  it("does not purge a house because a single resource was removed", async () => {
    const key = rentalKeys.list("1", "1", "expenses", {});
    client.setQueryData(key, {
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });
    mainInstance.defaults.adapter = async (config) => {
      if (config.url?.endsWith("/properties/1"))
        return response(config, property);
      throw reject(config, 404, "rental:not_found");
    };
    const { result } = renderHook(() => useRentalRecord("payments", "1", "7"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(key)).toBeDefined();
  });
  it("purges dependent data only after a property access recheck confirms revocation", async () => {
    const key = rentalKeys.list("1", "1", "expenses", {});
    client.setQueryData(key, {
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });
    mainInstance.defaults.adapter = async (config) => {
      throw reject(config, 404, "rental:not_found");
    };
    renderHook(() => useRentalRecord("payments", "1", "7"), { wrapper });
    await waitFor(() => expect(client.getQueryData(key)).toBeUndefined());
  });
  it("invalidates affected reads and audit without touching another house or actor", async () => {
    const keys = [
      rentalKeys.list("1", "1", "payments", {}),
      rentalKeys.list("1", "1", "audit-events", {}),
      rentalKeys.list("1", "2", "payments", {}),
      rentalKeys.list("2", "1", "payments", {}),
    ];
    keys.forEach((key) => client.setQueryData(key, {}));
    await invalidateRentalMutation(client, "1", ack);
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(
      [true, true, false, false],
    );
  });
});
