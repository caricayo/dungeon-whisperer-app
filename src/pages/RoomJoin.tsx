import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerSessionManager } from '@/hooks/useMultiplayerSessionManager';
import { useSessionManager } from '@/hooks/useSessionManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Shield, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';

/**
 * Room join page implementing Context-7 Doc Assist join flow:
 * /rooms/:sessionId/join → history → realtime subscribe room:{sessionId} → presence heartbeat
 */
export default function RoomJoin() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinAndSetupMultiplayerSession } = useMultiplayerSessionManager();
  const { setCurrentSession } = useSessionManager();
  
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{id: string; name: string; players?: string[]} | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setJoinError('Invalid session ID');
      return;
    }

    debugLog('[RoomJoin] Attempting to join session:', sessionId);
    
    // Validate session ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      setJoinError('Invalid session ID format');
      return;
    }

    // Auto-join on component mount
    handleJoinSession();
  }, [sessionId, user, handleJoinSession]);

  const handleJoinSession = useCallback(async () => {
    if (!sessionId || !user) {
      setJoinError('Authentication required to join session');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      debugLog('[RoomJoin] Starting join process for session:', sessionId);
      
      const session = await joinAndSetupMultiplayerSession(
        sessionId,
        setCurrentSession,
        navigate
      );

      if (session) {
        debugLog('[RoomJoin] Successfully joined session:', session.name);
        toast({
          title: "Joined Session",
          description: `Successfully joined "${session.name}"`,
        });
        
        // Navigate to main chat interface
        navigate('/', { replace: true });
      } else {
        throw new Error('Failed to join session - session may not exist or be full');
      }
    } catch (error) {
      debugError('[RoomJoin] Failed to join session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setJoinError(errorMessage);
      
      toast({
        title: "Join Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  }, [sessionId, user, joinAndSetupMultiplayerSession, setCurrentSession, navigate, toast]);

  const handleRetry = () => {
    setJoinError(null);
    handleJoinSession();
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert className="max-w-md">
          <Shield className="size-4" />
          <AlertDescription>
            Invalid session link. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You need to be signed in to join this multiplayer session.
            </p>
            <Button 
              onClick={() => navigate('/auth', { state: { returnTo: `/rooms/${sessionId}/join` } })}
              className="w-full"
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            {isJoining ? 'Joining Session...' : 'Join Multiplayer Session'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isJoining && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Connecting to session...</span>
            </div>
          )}

          {joinError && (
            <Alert variant="destructive">
              <AlertDescription>{joinError}</AlertDescription>
            </Alert>
          )}

          {sessionInfo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                Session: {sessionInfo.name}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                Players: {sessionInfo.players?.length ?? 0}/6
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {joinError && (
              <Button onClick={handleRetry} disabled={isJoining} className="flex-1">
                Retry Join
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleGoHome}
              disabled={isJoining}
              className="flex-1"
            >
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}