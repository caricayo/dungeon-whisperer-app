import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { debugError } from '@/lib/debug';

interface ErrorDetails {
  operation: string;
  error: Error | unknown;
  retryable?: boolean;
  context?: Record<string, any>;
}

export const useErrorHandler = () => {
  const { toast } = useToast();

  const handleError = useCallback(({ operation, error, retryable = false, context }: ErrorDetails) => {
    // Log error with context
    debugError(`Error in ${operation}:`, {
      error,
      context,
      timestamp: new Date().toISOString()
    });

    // Extract user-friendly error message
    let userMessage = 'An unexpected error occurred';
    let description = '';

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('Failed to fetch')) {
        userMessage = 'Connection failed';
        description = 'Please check your internet connection and try again';
      } else if (error.message.includes('JWT')) {
        userMessage = 'Session expired';
        description = 'Please sign in again';
      } else if (error.message.includes('Row Level Security')) {
        userMessage = 'Access denied';
        description = 'You don\'t have permission to perform this action';
      } else if (error.message.includes('duplicate key')) {
        userMessage = 'Duplicate entry';
        description = 'This item already exists';
      } else if (error.message.includes('violates')) {
        userMessage = 'Invalid operation';
        description = 'The operation cannot be completed';
      } else {
        userMessage = `Error in ${operation}`;
        description = error.message;
      }
    }

    // Show toast notification
    toast({
      variant: 'destructive',
      title: userMessage,
      description: retryable ? `${description}. You can try again.` : description,
    });

    return {
      userMessage,
      description,
      retryable,
      originalError: error
    };
  }, [toast]);

  const handleSuccess = useCallback((message: string, description?: string) => {
    toast({
      title: message,
      description,
      variant: 'default',
    });
  }, [toast]);

  return {
    handleError,
    handleSuccess
  };
};