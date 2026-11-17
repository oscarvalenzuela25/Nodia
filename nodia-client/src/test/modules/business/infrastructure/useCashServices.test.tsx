import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCashMovements,
  getCashReceipt,
  sendCashMutation,
} from "../../../../modules/business/infrastructure/cashServices";
import type {
  CashMovementList,
  CashMutationCommand,
  CashScope,
  CashWriteResult,
} from "../../../../modules/business/infrastructure/cashTypes";
import {
  cashKeys,
  useCashMovements,
  useCashMutation,
} from "../../../../modules/business/infrastructure/useCashServices";
import useAuthStore from "../../../../store/authStore";

vi.mock("../../../../modules/business/infrastructure/cashServices", async (importOriginal) => ({
  ...(await importOriginal()),
  getCashMovements: vi.fn(),
  getCashReceipt: vi.fn(),
  sendCashMutation: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

const scope: CashScope = {
  businessId: "a0000000-0000-4000-8000-000000000001",
  actorId: "42",
  sessionVersion: 6,
};
const otherScope = { ...scope, businessId: "a0000000-0000-4000-8000-000000000002" };
const command: CashMutationCommand = {
  operation: "category_create",
  fields: { name: "Mercadería", description: "Mantener la intención" },
};
const committed = (request_key: string, activeScope = scope): CashWriteResult => ({
  request_key,
  operation: "category_create",
  status: "committed",
  result: {
    category: {
      id: "18",
      business_id: activeScope.businessId,
      name: command.fields.name,
      description: command.fields.description,
      is_active: true,
      version: 1,
    },
  },
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

const prepare = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
};

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    user: { id: scope.actorId, name: "Synthetic actor" },
    token: "synthetic-session",
    expiresAt: Date.now() + 60000,
    sessionStatus: "authenticated",
    sessionVersion: scope.sessionVersion,
    isRefreshing: false,
  });
});

describe("Cash mutation recovery", () => {
  it("keeps a write with unknown result, checks the receipt, and retries exactly the original key and body", async () => {
    const { client, Wrapper } = prepare();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(sendCashMutation).mockRejectedValueOnce(new Error("Synthetic response lost"));
    vi.mocked(getCashReceipt).mockImplementation(async (_business, key) => ({
      request_key: key,
      status: "unconfirmed",
    }));
    const { result } = renderHook(() => useCashMutation(scope), { wrapper: Wrapper });
    const draft: CashMutationCommand = { ...command, fields: { ...command.fields } };

    await act(async () => {
      const submitted = result.current.submit(draft);
      expect(await result.current.submit(draft)).toBeUndefined();
      expect(await submitted).toMatchObject({ status: "unavailable" });
    });
    const key = vi.mocked(sendCashMutation).mock.calls[0][1];
    expect(result.current.pending).toBe(true);
    draft.fields.description = "Changes after dispatch";
    await act(async () => {
      expect(await result.current.submit(draft)).toBeUndefined();
      expect(await result.current.recover()).toEqual({ request_key: key, status: "unconfirmed" });
    });
    expect(getCashReceipt).toHaveBeenCalledExactlyOnceWith(scope.businessId, key, command);
    expect(sendCashMutation).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);

    vi.mocked(sendCashMutation).mockResolvedValueOnce(committed(key));
    await act(async () => {
      expect(await result.current.retry()).toEqual(committed(key));
    });
    expect(sendCashMutation).toHaveBeenLastCalledWith(scope.businessId, key, command);
    expect(result.current.pending).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: cashKeys.categories(scope) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: cashKeys.movements(scope) });
  });

  it("treats an initial CAS conflict as definitive and requires a new key for the reviewed command", async () => {
    const { Wrapper } = prepare();
    const update = {
      operation: "category_update",
      id: "18",
      fields: { expected_version: 1, is_active: false },
    } as const;
    const error = Object.assign(new AxiosError("Synthetic conflict"), {
      response: { status: 409, data: { message: "business:cash_version_conflict" } },
    });
    vi.mocked(sendCashMutation)
      .mockRejectedValueOnce(error)
      .mockImplementation(async (_business, key) => ({
        request_key: key,
        operation: "category_update",
        status: "processing",
      }));
    const { result } = renderHook(() => useCashMutation(scope), { wrapper: Wrapper });
    await act(async () => {
      expect(await result.current.submit(update)).toMatchObject({
        status: "rejected",
        error: { status_code: 409, message: "business:cash_version_conflict" },
      });
    });
    expect(result.current.pending).toBe(false);
    await act(async () => {
      expect(
        await result.current.submit({ ...update, fields: { ...update.fields, expected_version: 2 } }),
      ).toMatchObject({ status: "processing" });
    });
    expect(result.current.pending).toBe(true);
    const [, firstKey] = vi.mocked(sendCashMutation).mock.calls[0];
    const [, nextKey] = vi.mocked(sendCashMutation).mock.calls[1];
    expect(nextKey).not.toBe(firstKey);
  });

  it("discards a late acknowledgement after leaving and returning to a business", async () => {
    const { Wrapper } = prepare();
    const response = deferred<CashWriteResult>();
    vi.mocked(sendCashMutation).mockReturnValueOnce(response.promise);
    const { result, rerender } = renderHook((selected) => useCashMutation(selected), {
      initialProps: scope,
      wrapper: Wrapper,
    });
    let submitted!: ReturnType<typeof result.current.submit>;
    act(() => {
      submitted = result.current.submit(command);
    });
    await waitFor(() => expect(sendCashMutation).toHaveBeenCalledTimes(1));
    rerender(otherScope);
    rerender(scope);
    await act(async () => {
      response.resolve(committed(vi.mocked(sendCashMutation).mock.calls[0][1]));
      expect(await submitted).toBeUndefined();
    });
    expect(result.current.outcome).toBeUndefined();
    expect(result.current.pending).toBe(false);
  });
});

describe("Cash movement query identity", () => {
  it("pauses reads and writes when the authenticated session no longer owns the supplied scope", async () => {
    const { Wrapper } = prepare();
    useAuthStore.setState({ sessionVersion: scope.sessionVersion + 1 });
    const { result } = renderHook(
      () => ({
        query: useCashMovements(scope, { page: 1, limit: 10 }),
        mutation: useCashMutation(scope),
      }),
      { wrapper: Wrapper },
    );
    expect(result.current.query.fetchStatus).toBe("idle");
    await act(async () => {
      expect(await result.current.mutation.submit(command)).toBeUndefined();
    });
    expect(getCashMovements).not.toHaveBeenCalled();
    expect(sendCashMutation).not.toHaveBeenCalled();
  });

  it("retains prior rows only while paging the same criteria and drops them when the range changes", async () => {
    const { Wrapper } = prepare();
    const response = deferred<CashMovementList>();
    vi.mocked(getCashMovements)
      .mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
        summary: {
          currency: "CLP",
          income: { count: 0, total_amount: "0" },
          expense: { count: 0, total_amount: "0" },
        },
      })
      .mockReturnValue(response.promise);
    const { result, rerender } = renderHook(
      ({ page, from }) => useCashMovements(scope, { page, limit: 10, from }),
      { initialProps: { page: 1, from: "2026-01-01" }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ page: 2, from: "2026-01-01" });
    expect(result.current.isPlaceholderData).toBe(true);
    rerender({ page: 1, from: "2026-02-01" });
    expect(result.current.isPlaceholderData).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
