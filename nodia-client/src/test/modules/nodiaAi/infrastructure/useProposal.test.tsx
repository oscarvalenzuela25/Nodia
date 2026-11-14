import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { useNodiaAiProposal, useNodiaAiProposalReview } from "../../../../modules/nodiaAi/infrastructure/useProposal";
import { chatId } from "./fixtures";
import { proposal, proposalEvent, readonlyReview } from "./proposalFixtures";

const mocks = vi.hoisted(() => ({getNodiaAiProposal: vi.fn(), getNodiaAiProposalReview: vi.fn(), error: vi.fn()}));
vi.mock("../../../../modules/nodiaAi/infrastructure/services", async importOriginal => ({...await importOriginal<object>(), ...mocks}));
vi.mock("../../../../config/httpFeedback", () => ({notifyHttpError: mocks.error}));
let client: QueryClient;
function Wrapper({children}: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  vi.clearAllMocks(); client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  useAuthStore.setState({user: {id: "9", name: "Synthetic owner"}, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false});
  mocks.getNodiaAiProposal.mockResolvedValue(proposal); mocks.getNodiaAiProposalReview.mockResolvedValue(readonlyReview);
});
afterEach(() => {cleanup(); client.clear(); useAuthStore.setState({user: null, token: null, sessionStatus: "anonymous"});});

describe("NodiaAI retained proposal readers", () => {
  it("does not request hidden previews, retains their revision, and reauthorizes each reopened reader", async () => {
    const {result, rerender} = renderHook(({observed}) => {
      const query = useNodiaAiProposal(chatId, proposalEvent.payload, observed);
      const review = useNodiaAiProposalReview(chatId, proposalEvent.payload, query.data, observed);
      return {query, review};
    }, {initialProps: {observed: false}, wrapper: Wrapper});
    expect(mocks.getNodiaAiProposal).not.toHaveBeenCalled(); expect(mocks.getNodiaAiProposalReview).not.toHaveBeenCalled();
    rerender({observed: true});
    await waitFor(() => expect(result.current.review.data).toEqual(readonlyReview));
    rerender({observed: false});
    await act(() => client.invalidateQueries({queryKey: ["nodia-ai", "9", 1]}));
    expect(result.current.query.data).toEqual(proposal); expect(result.current.review.data).toEqual(readonlyReview);
    expect(mocks.getNodiaAiProposal).toHaveBeenCalledTimes(1); expect(mocks.getNodiaAiProposalReview).toHaveBeenCalledTimes(1);
    rerender({observed: true});
    await waitFor(() => expect(mocks.getNodiaAiProposal).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.getNodiaAiProposalReview).toHaveBeenCalledTimes(2));
  });
  it.each([401, 403, 404, 410])("keeps reviewed data through a 500 outage and removes the proposal and review on denial (%s)", async status => {
    const {result} = renderHook(() => {
      const query = useNodiaAiProposal(chatId, proposalEvent.payload);
      return {query, review: useNodiaAiProposalReview(chatId, proposalEvent.payload, query.data)};
    }, {wrapper: Wrapper});
    await waitFor(() => expect(result.current.review.data).toEqual(readonlyReview));
    const outage = Object.assign(new Error("offline"), {isAxiosError: true, response: {status: 500}});
    mocks.getNodiaAiProposalReview.mockRejectedValueOnce(outage);
    await act(() => result.current.review.refetch());
    await waitFor(() => {
      expect(result.current.review.error).toBe(outage);
      expect(result.current.review.isError).toBe(true);
      expect(result.current.review.isFetching).toBe(false);
    });
    expect(result.current.review.data).toEqual(readonlyReview); expect(result.current.query.data).toEqual(proposal);
    const denied = Object.assign(new Error("denied"), {isAxiosError: true, response: {status}});
    mocks.getNodiaAiProposalReview.mockRejectedValue(denied);
    await act(() => result.current.review.refetch());
    expect(client.getQueryData(["nodia-ai", "9", 1, "proposal", chatId, proposalEvent.payload])).toBeNull();
    expect(client.getQueryData(["nodia-ai", "9", 1, "proposal-review", chatId, proposalEvent.payload])).toBeNull();
    // Refetch can settle before the batched observer notification reaches React.
    // Observe this denial, rather than inspecting the preceding outage render.
    await waitFor(() => {
      expect(result.current.review.error).toBe(denied);
      expect(result.current.review.isError).toBe(true);
      expect(result.current.review.isFetching).toBe(false);
      expect(result.current.review.data).toBeNull();
      expect(result.current.query.data).toBeUndefined();
    });
  });
});
