import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/ui/shadcn/button";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Uncaught runtime error tracking
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground">
                    <div className="flex max-w-lg flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 p-8 text-center shadow-lg">
                        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
                        <h1 className="mb-2 text-2xl font-bold tracking-tight">Something went wrong</h1>
                        <p className="mb-6 text-sm text-muted-foreground">
                            An unexpected error occurred in the application. The error has been logged automatically.
                        </p>
                        {this.state.error && (
                            <div className="mb-6 max-h-32 w-full overflow-auto rounded bg-card p-3 text-left text-xs text-muted-foreground shadow-inner">
                                <code>{this.state.error.message}</code>
                            </div>
                        )}
                        <div className="flex gap-4">
                            <Button onClick={() => window.location.reload()}>
                                Reload Page
                            </Button>
                            <Button variant="outline" onClick={() => window.location.href = "/"}>
                                Return Home
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
