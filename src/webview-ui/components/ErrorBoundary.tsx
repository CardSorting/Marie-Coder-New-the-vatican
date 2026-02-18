import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Standard React Error Boundary to catch rendering crashes in the Marie webview.
 * Prevents white-screen failures by providing user-facing diagnostic feedback.
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[Webview] Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.fallback) {
                return this.fallback;
            }

            return (
                <div className="fatal-error-container">
                    <div className="fatal-error-card">
                        <h2 className="fatal-error-title">Webview Component Crash</h2>
                        <p className="fatal-error-message">
                            {this.state.error?.message || "An unexpected rendering error occurred."}
                        </p>
                        <div className="fatal-error-suggestion">
                            Please reload the VS Code window to recover.
                        </div>
                        {this.state.error?.stack && (
                            <pre className="fatal-error-stack">
                                {this.state.error.stack}
                            </pre>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }

    private get fallback() {
        return this.props.fallback;
    }
}
