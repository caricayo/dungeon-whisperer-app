/**
 * @fileoverview Unit tests for CreateMultiplayerSession component
 * Tests form validation, session creation, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CreateMultiplayerSession } from './CreateMultiplayerSession';
import { toast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  }),
  toast: vi.fn()
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}));

vi.mock('@/lib/security', () => ({
  InputSanitizer: {
    sanitizeText: vi.fn((input: string) => input.trim())
  },
  SecurityLogger: {
    logSecurityEvent: vi.fn()
  }
}));

describe('CreateMultiplayerSession', () => {
  const mockToast = vi.mocked(toast);
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render form elements correctly', () => {
      render(<CreateMultiplayerSession />);
      
      expect(screen.getByLabelText(/session name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/custom prompt/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/max players/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create session/i })).toBeInTheDocument();
    });

    it('should have appropriate placeholder texts', () => {
      render(<CreateMultiplayerSession />);
      
      expect(screen.getByPlaceholderText(/enter session name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/optional custom prompt/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when session name is empty', async () => {
      render(<CreateMultiplayerSession />);
      
      const createButton = screen.getByRole('button', { name: /create session/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Invalid Session Name',
            variant: 'destructive'
          })
        );
      });
    });

    it('should show error for session name that is too long', async () => {
      render(<CreateMultiplayerSession />);
      
      const sessionNameInput = screen.getByLabelText(/session name/i);
      const longName = 'a'.repeat(101); // Longer than 100 characters
      
      fireEvent.change(sessionNameInput, { target: { value: longName } });
      
      const createButton = screen.getByRole('button', { name: /create session/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Session Name Too Long',
            variant: 'destructive'
          })
        );
      });
    });

    it('should validate max players range', () => {
      render(<CreateMultiplayerSession />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '2');
      expect(slider).toHaveAttribute('max', '6');
    });
  });

  describe('Session Creation', () => {
    it('should create session with valid inputs', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const mockRpc = vi.mocked(supabase.rpc);
      
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          session_id: 'test-session-id',
          join_url: '/rooms/test-session-id/join'
        },
        error: null
      });

      const mockOnSessionCreated = vi.fn();
      
      render(<CreateMultiplayerSession onSessionCreated={mockOnSessionCreated} />);
      
      // Fill form
      const sessionNameInput = screen.getByLabelText(/session name/i);
      const customPromptInput = screen.getByLabelText(/custom prompt/i);
      
      fireEvent.change(sessionNameInput, { target: { value: 'Test Session' } });
      fireEvent.change(customPromptInput, { target: { value: 'Test prompt' } });
      
      // Submit form
      const createButton = screen.getByRole('button', { name: /create session/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('create_multiplayer_session_fixed', {
          session_name: 'Test Session',
          custom_prompt: 'Test prompt',
          max_players: expect.any(Number)
        });
        
        expect(mockOnSessionCreated).toHaveBeenCalledWith(
          'test-session-id',
          '/rooms/test-session-id/join'
        );
      });
    });

    it('should handle RPC errors gracefully', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const mockRpc = vi.mocked(supabase.rpc);
      
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      render(<CreateMultiplayerSession />);
      
      const sessionNameInput = screen.getByLabelText(/session name/i);
      fireEvent.change(sessionNameInput, { target: { value: 'Test Session' } });
      
      const createButton = screen.getByRole('button', { name: /create session/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Session Creation Failed',
            variant: 'destructive'
          })
        );
      });
    });

    it('should sanitize inputs before sending to database', async () => {
      const { InputSanitizer } = await import('@/lib/security');
      const mockSanitizeText = vi.mocked(InputSanitizer.sanitizeText);
      
      const { supabase } = await import('@/integrations/supabase/client');
      const mockRpc = vi.mocked(supabase.rpc);
      
      mockRpc.mockResolvedValue({
        data: { success: true, session_id: 'test', join_url: 'test' },
        error: null
      });

      render(<CreateMultiplayerSession />);
      
      const sessionNameInput = screen.getByLabelText(/session name/i);
      fireEvent.change(sessionNameInput, { target: { value: '<script>alert("xss")</script>Test' } });
      
      const createButton = screen.getByRole('button', { name: /create session/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockSanitizeText).toHaveBeenCalledWith('<script>alert("xss")</script>Test');
      });
    });
  });

  describe('Success State', () => {
    it('should show success message and copy functionality', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const mockRpc = vi.mocked(supabase.rpc);
      
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          session_id: 'test-session-id',
          session_name: 'Test Session',
          join_url: '/rooms/test-session-id/join'
        },
        error: null
      });

      render(<CreateMultiplayerSession />);
      
      const sessionNameInput = screen.getByLabelText(/session name/i);
      fireEvent.change(sessionNameInput, { target: { value: 'Test Session' } });
      
      const createButton = screen.getByRole('button', { name: /create session/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/session created successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/test session/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copy join url/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state during session creation', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const mockRpc = vi.mocked(supabase.rpc);
      
      // Create a promise that won't resolve immediately
      let resolveRpc: (value: unknown) => void = () => { /* noop */ };
      const rpcPromise = new Promise(resolve => {
        resolveRpc = resolve;
      });
      
      mockRpc.mockReturnValue(rpcPromise);

      render(<CreateMultiplayerSession />);
      
      const sessionNameInput = screen.getByLabelText(/session name/i);
      fireEvent.change(sessionNameInput, { target: { value: 'Test Session' } });
      
      const createButton = screen.getByRole('button', { name: /create session/i });
      
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Should show loading state
      expect(screen.getByText(/creating session/i)).toBeInTheDocument();
      expect(createButton).toBeDisabled();
      
      // Resolve the promise
      await act(async () => {
        resolveRpc({
          data: { success: true, session_id: 'test', join_url: 'test' },
          error: null
        });
      });
    });
  });
});