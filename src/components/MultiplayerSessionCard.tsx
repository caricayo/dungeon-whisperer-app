import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  Crown, 
  UserPlus, 
  Play, 
  Calendar, 
  Clock,
  LogOut,
  Star
} from 'lucide-react';
import { MultiplayerSession } from '@/hooks/useMultiplayerSessions';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface MultiplayerSessionCardProps {
  session: MultiplayerSession;
  isActive?: boolean;
  onJoin: (session: MultiplayerSession) => void;
  onInviteFriends: (sessionId: string) => void;
  onLeaveSession: (sessionId: string) => void;
  currentUserId?: string;
}

export const MultiplayerSessionCard: React.FC<MultiplayerSessionCardProps> = ({
  session,
  isActive = false,
  onJoin,
  onInviteFriends,
  onLeaveSession,
  currentUserId
}) => {
  const isUserDM = session.participants.find(p => p.userId === currentUserId)?.role === 'dm';
  const canInvite = session.participants.find(p => p.userId === currentUserId)?.permissions.canInvite;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-card/90 via-accent/20 to-card/90 transition-all duration-300 hover:shadow-xl">
        {/* Golden glow effect for multiplayer sessions */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute right-0 top-0 size-32 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-2xl" />
        
        <CardHeader className="relative">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="size-5 animate-pulse text-primary" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {session.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isActive && (
                <Badge variant="secondary" className="bg-green-500/20 text-xs text-green-700 dark:text-green-400">
                  <Play className="mr-1 size-3" />
                  Active
                </Badge>
              )}
              <Badge className="border-primary/30 bg-gradient-to-r from-primary/20 to-accent/20 text-primary">
                <Users className="mr-1 size-3" />
                Multiplayer
              </Badge>
            </div>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {session.messages.length > 0 
              ? `${session.messages.length} messages in this epic adventure`
              : 'A new multiplayer adventure awaits the party'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="relative space-y-4">
          {/* Session Stats */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-primary">
                {session.currentPlayerCount}
              </div>
              <div className="text-xs text-muted-foreground">Players</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-accent">
                {session.maxPlayers}
              </div>
              <div className="text-xs text-muted-foreground">Max Players</div>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" />
              Party Members
            </div>
            <div className="flex flex-wrap gap-2">
              {session.participants.slice(0, 4).map((participant) => (
                <div key={participant.id} className="flex items-center gap-1">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-primary/20 text-xs">
                      {participant.profile?.username?.[0]?.toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-foreground">
                      {participant.profile?.displayName ?? participant.profile?.username ?? 'Unknown'}
                    </span>
                    {participant.role === 'dm' && (
                      <Crown className="size-3 text-primary" />
                    )}
                    {participant.profile?.isOnline && (
                      <div className="size-2 rounded-full bg-green-500" />
                    )}
                  </div>
                </div>
              ))}
              {session.participants.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{session.participants.length - 4} more
                </Badge>
              )}
            </div>
          </div>

          {/* Session Details */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              Created {formatDistanceToNow(session.createdAt, { addSuffix: true })}
            </div>
            {session.updatedAt && (
              <div className="flex items-center gap-2">
                <Clock className="size-4" />
                Updated {formatDistanceToNow(session.updatedAt, { addSuffix: true })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant={isActive ? "default" : "outline"} 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20"
              onClick={() => onJoin(session)}
            >
              {isActive ? (
                <>
                  <Play className="mr-2 size-4" />
                  Continue Adventure
                </>
              ) : (
                <>
                  <Users className="mr-2 size-4" />
                  Join Session
                </>
              )}
            </Button>
            
            {(isUserDM ?? canInvite) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onInviteFriends(session.id)}
                className="border-primary/30 hover:bg-primary/10"
              >
                <UserPlus className="size-4" />
              </Button>
            )}
            
            {isUserDM ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete "${session.name}"? This will permanently remove the session for all players.`)) {
                    onLeaveSession(session.id);
                  }
                }}
                className="border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                Delete
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLeaveSession(session.id)}
                className="border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};