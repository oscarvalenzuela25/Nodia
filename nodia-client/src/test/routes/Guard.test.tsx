import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Guard from "../../routes/Guard";
import useAuth from "../../hooks/useAuth";
import useAuthStore from "../../store/authStore";

function Page() {
  const { isDemo } = useAuth();
  return <p>{isDemo ? "Demo content" : "Account content"}</p>;
}

beforeEach(() => useAuthStore.getState().logout());
afterEach(() => useAuthStore.getState().logout());

describe("Guard", () => {
  it("allows a visitor to view a route in demo mode", () => {
    render(<Guard><Page /></Guard>);
    expect(screen.getByText("Demo content")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Modo demo");
  });

  it("switches to the account view after login and back to demo after logout", () => {
    render(<Guard><Page /></Guard>);
    act(() => useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000 }));
    expect(screen.getByText("Account content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    act(() => useAuthStore.getState().logout());
    expect(screen.getByText("Demo content")).toBeInTheDocument();
  });

  it("does not mistake session recovery for an anonymous demo session", () => {
    useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000 });
    useAuthStore.getState().setSessionStatus("restoring");
    render(<Guard><Page /></Guard>);
    expect(screen.queryByText("Demo content")).not.toBeInTheDocument();
    expect(screen.queryByText("Account content")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
