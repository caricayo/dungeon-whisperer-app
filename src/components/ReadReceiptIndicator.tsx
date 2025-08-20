import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDisplayName } from '@/lib/displayNameResolver';

interface ReadReceiptIndicatorProps {
  messageId: string;
  sessionId: string | null;
  className?: string;
  showCount?: boolean;
}

export const ReadReceiptIndicator: React.FC<ReadReceiptIndicatorProps> = ({ 
  messageId,
  sessionId,
  className = "",
  showCount = false
}) => {
  const { getMessageReadStatus } = useReadReceipts(sessionId);
  
  const readStatus = getMessageReadStatus(messageId);
  const readCount = readStatus.length;
  
  if (readCount === 0) {
    return (
      <Check className={`size-3 text-muted-foreground/50 ${className}`} />
    );
  }

  const getTooltipContent = () => {
    if (readCount === 1) {
      const reader = readStatus[0];
      const name = getDisplayName({ id: reader.id, username: reader.username, display_name: reader.display_name });
      return `Read by ${name}`;
    } else if (readCount <= 3) {
      const names = readStatus
        .slice(0, 3)
        .map(r => getDisplayName({ id: r.id, username: r.username, display_name: r.display_name }))
        .join(', ');
      return `Read by ${names}`;
    } else {
      const firstTwo = readStatus
        .slice(0, 2)
        .map(r => getDisplayName({ id: r.id, username: r.username, display_name: r.display_name }))
        .join(', ');
      return `Read by ${firstTwo} and ${readCount - 2} others`;
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1 ${className}`}>
          <CheckCheck className="size-3 text-primary" />
          {showCount && readCount > 1 && (
            <Badge 
              variant="secondary" 
              className="h-4 min-w-4 px-1 py-0 text-xs"
            >
              {readCount}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-sm">{getTooltipContent()}</p>
      </TooltipContent>
    </Tooltip>
  );
};