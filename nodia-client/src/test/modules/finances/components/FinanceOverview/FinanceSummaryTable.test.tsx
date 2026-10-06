import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceSummaryTable from "../../../../../modules/finances/components/FinanceOverview/FinanceSummaryTable";
import type {
  FinanceColumn,
  FinanceTableProps,
} from "../../../../../modules/finances/components/FinanceTable";
import type {
  FinanceCategory,
  FinanceCategoryGroup,
  FinanceSummary,
} from "../../../../../modules/finances/types";

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  record: vi.fn(),
  mutation: vi.fn(),
  busy: vi.fn(),
  refetch: vi.fn(),
  uncertain: false,
  review: vi.fn(),
}));
vi.mock("../../../../../modules/finances/infrastructure/useServices", () => ({
  useFinanceSummary: mocks.summary,
  useFinanceRecord: mocks.record,
  useFinanceBusy: mocks.busy,
  useFinanceMutation: () => ({
    mutateAsync: mocks.mutation,
    isPending: false,
    isUncertain: mocks.uncertain,
    isReviewing: false,
    reviewResult: mocks.review,
  }),
}));
vi.mock("../../../../../modules/finances/components/FinanceTable", () => ({
  default: ({
    rows,
    columns,
    onSearchChange,
    onPageChange,
    onCreate,
    onEdit,
    onToggle,
  }: FinanceTableProps<FinanceSummary>) => (
    <div>
      <input
        aria-label="Summary search"
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <button onClick={() => onPageChange(2)}>Next summary page</button>
      <button onClick={onCreate}>Create summary record</button>
      {rows.map((row) => (
        <div key={row.id}>
          <span>{row.name}</span>
          {columns.map((column: FinanceColumn<FinanceSummary>) => (
            <span key={column.key}>{column.render(row)}</span>
          ))}
          <button onClick={() => onEdit(row)}>Edit summary record</button>
          <button onClick={() => onToggle(row)}>Toggle summary record</button>
        </div>
      ))}
    </div>
  ),
}));
vi.mock(
  "../../../../../modules/finances/components/FinanceCatalogModal",
  () => ({
    default: ({ initialData }: { initialData?: FinanceCategory }) => (
      <div role="dialog" aria-label="Category form">
        {initialData?.name ?? "Create category"}
      </div>
    ),
  }),
);
vi.mock("../../../../../modules/finances/components/FinanceGroupModal", () => ({
  default: ({ initialData }: { initialData?: FinanceCategoryGroup }) => (
    <div role="dialog" aria-label="Group form">
      {initialData?.categories?.map((row) => row.name).join(", ") ??
        "Create group"}
    </div>
  ),
}));

const summaryRow: FinanceSummary = {
  id: "1",
  name: "Zero category",
  key: "zero",
  is_active: true,
  movement_count: 0,
  income_amount: "0",
  expense_amount: "0",
  net_amount: "0",
};
const record: FinanceCategory = {
  id: "1",
  user_id: "1",
  name: "Hydrated category",
  key: "zero",
  is_active: true,
  created_at: "2026-10-04T00:00:00.000Z",
  updated_at: "2026-10-04T00:00:00.000Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.uncertain = false;
  mocks.review.mockRejectedValue(new Error("Read failed"));
  mocks.busy.mockReturnValue(false);
  mocks.summary.mockReturnValue({
    data: {
      data: [summaryRow],
      meta: { page: 1, limit: 10, total_items: 31, total_pages: 4 },
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: mocks.refetch,
  });
  mocks.record.mockReturnValue({
    data: undefined,
    isFetching: false,
    isError: false,
    refetch: mocks.refetch,
  });
  mocks.mutation.mockResolvedValue(record);
});

describe("FinanceSummaryTable", () => {
  it("keeps uncertain catalog toggles blocked after a failed result review", async () => {
    const view = render(
      <FinanceSummaryTable kind="categories" query={{ active: "active" }} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Toggle summary record" }),
    );
    mocks.uncertain = true;
    view.rerender(
      <FinanceSummaryTable kind="categories" query={{ active: "active" }} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Revisar resultado" }),
    );
    expect(mocks.review).toHaveBeenCalledOnce();
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("keeps zero catalog rows and sends bounded server pagination/search with the financial scope", async () => {
    const user = userEvent.setup();
    render(
      <FinanceSummaryTable
        kind="categories"
        query={{
          active: "active",
          q: { type_eq: "income" },
          category_ids: ["1"],
        }}
      />,
    );
    expect(screen.getAllByText("Zero category")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Next summary page" }));
    expect(mocks.summary).toHaveBeenLastCalledWith(
      "categories",
      expect.objectContaining({
        page: 2,
        limit: 10,
        category_ids: ["1"],
        q: { type_eq: "income" },
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Summary search" }),
      "Food",
    );
    expect(mocks.summary).toHaveBeenLastCalledWith(
      "categories",
      expect.objectContaining({
        page: 1,
        q: { type_eq: "income", name_cont: "Food" },
      }),
    );
  });

  it("hydrates the selected ID before opening edit and never edits an aggregate projection", async () => {
    const view = render(
      <FinanceSummaryTable kind="categories" query={{ active: "active" }} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Edit summary record" }),
    );
    expect(mocks.record).toHaveBeenLastCalledWith("categories", "1", true);
    expect(
      screen.queryByRole("dialog", { name: "Category form" }),
    ).not.toBeInTheDocument();
    mocks.record.mockReturnValue({
      data: record,
      isFetching: false,
      isError: false,
      refetch: mocks.refetch,
    });
    view.rerender(
      <FinanceSummaryTable kind="categories" query={{ active: "active" }} />,
    );
    expect(
      screen.getByRole("dialog", { name: "Category form" }),
    ).toHaveTextContent("Hydrated category");
  });

  it("can create groups and exposes the overlapping totals warning", async () => {
    render(
      <FinanceSummaryTable
        kind="category-groups"
        query={{ active: "active" }}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Create summary record" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Group form" }),
    ).toHaveTextContent("Create group");
  });

  it("keeps confirmation after an unsuccessful toggle and retries only explicitly", async () => {
    mocks.mutation.mockRejectedValueOnce(new Error("Conflict"));
    render(
      <FinanceSummaryTable kind="categories" query={{ active: "active" }} />,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Toggle summary record" }),
    );
    await user.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() => expect(mocks.mutation).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.mutation).toHaveBeenCalledWith({
      id: "1",
      data: { is_active: false },
    });
    await user.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.mutation).toHaveBeenCalledTimes(2);
  });

  it("blocks duplicate toggle handlers before the UI can update", async () => {
    let completeWrite: (() => void) | undefined;
    mocks.mutation.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeWrite = resolve;
        }),
    );
    render(
      <FinanceSummaryTable kind="categories" query={{ active: "active" }} />,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Toggle summary record" }),
    );
    const confirm = screen.getByRole("button", { name: /confirmar/i });
    await user.click(confirm);
    await user.click(confirm);
    expect(mocks.mutation).toHaveBeenCalledTimes(1);
    completeWrite?.();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("hydrates group membership rather than deriving it from its count", async () => {
    const view = render(
      <FinanceSummaryTable
        kind="category-groups"
        query={{ active: "active" }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Edit summary record" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Group form" }),
    ).not.toBeInTheDocument();
    mocks.record.mockReturnValue({
      data: {
        ...record,
        category_count: 1,
        categories: [
          {
            id: "99",
            name: "Historical inactive category",
            key: "old",
            is_active: false,
          },
        ],
      },
      isFetching: false,
      isError: false,
      refetch: mocks.refetch,
    });
    view.rerender(
      <FinanceSummaryTable
        kind="category-groups"
        query={{ active: "active" }}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Group form" }),
    ).toHaveTextContent("Historical inactive category");
  });
});
