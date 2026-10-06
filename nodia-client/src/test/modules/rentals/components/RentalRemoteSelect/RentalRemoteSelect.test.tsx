import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RentalRemoteSelect from "../../../../../modules/rentals/components/RentalRemoteSelect";
import useAuthStore from "../../../../../store/authStore";
import { getRentalList } from "../../../../../modules/rentals/infrastructure/services";
import type { SelectSingleInputProps } from "../../../../../components/inputs/SelectSingleInput/types";
vi.mock("../../../../../modules/rentals/infrastructure/services", () => ({
  getRentalList: vi.fn(),
}));
vi.mock("../../../../../components/inputs/SelectSingleInput", () => ({
  default: (p: SelectSingleInputProps) => (
    <div>
      <input
        aria-label="search"
        onChange={(e) => p.onSearchChange?.(e.target.value)}
      />
      <button onClick={p.onLoadMore}>more</button>
      <select
        aria-label={p.label as string}
        value={p.value ?? ""}
        onChange={(e) => p.onChange(e.target.value)}
        disabled={p.disabled}
      >
        {p.options.map((o) => {
          const option = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>
    </div>
  ),
}));
const list = vi.mocked(getRentalList);
let client: QueryClient;
beforeEach(() => {
  list.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.getState().login({
    token: "synthetic",
    expiresAt: Date.now() + 900000,
    user: { id: "1", name: "Synthetic" },
  });
});
afterEach(() => {
  client.clear();
  useAuthStore.getState().logout();
});
it("debounces private candidate search, bounds pages and keeps an off-page ID", async () => {
  list.mockImplementation(
    async (_resource, _id, query) =>
      ({
        data: [{ id: String(query?.page ?? 1), name: "Same name" }],
        meta: {
          page: query?.page ?? 1,
          limit: 20,
          total_items: 21,
          total_pages: 2,
        },
      }) as never,
  );
  render(
    <QueryClientProvider client={client}>
      <RentalRemoteSelect
        resource="collaborator-candidates"
        propertyId="7"
        label="Candidate"
        value="9007199254740993"
        selectedLabel="Selected candidate"
        onChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
  expect(list).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("search"), {
    target: { value: "Sa" },
  });
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(list).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("search"), {
    target: { value: "Same" },
  });
  await waitFor(() =>
    expect(list).toHaveBeenCalledWith(
      "collaborator-candidates",
      "7",
      { page: 1, limit: 20, search: "Same" },
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(screen.getByText("more"));
  await waitFor(() =>
    expect(list).toHaveBeenCalledWith(
      "collaborator-candidates",
      "7",
      { page: 2, limit: 20, search: "Same" },
      expect.any(AbortSignal),
    ),
  );
  expect(screen.getByRole("combobox")).toHaveValue("9007199254740993");
  expect(
    screen.getByRole("option", { name: "Selected candidate" }),
  ).toBeInTheDocument();
});
it("does not disclose candidates when its owner capability is disabled", async () => {
  render(
    <QueryClientProvider client={client}>
      <RentalRemoteSelect
        resource="collaborator-candidates"
        propertyId="7"
        label="Candidate"
        value={null}
        onChange={vi.fn()}
        enabled={false}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("search"), {
    target: { value: "Same" },
  });
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(list).not.toHaveBeenCalled();
});
it("distinguishes houses with the same name and selects their exact decimal ID", async () => {
  list.mockResolvedValue({
    data: [
      { id: "9007199254740992", name: "Casa compartida" },
      { id: "9007199254740993", name: "Casa compartida" },
    ],
    meta: { page: 1, limit: 20, total_items: 2, total_pages: 1 },
  } as never);
  const change = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <RentalRemoteSelect
        resource="properties"
        label="House"
        value={null}
        onChange={change}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", {
    name: "Casa compartida · #9007199254740992",
  });
  expect(
    screen.getByRole("option", { name: "Casa compartida · #9007199254740993" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "9007199254740993" },
  });
  expect(change).toHaveBeenCalledExactlyOnceWith("9007199254740993");
});
