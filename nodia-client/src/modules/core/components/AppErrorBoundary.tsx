import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";

type State = {
  hasError: boolean;
  errorMessage: string;
};

class AppErrorBoundary extends Component<PropsWithChildren & WithTranslation, State> {
  public state: State = {
    hasError: false,
    errorMessage: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Global app error:", error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: "2rem", textAlign: "center" }}>
          <h1>{this.props.t("core:generic_error_title")}</h1>
          <p>
            {this.state.errorMessage || this.props.t("core:generic_error_message")}
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            {this.props.t("core:reload_app")}
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

export default withTranslation()(AppErrorBoundary);
