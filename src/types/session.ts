// Session-related TypeScript interfaces

export interface SessionMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  userId?: string;
  username?: string;
}

export interface GameSession {
  id: string;
  name: string;
  messages: SessionMessage[];
  participants?: SessionParticipant[];
  isMultiplayer?: boolean;
  isSynced?: boolean;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
  isPublic?: boolean;
  settings?: SessionSettings;
}

export interface SessionParticipant {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  role: 'player' | 'dm' | 'observer';
  joinedAt: Date;
  isOnline?: boolean;
  avatar?: string;
}

export interface SessionSettings {
  systemPrompt?: string;
  voiceEnabled?: boolean;
  imageGeneration?: boolean;
  videoGeneration?: boolean;
  maxParticipants?: number;
  allowSpectators?: boolean;
}

export interface SessionJoinResult {
  success: boolean;
  message?: string;
  error?: string;
  session?: GameSession;
  last30Messages?: SessionMessage[];
}

export interface UserPresence {
  userId: string;
  username?: string;
  displayName?: string;
  isOnline: boolean;
  lastSeen: Date;
  sessionId?: string;
  avatar?: string;
}

export interface WorldUser {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  lastSeen: Date;
  isOnline: boolean;
}