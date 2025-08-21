import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Calendar, Clock, Play, Crown, UserPlus, Star, ArrowLeft, Globe } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useMultiplayerSessions } from '@/hooks/useMultiplayerSessions';
import { useSocialManager } from '@/hooks/useSocialManager';
import { useAuth } from '@/hooks/use-auth';
import { useSessionJoining } from '@/hooks/useSessionJoining';
import { supabase } from '@/integrations/supabase/client';
import { SessionInvitePanel } from '@/components/SessionInvitePanel';
import { MultiplayerSessionCard } from '@/components/MultiplayerSessionCard';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useMultiplayerSessionManager } from '@/hooks/useMultiplayerSessionManager';
import { WorldSelector } from '@/components/WorldSelector';
import { useSectionHistory } from '@/hooks/useSectionHistory';
import { getDisplayName } from '@/lib/displayNameResolver';

const Sessions = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { push: pushToHistory, back: goBack } = useSectionHistory('adventures');
  const { sessions, currentSession, setCurrentSession, createSession: createNewSession } = useSessionManager();
  const { 
    multiplayerSessions, 
    discoverableSessions,
    createMultiplayerSession, 
    sendSessionInvite,
    leaveSession 
  } = useMultiplayerSessions();
  const { friends } = useSocialManager();
  const { joinMultiplayerSession } = useSessionJoining();
  
  const [isCreating, setIsCreating] = useState(false);
  const [currentWorld, setCurrentWorld] = useState<number>(1);
  const [showCreateMultiplayer, setShowCreateMultiplayer] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('all');
  const [multiplayerForm, setMultiplayerForm] = useState({
    name: '',
    customPrompt: '',
    maxPlayers: 6
  });

  // Load current user's world
  useEffect(() => {
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
      } catch {
        console.error('Error loading current world:', _error);
      }
    };

    loadCurrentWorld();
  }, [user]);

  // Track page visit for section history
  useEffect(() => {
    pushToHistory('/sessions');
  }, [pushToHistory]);

  // Handle URL parameters for navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    const source = searchParams.get('source');
    
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Comprehensive D&D 5e Dungeon Master System Prompt
  const DEFAULT_DM_PROMPT = `You are the Dungeon Master for a Dungeons & Dragons 5th Edition one-shot adventure.  

Your goals are:
- **Continuity & Memory**: Always remember past events, player choices, NPCs, quests, locations, and unresolved threads. Keep track of the evolving world consistently.  
- **Rules Enforcement**: Use official 5e mechanics (abilities, skills, spells, combat, conditions, rests, death saves, etc.). When needed, clearly state DCs, rolls, or combat order.  
- **Cinematic Storytelling**: Describe scenes vividly with atmosphere, emotions, and sensory details. Make the world feel alive, epic, and fun.  
- **Dice Rolls**: Whenever an action has uncertainty, request a d20 roll (or other appropriate dice) and explain what ability/skill applies and the DC. Then narrate outcomes based on the result.  
- **Inventory & Stats**: Track the player's inventory, gold, equipment, HP, spell slots, and conditions. Always update these after events, combat, or resource usage.  
- **Player Agency**: Present meaningful choices, branching paths, and let the player's actions shape the world. Never railroad unnecessarily.  
- **Immersion & Fun**: Keep the tone adventurous, engaging, and playful. Add occasional surprises, twists, or humor to keep things entertaining.  
- **One-Shot Constraint**: This adventure must have a complete narrative arc within a single session (roughly 3–5 major encounters/scenes). It should conclude with a satisfying resolution (victory, tragedy, or twist ending).  

---

### Session Flow
1. **Start with Character Creation**  
   - Guide the user step by step:  
     - Choose a race (describe the common ones with flavor).  
     - Choose a class (explain the basics of each).  
     - Roll or assign ability scores (walk the user through rolling 4d6 drop lowest, or point buy if preferred).  
     - Select background, alignment, and starting equipment.  
     - Record max HP, AC, and key features.  
   - Keep track of all chosen stats, abilities, and inventory in memory.  

2. **After Character Creation**  
   - Introduce the one-shot setting cinematically.  
   - Establish the immediate hook that draws the player into the story.  

3. **During Play**  
   - Narrate scenes cinematically.  
   - Present meaningful choices or allow open-ended input.  
   - Call for rolls when relevant, specify which dice and modifiers to use, and narrate the results.  
   - Update the game state (stats, inventory, quest log) after each event.  
   - Build toward a climactic challenge or boss encounter.  

4. **Ending**  
   - Always resolve the story within this session.  
   - Conclude with a satisfying ending: victory, loss, or an unexpected twist.  
   - Summarize the consequences of the player's actions on the world.  

---

**Begin now by greeting the player and starting the character creation process for this one-shot adventure.**`;

  const handleCreateSession = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      const sessionName = `Adventure ${sessions.length + 1}`;
      
      createNewSession(sessionName, DEFAULT_DM_PROMPT);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateMultiplayerSession = async () => {
    if (isCreating) return;
    
    // Debug logging removed for production
    
    setIsCreating(true);
    try {
      const result = await createMultiplayerSession(
        multiplayerForm.name,
        multiplayerForm.customPrompt ?? DEFAULT_DM_PROMPT, // Use default if no custom prompt
        multiplayerForm.maxPlayers
      );
      
      if (result) {
        setShowCreateMultiplayer(false);
        setMultiplayerForm({ name: '', customPrompt: '', maxPlayers: 6 });
        
        // Auto-prompt to invite friends after creation
        if (result.shouldInvite) {
          setSelectedSessionId(result.sessionId);
          setShowInviteFriends(true);
        }
      } else {
        console.error('🔥 Multiplayer session creation failed - no result returned');
      }
    } catch {
      console.error('🔥 Error creating multiplayer session:', _error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSession = (session: Session) => {
    setCurrentSession(session);
    // Navigate using React Router to avoid page reload
    navigate('/maindashboard');
  };

  const { joinAndSetupMultiplayerSession } = useMultiplayerSessionManager();

  interface MultiplayerSession {
    id: string;
    name: string;
    messages: unknown[];
    customPrompt: string;
    createdAt: string | Date;
    updatedAt?: string | Date;
    isMultiplayer: boolean;
    maxPlayers: number;
    currentPlayerCount: number;
    owner_username?: string;
    created_at?: string;
    world?: number;
  }

  const handleJoinMultiplayerSession = async (session: MultiplayerSession) => {
    try {
      // Let server-side function enforce max players and membership rules
      const joined = await joinAndSetupMultiplayerSession(
        session.id,
        setCurrentSession,
        (path: string) => navigate(path)
      );

      if (!joined) {
        console.error('Failed to join multiplayer session');
      }
    } catch {
      console.error('Error joining multiplayer session:', _error);
    }
  };

  const handleInviteFriends = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowInviteFriends(true);
  };

  const handleSendInvite = async (friendId: string) => {
    await sendSessionInvite(selectedSessionId, friendId);
    setShowInviteFriends(false);
  };

  return (
    <div className="min-h-screen space-y-4 bg-background p-3 sm:space-y-6 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
              <h1 className="text-gradient-primary text-2xl font-bold sm:text-3xl">Adventure Sessions</h1>
              <p className="text-sm text-foreground-muted sm:text-base">Manage your solo and multiplayer D&D adventures</p>
            </div>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <WorldSelector 
              currentWorld={currentWorld}
              onWorldChange={setCurrentWorld}
            />
            {user && (
              <div className="flex gap-2">
                <Button onClick={handleCreateSession} disabled={isCreating} variant="outline" size="sm">
                  <Plus className="mr-2 size-4" />
                  <span className="hidden sm:inline">Solo Adventure</span>
                  <span className="sm:hidden">Solo</span>
                </Button>
                <Button 
                  onClick={() => setShowCreateMultiplayer(true)} 
                  disabled={isCreating}
                  size="sm"
                  className="bg-gradient-to-r from-primary/90 to-accent/90 hover:from-primary hover:to-accent"
                >
                  <Star className="mr-2 size-4" />
                  <span className="hidden sm:inline">Multiplayer Adventure</span>
                  <span className="sm:hidden">Multiplayer</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Adventures</TabsTrigger>
          <TabsTrigger value="solo">Solo Adventures</TabsTrigger>
          <TabsTrigger value="multiplayer">Multiplayer Adventures</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {user && <SessionInvitePanel className="w-full" />}

          {/* Combined Sessions Display */}
          {sessions.length > 0 || multiplayerSessions.length > 0 ? (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {/* Multiplayer Sessions First - with gold styling */}
              {multiplayerSessions.map((session, _index) => (
                <MultiplayerSessionCard
                  key={`mp-${session.id}`}
                  session={session}
                  isActive={currentSession?.id === session.id}
                  onJoin={handleJoinMultiplayerSession}
                  onInviteFriends={handleInviteFriends}
                  onLeaveSession={leaveSession}
                  currentUserId={user?.id}
                />
              ))}
              
              {/* Solo Sessions */}
              {sessions.map((session, _index) => (
                <motion.div
                  key={`solo-${session.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: (multiplayerSessions.length + index) * 0.1 }}
                >
                  <Card className="border-primary/20 transition-all duration-200 hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{session.name}</span>
                        <div className="flex items-center gap-2">
                          {currentSession?.id === session.id && (
                            <Badge variant="secondary" className="text-xs">
                              <Play className="mr-1 size-3" />
                              Active
                            </Badge>
                          )}
                          <Badge variant="outline">
                            <Users className="mr-1 size-3" />
                            {session.messages.length}
                          </Badge>
                        </div>
                      </CardTitle>
                      <CardDescription>
                        {session.messages.length > 0 
                          ? `${session.messages.length} messages in solo adventure`
                          : 'New solo adventure awaiting your first move'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-foreground-muted">
                          <Calendar className="mr-2 size-4" />
                          Created {formatDistanceToNow(session.createdAt, { addSuffix: true })}
                        </div>
                        {session.updatedAt && (
                          <div className="flex items-center text-sm text-foreground-muted">
                            <Clock className="mr-2 size-4" />
                            Updated {formatDistanceToNow(session.updatedAt, { addSuffix: true })}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant={currentSession?.id === session.id ? "default" : "outline"} 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleJoinSession(session)}
                          >
                            {currentSession?.id === session.id ? 'Continue Playing' : 'Join Session'}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              if (confirm(`Delete "${session.name}"? This cannot be undone.`)) {
                                try {
                                  // Delete from both local state and server
                                  const { error } = await supabase
                                    .from('sessions')
                                    .delete()
                                    .eq('id', session.id)
                                    .eq('user_id', user?.id);
                                  
                                  if (error) throw new Error("Operation failed");
                                  
                                  // If it's the current session, clear it
                                  if (currentSession?.id === session.id) {
                                    setCurrentSession(null);
                                  }
                                  
                                  // Refresh the page or update state
                                  window.location.reload();
                                } catch {
                                  console.error('Error deleting session:', _error);
                                  alert('Failed to delete session');
                                }
                              }
                            }}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            Delete
                          </Button>
                        </div>
                        {!session.isSynced && (
                          <div className="flex items-center text-xs text-yellow-500">
                            <Clock className="mr-1 size-3" />
                            Syncing to cloud...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="py-12 text-center"
            >
              <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-primary/10">
                <Users className="size-12 text-primary" />
              </div>
              <h2 className="text-gradient-primary mb-3 text-2xl font-semibold">Ready for Adventure?</h2>
              <p className="mx-auto mb-6 max-w-md text-foreground-muted">
                Create your first D&D session and embark on an epic journey. Go solo or invite friends for multiplayer adventures!
              </p>
              <div className="flex justify-center gap-4">
                <Button onClick={handleCreateSession} disabled={isCreating} size="lg" variant="outline">
                  <Plus className="mr-2 size-5" />
                  Solo Adventure
                </Button>
                <Button 
                  onClick={() => setShowCreateMultiplayer(true)} 
                  disabled={isCreating} 
                  size="lg"
                  className="bg-gradient-to-r from-primary/90 to-accent/90 hover:from-primary hover:to-accent"
                >
                  <Star className="mr-2 size-5" />
                  Multiplayer Adventure
                </Button>
              </div>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="solo" className="space-y-6">
          {sessions.length > 0 ? (<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session, _index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="border-primary/20 transition-all duration-200 hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{session.name}</span>
                        <div className="flex items-center gap-2">
                          {currentSession?.id === session.id && (
                            <Badge variant="secondary" className="text-xs">
                              <Play className="mr-1 size-3" />
                              Active
                            </Badge>
                          )}
                          <Badge variant="outline">
                            <Users className="mr-1 size-3" />
                            {session.messages.length}
                          </Badge>
                        </div>
                      </CardTitle>
                      <CardDescription>
                        {session.messages.length > 0 
                          ? `${session.messages.length} messages in solo adventure`
                          : 'New solo adventure awaiting your first move'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-foreground-muted">
                          <Calendar className="mr-2 size-4" />
                          Created {formatDistanceToNow(session.createdAt, { addSuffix: true })}
                        </div>
                        {session.updatedAt && (
                          <div className="flex items-center text-sm text-foreground-muted">
                            <Clock className="mr-2 size-4" />
                            Updated {formatDistanceToNow(session.updatedAt, { addSuffix: true })}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant={currentSession?.id === session.id ? "default" : "outline"} 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleJoinSession(session)}
                          >
                            {currentSession?.id === session.id ? 'Continue Playing' : 'Join Session'}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              if (confirm(`Delete "${session.name}"? This cannot be undone.`)) {
                                try {
                                  // Delete from both local state and server
                                  const { error } = await supabase
                                    .from('sessions')
                                    .delete()
                                    .eq('id', session.id)
                                    .eq('user_id', user?.id);
                                  
                                  if (error) throw new Error("Operation failed");
                                  
                                  // If it's the current session, clear it
                                  if (currentSession?.id === session.id) {
                                    setCurrentSession(null);
                                  }
                                  
                                  // Refresh the page or update state
                                  window.location.reload();
                                } catch {
                                  console.error('Error deleting session:', _error);
                                  alert('Failed to delete session');
                                }
                              }
                            }}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            Delete
                          </Button>
                        </div>
                        {!session.isSynced && (
                          <div className="flex items-center text-xs text-yellow-500">
                            <Clock className="mr-1 size-3" />
                            Syncing to cloud...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-primary/10">
                <Users className="size-12 text-primary" />
              </div>
              <h2 className="text-gradient-primary mb-3 text-2xl font-semibold">No Solo Adventures Yet</h2>
              <p className="mx-auto mb-6 max-w-md text-foreground-muted">
                Create a solo adventure for a personal D&D experience with our AI Dungeon Master.
              </p>
              <Button onClick={handleCreateSession} disabled={isCreating} size="lg">
                <Plus className="mr-2 size-5" />
                Create Solo Adventure
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="multiplayer" className="space-y-6">
          {user && <SessionInvitePanel className="w-full" />}
          
          {/* User's Multiplayer Sessions */}
          {multiplayerSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Crown className="size-5" />
                <span>Your Multiplayer Adventures</span>
                <Badge variant="outline">{multiplayerSessions.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {multiplayerSessions.map((session) => (
                  <MultiplayerSessionCard
                    key={session.id}
                    session={session}
                    isActive={currentSession?.id === session.id}
                    onJoin={handleJoinMultiplayerSession}
                    onInviteFriends={handleInviteFriends}
                    onLeaveSession={leaveSession}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            </div>
          )}
            
          {/* Discoverable Sessions */}
          {discoverableSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Globe className="size-5" />
                <span>Public Adventures in World {currentWorld}</span>
                <Badge variant="outline">{discoverableSessions.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {discoverableSessions.map((session: MultiplayerSession) => (
                  <Card key={session.id} className="border-accent/20 transition-all duration-200 hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{session.name}</span>
                        <Badge variant="secondary">
                          {session.current_player_count}/{session.max_players}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Created by {session.owner_username ?? 'Unknown Player'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-foreground-muted">
                          <Calendar className="mr-2 size-4" />
                          Created {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                        </div>
                        <div className="flex items-center text-sm text-accent-foreground">
                          <Globe className="mr-2 size-4" />
                          World {session.world}
                        </div>
                        <div className="pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full border-accent/30 hover:bg-accent/10"
                            onClick={() => handleJoinMultiplayerSession(session)}
                          >
                            Join Adventure
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty state - only show when both lists are empty */}
          {multiplayerSessions.length === 0 && discoverableSessions.length === 0 && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
                <Crown className="size-12 text-primary" />
              </div>
              <h2 className="mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-2xl font-semibold text-transparent">
                No Multiplayer Adventures Yet
              </h2>
              <p className="mx-auto mb-6 max-w-md text-foreground-muted">
                Create a multiplayer adventure and invite your friends for epic collaborative campaigns!
              </p>
              <Button 
                onClick={() => setShowCreateMultiplayer(true)} 
                disabled={isCreating} 
                size="lg"
                className="bg-gradient-to-r from-primary/90 to-accent/90 hover:from-primary hover:to-accent"
              >
                <Star className="mr-2 size-5" />
                Create Multiplayer Adventure
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Multiplayer Session Modal */}
      <Dialog open={showCreateMultiplayer} onOpenChange={setShowCreateMultiplayer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="size-5 text-primary" />
              Create Multiplayer Adventure
            </DialogTitle>
            <DialogDescription>
              Set up a new multiplayer D&D session that your friends can join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mp-name">Adventure Name</Label>
              <Input
                id="mp-name"
                placeholder="The Lost Mines of Phandelver"
                value={multiplayerForm.name}
                onChange={(e) => setMultiplayerForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="mp-prompt">Custom DM Instructions (Optional)</Label>
              <Textarea
                id="mp-prompt"
                placeholder="Leave empty to use the default comprehensive D&D 5e system prompt..."
                value={multiplayerForm.customPrompt}
                onChange={(e) => setMultiplayerForm(prev => ({ ...prev, customPrompt: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="mp-max-players">Max Players</Label>
              <Input
                id="mp-max-players"
                type="number"
                min="2"
                max="8"
                value={multiplayerForm.maxPlayers}
                onChange={(e) => setMultiplayerForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 6 }))}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreateMultiplayer(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary/90 to-accent/90 hover:from-primary hover:to-accent"
                onClick={handleCreateMultiplayerSession}
                disabled={isCreating || !multiplayerForm.name}
              >
                {isCreating ? 'Creating...' : 'Create Adventure'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Friends Modal */}
      <Dialog open={showInviteFriends} onOpenChange={setShowInviteFriends}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" />
              Invite Friends
            </DialogTitle>
            <DialogDescription>
              Choose friends to invite to this multiplayer adventure.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {friends.length > 0 ? (
              friends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
                      <span className="text-sm font-medium">
                        {friend.friend_profile?.username?.[0]?.toUpperCase() ?? 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {getDisplayName({
                          id: friend.friend_profile?.id ?? '',
                          username: friend.friend_profile?.username ?? '',
                          display_name: friend.friend_profile?.display_name
                        })}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`size-2 rounded-full ${
                          friend.friend_profile?.is_online ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <span className="text-xs text-muted-foreground">
                          {friend.friend_profile?.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendInvite(friend.friend_id)}
                    className="bg-primary/10 hover:bg-primary/20"
                  >
                    <UserPlus className="mr-1 size-4" />
                    Invite
                  </Button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <UserPlus className="mx-auto mb-3 size-12 opacity-50" />
                <p>No friends to invite</p>
                <p className="text-sm">Add friends first to invite them to adventures!</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sessions;
