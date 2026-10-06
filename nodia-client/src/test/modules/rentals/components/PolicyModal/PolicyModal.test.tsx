import {
  administrationMock,
  resetAdministrationMocks,
  property,
  memberProperty,
  policy,
} from "../PropertyModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PolicyModal from "../../../../../modules/rentals/components/PolicyModal";
import i18n from "../../../../../translate";
describe("PolicyModal", () => {
  beforeEach(resetAdministrationMocks);
  it("keeps changed policy and all tiers after rejection and submits one atomic payload", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    administrationMock.execute.mockRejectedValueOnce(new Error("conflict"));
    render(
      <PolicyModal
        open
        property={property}
        initialData={policy}
        onClose={close}
      />,
    );
    const name = screen.getByLabelText(new RegExp(i18n.t("rental:name")));
    await user.clear(name);
    await user.type(name, "Flexible revisada");
    const percent = screen.getAllByLabelText((label) =>
      label.startsWith(i18n.t("rental:refund_percent")),
    )[1];
    await user.clear(percent);
    await user.type(percent, "25.5");
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(administrationMock.execute).toHaveBeenCalledWith({
        operation: "policy.update",
        id: "20",
        data: {
          name: "Flexible revisada",
          is_active: true,
          rules: [
            { min_days_before: 0, refund_percent: "0.00" },
            { min_days_before: 7, refund_percent: "25.5" },
          ],
        },
      }),
    );
    expect(close).not.toHaveBeenCalled();
    expect(percent).toHaveValue("25.5");
    expect(name).toHaveValue("Flexible revisada");
  });
  it("blocks deactivation of the house default until explicitly replaced", () => {
    render(
      <PolicyModal
        open
        property={{ ...property, default_cancellation_policy_id: policy.id }}
        initialData={policy}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(
      screen.getByText(i18n.t("rental:default_policy_active")),
    ).toBeInTheDocument();
  });
  it("removes write access when ownership capabilities change without dropping the draft", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PolicyModal
        open
        property={property}
        initialData={policy}
        onClose={vi.fn()}
      />,
    );
    const name = screen.getByLabelText(new RegExp(i18n.t("rental:name")));
    await user.type(name, " cambiada");
    rerender(
      <PolicyModal
        open
        property={memberProperty}
        initialData={policy}
        onClose={vi.fn()}
      />,
    );
    expect(name).toHaveValue("Flexible cambiada");
    expect(name).toBeDisabled();
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
  });
  it("requires user percentages and never fabricates a default tier refund", () => {
    render(<PolicyModal open property={property} onClose={vi.fn()} />);
    expect(
      screen.getByLabelText((label) =>
        label.startsWith(i18n.t("rental:refund_percent")),
      ),
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
  });
});
