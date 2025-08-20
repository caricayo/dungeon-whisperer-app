/**
 * @fileoverview Chat header with session info and controls
 */

import React, { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Session } from '@/domains/chat/types';
import { MessageSquare, Settings, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePresenceManager } from '@/hooks/usePresenceManager';
import { useAuth } from '@/contexts/AuthContext';

interface ChatHeaderProps {
  session: Session | null;
  onSessionChange: (session: Session | null) => void;
  className?: string;
}

export const ChatHeader = memo<ChatHeaderProps>(({ 
  session, 
  onSessionChange, 
  className = '' 
}) => {
  const { user } = useAuth();
  const [showRoster, setShowRoster] = useState(false);
  
  // Set up presence for multiplayer sessions
  const isMultiplayerSession = session?.metadata?.isMultiplayer;
  const channelName = isMultiplayerSession ? `room:${session.id}` : '';
  const { onlineUsers } = usePresenceManager(channelName);
  
  if (!session) return null;

  // Filter online users to show participants
  const onlineParticipants = onlineUsers.filter(u => u.userId !== user?.id);
  const totalParticipants = onlineParticipants.length + (user ? 1 : 0);

  console.log(`✅ Presence channel ${channelName} - ${onlineUsers.length} online users`);

  return (
    <header className={`flex items-center justify-between p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <MessageSquare className="size-5 text-primary" />
        <div>
          <h1 className="font-semibold text-foreground">{session.name}</h1>
          <p className="text-sm text-muted-foreground">
            {session.messages?.length || 0} messages
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isMultiplayerSession && (
          <Popover open={showRoster} onOpenChange={setShowRoster}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {onlineParticipants.slice(0, 3).map((participant, index) => (
                    <Avatar key={participant.user_id} className="size-6 border border-background">
                      <AvatarFallback className="text-xs">
                        {participant.username?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {user && (
                    <Avatar className="size-6 border border-background">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {user.user_metadata?.username?.charAt(0)?.toUpperCase() || 'Me'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {totalParticipants > 3 && `+${totalParticipants - 3}`}
                  <Users className="ml-1 size-3" />
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-3">
                <h4 className="font-medium">Session Participants ({totalParticipants})</h4>
                <div className="space-y-2">
                  {user && (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.user_metadata?.username?.charAt(0)?.toUpperCase() || 'Me'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">You</p>
                        <Badge variant="secondary" className="text-xs">Online</Badge>
                      </div>
                    </div>
                  )}
                  {onlineParticipants.map(participant => (
                    <div key={participant.user_id} className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback>
                          {participant.username?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{participant.username || 'Unknown'}</p>
                        <Badge variant="secondary" className="text-xs">Online</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        <Button variant="ghost" size="sm">
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
});

ChatHeader.displayName = 'ChatHeader';