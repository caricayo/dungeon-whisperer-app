/**
 * @fileoverview Chat sidebar with session management
 */

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Session } from '@/domains/chat/types';
import { Plus, MessageSquare } from 'lucide-react';

interface ChatSidebarProps {
  session: Session | null;
  onSessionChange: (session: Session | null) => void;
  className?: string;
}

export const ChatSidebar = memo<ChatSidebarProps>(({ 
  session, 
  onSessionChange, 
  className = '' 
}) => {
  return (
    <aside className={`flex flex-col bg-card ${className}`}>
      <div className="border-b border-border p-4">
        <Button 
          onClick={() => onSessionChange(null)} 
          className="w-full justify-start gap-2"
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {session && (
            <div className="rounded-lg bg-accent p-3 text-accent-foreground">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                <span className="truncate font-medium">{session.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {session.messages?.length || 0} messages
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
});

ChatSidebar.displayName = 'ChatSidebar';