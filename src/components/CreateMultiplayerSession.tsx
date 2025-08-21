import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Users, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { debugLog, debugError } from '@/lib/debug';

interface CreateMultiplayerSessionProps {
  onSessionCreated?: (sessionId: string, joinUrl: string) => void;
}

export const CreateMultiplayerSession: React.FC<CreateMultiplayerSessionProps> = ({ 
  onSessionCreated 
}) => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [maxPlayers, setMaxPlayers] = useState([6]);
  const [createdSession, setCreatedSession] = useState<{
    sessionId: string;
    joinUrl: string;
    fullUrl: string;
  } | null>(null);
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
      debugLog('🎮 Creating multiplayer session:', sessionName);

      const { data, error } = await supabase.rpc('create_multiplayer_session', {
        session_name: sessionName.trim(),
        custom_prompt: customPrompt.trim() || null,
        max_players: maxPlayers[0]
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create session');
      }

      debugLog('✅ Multiplayer session created:', data);

      const fullUrl = `${window.location.origin}${data.join_url}`;
      
      setCreatedSession({
        sessionId: data.session_id,
        joinUrl: data.join_url,
        fullUrl
      });

      toast({
        title: "🎉 Multiplayer Session Created!",
        description: `"${data.session_name}" is ready for ${data.max_players} players.`,
      });

      // Reset form
      setSessionName('');
      setCustomPrompt('');
      setMaxPlayers([6]);

      // Notify parent component
      if (onSessionCreated) {
        onSessionCreated(data.session_id, data.join_url);
      }

    } catch (error) {
      debugError('❌ Error creating multiplayer session:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Session Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!createdSession) return;

    try {
      await navigator.clipboard.writeText(createdSession.fullUrl);
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

  if (createdSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Session Created Successfully!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Share this link with your players:</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={createdSession.fullUrl} 
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
          
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p><strong>Session ID:</strong> {createdSession.sessionId}</p>
            <p className="mt-1 text-muted-foreground">
              Players can join by clicking the link above or visiting the join URL directly.
            </p>
          </div>

          <Button 
            onClick={() => setCreatedSession(null)}
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

        <div className="space-y-2">
          <Label htmlFor="customPrompt">Custom Campaign Setting (Optional)</Label>
          <Textarea
            id="customPrompt"
            placeholder="Describe your campaign world, rules, or special instructions for the AI..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <div className="text-xs text-muted-foreground">
            {customPrompt.length}/500 characters
          </div>
        </div>

        <div className="space-y-2">
          <Label>Maximum Players: {maxPlayers[0]}</Label>
          <Slider
            value={maxPlayers}
            onValueChange={setMaxPlayers}
            max={12}
            min={2}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>2 players</span>
            <span>12 players</span>
          </div>
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
              Create Multiplayer Session
            </>
          )}
        </Button>

        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <p><strong>How it works:</strong></p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>You'll get a shareable join link</li>
            <li>Players click the link to join your session</li>
            <li>Everyone sees the same chat and AI responses</li>
            <li>Real-time synchronization keeps everyone connected</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};