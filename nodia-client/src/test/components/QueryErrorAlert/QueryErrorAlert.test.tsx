import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import QueryErrorAlert from "../../../components/QueryErrorAlert";

describe("QueryErrorAlert", () => {
  it("allows retry without removing existing content", async () => {
    const retry = vi.fn();
    const { rerender } = render(<><p>Existing data</p><QueryErrorAlert isError isFetching={false} onRetry={retry} /></>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /reintentar|retry/i }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<><p>Existing data</p><QueryErrorAlert isError isFetching onRetry={retry} /></>);
    expect(screen.getByText("Existing data")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
