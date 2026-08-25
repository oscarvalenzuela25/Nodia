import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";
import { Description, Page, ReloadButton, Title } from "./styles";

type State = {
  hasError: boolean;
};

class AppErrorBoundary extends Component<
  PropsWithChildren & WithTranslation,
  State
> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return {
      hasError: true,
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
        <Page>
          <Title>{this.props.t("core:generic_error_title")}</Title>
          <Description>
            {this.props.t("core:generic_error_message")}
          </Description>
          <ReloadButton
            type="button"
            variant="contained"
            onClick={() => window.location.reload()}
          >
            {this.props.t("core:reload_app")}
          </ReloadButton>
        </Page>
      );
    }

    return this.props.children;
  }
}

export default withTranslation()(AppErrorBoundary);
