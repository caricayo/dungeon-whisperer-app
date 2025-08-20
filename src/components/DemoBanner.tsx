import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Crown } from 'lucide-react';
import { isDemoMode } from '@/lib/demo-mode';

interface DemoBannerProps {
  className?: string;
  variant?: 'compact' | 'full';
  showUpgrade?: boolean;
}

/**
 * Demo mode banner component to inform users about limitations
 */
export function DemoBanner({ 
  className = '', 
  variant = 'compact',
  showUpgrade = true 
}: DemoBannerProps) {
  if (!isDemoMode) return null;

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center bg-gradient-mystical p-2 ${className}`}>
        <Badge variant="secondary" className="border-border/20 bg-background/10 text-foreground">
          <Sparkles className="mr-1 size-3" />
          Demo Mode
        </Badge>
      </div>
    );
  }

  return (
    <Card className={`border-primary/20 bg-gradient-card ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Crown className="size-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">You're using Demo Mode</p>
            <p className="text-sm text-muted-foreground">
              AI features are disabled. Explore the interface and see how it works!
            </p>
          </div>
          {showUpgrade && (
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary-dark">
              <Sparkles className="mr-1 size-4" />
              Upgrade
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}