import { useState } from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DateTimeInput from "../../../../components/inputs/DateTimeInput";
import i18n from "../../../../translate";
function Field({ changed }: { changed: (value: string) => void }) { const [value, setValue] = useState("2026-10-04T18:00:00Z"); return <DateTimeInput label="Plazo QA" value={value} timezone="America/Santiago" onChange={(next) => { setValue(next); changed(next); }} />; }
it("edits in the explicit resource timezone and preserves ambiguous DST drafts for validation", () => {
  const changed = vi.fn();
  render(<Field changed={changed} />);
  const date = screen.getByRole("textbox", { name: i18n.t("core:date_time_date", { label: "Plazo QA" }) });
  const time = screen.getByRole("textbox", { name: i18n.t("core:date_time_time", { label: "Plazo QA" }) });
  expect(date).toHaveValue("2026-10-04"); expect(time).toHaveValue("15:00");
  fireEvent.change(time, { target: { value: "16:00" } });
  expect(changed).toHaveBeenLastCalledWith("2026-10-04T19:00:00.000Z");
  fireEvent.change(date, { target: { value: "2026-04-04" } });
  fireEvent.change(time, { target: { value: "23:30" } });
  expect(changed).toHaveBeenLastCalledWith("2026-04-04T23:30");
  expect(time).toHaveValue("23:30");
});
