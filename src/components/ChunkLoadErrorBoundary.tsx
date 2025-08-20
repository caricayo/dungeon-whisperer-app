import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

/**
 * Specialized error boundary for chunk loading errors (lazy loading failures)
 * This commonly happens when users have cached old JS chunks after deployment
 */
export class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a chunk loading error
    const isChunkError = error.message.includes('Loading chunk') || 
                        error.message.includes('ChunkLoadError') ||
                        error.stack?.includes('chunk');
    
    return { 
      hasError: true,
      isChunkError
    };
  }

  componentDidCatch(error: Error) {
    import('@/lib/logger').then(({ logger }) => {
      logger.error('Chunk loading error', { error: error.message, stack: error.stack });
    });
  }

  private readonly handleReload = () => {
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.isChunkError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                <Wifi className="size-6 text-orange-600 dark:text-orange-500" />
              </div>
              <CardTitle>Update Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                A new version is available. Please refresh to get the latest updates.
              </p>
              
              <Button 
                onClick={this.handleReload} 
                className="w-full"
                size="sm"
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh Now
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Let other error boundaries handle non-chunk errors
    return this.props.children;
  }
}