
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { GenerationLogs } from '@/components/GenerationLogs';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Save, 
  Upload, 
  Image as ImageIcon, 
  Video,
  Clapperboard,
  Dice6,
  Scroll,
  LogOut,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Users,
  Cloud,
  CloudOff,
  Loader2,
  Mail
} from 'lucide-react';
import { SocialPanel } from '@/components/SocialPanel';

import { debugLog, debugError } from '@/lib/debug';
import { logger } from '@/lib/logger';
import type { GameSession } from '@/types/session';

interface GenerationLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface AppSidebarProps {
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (session: GameSession) => void;
  createSession: (name: string, prompt: string) => void;
  deleteSession: (id: string) => void;
  exportSession: (session: GameSession) => void;
  importSession: (file: File) => Promise<void>;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showLogs: boolean;
  setShowLogs: (show: boolean) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  saveSession: (session: GameSession) => void;
  hasApiKey: boolean;
  setHasApiKey: (has: boolean) => void;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  isGeneratingVideoAlt: boolean;
  generateImage: () => void;
  generateVideoRunway: () => void;
  generateVideoAlternative: () => void;
  generationLogs: GenerationLog[];
  onRetryFailed?: () => void;
  onUsageWarning?: (service: string, usage: number) => void;
}

export function AppSidebar({
  sessions,
  currentSession,
  setCurrentSession,
  createSession,
  deleteSession,
  exportSession,
  importSession,
  showSettings,
  setShowSettings,
  showLogs,
  setShowLogs,
  customPrompt: _customPrompt,
  setCustomPrompt: _setCustomPrompt,
  saveSession: _saveSession,
  hasApiKey: _hasApiKey,
  setHasApiKey: _setHasApiKey,
  isGeneratingImage,
  isGeneratingVideo,
  isGeneratingVideoAlt,
  generateImage,
  generateVideoRunway,
  generateVideoAlternative,
  generationLogs,
  onRetryFailed: _onRetryFailed,
  onUsageWarning: _onUsageWarning
}: AppSidebarProps) {
  const { open } = useSidebar();
  const [showSocial, setShowSocial] = useState(false);
  const [showAdventures, setShowAdventures] = useState(true);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await importSession(file);
        toast({
          title: "Import Successful! 📁",
          description: "Your session has been imported and is now ready to use.",
          duration: 5000,
        });
      } catch (error) {
        toast({
          title: "Import Error",
          description: error instanceof Error ? error.message : "Failed to import session",
          variant: "destructive",
        });
      }
    }
    e.target.value = '';
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    try {
      await deleteSession(sessionId);
      toast({
        title: "Adventure Deleted",
        description: "Your adventure has been successfully removed.",
      });
    } catch (error) {
      debugError('Failed to delete session:', error);
    } finally {
      setDeletingSessionId(null);
    }
  };


  const handleSessionClick = (session: GameSession) => {
    debugLog('📖 Session clicked:', session.id);
    setCurrentSession(session);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-4">
        {open && (
          <div className="flex items-center gap-2">
            <Dice6 className="size-6 text-primary" />
            <h2 className="text-lg font-bold">D&D Assistant</h2>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1">
          {/* Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/maindashboard" 
                      className={({ isActive }) => 
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }
                    >
                      <Dice6 className="size-4" />
                      {open && <span>Main Dashboard</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/sessions" 
                      className={({ isActive }) => 
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }
                    >
                      <Scroll className="size-4" />
                      {open && <span>Adventure Sessions</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user && (
                  <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/friends" 
                      className={({ isActive }) => 
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }
                    >
                      <Users className="size-4" />
                      {open && <span>Friends</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/inbox" 
                      className={({ isActive }) => 
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }
                    >
                      <Mail className="size-4" />
                      {open && <span>Inbox</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to="/settings" 
                          className={({ isActive }) => 
                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }
                        >
                          <Settings className="size-4" />
                          {open && <span>Settings</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* Adventures - Collapsible */}
          <SidebarGroup>
            <Collapsible open={showAdventures} onOpenChange={setShowAdventures}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="flex cursor-pointer items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <div className="flex items-center gap-2">
                    <Scroll className="size-4" />
                    {open && <span>Adventures ({sessions.length})</span>}
                  </div>
                  {open && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          createSession(`Adventure ${sessions.length + 1}`, customPrompt);
                        }}
                        className="size-6 p-0"
                      >
                        <Plus className="size-3" />
                      </Button>
                      {showAdventures ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </div>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              {open && (
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {sessions.slice(0, 10).map((session) => (
                        <SidebarMenuItem key={session.id}>
                          <div className={`group relative flex items-center rounded-md transition-colors ${
                            currentSession?.id === session.id 
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                              : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          } ${session.isMultiplayer ? 'bg-gradient-to-r from-primary/5 to-transparent ring-2 ring-primary/20' : ''}`}>
                            <div 
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 truncate p-2"
                              onClick={() => handleSessionClick(session)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSessionClick(session);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              {session.isMultiplayer ? (
                                <Users className="size-4 shrink-0 text-primary" />
                              ) : (
                                <Scroll className="size-4 shrink-0" />
                              )}
                              <span className={`truncate ${session.isMultiplayer ? 'font-medium' : ''}`}>
                                {session.name}
                              </span>
                              {session.isMultiplayer && (
                                <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-xs text-primary">
                                  MP
                                </Badge>
                              )}
                              {user && (
                                <div className="shrink-0" title={session.isSynced === false ? "Not synced to server" : "Synced to server"}>
                                  {session.isSynced === false ? (
                                    <CloudOff className="size-3 text-orange-500" />
                                  ) : (
                                    <Cloud className="size-3 text-green-500" />
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Delete Button */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mr-1 size-6 p-0 opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={deletingSessionId === session.id}
                                >
                                  {deletingSessionId === session.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Adventure</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{session.name}"? This action cannot be undone and all messages will be permanently lost.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteSession(session.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Adventure
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              )}
            </Collapsible>
          </SidebarGroup>

          {/* Social System */}
          <SidebarGroup>
            <Collapsible open={showSocial} onOpenChange={setShowSocial}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="flex cursor-pointer items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="size-4" />
                    {open && <span>Social</span>}
                  </div>
                  {open && (
                    showSocial ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              {open && (
                <CollapsibleContent>
                  <SidebarGroupContent className="px-2">
                    <SocialPanel isOpen={showSocial} />
                  </SidebarGroupContent>
                </CollapsibleContent>
              )}
            </Collapsible>
          </SidebarGroup>

          {/* Generation Tools */}
          {open && (
            <SidebarGroup>
              <SidebarGroupLabel>Generation Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateImage}
                      disabled={isGeneratingImage}
                      className="w-full justify-start"
                    >
                      {isGeneratingImage ? (
                        <div className="flex items-center gap-2">
                          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span>Generating...</span>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="mr-2 size-4" />
                          Generate Scene
                        </>
                      )}
                    </Button>
                  </SidebarMenuItem>
                  
                  <SidebarMenuItem>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        logger.debug('Runway video generation initiated', {
                          functionType: typeof generateVideoRunway,
                          isGenerating: isGeneratingVideo
                        });
                        try {
                          generateVideoRunway();
                        } catch (error) {
                          logger.error('Error calling generateVideoRunway', { error: error instanceof Error ? error.message : String(error) });
                        }
                      }}
                      disabled={isGeneratingVideo}
                      className="w-full justify-start"
                    >
                      {isGeneratingVideo ? (
                        <div className="flex items-center gap-2">
                          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span>Creating...</span>
                        </div>
                      ) : (
                        <>
                          <Video className="mr-2 size-4" />
                          Runway Video
                        </>
                      )}
                    </Button>
                  </SidebarMenuItem>
                  
                  <SidebarMenuItem>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateVideoAlternative}
                      disabled={isGeneratingVideoAlt}
                      className="w-full justify-start"
                    >
                      {isGeneratingVideoAlt ? (
                        <div className="flex items-center gap-2">
                          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span>Creating...</span>
                        </div>
                      ) : (
                        <>
                          <Clapperboard className="mr-2 size-4" />
                          Luma Video
                        </>
                      )}
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* System Status and API Usage moved to Settings page per user request */}

          {/* Session Management */}
          {open && (
            <SidebarGroup>
              <SidebarGroupLabel>Session Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => currentSession && exportSession(currentSession)}
                      disabled={!currentSession}
                      className="w-full justify-start"
                    >
                      <Save className="mr-2 size-4" />
                      Export Session
                    </Button>
                  </SidebarMenuItem>
                  
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => document.getElementById('file-import')?.click()}
                      className="w-full justify-start"
                    >
                      <Upload className="mr-2 size-4" />
                      Import Session
                    </Button>
                    <input
                      id="file-import"
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={handleFileImport}
                    />
                  </SidebarMenuItem>
                  
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLogs(!showLogs)}
                      className="w-full justify-start"
                    >
                      {showLogs ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
                      {showLogs ? 'Hide' : 'Show'} Logs
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Settings */}
          {open && (
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="w-full justify-start"
                    >
                      <Settings className="mr-2 size-4" />
                      {showSettings ? 'Hide' : 'Show'} Settings
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          
          {/* Generation Logs */}
          <GenerationLogs 
            logs={generationLogs} 
            isVisible={showLogs} 
            className="mx-2 mb-4"
          />
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        {open && user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xs font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="max-w-[120px] truncate text-xs font-medium">
                  {user.email}
                </span>
                <Badge variant="outline" className="w-fit text-xs">
                  Ready
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                toast({
                  title: "Signed Out",
                  description: "You have been securely signed out.",
                });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
