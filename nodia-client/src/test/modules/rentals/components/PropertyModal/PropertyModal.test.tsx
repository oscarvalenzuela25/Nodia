import {
  administrationMock,
  resetAdministrationMocks,
  property,
  memberProperty,
  ack,
} from "./fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PropertyModal from "../../../../../modules/rentals/components/PropertyModal";
import i18n from "../../../../../translate";

describe("PropertyModal", () => {
  beforeEach(resetAdministrationMocks);
  it("edits suggested values independently and retains a zero deposit and the draft after rejection", async () => {
    administrationMock.execute.mockRejectedValueOnce(new Error("conflict"));
    const close = vi.fn();
    render(
      <PropertyModal
        open
        initialData={property}
        section="defaults"
        onClose={close}
      />,
    );
    expect(
      screen.queryByLabelText(new RegExp(i18n.t("rental:name"))),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    const deposit = screen.getByLabelText(
      i18n.t("rental:default_deposit_percent"),
    );
    fireEvent.change(deposit, { target: { value: "0" } });
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "property.update",
        id: property.id,
        data: { default_deposit_percent: "0" },
      }),
    );
    expect(close).not.toHaveBeenCalled();
    expect(deposit).toHaveValue("0");
  });
  it("keeps commercial fields out of the house details editor", () => {
    render(
      <PropertyModal
        open
        initialData={property}
        section="details"
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText(new RegExp(i18n.t("rental:name"))),
    ).toHaveValue(property.name);
    expect(
      screen.queryByLabelText(i18n.t("rental:default_nightly_rate")),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t("rental:notes"))).toBeInTheDocument();
  });
  it("requires explicit house data and creates without commercial defaults or a default policy", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const saved = vi.fn();
    render(<PropertyModal open onClose={close} onSaved={saved} />);
    expect(
      screen.queryByLabelText(/Zona horaria|Hora de entrada|Hora de salida/),
    ).not.toBeInTheDocument();
    const form = screen
      .getByLabelText(new RegExp(i18n.t("rental:name")))
      .closest("form")!;
    expect(
      form.querySelectorAll("input")[form.querySelectorAll("input").length - 1],
    ).toHaveAttribute("type", "checkbox");
    for (const [field, value] of Object.entries({
      name: "Casa nueva",
      max_guests: "4",
    }))
      fireEvent.change(
        screen.getByLabelText(new RegExp(i18n.t(`rental:${field}`))),
        { target: { value } },
      );
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "property.create",
        data: {
          name: "Casa nueva",
          max_guests: 4,
          location: null,
          default_nightly_rate: null,
          default_deposit_percent: null,
          minimum_turnover_minutes: 0,
          notes: null,
          is_active: true,
        },
      }),
    );
    expect(saved).toHaveBeenCalledWith(ack);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("preserves edited accommodation data after a rejected update and submits only changed fields", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    administrationMock.execute.mockRejectedValueOnce(
      new Error("rental:invalid_input"),
    );
    render(<PropertyModal open initialData={property} onClose={close} />);
    const zone = screen.getByLabelText(i18n.t("rental:location"));
    await user.clear(zone);
    await user.type(zone, "Ubicación revisada");
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "property.update",
        id: "10",
        data: { location: "Ubicación revisada" },
      }),
    );
    expect(close).not.toHaveBeenCalled();
    expect(zone).toHaveValue("Ubicación revisada");
  });
  it("blocks double submission before React commits disabled state", async () => {
    const user = userEvent.setup();
    administrationMock.execute.mockReturnValue(new Promise(() => undefined));
    render(<PropertyModal open initialData={property} onClose={vi.fn()} />);
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("rental:name"))),
      " revisada",
    );
    const form = screen
      .getByLabelText(new RegExp(i18n.t("rental:name")))
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledTimes(1),
    );
  });
  it("reacts to lost configuration permission while a modal is open", async () => {
    const { rerender } = render(
      <PropertyModal open initialData={property} onClose={vi.fn()} />,
    );
    rerender(
      <PropertyModal open initialData={memberProperty} onClose={vi.fn()} />,
    );
    expect(
      screen.getByLabelText(new RegExp(i18n.t("rental:name"))),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
    fireEvent.submit(
      screen.getByLabelText(new RegExp(i18n.t("rental:name"))).closest("form")!,
    );
    await waitFor(() =>
      expect(administrationMock.execute).not.toHaveBeenCalled(),
    );
  });
  it("does not close for an undefined uncertain acknowledgment", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    administrationMock.execute.mockResolvedValue(undefined);
    render(<PropertyModal open initialData={property} onClose={close} />);
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("rental:name"))),
      " sin respuesta",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledTimes(1),
    );
    expect(close).not.toHaveBeenCalled();
  });
});
