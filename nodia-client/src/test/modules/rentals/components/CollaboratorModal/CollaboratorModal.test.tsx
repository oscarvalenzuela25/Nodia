import {
  administrationMock,
  resetAdministrationMocks,
  property,
  memberProperty,
  collaborator,
} from "../PropertyModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollaboratorModal from "../../../../../modules/rentals/components/CollaboratorModal";
import i18n from "../../../../../translate";
describe("CollaboratorModal", () => {
  beforeEach(resetAdministrationMocks);
  it("preserves a changed position after a failed update and does not reassign the user", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    administrationMock.execute.mockRejectedValueOnce(new Error("conflict"));
    render(
      <CollaboratorModal
        open
        property={property}
        initialData={collaborator}
        onClose={close}
      />,
    );
    const position = screen.getByLabelText(i18n.t("rental:position"));
    await user.clear(position);
    await user.type(position, "Limpieza");
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "collaborator.update",
        id: "30",
        data: { position: "Limpieza", is_active: true },
      }),
    );
    expect(close).not.toHaveBeenCalled();
    expect(position).toHaveValue("Limpieza");
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
  it("represents removing optional position with explicit null", async () => {
    const user = userEvent.setup();
    render(
      <CollaboratorModal
        open
        property={property}
        initialData={collaborator}
        onClose={vi.fn()}
      />,
    );
    await user.clear(screen.getByLabelText(i18n.t("rental:position")));
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "collaborator.update",
        id: "30",
        data: { position: null, is_active: true },
      }),
    );
  });
  it("disables all editing after ownership is revoked while preserving values", () => {
    const { rerender } = render(
      <CollaboratorModal
        open
        property={property}
        initialData={collaborator}
        onClose={vi.fn()}
      />,
    );
    rerender(
      <CollaboratorModal
        open
        property={memberProperty}
        initialData={collaborator}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(i18n.t("rental:position"))).toBeDisabled();
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
  });
  it("prevents activating a withdrawn collaborator on an archived house", () => {
    render(
      <CollaboratorModal
        open
        property={{ ...property, is_active: false }}
        initialData={{ ...collaborator, is_active: false }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
