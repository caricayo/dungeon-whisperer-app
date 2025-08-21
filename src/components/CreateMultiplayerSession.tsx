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
import { InputSanitizer, SecurityLogger } from '@/lib/security';

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
    sessionName: string;
    joinUrl: string;
    fullUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateSession = async () => {
    // Enhanced input validation with security
    try {
      const sanitizedName = InputSanitizer.sanitizeText(sessionName);
      
      if (!sanitizedName || sanitizedName.length < 1) {
        SecurityLogger.logSecurityEvent('invalid_session_name', { 
          reason: 'empty_or_dangerous' 
        });
        toast({
          title: "Invalid Session Name",
          description: "Please enter a valid name for your multiplayer session.",
          variant: "destructive",
        });
        return;
      }

      if (sanitizedName.length > 100) {
        toast({
          title: "Session Name Too Long",
          description: "Session name must be 100 characters or less.",
          variant: "destructive",
        });
        return;
      }
      
    } catch (_error: unknown) {
      const errorMessage = _error instanceof Error ? _error.message : 'Unknown error';
      SecurityLogger.logSecurityEvent('session_creation_input_error', { error: errorMessage });
      toast({
        title: "Invalid Input",
        description: "Please check your input and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      debugLog('🎮 Creating multiplayer session:', sessionName);

      // Re-sanitize inputs before database call (defensive programming)
      const sanitizedName = InputSanitizer.sanitizeText(sessionName);
      const sanitizedPrompt = InputSanitizer.sanitizeText(customPrompt);
      
      const {data, error} = await supabase.rpc('create_multiplayer_session_fixed', {
        session_name: sanitizedName,
        custom_prompt: sanitizedPrompt ?? null,
        max_players: maxPlayers[0]
      });

      if (error) {
        throw new Error("Operation failed");
      }

      if (!data?.success) {
        throw new Error(data?.error ?? 'Failed to create session');
      }

      debugLog('✅ Multiplayer session created:', data);

      const fullUrl = `${window.location.origin}${data.join_url}`;
      
      setCreatedSession({
        sessionId: data.session_id,
        sessionName: data.session_name || sanitizedName,
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
    } catch {
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
                aria-label="Copy join URL"
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
            <p><strong>Session Name:</strong> {createdSession.sessionName}</p>
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
            placeholder="Enter session name"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customPrompt">Custom Prompt</Label>
          <Textarea
            id="customPrompt"
            placeholder="Optional custom prompt"
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
          <Label htmlFor="maxPlayers">Max Players: {maxPlayers[0]}</Label>
          <Slider
            id="maxPlayers"
            value={maxPlayers}
            onValueChange={setMaxPlayers}
            max={6}
            min={2}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>2 players</span>
            <span>6 players</span>
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
              Create Session
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