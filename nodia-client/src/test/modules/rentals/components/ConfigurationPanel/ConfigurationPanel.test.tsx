import {
  administrationMock,
  resetAdministrationMocks,
  property,
  memberProperty,
  readResult,
  policy,
} from "../PropertyModal/fixtures";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigurationPanel from "../../../../../modules/rentals/components/ConfigurationPanel";
import i18n from "../../../../../translate";

describe("ConfigurationPanel", () => {
  beforeEach(resetAdministrationMocks);
  it("allows members to read the house while retaining no administration controls", () => {
    render(<ConfigurationPanel property={memberProperty} />);
    expect(screen.getByText(property.name)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("rental:edit_property") }),
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
      screen.getByText(i18n.t("rental:archive_property_confirm")),
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
    expect(screen.getByText(policy.name)).toBeInTheDocument();
  });
});
