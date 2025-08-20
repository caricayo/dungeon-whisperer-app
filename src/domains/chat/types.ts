/**
 * @fileoverview Core chat domain types and interfaces
 * @enterprise This file defines the foundational types for the chat domain
 */

import { z } from 'zod';

// Enterprise-grade message schema with validation
export const MessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10000),
  timestamp: z.date(),
  metadata: z.object({
    tokens: z.number().optional(),
    cost: z.number().optional(),
    model: z.string().optional(),
    processingTime: z.number().optional(),
  }).optional(),
  attachments: z.object({
    imageUrl: z.string().url().optional(),
    audioUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    videoTaskId: z.string().optional(),
  }).optional(),
  status: z.object({
    isGeneratingAudio: z.boolean().default(false),
    isError: z.boolean().default(false),
    retryCount: z.number().default(0),
  }).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Enterprise session schema
export const SessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  messages: z.array(MessageSchema),
  configuration: z.object({
    customPrompt: z.string().max(5000).default(''),
    model: z.string().default('gpt-4o-mini'),
    maxTokens: z.number().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
  metadata: z.object({
    createdAt: z.date(),
    updatedAt: z.date().optional(),
    participantCount: z.number().default(1),
    isMultiplayer: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
  syncStatus: z.object({
    isSynced: z.boolean().default(false),
    lastSyncAt: z.date().optional(),
    syncError: z.string().optional(),
  }).optional(),
});

export type Session = z.infer<typeof SessionSchema>;

// Enterprise error types
export interface ChatError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  context: {
    sessionId?: string;
    messageId?: string;
    userId?: string;
    operation: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
}

// Enterprise event types for analytics
export interface ChatEvent {
  type: 'message_sent' | 'message_received' | 'error_occurred' | 'session_created';
  timestamp: Date;
  userId: string;
  sessionId: string;
  metadata: Record<string, unknown>;
}

// Configuration types
export interface ChatConfiguration {
  apiEndpoints: {
    chat: string;
    tts: string;
    image: string;
    video: string;
  };
  limits: {
    maxMessagesPerSession: number;
    maxSessionsPerUser: number;
    rateLimit: {
      messages: number;
      windowMs: number;
    };
  };
  features: {
    ttsEnabled: boolean;
    imageGenerationEnabled: boolean;
    videoGenerationEnabled: boolean;
    multiplayerEnabled: boolean;
  };
}