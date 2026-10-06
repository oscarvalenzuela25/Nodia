import {
  administrationMock,
  resetAdministrationMocks,
  property,
  memberProperty,
  policy,
  readResult,
} from "../PropertyModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PolicyTable from "../../../../../modules/rentals/components/PolicyTable";
import i18n from "../../../../../translate";

// Table mechanics have shared tests; this adapter exposes consumer actions and pagination.
vi.mock("../../../../../modules/rentals/components/RentalTable", () => ({
  default: (props: {
    rows: (typeof policy)[];
    onCreate?: () => void;
    actions?: (row: typeof policy) => {
      key: string;
      label: string;
      onClick: () => void;
      disabled?: boolean;
    }[];
    onPageChange: (page: number) => void;
    onSearchChange?: (value: string) => void;
    busy?: boolean;
  }) => (
    <section>
      {props.onCreate && (
        <button disabled={props.busy} onClick={props.onCreate}>
          create-test
        </button>
      )}
      <button disabled={props.busy} onClick={() => props.onPageChange(2)}>
        next-test
      </button>
      <button
        disabled={props.busy}
        onClick={() => props.onSearchChange?.("Flexible")}
      >
        search-test
      </button>
      {props.rows.map((row) => (
        <div key={row.id}>
          {row.name}
          {props.actions?.(row).map((action) => (
            <button
              key={action.key}
              disabled={props.busy || action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ))}
    </section>
  ),
}));
describe("PolicyTable", () => {
  beforeEach(resetAdministrationMocks);
  it("uses server search and paging without per-row detail requests", async () => {
    const user = userEvent.setup();
    administrationMock.list.mockReturnValue(
      readResult({
        data: [policy],
        meta: { page: 1, limit: 10, total_items: 20, total_pages: 2 },
      }),
    );
    render(<PolicyTable property={property} />);
    expect(administrationMock.record).toHaveBeenCalledWith(
      "cancellation-policies",
      "10",
      undefined,
      false,
    );
    await user.click(screen.getByText("next-test"));
    await waitFor(() =>
      expect(administrationMock.list).toHaveBeenLastCalledWith(
        "cancellation-policies",
        "10",
        { page: 2, limit: 10, active: "active" },
      ),
    );
    await user.click(screen.getByText("search-test"));
    await waitFor(() =>
      expect(administrationMock.list).toHaveBeenLastCalledWith(
        "cancellation-policies",
        "10",
        { page: 1, limit: 10, active: "active", q: { name_cont: "Flexible" } },
      ),
    );
  });
  it("blocks default policy deactivation and presents member read-only detail", async () => {
    const { rerender } = render(
      <PolicyTable
        property={{ ...property, default_cancellation_policy_id: "20" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: i18n.t("rental:deactivate") }),
    ).toBeDisabled();
    rerender(<PolicyTable property={memberProperty} />);
    expect(screen.queryByText("create-test")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("rental:deactivate") }),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: i18n.t("rental:view_policy") }),
      );
    await waitFor(() =>
      expect(administrationMock.record).toHaveBeenCalledWith(
        "cancellation-policies",
        "10",
        "20",
        true,
      ),
    );
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
  });
});
