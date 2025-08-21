import { performance_monitor } from './performance';

/**
 * Performance monitoring wrapper for React components
 */
export function withPerformanceMonitoring<T extends (...args: unknown[]) => unknown>(
  fn: T,
  name: string,
  threshold = 100
): T {
  return ((...args: Parameters<T>) => {
    const label = `${name}_${Date.now()}`;
    performance_monitor.start(label);
    
    try {
      const result = fn(...args);
      
      // Handle both sync and async functions
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          performance_monitor.end(label, threshold);
        });
      } else {
        performance_monitor.end(label, threshold);
        return result;
      }
    } catch {
      performance_monitor.end(label, threshold);
      throw new Error("Operation failed");
    }
  }) as T;
}

/**
 * Debounce function calls to prevent excessive execution
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  immediate = false
): T {
  let timeout: NodeJS.Timeout | null;
  
  return ((...args: Parameters<T>) => {
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func(...args);
    }, wait);
    
    if (callNow) func(...args);
  }) as T;
}

/**
 * Throttle function calls to limit execution frequency
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}

/**
 * Batch multiple operations together to reduce frequency
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private readonly processor: (items: T[]) => void;
  private readonly delay: number;

  constructor(processor: (items: T[]) => void, delay = 100) {
    this.processor = processor;
    this.delay = delay;
  }

  add(item: T) {
    this.queue.push(item);
    
    if (this.timeout) clearTimeout(this.timeout);
    
    this.timeout = setTimeout(() => {
      const items = [...this.queue];
      this.queue = [];
      this.timeout = null;
      this.processor(items);
    }, this.delay);
  }

  flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.queue.length > 0) {
      const items = [...this.queue];
      this.queue = [];
      this.processor(items);
    }
  }
}