import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CoreAssociationsEditor from "../../../../../modules/nodiaAi/components/ProposalPreview/CoreAssociationsEditor";

describe("Core final association collection", () => {
  it("adds a bigint ID exactly and preserves existing selection", async () => {
    const onChange = vi.fn();
    render(<CoreAssociationsEditor label="Roles" value={["1"]} options={[{ value: "1", label: "Manager · 1" }]} onChange={onChange} disabled={false} error={false} maximum="100" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Agregar ID a Roles" }), { target: { value: "9007199254740993" } });
    await userEvent.click(screen.getByRole("button", { name: "Agregar ID" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["1", "9007199254740993"]);
  });
  it.each(["1", "0", "01", "1e3", "9223372036854775808"])("rejects duplicate or invalid ID %s", id => {
    render(<CoreAssociationsEditor label="Roles" value={["1"]} options={[]} onChange={vi.fn()} disabled={false} error={false} maximum="100" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Agregar ID a Roles" }), { target: { value: id } });
    expect(screen.getByRole("button", { name: "Agregar ID" })).toBeDisabled();
  });
});
