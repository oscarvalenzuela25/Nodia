import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import PhoneInput from "../../../../components/inputs/PhoneInput";
import i18n from "../../../../translate";
it("forwards form focus and disables both controls while retaining an incomplete telephone", () => {
  const ref = createRef<HTMLInputElement>();
  render(
    <PhoneInput
      ref={ref}
      country="CL"
      onCountryChange={vi.fn()}
      label="Telephone"
      value="98"
      onChange={vi.fn()}
      error
      helperText="Incomplete"
      disabled
      required
    />,
  );
  expect(ref.current).toBe(screen.getByRole("textbox", { name: "Telephone" }));
  expect(screen.getByRole("textbox", { name: "Telephone" })).toHaveValue("98");
  expect(screen.getByRole("textbox", { name: "Telephone" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Telephone" })).toHaveAttribute(
    "aria-required",
    "true",
  );
  expect(screen.getByText("Incomplete")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: i18n.t("core:phone_country") }),
  ).toHaveAttribute("aria-disabled", "true");
});
