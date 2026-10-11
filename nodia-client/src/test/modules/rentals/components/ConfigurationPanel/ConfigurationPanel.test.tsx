import {
  administrationMock,
  resetAdministrationMocks,
  property,
  memberProperty,
  readResult,
  policy,
} from "../PropertyModal/fixtures";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigurationPanel from "../../../../../modules/rentals/components/ConfigurationPanel";
import i18n from "../../../../../translate";

describe("ConfigurationPanel", () => {
  beforeEach(resetAdministrationMocks);
  it("preserves an open editor when revalidation changes the saved default policy", async () => {
    const { rerender } = render(<ConfigurationPanel property={property} />);
    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("rental:configuration_view.edit_details"),
      }),
    );
    const input = within(screen.getByRole("dialog")).getByLabelText(
      i18n.t("rental:location"),
    );
    await userEvent.type(input, "Unsaved house location");
    rerender(
      <ConfigurationPanel
        property={{ ...property, default_cancellation_policy_id: policy.id }}
      />,
    );
    expect(input).toHaveValue("Unsaved house location");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("sets the default by stable ID from a card and leaves the selection available after rejection", async () => {
    administrationMock.execute.mockRejectedValueOnce(new Error("conflict"));
    render(<ConfigurationPanel property={property} />);
    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("rental:configuration_view.use_default"),
      }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "property.update",
        id: property.id,
        data: { default_cancellation_policy_id: policy.id },
      }),
    );
    expect(
      screen.getByRole("combobox", {
        name: i18n.t("rental:default_cancellation_policy"),
      }),
    ).toHaveValue(policy.id);
    expect(
      screen.getByRole("button", {
        name: i18n.t("rental:save_default_policy"),
      }),
    ).toBeEnabled();
  });
  it("shows null values as absent while preserving real zero values", () => {
    render(
      <ConfigurationPanel
        property={{ ...property, default_deposit_percent: "0" }}
      />,
    );
    expect(screen.getByText("0 %")).toBeInTheDocument();
    expect(screen.getByText("0 minutos")).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t("rental:not_assigned"))).toHaveLength(2);
  });
  it("allows members to read the house while retaining no administration controls", () => {
    render(<ConfigurationPanel property={memberProperty} />);
    expect(screen.getByText(property.name)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: i18n.t("rental:configuration_view.edit_details"),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("rental:archive_property") }),
    ).not.toBeInTheDocument();
  });
  it("archives only after explicit confirmation and keeps the dialog on conflict", async () => {
    const user = userEvent.setup();
    administrationMock.execute.mockRejectedValueOnce(new Error("conflict"));
    render(<ConfigurationPanel property={property} />);
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:archive_property") }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText(
        i18n.t("rental:archive_property_confirm"),
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: i18n.t("core:confirm") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "property.update",
        id: "10",
        data: { is_active: false },
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("keeps an archived house readable and offers explicit reactivation to owner", () => {
    render(<ConfigurationPanel property={{ ...property, is_active: false }} />);
    expect(screen.getByText(property.name)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: i18n.t("rental:reactivate_property"),
      }),
    ).toBeEnabled();
  });
  it("reads the current default by stable ID without a full-policy download", () => {
    administrationMock.record.mockReturnValue(readResult(policy));
    render(
      <ConfigurationPanel
        property={{ ...property, default_cancellation_policy_id: "20" }}
      />,
    );
    expect(administrationMock.record).toHaveBeenCalledWith(
      "cancellation-policies",
      "10",
      "20",
      true,
    );
    expect(
      within(
        screen.getByRole("combobox", {
          name: i18n.t("rental:default_cancellation_policy"),
        }),
      ).getByText(policy.name),
    ).toBeInTheDocument();
  });
});
