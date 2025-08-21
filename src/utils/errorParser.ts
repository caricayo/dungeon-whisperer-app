import type { ErrorInfo, ErrorType } from '@/components/ErrorHandler';

// Helper function to parse and categorize errors
export const parseError = (error: unknown, service: string): ErrorInfo => {
  const message = error instanceof Error ? error.message : String(error);
  const timestamp = new Date();
  
  // Categorize based on message content
  if (message.includes('quota') || message.includes('billing') || message.includes('credit')) {
    return {
      type: 'quota_exceeded' as ErrorType,
      service,
      message: `API quota exhausted for ${service}`,
      technicalDetails: message,
      timestamp
    };
  }
  
  if (message.includes('unauthorized') || message.includes('invalid') || message.includes('key')) {
    return {
      type: 'invalid_key' as ErrorType,
      service,
      message: `Authentication failed for ${service}`,
      technicalDetails: message,
      timestamp
    };
  }
  
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return {
      type: 'rate_limit' as ErrorType,
      service,
      message: `Rate limit reached for ${service}`,
      technicalDetails: message,
      timestamp
    };
  }
  
  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return {
      type: 'network_error' as ErrorType,
      service,
      message: `Network connection issue`,
      technicalDetails: message,
      timestamp
    };
  }
  
  if (message.includes('unavailable') || message.includes('maintenance') || message.includes('503')) {
    return {
      type: 'service_unavailable' as ErrorType,
      service,
      message: `${service} is temporarily unavailable`,
      technicalDetails: message,
      timestamp
    };
  }
  
  return {
    type: 'unknown' as ErrorType,
    service,
    message: `Unexpected error with ${service}`,
    technicalDetails: message,
    timestamp
  };
};