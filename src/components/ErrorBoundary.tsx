import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { debugError } from '@/lib/debug';
import { env } from '@/lib/env';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId: string;
}

/**
 * Enhanced Error Boundary with structured logging and user-friendly fallback
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced structured error logging
    const errorLog = {
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: env.VITE_APP_ENV === 'development' ? error.stack : '[Redacted]',
      },
      errorInfo: {
        componentStack: env.VITE_APP_ENV === 'development' ? errorInfo.componentStack : '[Redacted]',
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
    };

    // Use existing debug logger and enhanced logging
    debugError('React Error Boundary caught an error:', errorLog);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private getUserId(): string | null {
    try {
      return localStorage.getItem('user-id') || null;
    } catch {
      return null;
    }
  }

  private readonly handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorId: '' });
  };

  private readonly handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <CardTitle className="text-foreground">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                We encountered an unexpected error. This has been logged and our team will investigate.
              </p>
              
              {env.VITE_APP_ENV === 'development' && this.state.error && (
                <div className="break-all rounded bg-muted p-3 font-mono text-xs text-muted-foreground">
                  <strong>Error:</strong> {this.state.error.message}
                </div>
              )}
              
              <div className="text-center text-xs text-muted-foreground">
                Error ID: {this.state.errorId}
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={this.handleRetry} 
                  variant="outline" 
                  className="flex-1"
                  size="sm"
                >
                  <RefreshCw className="mr-2 size-4" />
                  Try Again
                </Button>
                <Button 
                  onClick={this.handleReload} 
                  className="flex-1"
                  size="sm"
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}