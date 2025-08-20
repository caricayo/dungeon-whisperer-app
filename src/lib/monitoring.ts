/**
 * Comprehensive monitoring and alerting system
 * Tracks application health, performance metrics, and user engagement
 */

interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  unit?: 'count' | 'ms' | 'bytes' | 'percent' | 'rate';
}

interface AlertRule {
  name: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  metricName: string;
  enabled: boolean;
  cooldownMs: number;
  lastAlerted?: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  components: {
    database: 'up' | 'down' | 'slow';
    realtime: 'up' | 'down' | 'degraded';
    auth: 'up' | 'down' | 'slow';
    edge_functions: 'up' | 'down' | 'errors';
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    activeUsers: number;
    cacheHitRate: number;
  };
  lastCheck: number;
}

class ApplicationMonitoring {
  private readonly metrics = new Map<string, MetricData[]>();
  private alerts: AlertRule[] = [];
  private healthStatus: SystemHealth = {
    status: 'healthy',
    components: {
      database: 'up',
      realtime: 'up',
      auth: 'up',
      edge_functions: 'up'
    },
    metrics: {
      responseTime: 0,
      errorRate: 0,
      activeUsers: 0,
      cacheHitRate: 0
    },
    lastCheck: Date.now()
  };
  
  private readonly MAX_METRICS_PER_KEY = 100;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private healthCheckTimer?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultAlerts();
    this.startHealthChecks();
  }

  private initializeDefaultAlerts() {
    this.alerts = [
      {
        name: 'High Error Rate',
        condition: 'greater_than',
        threshold: 0.05, // 5% error rate
        metricName: 'error_rate',
        enabled: true,
        cooldownMs: 5 * 60 * 1000 // 5 minutes
      },
      {
        name: 'Slow Response Time',
        condition: 'greater_than',
        threshold: 2000, // 2 seconds
        metricName: 'response_time_avg',
        enabled: true,
        cooldownMs: 2 * 60 * 1000 // 2 minutes
      },
      {
        name: 'Low Cache Hit Rate',
        condition: 'less_than',
        threshold: 0.7, // 70% hit rate
        metricName: 'cache_hit_rate',
        enabled: true,
        cooldownMs: 10 * 60 * 1000 // 10 minutes
      },
      {
        name: 'High Memory Usage',
        condition: 'greater_than',
        threshold: 0.85, // 85% memory usage
        metricName: 'memory_usage_percent',
        enabled: true,
        cooldownMs: 5 * 60 * 1000
      }
    ];
  }

  private startHealthChecks() {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  // Record a metric
  recordMetric(metric: MetricData) {
    const key = metric.name;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metricArray = this.metrics.get(key)!;
    metricArray.push(metric);
    
    // Keep only the most recent metrics
    if (metricArray.length > this.MAX_METRICS_PER_KEY) {
      metricArray.shift();
    }
    
    // Check alert conditions
    this.checkAlerts(metric);
  }

  // Convenience methods for common metrics
  recordResponseTime(endpoint: string, durationMs: number) {
    this.recordMetric({
      name: 'response_time',
      value: durationMs,
      timestamp: Date.now(),
      tags: { endpoint },
      unit: 'ms'
    });
  }

  recordError(source: string, errorType: string) {
    this.recordMetric({
      name: 'error_count',
      value: 1,
      timestamp: Date.now(),
      tags: { source, errorType },
      unit: 'count'
    });
  }

  recordUserAction(action: string, userId?: string) {
    this.recordMetric({
      name: 'user_action',
      value: 1,
      timestamp: Date.now(),
      tags: { action, userId: userId || 'anonymous' },
      unit: 'count'
    });
  }

  recordDatabaseQuery(table: string, operation: string, durationMs: number) {
    this.recordMetric({
      name: 'db_query_time',
      value: durationMs,
      timestamp: Date.now(),
      tags: { table, operation },
      unit: 'ms'
    });
  }

  recordCacheActivity(operation: 'hit' | 'miss' | 'set' | 'invalidate', key?: string) {
    this.recordMetric({
      name: 'cache_activity',
      value: 1,
      timestamp: Date.now(),
      tags: { operation, key: key || 'unknown' },
      unit: 'count'
    });
  }

  // Get metric statistics
  getMetricStats(metricName: string, timeRangeMs: number = 5 * 60 * 1000) {
    const metrics = this.metrics.get(metricName) || [];
    const cutoff = Date.now() - timeRangeMs;
    const recentMetrics = metrics.filter(m => m.timestamp > cutoff);
    
    if (recentMetrics.length === 0) {
      return null;
    }
    
    const values = recentMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: recentMetrics.length,
      sum,
      average: sum / recentMetrics.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: recentMetrics[recentMetrics.length - 1].value
    };
  }

  // Health check implementation
  private async performHealthCheck() {
    const startTime = Date.now();
    const newHealth: SystemHealth = {
      ...this.healthStatus,
      lastCheck: startTime
    };

    try {
      // Check database connectivity
      const dbStartTime = Date.now();
      // This would be replaced with actual database connectivity check
      await this.checkDatabaseHealth();
      const dbResponseTime = Date.now() - dbStartTime;
      
      newHealth.components.database = dbResponseTime > 1000 ? 'slow' : 'up';
      
      // Calculate metrics
      const responseTimeStats = this.getMetricStats('response_time');
      const errorStats = this.getMetricStats('error_count');
      const totalRequests = this.getMetricStats('user_action');
      
      newHealth.metrics.responseTime = responseTimeStats?.average || 0;
      
      if (errorStats && totalRequests) {
        newHealth.metrics.errorRate = errorStats.sum / Math.max(totalRequests.sum, 1);
      }
      
      // Determine overall health status
      const hasSlowComponents = Object.values(newHealth.components).some(
        status => status === 'slow' || status === 'degraded'
      );
      const hasDownComponents = Object.values(newHealth.components).some(
        status => status === 'down' || status === 'errors'
      );
      
      if (hasDownComponents) {
        newHealth.status = 'down';
      } else if (hasSlowComponents || newHealth.metrics.errorRate > 0.1) {
        newHealth.status = 'degraded';
      } else {
        newHealth.status = 'healthy';
      }
      
    } catch (error) {
      console.error('Health check failed:', error);
      newHealth.status = 'down';
      newHealth.components.database = 'down';
    }
    
    this.healthStatus = newHealth;
    
    // Record health check metrics
    this.recordMetric({
      name: 'health_check_duration',
      value: Date.now() - startTime,
      timestamp: startTime,
      unit: 'ms'
    });
  }

  private async checkDatabaseHealth(): Promise<void> {
    // This would implement actual database health checking
    // For now, we'll simulate it
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.95) { // 5% chance of simulated failure
          reject(new Error('Database connection failed'));
        } else {
          resolve();
        }
      }, Math.random() * 100); // Random response time
    });
  }

  // Alert management
  private checkAlerts(metric: MetricData) {
    const relevantAlerts = this.alerts.filter(
      alert => alert.enabled && alert.metricName === metric.name
    );
    
    for (const alert of relevantAlerts) {
      if (this.shouldSkipAlert(alert)) continue;
      
      const shouldAlert = this.evaluateAlertCondition(alert, metric.value);
      
      if (shouldAlert) {
        this.triggerAlert(alert, metric);
      }
    }
  }

  private shouldSkipAlert(alert: AlertRule): boolean {
    if (!alert.lastAlerted) return false;
    return Date.now() - alert.lastAlerted < alert.cooldownMs;
  }

  private evaluateAlertCondition(alert: AlertRule, value: number): boolean {
    switch (alert.condition) {
      case 'greater_than':
        return value > alert.threshold;
      case 'less_than':
        return value < alert.threshold;
      case 'equals':
        return value === alert.threshold;
      case 'not_equals':
        return value !== alert.threshold;
      default:
        return false;
    }
  }

  private triggerAlert(alert: AlertRule, metric: MetricData) {
    alert.lastAlerted = Date.now();
    
    console.warn(`🚨 ALERT: ${alert.name}`, {
      metric: metric.name,
      value: metric.value,
      threshold: alert.threshold,
      condition: alert.condition,
      tags: metric.tags,
      timestamp: new Date(metric.timestamp).toISOString()
    });
    
    // In production, you would send this to your alerting system
    // this.sendToAlertingSystem(alert, metric);
  }

  // Public API
  getHealthStatus(): SystemHealth {
    return { ...this.healthStatus };
  }

  getMetrics(metricName?: string) {
    if (metricName) {
      return this.metrics.get(metricName) || [];
    }
    return Object.fromEntries(this.metrics.entries());
  }

  addAlert(alert: AlertRule) {
    this.alerts.push(alert);
  }

  removeAlert(alertName: string) {
    this.alerts = this.alerts.filter(alert => alert.name !== alertName);
  }

  destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    this.metrics.clear();
    this.alerts = [];
  }
}

// Global monitoring instance
const monitoring = new ApplicationMonitoring();

// Performance monitoring decorator
export function monitorPerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args: any[]) {
    const startTime = Date.now();
    const methodName = `${target.constructor.name}.${propertyKey}`;
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - startTime;
      
      monitoring.recordResponseTime(methodName, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      monitoring.recordError(methodName, error.name || 'UnknownError');
      monitoring.recordResponseTime(methodName, duration);
      
      throw error;
    }
  };
  
  return descriptor;
}

// User activity tracking hook
export function useActivityTracking() {
  const trackAction = (action: string, metadata?: Record<string, any>) => {
    monitoring.recordUserAction(action);
    
    if (metadata) {
      monitoring.recordMetric({
        name: 'user_activity_detail',
        value: 1,
        timestamp: Date.now(),
        tags: { action, ...metadata },
        unit: 'count'
      });
    }
  };
  
  return { trackAction };
}

export {
  monitoring,
  type MetricData,
  type AlertRule,
  type SystemHealth
};