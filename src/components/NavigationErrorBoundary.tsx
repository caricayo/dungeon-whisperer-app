import React, { Component, ReactNode } from 'react';
import { debugError } from '@/lib/debug';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class NavigationErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    debugError('Navigation Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Auto-recovery for navigation errors
    setTimeout(() => {
      this.setState({ hasError: false, error: undefined });
    }, 3000);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold text-destructive">Navigation Error</h2>
            <p className="text-muted-foreground">Redirecting you back to safety...</p>
            <div className="mx-auto size-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}