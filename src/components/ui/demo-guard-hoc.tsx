import React from 'react';
import { DemoGuard } from './demo-guard';

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
