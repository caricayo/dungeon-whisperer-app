import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, UserPlus, Check, X, Crown } from 'lucide-react';
import { useMultiplayerSessions } from '@/hooks/useMultiplayerSessions';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface SessionInvitePanelProps {
  className?: string;
}

export const SessionInvitePanel: React.FC<SessionInvitePanelProps> = ({ 
  className = '' 
}) => {
  const { 
    sessionInvites, 
    acceptSessionInvite, 
    declineSessionInvite, 
    isLoading 
  } = useMultiplayerSessions();

  if (isLoading) {
    return (
      <Card className={`${className} animate-pulse`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Session Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessionInvites.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Session Invitations
          </CardTitle>
          <CardDescription>
            You'll see multiplayer adventure invitations here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 size-12 opacity-50" />
            <p>No pending invitations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (<Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-5" />
          Session Invitations
          <Badge variant="secondary" className="ml-auto">
            {sessionInvites.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Friends have invited you to join their adventures
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {sessionInvites.map((invite, _index) => (
              <motion.div
                key={invite.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className="rounded-lg border border-border bg-card/50 p-4 transition-colors hover:bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Crown className="size-4 text-primary" />
                        <span className="font-medium text-foreground">
                          {invite.session?.name ?? 'Multiplayer Adventure'}
                        </span>
                        <Badge variant="outline" className="border-primary/30 bg-gradient-to-r from-primary/20 to-accent/20 text-xs">
                          <Users className="mr-1 size-3" />
                          Multiplayer
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Invited by</span>
                        <span className="font-medium text-foreground">
                          {invite.inviter?.displayName ?? invite.inviter?.username ?? 'Unknown'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(invite.createdAt, { addSuffix: true })}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acceptSessionInvite(invite.id)}
                        className="border-green-500/30 bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-400"
                      >
                        <Check className="mr-1 size-4" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => declineSessionInvite(invite.id)}
                        className="border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400"
                      >
                        <X className="mr-1 size-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};