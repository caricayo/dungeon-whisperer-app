/**
 * @fileoverview Enterprise metrics collection and monitoring
 * @enterprise Production-ready metrics collection with multiple backends
 */

import { Logger } from './Logger';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface ChatMetrics {
  userId: string;
  sessionId: string;
  tokens: number;
  processingTime: number;
  model: string;
}

export interface MetricsBackend {
  send(metrics: Metric[]): Promise<void>;
}

/**
 * Console metrics backend for development
 */
class ConsoleMetricsBackend implements MetricsBackend {
  async send(metrics: Metric[]): Promise<void> {
    metrics.forEach(metric => {
      console.log(`📊 [METRIC] ${metric.name}: ${metric.value}`, metric.tags);
    });
  }
}

/**
 * Remote metrics backend for production (e.g., DataDog, Prometheus)
 */
class RemoteMetricsBackend implements MetricsBackend {
  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  async send(metrics: Metric[]): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ metrics })
      });
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }
}

/**
 * Enterprise metrics collector
 */
export class MetricsCollector {
  private static instance: MetricsCollector;
  private readonly logger = Logger.getInstance('MetricsCollector');
  private readonly backends: MetricsBackend[] = [];
  private metricsBuffer: Metric[] = [];
  private readonly flushInterval: NodeJS.Timeout;

  private constructor() {
    // Add console backend for development
    this.backends.push(new ConsoleMetricsBackend());

    // SECURITY: Remote metrics moved to server-side edge function
    // Client-side API keys are a security vulnerability
    // Production metrics should be sent via secure edge function

    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  static getInstance(): MetricsCollector {
    if (!this.instance) {
      this.instance = new MetricsCollector();
    }
    return this.instance;
  }

  /**
   * Record a counter metric
   */
  counter(name: string, value = 1, tags: Record<string, string> = {}): void {
    this.addMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'counter'
    });
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.addMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'gauge'
    });
  }

  /**
   * Record a timer metric
   */
  timer(name: string, durationMs: number, tags: Record<string, string> = {}): void {
    this.addMetric({
      name,
      value: durationMs,
      timestamp: new Date(),
      tags,
      type: 'timer'
    });
  }

  /**
   * Record chat-specific metrics
   */
  recordChatMessage(metrics: ChatMetrics): void {
    const tags = {
      userId: metrics.userId,
      sessionId: metrics.sessionId,
      model: metrics.model
    };

    this.counter('chat.messages.sent', 1, tags);
    this.gauge('chat.tokens.used', metrics.tokens, tags);
    this.timer('chat.processing_time', metrics.processingTime, tags);
  }

  /**
   * Record error metrics
   */
  recordError(error: { category: string; severity: string; operation: string }): void {
    this.counter('errors.total', 1, {
      category: error.category,
      severity: error.severity,
      operation: error.operation
    });
  }

  /**
   * Record performance metrics
   */
  recordPerformance(operation: string, durationMs: number, success: boolean): void {
    this.timer(`performance.${operation}`, durationMs, {
      success: success.toString()
    });
  }

  /**
   * Record user engagement metrics
   */
  recordUserEngagement(userId: string, action: string, metadata: Record<string, string> = {}): void {
    this.counter('user.engagement', 1, {
      userId,
      action,
      ...metadata
    });
  }

  /**
   * Add metric to buffer
   */
  private addMetric(metric: Metric): void {
    this.metricsBuffer.push(metric);

    // Auto-flush if buffer gets too large
    if (this.metricsBuffer.length >= 100) {
      this.flush();
    }
  }

  /**
   * Flush metrics to all backends
   */
  private async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await Promise.all(
        this.backends.map(backend => 
          backend.send(metricsToSend).catch(error => 
            this.logger.error('Failed to send metrics to backend', { error })
          )
        )
      );

      this.logger.debug(`Flushed ${metricsToSend.length} metrics`);
    } catch (error) {
      this.logger.error('Failed to flush metrics', { error });
      // Put metrics back in buffer for retry
      this.metricsBuffer.unshift(...metricsToSend);
    }
  }

  /**
   * Add custom metrics backend
   */
  addBackend(backend: MetricsBackend): void {
    this.backends.push(backend);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }
}

// Ensure cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    MetricsCollector.getInstance().destroy();
  });
}