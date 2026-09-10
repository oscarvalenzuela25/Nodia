import type { ComponentType, FC } from "react";
import { CircularProgress } from "@mui/material";
import { useAuthorizationContext } from "../../services/authorizationService";
import { FullScreenLoadingWrapper } from "./styles";
import type { WithAuthorizationContextOptions } from "./types";

export function withAuthorizationContext<P extends object>(
  WrappedComponent: ComponentType<P>,
  options?: WithAuthorizationContextOptions
): FC<P> {
  const WithAuthorizationContextComponent: FC<P> = (props: P) => {
    const { isLoading, isError } = useAuthorizationContext(options);

    if (isLoading && !isError) {
      return (
        <FullScreenLoadingWrapper data-testid="auth-context-loading">
          <CircularProgress size={60} sx={{ color: "primary.main" }} />
        </FullScreenLoadingWrapper>
      );
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthorizationContextComponent.displayName = `withAuthorizationContext(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return WithAuthorizationContextComponent;
}

export default withAuthorizationContext;
