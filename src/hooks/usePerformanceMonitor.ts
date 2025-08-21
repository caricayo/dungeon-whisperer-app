/**
 * @fileoverview Enterprise performance monitoring hook
 * @enterprise Real-time performance tracking with metrics collection
 */

import { useCallback, useRef, useEffect } from 'react';
import { Logger } from '@/lib/enterprise/Logger';
import { MetricsCollector } from '@/lib/enterprise/MetricsCollector';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Enterprise performance monitoring hook
 * @enterprise Tracks component performance with enterprise-grade monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const logger = Logger.getInstance('PerformanceMonitor');
  const metrics = MetricsCollector.getInstance();
  const entriesRef = useRef<Map<string, PerformanceEntry>>(new Map());
  const thresholdsRef = useRef({
    render: 16, // 16ms for 60fps
    interaction: 100, // 100ms for responsive interactions
    computation: 50 // 50ms for computations
  });

  // Start performance measurement
  const start = useCallback((operationName: string, metadata?: Record<string, unknown>) => {
    const entry: PerformanceEntry = {
      name: operationName,
      startTime: performance.now(),
      metadata
    };
    
    entriesRef.current.set(operationName, entry);
    
    logger.debug('Performance measurement started', {
      component: componentName,
      operation: operationName,
      metadata
    });
  }, [componentName, logger]);

  // End performance measurement
  const end = useCallback((operationName: string, additionalMetadata?: Record<string, unknown>) => {
    const entry = entriesRef.current.get(operationName);
    if (!entry) {
      logger.warn('Performance measurement not found', {
        component: componentName,
        operation: operationName
      });
      return;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;
    
    // Update entry
    entry.duration = duration;
    
    // Determine if this is a performance issue
    const threshold = getThreshold(operationName);
    const isSlowPerformance = duration > threshold;
    
    // Log performance data
    const logData = {
      component: componentName,
      operation: operationName,
      duration: Math.round(duration * 100) / 100,
      threshold,
      isSlowPerformance,
      ...entry.metadata,
      ...additionalMetadata
    };

    if (isSlowPerformance) {
      logger.warn('Slow performance detected', logData);
    } else {
      logger.debug('Performance measurement completed', logData);
    }

    // Record metrics
    metrics.timer(`performance.${componentName}.${operationName}`, duration, {
      component: componentName,
      operation: operationName,
      slow: isSlowPerformance.toString()
    });

    // Record performance issue if threshold exceeded
    if (isSlowPerformance) {
      metrics.counter('performance.issues', 1, {
        component: componentName,
        operation: operationName,
        severity: duration > threshold * 2 ? 'high' : 'medium'
      });
    }

    // Clean up
    entriesRef.current.delete(operationName);
    
    return { duration, isSlowPerformance };
  }, [componentName, logger, metrics]);

  // Monitor function execution time
  const monitor = useCallback(<T>(operationName: string, fn: () => T, metadata?: Record<string, unknown>): T => {
    start(operationName, metadata);
    
    try {
      const result = fn();
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          end(operationName);
        }) as T;
      }
      
      // Handle sync functions
      end(operationName);
      return result;
    } catch {
      end(operationName, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error("Operation failed");
    }
  }, [start, end]);

  // Monitor async function execution time
  const monitorAsync = useCallback(async <T>(
    operationName: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, unknown>
  ): Promise<T> => {
    start(operationName, metadata);
    
    try {
      const result = await fn();
      end(operationName);
      return result;
    } catch {
      end(operationName, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error("Operation failed");
    }
  }, [start, end]);

  // Get appropriate threshold for operation type
  const getThreshold = useCallback((operationName: string): number => {
    const name = operationName.toLowerCase();
    
    if (name.includes('render') || name.includes('paint')) {
      return thresholdsRef.current.render;
    }
    
    if (name.includes('click') || name.includes('interaction') || name.includes('input')) {
      return thresholdsRef.current.interaction;
    }
    
    return thresholdsRef.current.computation;
  }, []);

  // Update performance thresholds
  const setThresholds = useCallback((newThresholds: Partial<typeof thresholdsRef.current>) => {
    thresholdsRef.current = { ...thresholdsRef.current, ...newThresholds };
    
    logger.info('Performance thresholds updated', {
      component: componentName,
      thresholds: thresholdsRef.current
    });
  }, [componentName, logger]);

  // Component-specific render performance monitoring
  const renderStart = useCallback(() => start('render'), [start]);
  const renderEnd = useCallback(() => end('render'), [end]);

  // Memory usage monitoring
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
      if (memory) {
        const memoryData = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usagePercentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
        };

        logger.debug('Memory usage check', {
          component: componentName,
          ...memoryData
        });

        metrics.gauge('memory.usage_percentage', memoryData.usagePercentage, {
          component: componentName
        });

        // Alert if memory usage is high
        if (memoryData.usagePercentage > 80) {
          logger.warn('High memory usage detected', {
            component: componentName,
            ...memoryData
          });
        }

        return memoryData;
      }
    }

    return null;
  }, [componentName, logger, metrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // End any remaining measurements
      entriesRef.current.forEach((entry, operationName) => {
        logger.warn('Cleaning up unfinished performance measurement', {
          component: componentName,
          operation: operationName,
          duration: performance.now() - entry.startTime
        });
      });
      
      entriesRef.current.clear();
    };
  }, [componentName, logger]);

  return {
    start,
    end,
    monitor,
    monitorAsync,
    renderStart,
    renderEnd,
    setThresholds,
    checkMemoryUsage
  };
}