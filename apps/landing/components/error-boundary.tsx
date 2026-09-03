import ErrorPage from "@s3-viewer/ui/ErrorPage";
import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = { children: ReactNode };

type ErrorBoundaryState = { hasError: boolean };

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
   state: ErrorBoundaryState = { hasError: false };

   static getDerivedStateFromError(): ErrorBoundaryState {
      return { hasError: true };
   }

   render() {
      if (this.state.hasError) {
         return <ErrorPage code={500} href="/" linkLabel="Back to home" />;
      }

      return this.props.children;
   }
}

export default ErrorBoundary;
