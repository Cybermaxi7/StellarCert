import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  message: string;
}

class ErrorBoundaryImpl extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep local logging as a fallback and support external monitoring.
    console.error("ErrorBoundary caught:", error, info.componentStack);

    try {
      this.props.onError?.(error, info);
    } catch (loggingError) {
      // A monitoring callback must not disrupt the fallback UI.
      console.error("ErrorBoundary onError callback failed:", loggingError);
    }
  }

  private reset = (): void => {
    this.setState(
      {
        hasError: false,
        message: "",
      },
      () => {
        this.props.onReset?.();
      },
    );
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Explicitly allow null as a custom fallback.
    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-8 text-center"
        role="alert"
      >
        <h2 className="mb-2 text-2xl font-semibold text-red-600">
          Something went wrong
        </h2>

        <p className="mb-4 text-gray-500">{this.state.message}</p>

        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={this.reset}
        >
          Try again
        </button>
      </div>
    );
  }
}

/**
 * Resets the boundary when the pathname changes.
 * Deriving the key directly from the location avoids the extra
 * mount caused by incrementing state inside an effect.
 */
export function ErrorBoundary({ children, fallback, onReset, onError }: Props) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundaryImpl
      key={pathname}
      fallback={fallback}
      onReset={onReset}
      onError={onError}
    >
      {children}
    </ErrorBoundaryImpl>
  );
}

export default ErrorBoundary;
