import { useState } from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DateInput from "../../../../components/inputs/DateInput";
import MUIProvider from "../../../../providers/MUIProvider";
import i18n from "../../../../translate";
function Field({
  label = "Fecha QA",
  minDate,
  maxDate,
}: {
  label?: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [value, setValue] = useState("2026-10-09");
  return (
    <DateInput
      label={label}
      value={value}
      minDate={minDate}
      maxDate={maxDate}
      onChange={setValue}
    />
  );
}
it("selects a civil date using the localized community calendar without an instant conversion", async () => {
  render(
    <MUIProvider>
      <Field />
    </MUIProvider>,
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: i18n.t("core:open_date_calendar", { label: "Fecha QA" }),
    }),
  );
  await userEvent.click(screen.getByRole("gridcell", { name: "15" }));
  expect(screen.getByRole("textbox", { name: "Fecha QA" })).toHaveValue(
    "2026-10-15",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("forwards incomplete and impossible dates unchanged and disables both input and picker", () => {
  const change = vi.fn();
  const { rerender } = render(
    <DateInput
      label="Fecha QA"
      value="2026-02-29"
      onChange={change}
      error
      helperText="Revisar"
    />,
  );
  const input = screen.getByRole("textbox", { name: "Fecha QA" });
  expect(input).toHaveValue("2026-02-29");
  fireEvent.change(input, { target: { value: "2026-0" } });
  expect(change).toHaveBeenCalledWith("2026-0");
  rerender(
    <DateInput label="Fecha QA" value="2026-0" onChange={change} disabled />,
  );
  expect(input).toBeDisabled();
  expect(screen.getByRole("button")).toBeDisabled();
});

it("keeps the picker open through year and month selection and closes after selecting the day", async () => {
  render(
    <MUIProvider>
      <Field
        label="Fecha por etapas"
        minDate="2025-01-01"
        maxDate="2028-12-31"
      />
    </MUIProvider>,
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: i18n.t("core:open_date_calendar", { label: "Fecha por etapas" }),
    }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: /cambie a la vista anual/ }),
  );
  await userEvent.click(
    screen.getByRole("radio", { name: "2027" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await userEvent.click(
    await screen.findByRole("radio", { name: "mayo" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await userEvent.click(
    await screen.findByRole("gridcell", { name: "20" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Fecha por etapas" })).toHaveValue(
    "2027-05-20",
  );
});
