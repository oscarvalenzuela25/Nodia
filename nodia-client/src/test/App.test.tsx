import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import router from "../routes";
import envs from "../config/.envs";
import useAuthStore from "../store/authStore";
import { queryClient } from "../config/reactQuery";

vi.mock("../routes", async () => {
  const { createMemoryRouter, Link } = await import("react-router");
  const { createElement, Fragment } = await import("react");
  const { default: Login } = await import("../modules/auth/pages/Login");
  return { default: createMemoryRouter([
    { path: "/", element: createElement(Fragment, null,
      createElement("h1", null, "Home fixture"),
      createElement(Link, { to: "/login" }, "Open Login")) },
    { path: "/login", element: createElement(Login) },
  ]) };
});

const originalClientId = envs.GOOGLE_CLIENT_ID;
const googleScripts = () => document.querySelectorAll('script[src^="https://accounts.google.com/gsi/client"]');

beforeEach(async () => {
  envs.GOOGLE_CLIENT_ID = "test-client-id";
  useAuthStore.getState().logout();
  queryClient.clear();
  await act(async () => { await router.navigate("/"); });
});
afterEach(() => {
  envs.GOOGLE_CLIENT_ID = originalClientId;
  queryClient.clear();
});

describe("App Google SDK boundary", () => {
  it("keeps Home free of GIS and loads exactly one script only after navigating to Login", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Home fixture" });
    expect(googleScripts()).toHaveLength(0);
    await userEvent.click(screen.getByRole("link", { name: "Open Login" }));
    await screen.findByRole("button", { name: /volver al inicio/i });
    expect(googleScripts()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /volver al inicio/i }));
    await screen.findByRole("heading", { name: "Home fixture" });
    expect(googleScripts()).toHaveLength(0);
    await userEvent.click(screen.getByRole("link", { name: "Open Login" }));
    expect(googleScripts()).toHaveLength(1);
  });
});
