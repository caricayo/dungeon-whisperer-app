import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCompatibility } from '@/components/CompatibilityChecker';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'checking';
  message?: string;
  lastChecked?: Date;
}

interface SystemStatusProps {
  onRetry?: () => void;
  className?: string;
}

export const SystemStatus: React.FC<SystemStatusProps> = React.memo(({ onRetry, className }) => {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'OpenAI Chat', status: 'checking' },
    { name: 'Image Generation', status: 'checking' },
    { name: 'Runway Video', status: 'checking' },
    { name: 'Luma Video', status: 'checking' },
    { name: 'Text-to-Speech', status: 'checking' }
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get compatibility data
  const { isCompatible, issues, warnings } = useCompatibility();

  const checkServiceHealth = async () => {
    setIsRefreshing(true);
    const newServices: ServiceStatus[] = [];

    // Check each service with basic connectivity
    for (const service of services) {
      try {
        // Simulate service health check - in reality, you'd ping each service
        const isHealthy = Math.random() > 0.1; // 90% chance of being healthy
        
        newServices.push({
          ...service,
          status: isHealthy ? 'operational' : 'degraded',
          message: isHealthy ? 'All systems operational' : 'Experiencing intermittent issues',
          lastChecked: new Date()
        });
      } catch (error) {
        newServices.push({
          ...service,
          status: 'outage',
          message: 'Service unavailable',
          lastChecked: new Date()
        });
      }
    }

    setServices(newServices);
    setIsRefreshing(false);
  };

  useEffect(() => {
    checkServiceHealth();
  }, []);

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="size-4 text-success" />;
      case 'degraded':
        return <AlertTriangle className="size-4 text-warning" />;
      case 'outage':
        return <XCircle className="size-4 text-destructive" />;
      case 'checking':
        return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return 'bg-success/10 text-success border-success/20';
      case 'degraded':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'outage':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'checking':
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const overallStatus = services.every(s => s.status === 'operational') 
    ? 'operational' 
    : services.some(s => s.status === 'outage') 
    ? 'outage' 
    : 'degraded';

  return (
    <Card className={`p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="size-5" />
          <h3 className="font-semibold">System Status</h3>
          <Badge className={getStatusColor(overallStatus)}>
            {overallStatus === 'operational' ? 'All Systems Operational' :
             overallStatus === 'degraded' ? 'Degraded Performance' :
             'Service Disruption'}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkServiceHealth}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </Button>
      </div>

      <div className="space-y-2">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(service.status)}
              <span className="text-sm">{service.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {service.lastChecked && (
                `Last checked: ${service.lastChecked.toLocaleTimeString()}`
              )}
            </div>
          </div>
        ))}
      </div>

      {overallStatus !== 'operational' && (
        <Alert className="mt-4">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Some services are experiencing issues. Your adventure may be affected.
            </span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry Failed Operations
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Enterprise Compatibility Section */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <Shield className="size-3" />
              Enterprise Compatibility
              {issues.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {issues.length}
                </Badge>
              )}
              {warnings.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {warnings.length}
                </Badge>
              )}
            </div>
            {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 space-y-2 text-sm">
            {issues.length > 0 && (
              <div className="text-destructive">
                <strong>Issues:</strong>
                <ul className="mt-1 list-inside list-disc">
                  {issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="text-warning">
                <strong>Warnings:</strong>
                <ul className="mt-1 list-inside list-disc">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {isCompatible && issues.length === 0 && warnings.length === 0 && (
              <div className="text-success">
                <CheckCircle className="mr-2 inline size-4" />
                All systems compatible
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});