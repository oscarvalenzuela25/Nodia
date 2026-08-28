import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TextInput from "../../../../../src/components/inputs/TextInput";

describe("TextInput", () => {
  it("renders label, placeholder, value and handles input", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TextInput
        label="Email"
        required
        value=""
        onChange={handleChange}
        placeholder="user@example.com"
      />
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("user@example.com");
    await user.type(input, "a");

    expect(handleChange).toHaveBeenCalled();
  });
});
