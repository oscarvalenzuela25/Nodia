import { vi } from "vitest";
import type {
  FinanceCategory,
  FinanceCategoryGroup,
  FinanceMovement,
  FinanceObligation,
} from "../../../../../modules/finances/types";

const financeMock = vi.hoisted(() => ({
  save: vi.fn(),
  record: vi.fn(),
  options: vi.fn(),
  busy: false,
  uncertain: false,
  review: vi.fn(),
}));
export { financeMock };
vi.mock("../../../../../modules/finances/infrastructure/useServices", () => ({
  useFinanceMutation: () => ({
    mutateAsync: financeMock.save,
    isPending: false,
    isUncertain: financeMock.uncertain,
    isReviewing: false,
    reviewResult: financeMock.review,
  }),
  useFinanceBusy: () => financeMock.busy,
  useFinanceRecord: (...args: unknown[]) => financeMock.record(...args),
  useFinanceOptions: (...args: unknown[]) => financeMock.options(...args),
}));

const base = {
  id: "10",
  user_id: "1",
  name: "Comida",
  is_active: true,
  created_at: "2026-10-04T12:00:00Z",
  updated_at: "2026-10-04T12:00:00Z",
};
export const category: FinanceCategory = { ...base, key: "food" };
export const group: FinanceCategoryGroup = {
  ...base,
  id: "20",
  name: "Gastos",
  key: "expenses",
  category_count: 1,
  categories: [
    { id: "99", name: "Histórica", key: "history", is_active: false },
  ],
};
export const obligation: FinanceObligation = {
  ...base,
  id: "30",
  name: "Préstamo",
  key: "loan",
  type: "loan",
  amount: "100000",
  description: null,
  paid_amount: "40000",
  remaining_amount: "60000",
  initial_movement: {
    id: "40",
    type: "expense",
    status: "paid",
    amount: "100000",
    category_id: category.id,
  },
};
export const movement: FinanceMovement = {
  ...base,
  id: "41",
  name: "Pago",
  amount: "20000",
  type: "income",
  status: "received",
  category_id: category.id,
  obligation_id: obligation.id,
  category: { id: category.id, name: category.name, key: category.key },
  obligation: {
    id: obligation.id,
    name: obligation.name,
    type: obligation.type,
  },
};

export function resetFinanceMocks() {
  vi.clearAllMocks();
  financeMock.busy = false;
  financeMock.uncertain = false;
  financeMock.save.mockResolvedValue(category);
  financeMock.review.mockResolvedValue(undefined);
  financeMock.options.mockImplementation((resource: string) => ({
    data: {
      pages: [
        {
          data: resource === "obligations" ? [obligation] : [category],
          meta: { page: 1, limit: 20, total_items: 1, total_pages: 1 },
        },
      ],
    },
    isFetching: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }));
  financeMock.record.mockImplementation(
    (resource: string, id: string | undefined) => ({
      data: id
        ? resource === "obligations"
          ? obligation
          : resource === "category-groups"
            ? group
            : category
        : undefined,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }),
  );
}
