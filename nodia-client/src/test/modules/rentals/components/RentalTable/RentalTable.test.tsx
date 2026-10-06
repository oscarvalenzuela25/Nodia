import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalTable from "../../../../../modules/rentals/components/RentalTable";
import i18n from "../../../../../translate";
const props = () => ({
  rows: [{ id: "42", name: "Exact row" }],
  columns: [
    { key: "name", label: "Name", render: (row: { name: string }) => row.name },
  ],
  page: 1,
  limit: 10,
  onPageChange: vi.fn(),
  onLimitChange: vi.fn(),
  query: {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
  meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
});
describe("RentalTable", () => {
  beforeEach(() => vi.clearAllMocks());
  it("preserves the row during a refetch, and disables actions", () => {
    render(
      <RentalTable
        {...props()}
        query={{ ...props().query, isFetching: true }}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText("Exact row")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("rental:create") }),
    ).toBeDisabled();
  });
  it("distinguishes empty from failure and offers retry", async () => {
    const p = props();
    render(
      <RentalTable {...p} rows={[]} query={{ ...p.query, isError: true }} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("rental:retry") }),
    );
    expect(p.query.refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("binds a menu action to the stable row ID", async () => {
    const action = vi.fn();
    render(
      <RentalTable
        {...props()}
        actions={(row) => [
          { key: "open", label: "Open row", onClick: () => action(row.id) },
        ]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("rental:row_actions", { id: "42" }),
      }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Open row" }));
    expect(action).toHaveBeenCalledWith("42");
  });
  it("adjusts the page after the last row leaves the current filter", async () => {
    const p = props();
    render(<RentalTable {...p} page={3} rows={[]} />);
    await waitFor(() => expect(p.onPageChange).toHaveBeenCalledWith(1));
  });
});
