import { SITE_PATHS } from "@s3-viewer/types";
import ErrorPage from "@s3-viewer/ui/ErrorPage";
import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { failed: boolean };

const currentHref = () =>
   typeof window === "undefined" ? SITE_PATHS.dashboard : window.location.href;

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
   state: ErrorBoundaryState = { failed: false };

   static getDerivedStateFromError(): ErrorBoundaryState {
      return { failed: true };
   }

   render() {
      if (!this.state.failed) return this.props.children;
      return <ErrorPage code={500} href={currentHref()} linkLabel="Reload" />;
   }
}

export default ErrorBoundary;
