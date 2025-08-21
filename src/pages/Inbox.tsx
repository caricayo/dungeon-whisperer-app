import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useAuth } from '@/hooks/use-auth';
import { Mail, Send, Users, MessageSquare, Loader2, User, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useSectionHistory } from '@/hooks/useSectionHistory';

const Inbox = () => {
  const { user } = useAuth();
  const _navigate = useNavigate();
  const { roomId } = useParams<{ roomId?: string }>();
  const { push: pushToHistory, back: goBack } = useSectionHistory('social');
  const {
    conversations,
    selectedConversation,
    setSelectedConversation,
    isLoading,
    isSending,
    sendMessage,
    markMessagesAsRead,
    startConversation
  } = useDirectMessages();
  
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  // Track page visit for section history
  useEffect(() => {
    pushToHistory(roomId ? `/dm/${roomId}` : '/inbox');
  }, [pushToHistory, roomId]);

  // Handle DM route parameter
  useEffect(() => {
    if (roomId && user) {
      // DM route accessed
      startConversation(roomId);
    }
  }, [roomId, user, startConversation]);

  // Mark messages as read when selecting a conversation
  useEffect(() => {
    if (selectedConversation && selectedConversation.unreadCount > 0) {
      markMessagesAsRead(selectedConversation.otherUserId);
    }
  }, [selectedConversation, markMessagesAsRead]);

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim() || isSending) return;

    const success = await sendMessage(selectedConversation.otherUserId, messageInput);
    if (success) {
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Mail className="mx-auto mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">Please sign in to access your messages.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => goBack('/inbox')}
            className="p-2"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <MessageSquare className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">Inbox</h1>
          {totalUnreadCount > 0 && (
            <Badge variant="secondary" className="bg-primary text-primary-foreground">
              {totalUnreadCount} unread
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">Private messages with your friends and party members.</p>
      </div>

      <div className="grid h-[600px] grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Conversations
              {conversations.length > 0 && (
                <Badge variant="outline">{conversations.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center p-6">
                  <Loader2 className="size-6 animate-spin" />
                  <span className="ml-2">Loading conversations...</span>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Mail className="mx-auto mb-4 size-12 opacity-50" />
                  <p>No conversations yet.</p>
                  <p className="mt-2 text-sm">Start by messaging a friend from your Friends list!</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.otherUserId}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`w-full rounded-lg p-3 text-left transition-colors ${
                        selectedConversation?.otherUserId === conversation.otherUserId
                          ? 'border border-primary/20 bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar className="size-10">
                            <AvatarImage 
                              src={conversation.otherUser.avatarUrl} 
                              alt={conversation.otherUser.username}
                            />
                            <AvatarFallback>
                              <User className="size-5" />
                            </AvatarFallback>
                          </Avatar>
                          {conversation.otherUser.isOnline && (
                            <div className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-white bg-green-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate font-medium">
                              {conversation.otherUser.displayName ?? conversation.otherUser.username}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <Badge variant="secondary" className="ml-2 bg-primary text-primary-foreground">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {conversation.lastMessage.content ?? 'No messages yet'}
                          </p>
                          {conversation.lastMessage.createdAt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDistanceToNow(conversation.lastMessage.createdAt, { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message View */}
        <Card className="lg:col-span-2">
          {selectedConversation ? (
            <>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage 
                      src={selectedConversation.otherUser.avatarUrl} 
                      alt={selectedConversation.otherUser.username}
                    />
                    <AvatarFallback>
                      <User className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">
                      {selectedConversation.otherUser.displayName ?? selectedConversation.otherUser.username}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.otherUser.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex h-[500px] flex-col p-0">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selectedConversation.messages.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <MessageSquare className="mx-auto mb-4 size-12 opacity-50" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      selectedConversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                              message.senderId === user.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p className="mt-1 text-xs opacity-70">
                              {formatDistanceToNow(message.createdAt, { addSuffix: true })}
                              {message.senderId !== user.id && message.readAt && (
                                <span className="ml-2">• Read</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                
                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder={`Message ${selectedConversation.otherUser.username}...`}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isSending}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={!messageInput.trim() || isSending}
                      size="icon"
                    >
                      {isSending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-4 size-12 opacity-50" />
                <p>Select a conversation to start messaging</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Inbox;
