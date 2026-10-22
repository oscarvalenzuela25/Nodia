import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { useNodiaAiExecution } from "../../../../modules/nodiaAi/infrastructure/useExecution";
import { chatId, detail } from "./fixtures";
import { execution } from "./proposalFixtures";

const mocks = vi.hoisted(() => ({getNodiaAiExecution: vi.fn(), controlNodiaAiExecution: vi.fn(), error: vi.fn(), success: vi.fn()}));
vi.mock("../../../../modules/nodiaAi/infrastructure/services", async importOriginal => ({...await importOriginal<object>(), ...mocks}));
vi.mock("../../../../config/httpFeedback", () => ({notifyHttpError: mocks.error}));
vi.mock("sileo", () => ({sileo: {success: mocks.success, error: mocks.error}}));
let client: QueryClient;
function Wrapper({children}: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  vi.clearAllMocks(); client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  useAuthStore.setState({user: {id: "9", name: "Synthetic owner"}, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false});
  client.setQueryData(["nodia-ai", "9", 1, "detail", chatId], detail);
  mocks.getNodiaAiExecution.mockResolvedValue(execution);
});
afterEach(() => {cleanup(); client.clear(); useAuthStore.setState({user: null, token: null, sessionStatus: "anonymous"});});

describe("NodiaAI retained execution reader", () => {
  it("suspends hidden execution reads and controls without discarding the exact receipt", async () => {
    const {result, rerender} = renderHook(({observed}) => useNodiaAiExecution(chatId, execution.execution_id, observed), {initialProps: {observed: false}, wrapper: Wrapper});
    expect(mocks.getNodiaAiExecution).not.toHaveBeenCalled();
    rerender({observed: true});
    await waitFor(() => expect(result.current.data).toEqual(execution));
    rerender({observed: false});
    await act(() => client.invalidateQueries({queryKey: ["nodia-ai", "9", 1, "execution"]}));
    await act(() => result.current.control("cancel"));
    await act(() => result.current.recover());
    expect(mocks.getNodiaAiExecution).toHaveBeenCalledTimes(1);
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(execution); expect(result.current.readOnly).toBe(true);
    rerender({observed: true});
    await waitFor(() => expect(mocks.getNodiaAiExecution).toHaveBeenCalledTimes(2));
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
});
