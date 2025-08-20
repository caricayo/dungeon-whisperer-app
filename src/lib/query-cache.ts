/**
 * Query result caching system for Supabase queries
 * Implements memory-based caching with TTL and size limits
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  hits: number;
  size: number; // Approximate size in bytes
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
}

class QueryCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private currentSize = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 2 * 60 * 1000, // 2 minutes
      ...config
    };

    this.startCleanup();
  }

  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup() {
    const now = Date.now();
    const entriesToRemove: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        entriesToRemove.push(key);
      }
    }

    // Remove expired entries
    for (const key of entriesToRemove) {
      this.delete(key);
    }

    // If still over limits, remove least recently used entries
    if (this.cache.size > this.config.maxEntries || this.currentSize > this.config.maxSize) {
      this.evictLRU();
    }
  }

  private evictLRU() {
    // Sort by hits (ascending) and timestamp (ascending) - least used first
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        if (a.hits !== b.hits) return a.hits - b.hits;
        return a.timestamp - b.timestamp;
      });

    // Remove entries until we're under limits
    for (const [key] of sortedEntries) {
      if (this.cache.size <= this.config.maxEntries && 
          this.currentSize <= this.config.maxSize) {
        break;
      }
      this.delete(key);
    }
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimation (UTF-16)
    } catch {
      return 1000; // Fallback size estimate
    }
  }

  private generateKey(table: string, query: any, params?: any): string {
    const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${table}:${btoa(queryStr + paramsStr).slice(0, 32)}`;
  }

  set<T>(table: string, query: any, data: T, params?: any, ttl?: number): void {
    const key = this.generateKey(table, query, params);
    const size = this.estimateSize(data);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      hits: 0,
      size
    };

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSize -= existing.size;
    }

    this.cache.set(key, entry);
    this.currentSize += size;

    // Trigger cleanup if over limits
    if (this.cache.size > this.config.maxEntries || this.currentSize > this.config.maxSize) {
      this.evictLRU();
    }
  }

  get<T>(table: string, query: any, params?: any): T | null {
    const key = this.generateKey(table, query, params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    // Update hit count and timestamp for LRU
    entry.hits++;
    entry.timestamp = now;

    return entry.data as T;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  invalidate(pattern: string): number {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      if (this.delete(key)) count++;
    }

    return count;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      size: this.currentSize,
      maxEntries: this.config.maxEntries,
      maxSize: this.config.maxSize,
      hitRate: this.calculateHitRate()
    };
  }

  private calculateHitRate(): number {
    let totalHits = 0;
    let totalEntries = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalEntries++;
    }

    return totalEntries > 0 ? totalHits / totalEntries : 0;
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Global cache instance
const queryCache = new QueryCache();

// Cache-enabled query wrapper
export async function cachedQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  cacheKey: {
    table: string;
    query: any;
    params?: any;
  },
  options: {
    ttl?: number;
    skipCache?: boolean;
    invalidateOnError?: boolean;
  } = {}
): Promise<{ data: T | null; error: any; fromCache?: boolean }> {
  const { table, query, params } = cacheKey;
  const { ttl, skipCache = false, invalidateOnError = true } = options;

  // Check cache first unless explicitly skipped
  if (!skipCache) {
    const cached = queryCache.get<{ data: T | null; error: any }>(table, query, params);
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  try {
    // Execute query
    const result = await queryFn();

    // Cache successful results
    if (!result.error) {
      queryCache.set(table, query, result, params, ttl);
    } else if (invalidateOnError) {
      // Invalidate related cache entries on error
      queryCache.invalidate(table);
    }

    return result;
  } catch (error) {
    if (invalidateOnError) {
      queryCache.invalidate(table);
    }
    return { data: null, error };
  }
}

// Cache invalidation helpers
export function invalidateTableCache(table: string): number {
  return queryCache.invalidate(table);
}

export function invalidateCache(pattern: string): number {
  return queryCache.invalidate(pattern);
}

export function clearAllCache(): void {
  queryCache.clear();
}

export function getCacheStats() {
  return queryCache.getStats();
}

// Specific cache TTL presets
export const CacheTTL = {
  SHORT: 30 * 1000,      // 30 seconds
  MEDIUM: 5 * 60 * 1000,  // 5 minutes  
  LONG: 30 * 60 * 1000,   // 30 minutes
  HOUR: 60 * 60 * 1000,   // 1 hour
  DAY: 24 * 60 * 60 * 1000 // 24 hours
} as const;

// Auto-invalidation for write operations
export function invalidateOnWrite(tables: string[]) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      // Invalidate cache for affected tables after successful writes
      if (result && !result.error) {
        tables.forEach(table => invalidateTableCache(table));
      }
      
      return result;
    };
    
    return descriptor;
  };
}

export default queryCache;