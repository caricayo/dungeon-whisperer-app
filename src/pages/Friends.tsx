import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserPlus, Users, Check, X, Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import { useSocialManager } from '@/hooks/useSocialManager';
import { useAuth } from '@/contexts/AuthContext';
import { MessageUserModal } from '@/components/MessageUserModal';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useSectionHistory } from '@/hooks/useSectionHistory';
import { getDisplayName } from '@/lib/displayNameResolver';

const Friends = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { push: pushToHistory, back: goBack } = useSectionHistory('social');
  const {
    friends,
    friendRequests,
    isLoading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
  } = useSocialManager();

  // Track page visit for section history
  useEffect(() => {
    pushToHistory('/friends');
  }, [pushToHistory]);

  const [friendEmail, setFriendEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState<{
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  } | null>(null);

  // Separate incoming and outgoing friend requests
  const incomingRequests = friendRequests.filter(req => req.friend_id === user?.id);
  const outgoingRequests = friendRequests.filter(req => req.user_id === user?.id);

  const handleSendFriendRequest = async () => {
    if (!friendEmail.trim() || isSending) return;
    
    setIsSending(true);
    try {
      const success = await sendFriendRequest(friendEmail.trim());
      if (success) {
        setFriendEmail('');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendFriendRequest();
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 size-8 animate-spin text-primary" />
          <p className="text-foreground-muted">Loading your connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goBack('/maindashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div>
              <h1 className="text-gradient-primary text-3xl font-bold">Friends & Connections</h1>
              <p className="text-foreground-muted">Connect with other adventurers</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add Friend Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserPlus className="mr-2 size-5 text-primary" />
              Add New Friend
            </CardTitle>
            <CardDescription>Send a friend request by username</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input 
                  placeholder="Enter friend's username" 
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSending}
                />
              </div>
              <Button onClick={handleSendFriendRequest} disabled={!friendEmail.trim() || isSending}>
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 size-4" />
                )}
                {isSending ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Friends List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 size-5 text-primary" />
                Friends ({friends.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {friends.length > 0 ? (
                friends.map((friend) => {
                  const profile = friend.friend_profile || friend.requester_profile;
                  return (
                    <div 
                      key={friend.id} 
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                      onClick={() => navigate(`/dm/${friend.friend_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-sm font-medium">
                            {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{getDisplayName({ id: profile?.id || '', username: profile?.username || '', display_name: profile?.display_name })}</div>
                          <div className="text-sm text-foreground-muted">@{profile?.username || 'unknown'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserForMessage({
                              id: friend.friend_id,
                              username: profile?.username || `User-${friend.friend_id.slice(0, 8)}`,
                              displayName: profile?.display_name,
                              avatarUrl: undefined
                            });
                          }}
                        >
                          <MessageSquare className="size-4" />
                        </Button>
                        <Badge variant={profile?.is_online ? "secondary" : "outline"}>
                          {profile?.is_online ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-foreground-muted">
                  <Users className="mx-auto mb-2 size-8 opacity-50" />
                  <p>No friends yet. Send some friend requests!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Friend Requests */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Friend Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Incoming requests */}
              {incomingRequests.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-medium">Incoming ({incomingRequests.length})</h4>
                  <div className="space-y-2">
                    {incomingRequests.map((request) => {
                      const profile = request.requester_profile;
                      return (
                        <div key={request.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-sm font-medium">
                                {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{getDisplayName({ id: profile?.id || '', username: profile?.username || '', display_name: profile?.display_name })}</div>
                              <div className="text-xs text-foreground-muted">
                                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => acceptFriendRequest(request.id)}>
                              <Check className="size-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => declineFriendRequest(request.id)}>
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outgoing requests */}
              {outgoingRequests.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-medium">Sent ({outgoingRequests.length})</h4>
                  <div className="space-y-2">
                    {outgoingRequests.map((request) => {
                      const profile = request.friend_profile;
                      return (
                        <div key={request.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-sm font-medium">
                                {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{getDisplayName({ id: profile?.id || '', username: profile?.username || '', display_name: profile?.display_name })}</div>
                              <div className="text-xs text-foreground-muted">
                                Sent {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline">Pending</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {friendRequests.length === 0 && (
                <div className="py-6 text-center text-foreground-muted">
                  <UserPlus className="mx-auto mb-2 size-8 opacity-50" />
                  <p>No pending friend requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Message User Modal */}
      {selectedUserForMessage && (
        <MessageUserModal
          isOpen={true}
          onClose={() => setSelectedUserForMessage(null)}
          user={selectedUserForMessage}
        />
      )}
    </div>
  );
};

export default Friends;