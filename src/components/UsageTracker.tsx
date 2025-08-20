import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Info,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { debugError } from '@/lib/debug';

interface UsageData {
  service: string;
  operation: string;
  count: number;
  totalCost: number;
  lastUsed: Date;
}

interface UsageTrackerProps {
  className?: string;
  onLimitWarning?: (service: string, usage: number) => void;
}

export const UsageTracker: React.FC<UsageTrackerProps> = ({ 
  className, 
  onLimitWarning 
}) => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estimated limits and costs (these would come from actual API billing in production)
  const serviceLimits = {
    openai: { daily: 50, cost: 0.002 },
    runway: { daily: 5, cost: 2.00 },
    luma: { daily: 10, cost: 1.50 },
  };

  const loadUsageData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_usage')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Aggregate usage by service
      const aggregated = data?.reduce((acc, item) => {
        const key = `${item.service}-${item.operation}`;
        if (!acc[key]) {
          acc[key] = {
            service: item.service,
            operation: item.operation,
            count: 0,
            totalCost: 0,
            lastUsed: new Date(item.created_at)
          };
        }
        acc[key].count += 1;
        acc[key].totalCost += parseFloat(item.cost_estimate?.toString() || '0');
        if (new Date(item.created_at) > acc[key].lastUsed) {
          acc[key].lastUsed = new Date(item.created_at);
        }
        return acc;
      }, {} as Record<string, UsageData>) || {};

      setUsage(Object.values(aggregated));

      // Check for limit warnings
      Object.values(aggregated).forEach(usage => {
        const serviceKey = usage.service as keyof typeof serviceLimits;
        const limit = serviceLimits[serviceKey];
        if (limit && usage.count > limit.daily * 0.8) {
          onLimitWarning?.(usage.service, usage.count / limit.daily);
        }
      });

    } catch (error) {
      debugError('Error loading usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadUsageData();
    }
  }, [isVisible, user]);

  const getTotalCost = () => {
    return usage.reduce((sum, item) => sum + item.totalCost, 0);
  };

  const getUsagePercentage = (service: string, count: number) => {
    const serviceKey = service as keyof typeof serviceLimits;
    const limit = serviceLimits[serviceKey];
    return limit ? Math.min((count / limit.daily) * 100, 100) : 0;
  };

  const getWarningLevel = (percentage: number) => {
    if (percentage >= 90) return 'destructive';
    if (percentage >= 80) return 'warning';
    return 'default';
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="size-5" />
          <h3 className="font-semibold">API Usage</h3>
          <Badge variant="outline" className="text-xs">
            Last 24h
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>

      {!isVisible && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Click the eye icon to view your API usage and costs. All usage is tracked transparently.
          </AlertDescription>
        </Alert>
      )}

      {isVisible && (
        <>
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Estimated Cost Today</span>
              <Badge variant="secondary">
                ${getTotalCost().toFixed(4)}
              </Badge>
            </div>
            
            <Alert>
              <Info className="size-4" />
              <AlertDescription className="text-xs">
                This app uses shared API credits. Usage is for transparency only - you're not being charged directly.
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-3">
            {usage.length === 0 && !isLoading && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No API usage in the last 24 hours
              </p>
            )}

            {usage.map((item) => {
              const percentage = getUsagePercentage(item.service, item.count);
              const warningLevel = getWarningLevel(percentage);
              
              return (
                <div key={`${item.service}-${item.operation}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {item.service} {item.operation}
                      </span>
                      {warningLevel !== 'default' && (
                        <AlertTriangle className="size-3 text-warning" />
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{item.count} calls</div>
                      <div className="text-xs text-muted-foreground">
                        ${item.totalCost.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Progress value={percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{percentage.toFixed(0)}% of daily estimate</span>
                      <span>
                        Last used: {item.lastUsed.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {warningLevel === 'destructive' && (
                    <Alert className="border-destructive">
                      <AlertTriangle className="size-4" />
                      <AlertDescription className="text-xs">
                        High usage detected. Service may be rate-limited soon.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={loadUsageData}
              disabled={isLoading}
              className="w-full"
            >
              <TrendingUp className="mr-2 size-4" />
              Refresh Usage Data
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};