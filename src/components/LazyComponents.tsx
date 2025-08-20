import React, { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load heavy components for better performance
const PremiumHero = lazy(() => import('@/components/PremiumHero').then(m => ({ default: m.PremiumHero })));
const Dashboard = lazy(() => import('../pages/Dashboard'));

// Loading components
const PremiumHeroSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-background p-4">
    <Card className="w-full max-w-4xl">
      <CardContent className="space-y-6 p-8">
        <Skeleton className="mx-auto h-12 w-3/4" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="mx-auto h-6 w-2/3" />
        <div className="flex justify-center gap-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-12 w-32" />
        </div>
      </CardContent>
    </Card>
  </div>
);

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-background p-4">
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

interface LazyComponentsProps {
  showDashboard: boolean;
  onGetStarted: () => void;
  onLearnMore: () => void;
}

/**
 * Lazy-loaded components wrapper for performance optimization
 */
export function LazyComponents({ showDashboard, onGetStarted, onLearnMore }: LazyComponentsProps) {
  if (showDashboard) {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PremiumHeroSkeleton />}>
      <PremiumHero
        onGetStarted={onGetStarted}
        onLearnMore={onLearnMore}
      />
    </Suspense>
  );
}