import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { Send, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MessageUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export const MessageUserModal = ({ isOpen, onClose, user }: MessageUserModalProps) => {
  const { sendMessage, isSending, startConversation } = useDirectMessages();
  const [messageContent, setMessageContent] = useState('');
  const navigate = useNavigate();

  const handleSendMessage = async () => {
    if (!messageContent.trim() || isSending) return;

    const success = await sendMessage(user.id, messageContent);
    if (success) {
      setMessageContent('');
      onClose();
      
      // Start conversation and navigate to inbox
      await startConversation(user.id);
      navigate('/inbox');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarImage src={user.avatarUrl} alt={user.username} />
              <AvatarFallback>
                <User className="size-4" />
              </AvatarFallback>
            </Avatar>
            Send Message
          </DialogTitle>
          <DialogDescription>
            Send a private message to {user.displayName || user.username}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={user.avatarUrl} alt={user.username} />
                <AvatarFallback>
                  <User className="size-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.displayName || user.username}</p>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="Type your message here..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={4}
              disabled={isSending}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage} 
              disabled={!messageContent.trim() || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};