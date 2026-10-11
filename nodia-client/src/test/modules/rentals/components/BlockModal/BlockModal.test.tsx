import { ui, property, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockModal from "../../../../../modules/rentals/components/BlockModal";
import i18n from "../../../../../translate";
import { blockSchema } from "../../../../../modules/rentals/infrastructure/schemas";
import { example } from "../../infrastructure/fixtures";

beforeEach(resetUI);
it("keeps edited inputs open when the write is rejected", async () => {
  const row = blockSchema.parse(
    example("/{propertyId}/blocks/{id}"),
  ) as ReturnType<typeof blockSchema.parse>;
  ui.execute.mockRejectedValueOnce(new Error("known rejection"));
  const close = vi.fn();
  render(
    <BlockModal property={property} open initialData={row} onClose={close} />,
  );
  const dateTimeInputs = (["starts_at", "ends_at"] as const).flatMap((name) => {
    const label = i18n.t(`rental:${name}`);
    const group = screen.getByRole("group", { name: label });
    expect(group).toBeInTheDocument();
    return ["core:date_time_date", "core:date_time_time"].map((key) => {
      const input = screen.getByRole("textbox", { name: i18n.t(key, { label }) });
      return { input, value: (input as HTMLInputElement).value };
    });
  });
  const input = screen.getByLabelText(i18n.t("rental:notes"));
  fireEvent.change(input, { target: { value: "Edited after initial data" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "block.update",
        data: expect.objectContaining({ notes: "Edited after initial data" }),
      }),
    ),
  );
  expect(close).not.toHaveBeenCalled();
  expect(input).toHaveValue("Edited after initial data");
  dateTimeInputs.forEach(({ input, value }) => expect(input).toHaveValue(value));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
