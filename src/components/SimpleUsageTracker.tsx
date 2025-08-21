import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { isFeatureEnabled } from '@/lib/features';

interface SimpleUsageData {
  service: string;
  count: number;
}

export const SimpleUsageTracker: React.FC = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<SimpleUsageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isFeatureEnabled('USAGE_TRACKING')) {
      setLoading(false);
      return;
    }

    const loadUsage = async () => {
      try {
        const { data, error } = await supabase
          .from('api_usage_logs')
          .select('service')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (error) throw error;

        // Simple aggregation
        const counts = data?.reduce((acc, item) => {
          acc[item.service] = (acc[item.service] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        setUsage(
          Object.entries(counts).map(([service, count]) => ({ service, count }))
        );
      } catch (error) {
        console.error('Usage tracking error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsage();
  }, [user]);

  if (!isFeatureEnabled('USAGE_TRACKING') || !user) {
    return null;
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4" />
          Loading usage data...
        </div>
      </Card>
    );
  }

  if (usage.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4" />
          No usage data yet
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="size-4" />
          Daily Usage
        </div>
        <div className="flex flex-wrap gap-2">
          {usage.map(({ service, count }) => (
            <Badge key={service} variant="outline" className="text-xs">
              {service}: {count}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
};