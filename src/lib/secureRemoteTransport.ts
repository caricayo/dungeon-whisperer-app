import { supabase } from '@/integrations/supabase/client';

export class SecureRemoteTransport {
  private buffer: Record<string, unknown>[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  async log(entry: Record<string, unknown>): Promise<void> {
    this.buffer.push(entry);
    
    // Auto-flush if buffer gets large or after delay
    if (this.buffer.length >= 10) {
      await this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 5000);
    }
  }

  async recordMetrics(metrics: Record<string, unknown>[]): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('secure-metrics', {
        body: { metrics }
      });

      if (error) {
        console.error('Failed to send metrics securely:', _error);
      }
    } catch {
      console.error('Metrics transport error:', _error);
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      const { error } = await supabase.functions.invoke('secure-logging', {
        body: { logs }
      });

      if (error) {
        console.error('Failed to send logs securely:', _error);
        // Put logs back for retry
        this.buffer.unshift(...logs);
      }
    } catch {
      console.error('Logging transport error:', _error);
      this.buffer.unshift(...logs);
    }
  }

  destroy(): void {
    this.flush(); // Final flush
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}