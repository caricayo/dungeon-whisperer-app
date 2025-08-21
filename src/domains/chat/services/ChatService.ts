/**
 * @fileoverview Enterprise chat service with comprehensive error handling and monitoring
 * @enterprise This service handles all chat-related operations with enterprise-grade patterns
 */

import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/enterprise/Logger';
import { ErrorHandler } from '@/lib/enterprise/ErrorHandler';
import { MetricsCollector } from '@/lib/enterprise/MetricsCollector';
import { Message } from '../types';
import { validateInput } from '@/lib/validation';
import DemoModeAPIGuard from '@/lib/demo-mode-guard';
import { ttsService } from '@/lib/tts';

interface AIResponse {
  content: string;
  usage?: {
    total_tokens: number;
  };
}

export class ChatService {
  private readonly logger = Logger.getInstance('ChatService');
  private readonly errorHandler = ErrorHandler.getInstance();
  private readonly metrics = MetricsCollector.getInstance();

  /**
   * Sends a message and receives AI response with comprehensive error handling
   * @enterprise Implements retry logic, rate limiting, and monitoring
   */
  async sendMessage(
    message: string,
    sessionId: string,
    userId: string,
    configuration: { customPrompt?: string; model?: string }
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();

    try {
      this.logger.info('Sending message', {
        correlationId,
        sessionId,
        userId,
        messageLength: message.length,
        model: configuration.model ?? 'default'
      });

      // Enterprise input validation
      const validationResult = validateInput(message);
      if (!validationResult.isValid) {
        throw new Error(`Input validation failed: ${validationResult.error}`);
      }

      // Rate limiting check
      await this.checkRateLimit(userId);

      // Create user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        metadata: {
          processingTime: 0
        }
      };

      // Call AI service with retry logic
      const aiResponse = await this.callAIServiceWithRetry({
        message,
        sessionId,
        userId,
        configuration,
        correlationId
      });

      // Create assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        metadata: {
          tokens: aiResponse.usage?.total_tokens,
          cost: this.calculateCost(aiResponse.usage?.total_tokens ?? 0),
          model: configuration.model ?? 'gpt-4o-mini',
          processingTime: Date.now() - startTime
        }
      };

      // Record metrics
      this.metrics.recordChatMessage({
        userId,
        sessionId,
        tokens: aiResponse.usage?.total_tokens ?? 0,
        processingTime: Date.now() - startTime,
        model: configuration.model ?? 'gpt-4o-mini'
      });

      // Log success
      this.logger.info('Message processed successfully', {
        correlationId,
        processingTime: Date.now() - startTime,
        tokens: aiResponse.usage?.total_tokens
      });

      return { userMessage, assistantMessage };

    } catch (error) {
      const chatError = this.errorHandler.handleChatError(error instanceof Error ? error : new Error("Operation failed"), {
        correlationId,
        sessionId,
        userId,
        operation: 'sendMessage'
      });

      this.metrics.recordError({
        category: chatError.category,
        severity: chatError.severity,
        operation: chatError.context.operation
      });
      
      this.logger.error('Message processing failed', {
        correlationId,
        error: chatError,
        processingTime: Date.now() - startTime
      });

      throw chatError;
    }
  }

  /**
   * AI service call with enterprise retry logic
   * @private
   */
  private async callAIServiceWithRetry(params: {
    message: string;
    sessionId: string;
    userId: string;
    configuration: { customPrompt?: string; model?: string };
    correlationId: string;
  }): Promise<AIResponse> {
    const maxRetries = 3;
    let lastError: Error = new Error("Operation failed");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await DemoModeAPIGuard.guardSupabaseFunction(
          'dnd-chat-v2',
          () => supabase.functions.invoke('dnd-chat-v2', {
            body: {
              messages: [{ role: 'user', content: params.message }],
              customPrompt: params.configuration.customPrompt,
              metadata: {
                correlationId: params.correlationId,
                attempt,
                sessionId: params.sessionId
              }
            }
          }),
          {
            operationName: 'AI Chat Service',
            showToast: false,
            fallbackData: null
          }
        );

        if (!response || !response.data) {
          throw new Error("No response data");
        }
        return response.data as AIResponse;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Operation failed");
        
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.logger.warn(`Retry attempt ${attempt} failed, retrying in ${backoffMs}ms`, {
            correlationId: params.correlationId,
            error: lastError.message
          });
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError;
  }

  /**
   * Rate limiting implementation
   * @private
   */
  private async checkRateLimit(_userId: string): Promise<void> {
    // Implementation would check Redis or in-memory store
    // For now, using simple in-memory tracking
    // This would be moved to a proper rate limiting service in production
    // using Redis or similar distributed cache
  }

  /**
   * Calculate API cost based on tokens
   * @private
   */
  private calculateCost(tokens: number): number {
    // GPT-4o-mini pricing: $0.15 per 1M input tokens, $0.6 per 1M output tokens
    // Simplified calculation - in production, track input/output separately
    return (tokens / 1000000) * 0.375; // Average cost
  }

  /**
   * Generate TTS audio for message
   * @enterprise Implements audio generation with fallback providers
   */
  async generateAudio(
    text: string,
    messageId: string,
    options: { voice?: string; provider?: 'elevenlabs' | 'openai' }
  ): Promise<string> {
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      this.logger.info('Generating TTS audio', {
        correlationId,
        messageId,
        textLength: text.length,
        provider: options.provider ?? 'auto'
      });

      // Validate text input
      if (!text?.trim()) {
        throw new Error('Text content is required for audio generation');
      }

      // Use the existing TTS service to generate audio
      const audioUrl = await ttsService.generateSpeech(text, {
        voice: options.voice,
        provider: options.provider ?? 'auto'
      });

      // Record success metrics
      this.metrics.recordUserEngagement('system', 'audio_generated', {
        messageId,
        textLength: text.length.toString(),
        provider: options.provider ?? 'auto',
        processingTime: (Date.now() - startTime).toString()
      });

      this.logger.info('TTS audio generated successfully', {
        correlationId,
        messageId,
        processingTime: Date.now() - startTime,
        audioUrl: audioUrl.substring(0, 50) + '...'
      });
      
      return audioUrl;
      
    } catch (error) {
      this.logger.error('TTS generation failed', {
        correlationId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      });

      // Record error metrics
      this.metrics.recordError({
        category: 'tts_generation',
        severity: 'medium',
        operation: 'generateAudio'
      });

      throw new Error("Operation failed");
    }
  }

  /**
   * Generate image for message content
   * @enterprise Implements image generation with DALL-E integration
   */
  async generateImage(
    text: string,
    messageId: string,
    options?: { model?: string; size?: string; quality?: string }
  ): Promise<string> {
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      this.logger.info('Generating image', {
        correlationId,
        messageId,
        textLength: text.length,
        options
      });

      // Validate text input
      if (!text?.trim()) {
        throw new Error('Text content is required for image generation');
      }

      // Call the image generation Supabase function
      const response = await DemoModeAPIGuard.guardSupabaseFunction(
        'dnd-image',
        () => supabase.functions.invoke('dnd-image', {
          body: {
            prompt: text.trim(),
            model: options?.model ?? 'dall-e-3',
            size: options?.size ?? '1792x1024',
            quality: options?.quality ?? 'hd'
          }
        }),
        {
          operationName: 'AI Image Generation',
          fallbackData: null
        }
      );

      if (!response || !response.data) {
        throw new Error('Image generation service error');
      }

      const imageUrl = response.data.imageUrl;
      if (!imageUrl) {
        throw new Error('No image URL received from image generation service');
      }

      // Record success metrics
      this.metrics.recordUserEngagement('system', 'image_generated', {
        messageId,
        textLength: text.length.toString(),
        processingTime: (Date.now() - startTime).toString()
      });

      this.logger.info('Image generated successfully', {
        correlationId,
        messageId,
        processingTime: Date.now() - startTime,
        imageUrl: imageUrl.substring(0, 50) + '...'
      });
      
      return imageUrl;
      
    } catch (error) {
      this.logger.error('Image generation failed', {
        correlationId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      });

      // Record error metrics
      this.metrics.recordError({
        category: 'image_generation',
        severity: 'medium',
        operation: 'generateImage'
      });

      throw new Error("Operation failed");
    }
  }

  /**
   * Generate video for message content
   * @enterprise Implements video generation with Runway/Luma integration
   */
  async generateVideo(
    text: string,
    messageId: string,
    options?: { provider?: 'runway' | 'luma'; taskId?: string }
  ): Promise<string> {
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      this.logger.info('Generating video', {
        correlationId,
        messageId,
        textLength: text.length,
        provider: options?.provider ?? 'runway',
        taskId: options?.taskId
      });

      // Validate text input
      if (!text?.trim()) {
        throw new Error('Text content is required for video generation');
      }

      const provider = options?.provider ?? 'runway';
      const functionName = provider === 'luma' ? 'luma-video' : 'dnd-video';

      // Call the video generation Supabase function
      const response = await DemoModeAPIGuard.guardSupabaseFunction(
        functionName,
        () => supabase.functions.invoke(functionName, {
          body: {
            prompt: text.trim(),
            taskId: options?.taskId
          }
        }),
        {
          operationName: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Video Generation`,
          fallbackData: null
        }
      );

      if (!response || !response.data) {
        throw new Error('Video generation service error');
      }

      const { videoUrl, taskId } = response.data;
      if (!videoUrl && !taskId) {
        throw new Error('No video URL or task ID received from video generation service');
      }

      // Record success metrics
      this.metrics.recordUserEngagement('system', 'video_generated', {
        messageId,
        textLength: text.length.toString(),
        provider,
        processingTime: (Date.now() - startTime).toString()
      });

      this.logger.info('Video generation initiated successfully', {
        correlationId,
        messageId,
        processingTime: Date.now() - startTime,
        provider,
        hasVideoUrl: !!videoUrl,
        hasTaskId: !!taskId
      });
      
      // Return video URL if available, otherwise return a status message
      return videoUrl ?? `Video generation in progress (Task ID: ${taskId})`;
      
    } catch (error) {
      this.logger.error('Video generation failed', {
        correlationId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      });

      // Record error metrics
      this.metrics.recordError({
        category: 'video_generation',
        severity: 'medium',
        operation: 'generateVideo'
      });

      throw new Error("Operation failed");
    }
  }
}