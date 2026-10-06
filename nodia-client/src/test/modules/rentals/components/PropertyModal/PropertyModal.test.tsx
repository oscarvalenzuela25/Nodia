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
  it("requires explicit house data and creates without commercial defaults or a default policy", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const saved = vi.fn();
    render(<PropertyModal open onClose={close} onSaved={saved} />);
    for (const [field, value] of Object.entries({
      name: "Casa nueva",
      timezone: "America/Santiago",
      max_guests: "4",
      check_in_time: "15:00",
      check_out_time: "11:00",
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
          timezone: "America/Santiago",
          max_guests: 4,
          check_in_time: "15:00",
          check_out_time: "11:00",
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
  it("preserves a changed timezone after the history conflict and submits only changed fields", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    administrationMock.execute.mockRejectedValueOnce(
      new Error("rental:agreement_immutable"),
    );
    render(<PropertyModal open initialData={property} onClose={close} />);
    const zone = screen.getByLabelText(new RegExp(i18n.t("rental:timezone")));
    await user.clear(zone);
    await user.type(zone, "America/Bogota");
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "property.update",
        id: "10",
        data: { timezone: "America/Bogota" },
      }),
    );
    expect(close).not.toHaveBeenCalled();
    expect(zone).toHaveValue("America/Bogota");
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
