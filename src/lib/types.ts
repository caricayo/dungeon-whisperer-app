export interface User {
  id: string;
  email?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  custom_prompt?: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
  started_at?: string;
  ended_at?: string;
  is_multiplayer: boolean;
  current_player_count: number;
  max_players?: number;
  campaign_id?: string;
  initiative_order?: unknown;
  scene_data?: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    cost?: number;
  };
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  role: 'dm' | 'player';
  joined_at: string;
  permissions: {
    can_invite?: boolean;
    can_manage?: boolean;
  };
  profile?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  };
}

export interface SessionInvite {
  id: string;
  session_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  session?: {
    name: string;
    title?: string;
  };
  inviter?: {
    username: string;
    display_name?: string;
  };
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
  friend_profile?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
    last_seen?: string;
  };
}

export interface DatabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: DatabaseError;
  success: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}