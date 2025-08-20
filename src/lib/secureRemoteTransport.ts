import { supabase } from '@/integrations/supabase/client';

export class SecureRemoteTransport {
  private buffer: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  async log(entry: any): Promise<void> {
    this.buffer.push(entry);
    
    // Auto-flush if buffer gets large or after delay
    if (this.buffer.length >= 10) {
      await this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 5000);
    }
  }

  async recordMetrics(metrics: any[]): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('secure-metrics', {
        body: { metrics }
      });

      if (error) {
        console.error('Failed to send metrics securely:', error);
      }
    } catch (error) {
      console.error('Metrics transport error:', error);
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
        console.error('Failed to send logs securely:', error);
        // Put logs back for retry
        this.buffer.unshift(...logs);
      }
    } catch (error) {
      console.error('Logging transport error:', error);
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