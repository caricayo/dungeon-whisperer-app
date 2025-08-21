import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { debugError } from '@/lib/debug';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

export class AuthErrorBoundary extends Component<Props, State> {
  private readonly maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debugError('🚨 Auth Error Boundary caught error:', { error, errorInfo });
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // Max retries reached, reload page
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Authentication Error</AlertTitle>
              <AlertDescription className="mb-4 mt-2">
                {this.state.error?.message ?? 'An unexpected authentication error occurred.'}
                {this.state.retryCount > 0 && (
                  <span className="mt-2 block text-sm">
                    Retry attempts: {this.state.retryCount}/{this.maxRetries}
                  </span>
                )}
              </AlertDescription>
              <Button 
                onClick={this.handleRetry}
                className="w-full"
                disabled={this.state.retryCount >= this.maxRetries}
              >
                <RefreshCw className="mr-2 size-4" />
                {this.state.retryCount >= this.maxRetries ? 'Reload Page' : 'Try Again'}
              </Button>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}