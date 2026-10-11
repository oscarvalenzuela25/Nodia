import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhoneCountryInput from "../../../../components/inputs/PhoneCountryInput";
import i18n from "../../../../translate";
it("uses searchable localized calling codes without allowing a cleared country", async () => {
  const change = vi.fn();
  const view = render(<PhoneCountryInput value="CL" onChange={change} />);
  expect(screen.getByText("Chile (+56)")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("core:phone_country") }),
  );
  await userEvent.click(
    await screen.findByRole("option", { name: "Estados Unidos (+1)" }),
  );
  expect(change).toHaveBeenCalledWith("US");
  view.rerender(<PhoneCountryInput value="US" onChange={change} disabled />);
  expect(
    screen.getByRole("button", { name: i18n.t("core:phone_country") }),
  ).toHaveAttribute("aria-disabled", "true");
});
