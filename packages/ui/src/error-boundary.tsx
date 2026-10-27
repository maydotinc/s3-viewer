import { SITE_PATHS } from "@s3-viewer/shared/constants";
import ErrorPage from "@s3-viewer/ui/error-page";
import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
   children?: ReactNode;
   fallback?: ReactNode;
   resetKey?: string;
};
type ErrorBoundaryState = { failed: boolean };

const currentHref = () =>
   typeof window === "undefined" ? SITE_PATHS.dashboard : window.location.href;

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
   override state: ErrorBoundaryState = { failed: false };

   static getDerivedStateFromError(): ErrorBoundaryState {
      return { failed: true };
   }

   override componentDidUpdate(previous: ErrorBoundaryProps) {
      if (this.state.failed && previous.resetKey !== this.props.resetKey)
         this.setState({ failed: false });
   }

   override render() {
      if (!this.state.failed) return this.props.children;
      if (this.props.fallback !== undefined) return this.props.fallback;
      return <ErrorPage code={500} href={currentHref()} linkLabel="Reload" />;
   }
}

export default ErrorBoundary;
