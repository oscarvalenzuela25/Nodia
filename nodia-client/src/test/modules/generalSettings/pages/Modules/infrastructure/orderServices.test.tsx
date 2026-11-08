import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import { mainInstance } from "../../../../../../config/api";
import { queryClient } from "../../../../../../config/reactQuery";
import { useAuthorizationContext } from "../../../../../../services/authorizationService";
import useAuthStore from "../../../../../../store/authStore";
import useGeneralSettingsStore from "../../../../../../store/generalSettings/generalSettingsStore";
import type { AuthorizationContextResponse } from "../../../../../../store/generalSettings/types";
import { useModules, useModuleGroups, useMoveModuleOrder, useMoveModuleGroupOrder } from "../../../../../../modules/generalSettings/pages/Modules/infrastructure/useServices";
import { getModules, moveModuleOrder, moveModuleGroupOrder } from "../../../../../../modules/generalSettings/pages/Modules/infrastructure/services";
import type { MoveModuleOrderCommand } from "../../../../../../modules/generalSettings/pages/Modules/types";
import i18n from "../../../../../../translate";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const originalAdapter = mainInstance.defaults.adapter;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
const command: MoveModuleOrderCommand = {
  direction: "down", expected_sort_order: 0, expected_module_group_id: "3",
  expected_neighbor: { id: "12", sort_order: 1 }, page_size: 1,
};
const moduleResult = {
  status: "moved", id: "11", module_group_id: "3", sort_order: 1,
  previous: { id: "12", sort_order: 0 }, next: null, position: 2, page: 2,
};
const groupResult = {
  status: "moved", id: "3", sort_order: 1,
  previous: { id: "4", sort_order: 0 }, next: null, position: 2, page: 2,
};
const context = (moved: boolean, kind: "module" | "group"): AuthorizationContextResponse => {
  const groups = [
    { module_group_key: "settings", translates: [], modules: (moved && kind === "module" ? ["roles", "users"] : ["users", "roles"]).map((key) => ({ key, translates: [] })) },
    { module_group_key: "business", translates: [], modules: [{ key: "businesses", translates: [] }] },
  ];
  return { roles: ["admin"], actions: [], modules: moved && kind === "group" ? groups.reverse() : groups };
};
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: "OK", headers: {} });

beforeEach(() => {
  useAuthStore.getState().logout(); queryClient.clear(); vi.clearAllMocks();
  useAuthStore.getState().login({ token: "fixture", expiresAt: Date.now() + 900000, user: { id: "42", name: "Fixture" } });
});
afterEach(() => {
  useAuthStore.getState().logout(); queryClient.clear(); mainInstance.defaults.adapter = originalAdapter;
});

function setup(kind: "module" | "group", options: { failure?: "conflict" | "timeout" | "invalid"; failRecovery?: boolean } = {}) {
  let moved = false;
  let writes = 0;
  let reads = 0;
  let failReads = options.failRecovery ?? false;
  mainInstance.defaults.adapter = async (config) => {
    if (config.method === "patch") {
      writes += 1;
      if (options.failure === "conflict") throw new AxiosError("changed", "ERR_BAD_RESPONSE", config, undefined, { ...response(config, { message: "modules:order_conflict" }), status: 409 });
      if (options.failure === "timeout") throw new AxiosError("timeout", "ECONNABORTED", config);
      moved = true;
      return response(config, options.failure === "invalid" ? { ...moduleResult, id: "99" } : kind === "module" ? moduleResult : groupResult);
    }
    reads += 1;
    if (writes && failReads) throw new AxiosError("read unavailable", "ERR_BAD_RESPONSE", config, undefined, { ...response(config, { message: "Read unavailable" }), status: 503 });
    if (config.url?.endsWith("/authorization/context")) return response(config, context(moved, kind));
    return response(config, {
      data: [], meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });
  };
  const hook = renderHook(() => {
    const authorization = useAuthorizationContext();
    const modules = useModules({ ordering: true });
    const groups = useModuleGroups({ ordering: true });
    const moduleMove = useMoveModuleOrder();
    const groupMove = useMoveModuleGroupOrder();
    return {
      ready: authorization.isSuccess && modules.isSuccess && groups.isSuccess,
      moduleMove, groupMove,
      pending: moduleMove.isPending || groupMove.isPending,
      recoveryRequired: moduleMove.recoveryRequired || groupMove.recoveryRequired,
      context: authorization.data,
    };
  }, { wrapper });
  return { ...hook, writes: () => writes, reads: () => reads, allowReads: () => { failReads = false; } };
}

describe("module ordering transport and sidenav context", () => {
  it.each(["module", "group"] as const)("invalidates lists and applies fresh sidenav context after moving a %s", async (kind) => {
    const { result, writes, reads } = setup(kind);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(reads()).toBe(3);
    await act(async () => {
      if (kind === "module") await result.current.moduleMove.mutateAsync({ id: "11", command });
      else await result.current.groupMove.mutateAsync({ id: "3", command: { direction: "down", expected_sort_order: 0, expected_neighbor: { id: "4", sort_order: 1 }, page_size: 1 } });
    });
    await waitFor(() => expect(useGeneralSettingsStore.getState().modules).toEqual(context(true, kind).modules));
    expect(reads()).toBe(6);
    expect(writes()).toBe(1);
    expect(result.current.recoveryRequired).toBe(false);
    expect(sileo.success).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ description: i18n.t("modules:ordering.save_success") }));
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it.each(["conflict", "timeout", "invalid"] as const)("reconciles %s with reads and never repeats the PATCH", async (failure) => {
    const { result, writes, reads } = setup("module", { failure });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await expect(result.current.moduleMove.mutateAsync({ id: "11", command })).rejects.toBeDefined(); });
    expect(writes()).toBe(1);
    expect(reads()).toBe(6);
    expect(result.current.pending).toBe(false);
    expect(result.current.recoveryRequired).toBe(false);
    expect(sileo.error).toHaveBeenCalledTimes(1);
    expect(sileo.success).not.toHaveBeenCalled();
    if (failure === "conflict") expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ description: i18n.t("modules:order_conflict") }));
  });

  it("keeps a confirmed move successful but blocks further moves until failed refreshes recover", async () => {
    const { result, writes, allowReads } = setup("module", { failRecovery: true });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(() => result.current.moduleMove.mutateAsync({ id: "11", command }));
    await waitFor(() => expect(result.current.recoveryRequired).toBe(true));
    expect(result.current.moduleMove.isSuccess).toBe(true);
    expect(sileo.success).toHaveBeenCalledTimes(1);
    await act(async () => { await expect(result.current.moduleMove.mutateAsync({ id: "11", command })).rejects.toThrow("modules:ordering.recovery_failed"); });
    expect(writes()).toBe(1);
    allowReads();
    await act(async () => { await result.current.moduleMove.recover(); });
    await waitFor(() => expect(result.current.recoveryRequired).toBe(false));
    expect(writes()).toBe(1);
  });

  it("does not announce unchanged as a persisted order modification", async () => {
    mainInstance.defaults.adapter = async (config) => response(config, {
      status: "unchanged", id: "11", module_group_id: "3", sort_order: 0,
      previous: null, next: null, position: 1, page: 1,
    });
    const { result } = renderHook(() => useMoveModuleOrder(), { wrapper });
    await act(() => result.current.mutateAsync({ id: "11", command: { ...command, direction: "up", expected_neighbor: null } }));
    expect(sileo.success).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ description: i18n.t("modules:ordering.unchanged") }));
  });

  it("rejects missing ordering metadata instead of enabling historical data", async () => {
    mainInstance.defaults.adapter = async (config) => response(config, {
      data: [{ id: "11", key: "users", module_group_id: "3" }],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    });
    await expect(getModules({ ordering: true })).rejects.toThrow("modules:ordering.invalid_response");
    expect((await getModules()).data).toHaveLength(1);
  });

  it("preserves bigint IDs and rejects an inconsistent returned page", async () => {
    const id = "9007199254740993";
    mainInstance.defaults.adapter = async (config) => {
      expect(config.url).toContain(`/module/${id}/order`);
      return response(config, { ...moduleResult, id, page: 3 });
    };
    await expect(moveModuleOrder(id, command)).rejects.toThrow("modules:ordering.invalid_response");
  });

  it("submits an explicit target and accepts before placement without assuming the target's old rank", async () => {
    const beforeCommand: MoveModuleOrderCommand = {
      ...command, direction: "before", expected_neighbor: { id: "12", sort_order: 4 },
    };
    const placed = { ...moduleResult, sort_order: 3, position: 4, page: 4,
      previous: { id: "20", sort_order: 2 }, next: { id: "12", sort_order: 4 } };
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      expect(JSON.parse(config.data)).toEqual(beforeCommand);
      return response(config, placed);
    });
    mainInstance.defaults.adapter = adapter;
    await expect(moveModuleOrder("11", beforeCommand)).resolves.toEqual(placed);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("validates after placement for a group using its returned previous neighbor", async () => {
    const placed = { ...groupResult, previous: { id: "4", sort_order: 0 } };
    mainInstance.defaults.adapter = async (config) => response(config, placed);
    await expect(moveModuleGroupOrder("3", {
      direction: "after", expected_sort_order: 4,
      expected_neighbor: { id: "4", sort_order: 0 }, page_size: 1,
    })).resolves.toEqual(placed);
  });

  it.each(["before", "after"] as const)("accepts an already adjacent %s target only with an unchanged origin rank", async (direction) => {
    const rank = direction === "before" ? 0 : 1;
    const adjacent = { id: "12", sort_order: direction === "before" ? 1 : 0 };
    const placed = {
      ...moduleResult, status: "unchanged", sort_order: rank, position: rank + 1, page: rank + 1,
      previous: direction === "after" ? adjacent : null,
      next: direction === "before" ? adjacent : null,
    };
    mainInstance.defaults.adapter = async (config) => response(config, placed);
    await expect(moveModuleOrder("11", {
      ...command, direction, expected_sort_order: rank, expected_neighbor: adjacent,
    })).resolves.toEqual(placed);
    mainInstance.defaults.adapter = async (config) => response(config, {
      ...placed, sort_order: rank + 1,
      previous: direction === "after" ? adjacent : null,
      next: direction === "before" ? { ...adjacent, sort_order: rank + 2 } : null,
    });
    await expect(moveModuleOrder("11", {
      ...command, direction, expected_sort_order: rank, expected_neighbor: adjacent,
    })).rejects.toThrow("modules:ordering.invalid_response");
  });

  it.each(["before", "after"] as const)("rejects a null %s target before issuing HTTP", async (direction) => {
    const adapter = vi.fn();
    mainInstance.defaults.adapter = adapter;
    await expect(moveModuleOrder("11", {
      ...command, direction, expected_neighbor: null,
    } as unknown as MoveModuleOrderCommand)).rejects.toBeDefined();
    expect(adapter).not.toHaveBeenCalled();
  });

  it.each(["wrong_target", "wrong_side", "unchanged_rank"] as const)("rejects an unverified drag result: %s", async (invalid) => {
    const placed = { ...moduleResult, sort_order: invalid === "unchanged_rank" ? 0 : 3,
      position: 4, page: 4, previous: null,
      next: { id: invalid === "wrong_target" ? "99" : "12", sort_order: 4 } };
    mainInstance.defaults.adapter = async (config) => response(config, invalid === "wrong_side"
      ? { ...placed, previous: { id: "12", sort_order: 2 }, next: null } : placed);
    await expect(moveModuleOrder("11", {
      ...command, direction: "before", expected_neighbor: { id: "12", sort_order: 4 },
    })).rejects.toThrow("modules:ordering.invalid_response");
  });

  it.each(["self_neighbor", "parent_mismatch"] as const)("rejects actionable metadata inconsistency: %s", async (invalid) => {
    const item = {
      id: "11", key: "users", module_group_id: "3", sort_order: 0,
      module_group: { id: invalid === "parent_mismatch" ? "4" : "3", key: "settings", sort_order: 0 },
      ordering: { previous: null, next: { id: invalid === "self_neighbor" ? "11" : "12", sort_order: 1 } },
      group_ordering: { previous: null, next: { id: "4", sort_order: 1 } },
    };
    mainInstance.defaults.adapter = async (config) => response(config, {
      data: [item], meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    });
    await expect(getModules({ ordering: true })).rejects.toThrow("modules:ordering.invalid_response");
  });

  it("discards late feedback and context refresh after logout", async () => {
    let finish!: () => void;
    let reads = 0;
    mainInstance.defaults.adapter = async (config) => {
      if (config.method === "patch") {
        await new Promise<void>((resolve) => { finish = resolve; });
        return response(config, moduleResult);
      }
      reads += 1;
      return response(config, {});
    };
    const { result } = renderHook(() => useMoveModuleOrder(), { wrapper });
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.mutateAsync({ id: "11", command }).catch(() => undefined); });
    await waitFor(() => expect(finish).toBeDefined());
    act(() => useAuthStore.getState().logout());
    await act(async () => { finish(); await pending; });
    expect(reads).toBe(0);
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("does not dispatch an old intent using a newly signed-in actor", async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, moduleResult));
    mainInstance.defaults.adapter = adapter;
    const { result } = renderHook(() => useMoveModuleOrder(), { wrapper });
    await act(async () => {
      const pending = result.current.mutateAsync({ id: "11", command }).catch(() => undefined);
      useAuthStore.getState().logout();
      useAuthStore.getState().login({ token: "other-fixture", expiresAt: Date.now() + 900000, user: { id: "84", name: "Another fixture" } });
      await pending;
    });
    expect(adapter).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });
});
