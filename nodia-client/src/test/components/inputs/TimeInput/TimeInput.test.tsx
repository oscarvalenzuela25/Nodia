import { expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimeInput from "../../../../components/inputs/TimeInput";
import MUIProvider from "../../../../providers/MUIProvider";
it("keeps empty or partial booking hours explicit and offers a 24-hour clock", async () => {
  const change = vi.fn();
  render(<MUIProvider><TimeInput label="Hora QA" value="" onChange={change} /></MUIProvider>);
  expect(screen.getByRole("textbox", { name: "Hora QA" })).toHaveValue("");
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "1:" } });
  expect(change).toHaveBeenCalledWith("1:");
  await userEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
