import { useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthSessionProvider from "../../providers/AuthSessionProvider";
import GuardStrict from "../../routes/GuardStrict";
import useAuthStore from "../../store/authStore";
import { mainInstance, waitForRefresh } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import { useTeacherCommand } from "../../modules/teacher/infrastructure/useServices";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const originalAdapter = mainInstance.defaults.adapter;
const session = { token: "fixture-old-token", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Synthetic actor" } };
const mounts = vi.fn();
const unmounts = vi.fn();
const releases: (() => void)[] = [];
const context = { roles: [], actions: [], modules: [{ module_group_key: "fixture", translates: [], modules: [{ key: "teacher", link: "/nodia-teacher", translates: [] }] }] };
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: "OK", headers: {} });

function CommandProbe() {
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const command = useTeacherCommand();
  useEffect(() => { mounts(); return () => { unmounts(); }; }, []);
  return <>
    <input aria-label="Synthetic draft" value={draft} onChange={event => setDraft(event.target.value)} />
    <button disabled={command.blocked} onClick={() => { void command.execute("sessions/fixture-session/archive", {}).then(result => { if (result) setSaved(true); }); }}>Synthetic archive</button>
    <p>{command.uncertain ? "Uncertain command" : saved ? "Acknowledged command" : "Idle command"}</p>
  </>;
}

beforeEach(() => { queryClient.clear(); useAuthStore.getState().logout(); useAuthStore.getState().login(session); mounts.mockClear(); unmounts.mockClear(); sessionStorage.clear(); });
afterEach(async () => { useAuthStore.getState().logout(); releases.splice(0).forEach(release => release()); await waitForRefresh(); mainInstance.defaults.adapter = originalAdapter; queryClient.clear(); });

describe("same-actor renewal across a Teacher command", () => {
  it("keeps the draft and command owner mounted through real 401/refresh/200 without false uncertainty", async () => {
    let finishRefresh!: () => void;
    let finishAcknowledgement!: () => void;
    const commandKeys: unknown[] = [];
    mainInstance.defaults.adapter = async config => {
      if (config.url?.endsWith("/authorization/context")) return response(config, context);
      if (config.url?.endsWith("/auth/refresh")) {
        await new Promise<void>(resolve => { finishRefresh = resolve; releases.push(resolve); });
        return response(config, { ...session, token: "fixture-renewed-token" });
      }
      if (config.url?.endsWith("/auth/me")) return response(config, session.user);
      if (config.url?.endsWith("/archive")) {
        commandKeys.push(config.headers["Idempotency-Key"]);
        if (config.headers.Authorization === "Bearer fixture-old-token") throw new AxiosError("Synthetic expired access token", "ERR_BAD_RESPONSE", config, undefined, { ...response(config, {}), status: 401 });
        await new Promise<void>(resolve => { finishAcknowledgement = resolve; releases.push(resolve); });
        return response(config, { session_id: "fixture-session", state: "archived", revision: 2 });
      }
      throw new Error("Unexpected synthetic endpoint");
    };
    const memory = createMemoryRouter([
      { path: "/nodia-teacher", element: <GuardStrict modulePath="/nodia-teacher"><CommandProbe /></GuardStrict> },
      { path: "/", element: <p>Home</p> }, { path: "/login", element: <p>Sign in</p> },
    ], { initialEntries: ["/nodia-teacher"] });
    render(<QueryClientProvider client={queryClient}><AuthSessionProvider><RouterProvider router={memory} /></AuthSessionProvider></QueryClientProvider>);
    const input = await screen.findByRole("textbox", { name: "Synthetic draft" });
    fireEvent.change(input, { target: { value: "Unsent synthetic message" } });
    fireEvent.click(screen.getByRole("button", { name: "Synthetic archive" }));
    await waitFor(() => expect(finishRefresh).toBeDefined());
    expect(screen.getByRole("textbox", { name: "Synthetic draft", hidden: true })).toBe(input);
    expect(input.closest("[inert]")).not.toBeNull();
    await act(async () => { finishRefresh(); });
    await waitFor(() => expect(finishAcknowledgement).toBeDefined());
    expect(screen.queryByText("Uncertain command")).not.toBeInTheDocument();
    await act(async () => { finishAcknowledgement(); });
    expect(await screen.findByText("Acknowledged command")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Synthetic draft" })).toBe(input);
    expect(input).toHaveValue("Unsent synthetic message");
    expect(mounts).toHaveBeenCalledOnce(); expect(unmounts).not.toHaveBeenCalled();
    expect(commandKeys).toHaveLength(2); expect(commandKeys[0]).toBe(commandKeys[1]);
    expect(sessionStorage.getItem("teacher:pending-request:v1")).toBeNull();
    memory.dispose();
  });
});
