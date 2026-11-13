import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { InternalAxiosRequestConfig } from "axios";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../config/api";
import { queryClient } from "../../../config/reactQuery";
import { authorizationKeys } from "../../../services/authorizationService";
import useAuthStore from "../../../store/authStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import { useVisibleModules } from "../../../store/generalSettings/useGeneralSettings";
import type { AuthorizationContextResponse, ModuleGroupContext } from "../../../store/generalSettings/types";

vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));

const originalAdapter = mainInstance.defaults.adapter;
const aiGroups: ModuleGroupContext[] = [{ module_group_key: "tools", translates: [],
  modules: [{ key: "nodia_ai", link: "/nodia-ai", translates: [] }] }];
const context = (modules: ModuleGroupContext[] = [], roles: string[] = []): AuthorizationContextResponse => ({ roles, actions: [], modules });
const signIn = (id: string) => useAuthStore.getState().login({ token: "synthetic-" + id,
  user: { id, name: "Synthetic " + id }, expiresAt: Date.now() + 900_000 });
const response = (config: InternalAxiosRequestConfig, data: AuthorizationContextResponse) => ({
  config, data, status: 200, statusText: "OK", headers: {},
});
const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
const key = (id = "new-user") => [...authorizationKeys.context(), id];

beforeEach(() => { queryClient.clear(); useAuthStore.getState().logout(); signIn("new-user"); });
afterEach(() => { useAuthStore.getState().logout(); queryClient.clear(); mainInstance.defaults.adapter = originalAdapter; });

describe("visible modules belong to the current authenticated actor", () => {
  it("hides a previous administrator's memory while the new user's assignments load and remain empty", async () => {
    // Models a late residual store write after identity replacement. The query
    // response belongs to the new user; memory alone must never populate a menu.
    settings.getState().setContext(context(aiGroups, ["super_admin"]));
    let resolve!: (value: AuthorizationContextResponse) => void;
    const request = vi.fn(async config => response(config, await new Promise<AuthorizationContextResponse>(done => { resolve = done; })));
    mainInstance.defaults.adapter = request;
    const { result } = renderHook(useVisibleModules, { wrapper });
    expect(result.current).toEqual([]);
    await waitFor(() => expect(resolve).toBeDefined());
    expect(request).toHaveBeenCalledOnce();
    await act(async () => resolve(context()));
    await waitFor(() => expect(queryClient.getQueryData(key())).toEqual(context()));
    expect(result.current).toEqual([]);
  });

  it("shows an exact assignment and removes it when the current authorization response revokes it", async () => {
    mainInstance.defaults.adapter = async config => response(config, context(aiGroups));
    const { result } = renderHook(useVisibleModules, { wrapper });
    await waitFor(() => expect(result.current).toEqual(aiGroups));
    act(() => { queryClient.setQueryData(key(), context()); });
    await waitFor(() => expect(result.current).toEqual([]));
  });

  it.each([
    { modules: [{ module_group_key: "tools", translates: [], modules: [{ key: "unrelated", link: "/NODIA-AI/?from=menu", translates: [] }] }] },
    { modules: [...aiGroups, { module_group_key: "another", translates: [], modules: [{ key: "nodia_ai", link: "/tools/nodia-ai", translates: [] }] }] },
  ] satisfies { modules: ModuleGroupContext[] }[])("rejects lookalike or ambiguous module destinations %#", async ({ modules }) => {
    const input = context([...modules, { module_group_key: "business", translates: [],
      modules: [{ key: "business", link: "/business", translates: [] }] }]);
    mainInstance.defaults.adapter = async config => response(config, input);
    const { result } = renderHook(useVisibleModules, { wrapper });
    await waitFor(() => expect(queryClient.getQueryData(key())).toEqual(input));
    await waitFor(() => expect(result.current.flatMap(group => group.modules).map(module => module.key)).toEqual(["business"]));
  });

  it("keeps the explicit super_admin catalog bypass without relying on the previous store's roles", async () => {
    settings.getState().setContext(context());
    mainInstance.defaults.adapter = async config => response(config, context(aiGroups, ["super_admin"]));
    const { result } = renderHook(useVisibleModules, { wrapper });
    await waitFor(() => expect(result.current).toEqual(aiGroups));
  });

  it("does not publish an old in-flight response after switching to an unassigned actor", async () => {
    let finishOld!: (value: AuthorizationContextResponse) => void;
    mainInstance.defaults.adapter = async config => {
      if (config.headers.Authorization === "Bearer synthetic-new-user") {
        return response(config, await new Promise<AuthorizationContextResponse>(resolve => { finishOld = resolve; }));
      }
      return response(config, context());
    };
    const { result } = renderHook(useVisibleModules, { wrapper });
    await waitFor(() => expect(finishOld).toBeDefined());
    act(() => signIn("other-user"));
    expect(result.current).toEqual([]);
    await waitFor(() => expect(queryClient.getQueryData(key("other-user"))).toEqual(context()));
    await act(async () => finishOld(context(aiGroups, ["super_admin"])));
    expect(result.current).toEqual([]);
  });

  it("hides cached navigation during invalid session states and after logout", async () => {
    queryClient.setQueryData(key(), context(aiGroups));
    const { result } = renderHook(useVisibleModules, { wrapper });
    expect(result.current).toEqual(aiGroups);
    act(() => useAuthStore.getState().setSessionStatus("restoring"));
    expect(result.current).toEqual([]);
    act(() => useAuthStore.getState().logout());
    expect(result.current).toEqual([]);
  });
});
