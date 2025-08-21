import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateMultiplayerSessionProps {
  onSessionCreated?: (sessionId: string, joinUrl: string) => void;
}

export const CreateMultiplayerSession: React.FC<CreateMultiplayerSessionProps> = ({ 
  onSessionCreated 
}) => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      toast({
        title: "Session Name Required",
        description: "Please enter a name for your multiplayer session.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase.rpc('create_multiplayer_session', {
        session_name: sessionName.trim(),
        custom_prompt: null,
        max_players: 6
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create session');

      const fullUrl = `${window.location.origin}${data.join_url}`;
      setJoinUrl(fullUrl);

      toast({
        title: "Session Created!",
        description: `"${sessionName}" is ready. Share the link below.`,
      });

      onSessionCreated?.(data.session_id, data.join_url);

    } catch (error) {
      toast({
        title: "Session Creation Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!joinUrl) return;

    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      
      toast({
        title: "Copied!",
        description: "Join URL copied to clipboard",
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (joinUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Session Created!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Share this link:</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={joinUrl} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <Button 
            onClick={() => {
              setJoinUrl('');
              setSessionName('');
            }}
            variant="outline"
            className="w-full"
          >
            Create Another Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" />
          Create Multiplayer Session
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sessionName">Session Name *</Label>
          <Input
            id="sessionName"
            placeholder="Epic Dragon Quest Adventure"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={100}
          />
        </div>

        <Button 
          onClick={handleCreateSession}
          disabled={isCreating || !sessionName.trim()}
          className="w-full"
        >
          {isCreating ? (
            <>
              <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating Session...
            </>
          ) : (
            <>
              <Users className="mr-2 size-4" />
              Create Session
            </>
          )}
        </Button>

        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <p><strong>Simple multiplayer:</strong> Create a session and share the link with friends to play together.</p>
        </div>
      </CardContent>
    </Card>
  );
};