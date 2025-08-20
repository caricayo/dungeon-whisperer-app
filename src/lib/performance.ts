import { env } from './env';

/**
 * Performance monitoring utilities
 */
class PerformanceMonitor {
  private readonly measurements = new Map<string, number>();
  private readonly enabled: boolean = env.VITE_PERFORMANCE_MONITORING;

  /**
   * Start measuring an operation
   */
  start(label: string): void {
    if (!this.enabled) return;
    this.measurements.set(label, performance.now());
  }

  /**
   * End measuring and log the duration
   */
  end(label: string, threshold = 1000): number | null {
    if (!this.enabled) return null;
    
    const startTime = this.measurements.get(label);
    if (!startTime) {
      console.warn(`Performance measurement for "${label}" was not started`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(label);

    // Only log if above threshold or in development
    if (duration > threshold || env.VITE_APP_ENV === 'development') {
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    label: string,
    operation: () => Promise<T>,
    threshold?: number
  ): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    this.start(label);
    try {
      const result = await operation();
      this.end(label, threshold);
      return result;
    } catch (error) {
      this.end(label, threshold);
      throw error;
    }
  }

  /**
   * Log current performance metrics
   */
  getMetrics() {
    if (!this.enabled || typeof performance === 'undefined') return null;

    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        navigation: {
          domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
          loadComplete: Math.round(navigation.loadEventEnd - navigation.fetchStart),
          firstByte: Math.round(navigation.responseStart - navigation.fetchStart),
        },
        paint: {
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
          largestContentfulPaint: paint.find(p => p.name === 'largest-contentful-paint')?.startTime,
        },
        memory: (performance as any).memory ? {
          used: Math.round((performance as any).memory.usedJSHeapSize / 1048576),
          total: Math.round((performance as any).memory.totalJSHeapSize / 1048576),
          limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1048576),
        } : null,
      };
    } catch (error) {
      console.warn('Failed to collect performance metrics:', error);
      return null;
    }
  }
}

export const performance_monitor = new PerformanceMonitor();

/**
 * Performance decorator for measuring function execution time
 */
export function measurePerformance(label?: string, threshold?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const measureLabel = label || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = async function (...args: any[]) {
      return performance_monitor.measure(
        measureLabel,
        () => originalMethod.apply(this, args),
        threshold
      );
    };
    
    return descriptor;
  };
}

/**
 * Report performance metrics to console in development
 */
export function logPerformanceMetrics() {
  if (env.VITE_APP_ENV === 'development') {
    const metrics = performance_monitor.getMetrics();
    if (metrics) {
      console.table(metrics);
    }
  }
}