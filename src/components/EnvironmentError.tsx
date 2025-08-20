import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EnvironmentErrorProps {
  error: Error;
  onRetry?: () => void;
}

export const EnvironmentError: React.FC<EnvironmentErrorProps> = ({ error, onRetry }) => {
  const isSupabaseError = error.message.includes('Supabase');
  const isNetworkError = error.message.includes('network') || error.message.includes('Network');

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Configuration Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              {isSupabaseError 
                ? "Database connection configuration is missing or invalid."
                : isNetworkError
                ? "Network connection issue detected."
                : "Application configuration error detected."
              }
            </AlertDescription>
          </Alert>

          {isSupabaseError && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Common solutions:</strong></p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Copy <code>.env.example</code> to <code>.env.local</code></li>
                <li>Add your Supabase project URL and API key</li>
                <li>Restart the development server</li>
                <li>Contact support if deployed</li>
              </ul>
            </div>
          )}

          <div className="rounded bg-muted p-3 text-xs font-mono">
            {error.message}
          </div>

          {onRetry && (
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="mr-2 size-4" />
              Retry Connection
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};