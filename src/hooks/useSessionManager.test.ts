import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionManager } from '@/hooks/useSessionManager';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock useAuth
const mockUseAuth = {
  user: null,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('useSessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useSessionManager());
    
    expect(result.current.sessions).toEqual([]);
    expect(result.current.currentSession).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('creates new session correctly', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    await act(async () => {
      result.current.createSession('Test Adventure', 'Custom prompt');
    });
    
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.currentSession?.name).toBe('Test Adventure');
    expect(result.current.currentSession?.customPrompt).toBe('Custom prompt');
    expect(result.current.currentSession?.messages).toEqual([]);
  });

  it('saves session to localStorage for unauthenticated users', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    await act(async () => {
      result.current.createSession('Test Session', '');
    });
    
    const savedSessions = JSON.parse(localStorage.getItem('dnd-sessions') ?? '[]');
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0].name).toBe('Test Session');
  });

  it('deletes session and clears current if active', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    // Create session
    await act(async () => {
      result.current.createSession('Test', '');
    });
    
    const sessionId = result.current.currentSession?.id;
    expect(sessionId).toBeDefined();
    
    // Delete session
    await act(async () => {
      await result.current.deleteSession(sessionId);
    });
    
    expect(result.current.sessions).toHaveLength(0);
    expect(result.current.currentSession).toBeNull();
  });

  it('handles multiple sessions correctly', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    await act(async () => {
      result.current.createSession('Session 1', '');
      result.current.createSession('Session 2', '');
      result.current.createSession('Session 3', '');
    });
    
    expect(result.current.sessions).toHaveLength(3);
    expect(result.current.currentSession?.name).toBe('Session 3'); // Last created should be current
  });

  it('sets current session correctly', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    await act(async () => {
      result.current.createSession('Session 1', '');
      result.current.createSession('Session 2', '');
    });
    
    const firstSession = result.current.sessions[0];
    
    await act(async () => {
      result.current.setCurrentSession(firstSession);
    });
    
    expect(result.current.currentSession?.id).toBe(firstSession.id);
  });
});