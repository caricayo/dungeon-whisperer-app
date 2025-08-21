import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  Mail, 
  ChevronDown,
  ChevronRight,
  Send,
  Globe
} from 'lucide-react';
import { useSocialManager } from '@/hooks/useSocialManager';
import { useAuth } from '@/hooks/use-auth';
import { usePresenceManager } from '@/hooks/usePresenceManager';
import { useWorldDirectory } from '@/hooks/useWorldDirectory';
import { getDisplayName } from '@/lib/displayNameResolver';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SocialPanelProps {
  isOpen: boolean;
}

export const SocialPanel = ({ isOpen }: SocialPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    friends,
    friendRequests,
    isLoading,
    sendFriendRequest,
    sendFriendRequestByUserId,
    acceptFriendRequest,
    declineFriendRequest,
  } = useSocialManager();

  const [friendUsername, setFriendUsername] = useState('');
  const [showFriends, setShowFriends] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [showWorlds, setShowWorlds] = useState(false);
  const [showWorldDirectory, setShowWorldDirectory] = useState(false);
  const [currentWorld, setCurrentWorld] = useState<number>(1);

  // Get online users for discovery and world directory
  const { onlineUsers } = usePresenceManager();
  const { allUsers, isLoading: isLoadingDirectory } = useWorldDirectory();

  // Load current user's world on mount
  React.useEffect(() => {
    if (!user) return;
    
    const loadCurrentWorld = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('current_world')
          .eq('id', user.id)
          .single();
        
        if (data?.current_world) {
          setCurrentWorld(data.current_world);
        }
      } catch (error) {
        console.error('Error loading current world:', error);
      }
    };

    loadCurrentWorld();
  }, [user]);

  // Handle world change
  const handleWorldChange = useCallback(async (newWorld: number) => {
    if (!user || newWorld === currentWorld) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ current_world: newWorld })
        .eq('id', user.id);

      if (error) throw error;

      setCurrentWorld(newWorld);
      toast({
        title: "World Changed",
        description: `You are now in World ${newWorld}`,
      });
    } catch (error) {
      console.error('Error changing world:', error);
      toast({
        title: "World Change Failed",
        description: "Could not change world. Please try again.",
        variant: "destructive",
      });
    }
  }, [user, currentWorld, toast]);

  const handleSendFriendRequest = async () => {
    if (friendUsername.trim()) {
      console.warn('🔥 Sending friend request to:', friendUsername);
      console.warn('🔥 sendFriendRequest function type:', typeof sendFriendRequest);
      console.warn('🔥 isLoading:', isLoading);
      const success = await sendFriendRequest(friendUsername);
      console.warn('🔥 Friend request result:', success);
      if (success) {
        setFriendUsername('');
      }
    } else {
      console.warn('🔥 Friend request failed - empty username');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendFriendRequest();
    }
  };

  // Filter out current user and existing friends from online users, and filter by world
  const availableOnlineUsers = onlineUsers.filter(onlineUser => {
    // Exclude current user
    if (onlineUser.userId === user?.id) return false;
    
    // Only include users in the same world
    if (onlineUser.currentWorld !== currentWorld) return false;
    
    // Exclude existing friends
    const isAlreadyFriend = friends.some(friend => 
      friend.friend_id === onlineUser.userId || friend.user_id === onlineUser.userId
    );
    
    // Exclude pending requests
    const hasPendingRequest = friendRequests.some(request =>
      request.friend_id === onlineUser.userId || request.user_id === onlineUser.userId  
    );
    
    return !isAlreadyFriend && !hasPendingRequest;
  });

  // Filter world directory users for friend requests
  const worldDirectoryUsers = React.useMemo(() => {
    if (!user) return [];
    
    return allUsers.filter(worldUser => {
      // Exclude current user
      if (worldUser.id === user.id) return false;
      
      // Exclude existing friends
      if (friends.some(friend => 
        friend.friend_id === worldUser.id || friend.user_id === worldUser.id
      )) return false;
      
      // Exclude users with pending requests
      if (friendRequests.some(request => 
        request.friend_id === worldUser.id || request.user_id === worldUser.id
      )) return false;
      
      return true;
    });
  }, [allUsers, user, friends, friendRequests]);

  const handleSendFriendRequestToOnlineUser = async (userId: string, username?: string) => {
    if (!username) {
      toast({
        title: "Username Required",
        description: "They haven't set a username yet. Ask them to open the app and pick one.",
        variant: "destructive",
      });
      return;
    }
    
    await sendFriendRequestByUserId(userId);
  };

  console.warn('🔍 Social Panel Debug:', {
    totalOnlineUsers: onlineUsers.length,
    currentUserId: user?.id,
    friendsCount: friends.length,
    requestsCount: friendRequests.length,
    availableUsersCount: availableOnlineUsers.length,
    onlineUsers: onlineUsers.map(u => ({ id: u.user_id, username: u.username })),
    availableUsers: availableOnlineUsers.map(u => ({ id: u.user_id, username: u.username }))
  });

  if (!isOpen) return null;

  return (
    <div className="space-y-4">
      {/* Add Friend */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserPlus className="size-4" />
          Add Friend
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="username"
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            className="text-xs"
            size={32}
          />
          <Button
            size="sm"
            onClick={handleSendFriendRequest}
            disabled={!friendUsername.trim() || isLoading}
          >
            <Send className="size-3" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* World Selection */}
      <Collapsible open={showWorlds} onOpenChange={setShowWorlds}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-between p-2">
            <div className="flex items-center gap-2">
              <Globe className="size-4" />
              <span className="text-sm">World {currentWorld}</span>
            </div>
            {showWorlds ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1 p-1">
            {[1, 2, 3].map((world) => (
              <Button
                key={world}
                size="sm"
                variant={currentWorld === world ? "default" : "outline"}
                onClick={() => handleWorldChange(world)}
                className="h-7 text-xs"
                disabled={isLoading}
              >
                World {world}
              </Button>
            ))}
          </div>
          <div className="px-2 text-center text-xs text-muted-foreground">
            Only users in the same world can see each other's public adventures
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Friends List */}
      <Collapsible open={showFriends} onOpenChange={setShowFriends}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-between p-2">
            <div className="flex items-center gap-2">
              <Users className="size-4" />
              <span className="text-sm">Friends ({friends.length})</span>
            </div>
            {showFriends ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <ScrollArea className="max-h-40">
            {friends.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No friends yet
              </div>
            ) : (
              <div className="space-y-2">
                 {friends.map((friend) => {
                   // Determine the other user's profile regardless of who initiated
                   const otherProfile = friend.user_id === user?.id 
                     ? friend.friend_profile 
                     : friend.requester_profile;
                   const displayName = getDisplayName(otherProfile);
                   const isOnline = otherProfile?.is_online ?? false;

                   return (
                     <div key={friend.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                       <div className="flex items-center gap-2">
                         <div className="relative">
                           <div className="flex size-6 items-center justify-center rounded-full bg-primary/20">
                             <span className="text-xs font-medium">
                               {displayName.charAt(0).toUpperCase()}
                             </span>
                           </div>
                           {/* Online/Offline indicator */}
                           <div className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border border-background ${
                             isOnline ? 'bg-green-500' : 'bg-gray-400'
                           }`} />
                         </div>
                         <div className="flex flex-col">
                           <span className="max-w-20 truncate text-xs font-medium">
                             {displayName}
                           </span>
                         </div>
                       </div>
                     </div>
                   );
                 })}
              </div>
            )}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4" />
              Requests ({friendRequests.length})
            </div>
            <ScrollArea className="max-h-32">
              <div className="space-y-2">
                {friendRequests.map((request) => (
                  <div key={request.id} className="space-y-2 rounded-lg bg-muted/50 p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-5 items-center justify-center rounded-full bg-primary/20">
                        <span className="text-xs">
                          {request.user_id.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="flex-1 truncate text-xs">
                        Friend request
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acceptFriendRequest(request.id)}
                        className="h-6 px-2 text-xs"
                      >
                        <Check className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => declineFriendRequest(request.id)}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}

      {/* Online Users Discovery */}
      <Separator />
      <Collapsible open={showOnlineUsers} onOpenChange={setShowOnlineUsers}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-between p-2">
            <div className="flex items-center gap-2">
              <Globe className="size-4" />
              <span className="text-sm">World {currentWorld} Users ({availableOnlineUsers.length})</span>
            </div>
            {showOnlineUsers ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <ScrollArea className="max-h-40">
            {availableOnlineUsers.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No new users online
              </div>
            ) : (
              <div className="space-y-2">
                {availableOnlineUsers.map((onlineUser) => (
                  <div key={onlineUser.user_id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/20">
                          <span className="text-xs font-medium">
                            {onlineUser.username?.charAt(0).toUpperCase() ?? 'U'}
                          </span>
                        </div>
                        {/* Online indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border border-background bg-green-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="max-w-16 truncate text-xs font-medium">
                          {onlineUser.username ?? 'Unknown'}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <div className="size-1.5 rounded-full bg-green-500" />
                          <span>Online</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendFriendRequestToOnlineUser(onlineUser.user_id, onlineUser.username)}
                      className="h-6 px-2 text-xs"
                      disabled={isLoading}
                    >
                      <UserPlus className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {/* World Directory */}
      <Separator />
      <Collapsible open={showWorldDirectory} onOpenChange={setShowWorldDirectory}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-between p-2">
            <div className="flex items-center gap-2">
              <Globe className="size-4" />
              <span className="text-sm">All Adventurers ({worldDirectoryUsers.length})</span>
            </div>
            {showWorldDirectory ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <ScrollArea className="max-h-60">
            {isLoadingDirectory ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Loading all adventurers...
              </div>
            ) : worldDirectoryUsers.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                All adventurers are already friends or have pending requests
              </div>
            ) : (
              <div className="space-y-2">
                {worldDirectoryUsers.map((worldUser) => {
                  const displayName = worldUser.resolvedDisplayName;
                  
                  return (
                    <div key={worldUser.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="flex size-6 items-center justify-center rounded-full bg-primary/20">
                            <span className="text-xs font-medium">
                              {displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {/* Online/Offline indicator */}
                          <div className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border border-background ${
                            worldUser.is_online ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div className="flex flex-col">
                          <span className="max-w-16 truncate text-xs font-medium">
                            {displayName}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <div className={`size-1.5 rounded-full ${
                              worldUser.is_online ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span>{worldUser.is_online ? 'Online' : 'Offline'}</span>
                            <span>• W{worldUser.current_world}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendFriendRequestByUserId(worldUser.id)}
                        className="h-6 px-2 text-xs"
                        disabled={isLoading}
                      >
                        <UserPlus className="size-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

    </div>
  );
};
