import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import FinanceResourceTab from "../../../../../modules/finances/components/FinanceResourceTab";
import type {
  FinanceCategory,
  FinanceQuery,
} from "../../../../../modules/finances/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  record: vi.fn(),
  mutate: vi.fn(),
  busy: vi.fn(),
  refetch: vi.fn(),
  uncertain: false,
  review: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      values?.name ? `${key}:${values.name}` : key,
    i18n: { language: "es" },
  }),
}));
vi.mock("boneyard-js/react", () => ({
  Skeleton: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../../../modules/finances/infrastructure/useServices", () => ({
  useFinanceList: mocks.list,
  useFinanceRecord: mocks.record,
  useFinanceBusy: mocks.busy,
  useFinanceMutation: () => ({
    mutateAsync: mocks.mutate,
    isPending: false,
    isUncertain: mocks.uncertain,
    isReviewing: false,
    reviewResult: mocks.review,
  }),
}));
vi.mock("../../../../../modules/finances/components/FinanceFilters", () => ({
  default: () => <div>Filtros</div>,
}));
vi.mock(
  "../../../../../modules/finances/components/FinanceCatalogModal",
  () => ({
    default: ({ initialData }: { initialData?: FinanceCategory }) => (
      <div role="dialog">{initialData?.name ?? "Crear categoría"}</div>
    ),
  }),
);
vi.mock("../../../../../modules/finances/components/FinanceGroupModal", () => ({
  default: () => <div>Group modal</div>,
}));
vi.mock(
  "../../../../../modules/finances/components/FinanceMovementModal",
  () => ({ default: () => <div>Movement modal</div> }),
);
vi.mock(
  "../../../../../modules/finances/components/FinanceObligationModal",
  () => ({ default: () => <div>Obligation modal</div> }),
);

const category: FinanceCategory = {
  id: "9007199254740993",
  user_id: "1",
  name: "Categoría personal",
  key: "personal",
  is_active: true,
  created_at: "2026-10-01T03:00:00Z",
  updated_at: "2026-10-01T03:00:00Z",
};
const listing = {
  data: {
    data: [category],
    meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
  },
  isLoading: false,
  isFetching: false,
  isError: false,
  isPlaceholderData: false,
  refetch: mocks.refetch,
};

describe("FinanceResourceTab", () => {
  it.each([
    {remaining:'60000',expected:'$60.000',canPay:true},
    {remaining:'0',expected:'$0',canPay:false},
    {remaining:null,expected:'finance:void_obligation',canPay:false},
  ])('shows the server obligation balance and restricts payment actions: $remaining',async({remaining,expected,canPay})=>{
    mocks.list.mockReturnValue({...listing,data:{...listing.data,data:[{...category,id:'30',type:'loan',amount:'100000',paid_amount:remaining==='0'?'100000':'40000',remaining_amount:remaining,description:null,initial_movement:{id:'40',type:'expense',status:'paid',amount:'100000',category_id:category.id}}]}});
    render(<FinanceResourceTab resource="obligations"/>);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button',{name:'finance:row_actions:Categoría personal'}));
    const action=screen.getByRole('menuitem',{name:'finance:register_payment'});
    if(canPay){expect(action).not.toHaveAttribute('aria-disabled','true');}
    else{expect(action).toHaveAttribute('aria-disabled','true');}
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uncertain = false;
    mocks.review.mockRejectedValue(new Error("Read failed"));
    mocks.list.mockReturnValue(listing);
    mocks.record.mockReturnValue({
      data: category,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mocks.refetch,
    });
    mocks.busy.mockReturnValue(false);
    mocks.mutate.mockResolvedValue(category);
  });

  it("reviews uncertain toggles without repeating a write when review fails", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValue(new Error("Lost response"));
    const view = render(<FinanceResourceTab resource="categories" />);
    await user.click(
      screen.getByRole("button", {
        name: "finance:row_actions:Categoría personal",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "finance:deactivate" }),
    );
    await user.click(screen.getByRole("button", { name: "core:confirm" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce());
    mocks.uncertain = true;
    view.rerender(<FinanceResourceTab resource="categories" />);
    await user.click(
      screen.getByRole("button", { name: "finance:review_result" }),
    );
    expect(mocks.review).toHaveBeenCalledOnce();
    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "finance:review_result" }),
    ).toBeInTheDocument();
  });

  it("requests active records by default and hydrates exact edit identity", async () => {
    const user = userEvent.setup();
    render(<FinanceResourceTab resource="categories" />);
    expect(mocks.list).toHaveBeenCalledWith(
      "categories",
      expect.objectContaining({ active: "active", limit: 10 }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "finance:row_actions:Categoría personal",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "finance:update" }));
    expect(mocks.record).toHaveBeenLastCalledWith(
      "categories",
      category.id,
      true,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(category.name);
  });

  it("preserves toggle confirmation after rejection and closes only on successful retry", async () => {
    const user = userEvent.setup();
    mocks.mutate
      .mockRejectedValueOnce(new Error("finance:conflict"))
      .mockResolvedValueOnce(category);
    render(<FinanceResourceTab resource="categories" />);
    await user.click(
      screen.getByRole("button", {
        name: "finance:row_actions:Categoría personal",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "finance:deactivate" }),
    );
    await user.click(screen.getByRole("button", { name: "core:confirm" }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      id: category.id,
      data: { is_active: false },
    });
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "finance:confirm_toggle:Categoría personal",
    );
    await user.click(screen.getByRole("button", { name: "core:confirm" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });

  it("uses embedded financial scope without mounting a second Filter", () => {
    const query: FinanceQuery = {
      active: "inactive",
      category_group_ids: ["15"],
      q: { created_at_gteq: "2026-10-01T03:00:00Z" },
    };
    mocks.list.mockReturnValue({
      ...listing,
      data: {
        ...listing.data,
        data: [
          {
            ...category,
            amount: "100000",
            type: "expense",
            status: "paid",
            category_id: category.id,
            obligation_id: null,
            category: {
              id: category.id,
              name: category.name,
              key: category.key,
            },
            obligation: null,
          },
        ],
      },
    });
    render(
      <FinanceResourceTab
        resource="movements"
        showFilters={false}
        query={query}
        limit={5}
      />,
    );
    expect(screen.queryByText("Filtros")).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(
      "movements",
      expect.objectContaining({ ...query, limit: 5 }),
    );
  });

  it("recovers an out-of-range page after an archive removes the final item", async () => {
    const onQueryChange = vi.fn();
    mocks.list.mockReturnValue({
      ...listing,
      data: {
        data: [],
        meta: { page: 3, limit: 10, total_items: 20, total_pages: 2 },
      },
    });
    render(
      <FinanceResourceTab
        resource="categories"
        query={{ active: "active", page: 3, limit: 10 }}
        onQueryChange={onQueryChange}
      />,
    );
    await waitFor(() =>
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, active: "active", limit: 10 }),
      ),
    );
  });
});
