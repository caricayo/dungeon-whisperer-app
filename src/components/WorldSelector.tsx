import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface WorldSelectorProps {
  currentWorld: number;
  onWorldChange: (world: number) => void;
  className?: string;
}

export const WorldSelector: React.FC<WorldSelectorProps> = ({ 
  currentWorld, 
  onWorldChange, 
  className = "" 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleWorldChange = async (value: string) => {
    if (!user || isUpdating) return;

    const newWorld = parseInt(value);
    if (newWorld === currentWorld) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          current_world: newWorld,
          username: user.user_metadata?.username || `user_${user.id.slice(0, 8)}`
        }, {
          onConflict: 'id'
        });

      if (error) throw error;

      onWorldChange(newWorld);
      toast({
        title: "World Changed",
        description: `You're now exploring World ${newWorld}!`,
      });

    } catch (error) {
      console.error('Error updating world:', error);
      toast({
        title: "Update Failed",
        description: "Could not change world. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-primary" />
        <span className="text-sm font-medium">Current World:</span>
      </div>
      <Select
        value={currentWorld.toString()}
        onValueChange={handleWorldChange}
        disabled={isUpdating}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5].map((world) => (
            <SelectItem key={world} value={world.toString()}>
              <div className="flex items-center gap-2">
                <span>World {world}</span>
                {world === currentWorld && (
                  <Badge variant="secondary" className="text-xs">Current</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};