import {
  administrationMock,
  resetAdministrationMocks,
  property,
  memberProperty,
  collaborator,
  readResult,
} from "../PropertyModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollaboratorTable from "../../../../../modules/rentals/components/CollaboratorTable";
import i18n from "../../../../../translate";
vi.mock("../../../../../modules/rentals/components/RentalTable", () => ({
  default: (props: {
    rows: (typeof collaborator)[];
    onCreate?: () => void;
    actions?: (row: typeof collaborator) => {
      key: string;
      label: string;
      onClick: () => void;
      disabled?: boolean;
    }[];
    onSearchChange?: (value: string) => void;
    busy?: boolean;
  }) => (
    <section>
      {props.onCreate && (
        <button disabled={props.busy} onClick={props.onCreate}>
          create-test
        </button>
      )}
      <button
        disabled={props.busy}
        onClick={() => props.onSearchChange?.("Apoyo")}
      >
        search-test
      </button>
      {props.rows.map((row) => (
        <div key={row.id}>
          {row.user.name}
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
describe("CollaboratorTable", () => {
  beforeEach(resetAdministrationMocks);
  it("uses the actual position filter and does not fetch global users", async () => {
    render(<CollaboratorTable property={property} />);
    await userEvent.setup().click(screen.getByText("search-test"));
    await waitFor(() =>
      expect(administrationMock.list).toHaveBeenLastCalledWith(
        "collaborators",
        "10",
        { page: 1, limit: 10, active: "active", q: { position_cont: "Apoyo" } },
      ),
    );
    expect(
      administrationMock.list.mock.calls.every(
        (args) => args[0] === "collaborators",
      ),
    ).toBe(true);
  });
  it("members can read without edit/add/withdraw actions", () => {
    render(<CollaboratorTable property={memberProperty} />);
    expect(screen.getByText(collaborator.user.name!)).toBeInTheDocument();
    expect(screen.queryByText("create-test")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: i18n.t("rental:remove_collaborator"),
      }),
    ).not.toBeInTheDocument();
  });
  it("withdraws membership by exact row ID after confirmation and keeps failed confirmation", async () => {
    const user = userEvent.setup();
    administrationMock.execute.mockRejectedValueOnce(new Error("conflict"));
    render(<CollaboratorTable property={property} />);
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rental:remove_collaborator"),
      }),
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("core:confirm") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "collaborator.update",
        id: "30",
        data: { is_active: false },
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("archived house prevents adding/reactivating while allowing withdrawal", () => {
    administrationMock.list.mockReturnValue(
      readResult({
        data: [{ ...collaborator, is_active: false }],
        meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
      }),
    );
    render(<CollaboratorTable property={{ ...property, is_active: false }} />);
    expect(screen.queryByText("create-test")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: i18n.t("rental:reactivate_collaborator"),
      }),
    ).toBeDisabled();
  });
});
