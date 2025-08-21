export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoTaskId?: string;
  isGeneratingAudio?: boolean;
  ttsError?: string;
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  customPrompt: string;
  createdAt: Date;
  updatedAt: Date;
  isSynced?: boolean;
  isMultiplayer?: boolean;
}

export type GameSession = Session;