import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Sparkles } from 'lucide-react';
import { guardDemoMode } from '@/lib/demo-mode';

interface DemoGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  feature?: string;
  showFallback?: boolean;
}

/**
 * Component wrapper that conditionally renders content based on demo mode
 */
export function DemoGuard({ 
  children, 
  fallback, 
  feature = 'This feature',
  showFallback = true 
}: DemoGuardProps) {
  const isBlocked = guardDemoMode(feature, false);
  
  if (!isBlocked) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showFallback) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardContent className="p-6 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="size-6 text-primary" />
        </div>
        <h3 className="mb-2 font-heading text-lg text-foreground">
          {feature} Requires Upgrade
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          This premium feature is disabled in demo mode. Upgrade to unlock all AI-powered capabilities.
        </p>
        <Button className="bg-primary text-primary-foreground hover:bg-primary-dark">
          <Sparkles className="mr-2 size-4" />
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Higher-order component for demo mode protection
 */
export function withDemoGuard<P extends object>(
  Component: React.ComponentType<P>,
  feature?: string
) {
  return function DemoGuardedComponent(props: P) {
    return (
      <DemoGuard feature={feature}>
        <Component {...props} />
      </DemoGuard>
    );
  };
}