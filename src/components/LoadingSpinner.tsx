import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dice6 } from 'lucide-react';

interface LoadingSpinnerProps {
  type?: 'page' | 'component' | 'minimal';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({ 
  type = 'page', 
  message = 'Loading...' 
}) => {
  if (type === 'minimal') {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin">
          <Dice6 className="size-6 text-primary" />
        </div>
      </div>
    );
  }

  if (type === 'component') {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <div className="mx-auto animate-spin">
          <Dice6 className="size-12 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
});

export default LoadingSpinner;