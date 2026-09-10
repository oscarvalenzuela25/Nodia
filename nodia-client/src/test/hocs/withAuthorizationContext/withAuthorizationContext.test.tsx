import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import withAuthorizationContext from "../../../../src/hocs/withAuthorizationContext/withAuthorizationContext";
import * as authService from "../../../../src/services/authorizationService";

vi.mock("../../../../src/services/authorizationService", () => ({
  useAuthorizationContext: vi.fn(),
}));

const MockComponent = ({ message = "Hello World" }: { message?: string }) => {
  const location = useLocation();
  return (
    <div>
      <div data-testid="wrapped-component">{message}</div>
      <div data-testid="current-path">{location.pathname}</div>
    </div>
  );
};

describe("withAuthorizationContext HOC", () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with CircularProgress when isLoading is true", () => {
    vi.mocked(authService.useAuthorizationContext).mockReturnValue({
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof authService.useAuthorizationContext>);

    const Wrapped = withAuthorizationContext(MockComponent);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Wrapped />
      </MemoryRouter>
    );

    expect(screen.getByTestId("auth-context-loading")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByTestId("wrapped-component")).not.toBeInTheDocument();
  });

  it("renders wrapped component without blocking when isError is true", () => {
    vi.mocked(authService.useAuthorizationContext).mockReturnValue({
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof authService.useAuthorizationContext>);

    const Wrapped = withAuthorizationContext(MockComponent);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Wrapped message="Non-blocking layout content" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("auth-context-loading")).not.toBeInTheDocument();
    expect(screen.getByTestId("wrapped-component")).toBeInTheDocument();
    expect(screen.getByText("Non-blocking layout content")).toBeInTheDocument();
  });


  it("renders wrapped component when isLoading is false and isError is false", () => {
    vi.mocked(authService.useAuthorizationContext).mockReturnValue({
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof authService.useAuthorizationContext>);

    const Wrapped = withAuthorizationContext(MockComponent);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Wrapped message="Authorized content" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("auth-context-loading")).not.toBeInTheDocument();
    expect(screen.getByTestId("wrapped-component")).toBeInTheDocument();
    expect(screen.getByText("Authorized content")).toBeInTheDocument();
  });

  it("sets a readable displayName on the HOC wrapper", () => {
    const Wrapped = withAuthorizationContext(MockComponent);
    expect(Wrapped.displayName).toBe("withAuthorizationContext(MockComponent)");
  });
});
