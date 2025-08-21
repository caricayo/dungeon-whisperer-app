import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debugLog, debugError } from '@/lib/debug';
import { useToast } from '@/hooks/use-toast';

interface UserSettings {
  id?: string;
  user_id: string;
  custom_dnd_prompt?: string;
  elevenlabs_voice_id?: string;
  tts_speed: number;
  tts_provider: string;
  has_openai_key: boolean;
  created_at: string;
  updated_at: string;
}

interface UserSettingsUpdate {
  custom_dnd_prompt?: string;
  openai_api_key_encrypted?: string; // Only for updates, never exposed
  elevenlabs_voice_id?: string;
  tts_speed?: number;
  tts_provider?: string;
}

interface UseUserSettingsSecure {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: UserSettingsUpdate) => Promise<boolean>;
  deleteApiKey: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export const useUserSettingsSecure = (): UseUserSettingsSecure => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      debugLog('🔐 Loading user settings securely');
      
      // Use the secure function that masks encrypted data
      const { data, error: dbError } = await supabase.rpc('get_safe_user_settings');
      
      if (dbError) {
        throw dbError;
      }
      
      if (data && data.length > 0) {
        setSettings(data[0]);
        debugLog('✅ User settings loaded securely', { 
          hasApiKey: data[0].has_openai_key,
          provider: data[0].tts_provider 
        });
      } else {
        setSettings(null);
        debugLog('ℹ️ No user settings found');
      }
    } catch (_err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      debugError('❌ Error loading user settings', _err);
      setError(errorMessage);
      
      toast({
        variant: 'destructive',
        title: 'Settings Error',
        description: 'Failed to load your settings securely. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateSettings = useCallback(async (updates: UserSettingsUpdate): Promise<boolean> => {
    try {
      setError(null);
      debugLog('🔐 Updating user settings securely', updates);
      
      // Use the secure update function with validation
      const { data, error: dbError } = await supabase.rpc('update_user_settings_secure', {
        p_custom_dnd_prompt: updates.custom_dnd_prompt ?? null,
        p_openai_api_key_encrypted: updates.openai_api_key_encrypted ?? null,
        p_elevenlabs_voice_id: updates.elevenlabs_voice_id ?? null,
        p_tts_speed: updates.tts_speed ?? null,
        p_tts_provider: updates.tts_provider ?? null,
      });
      
      if (dbError) {
        throw dbError;
      }
      
      if (data) {
        // Refresh settings to get updated data
        await loadSettings();
        
        toast({
          title: 'Settings Updated',
          description: 'Your settings have been updated securely.',
        });
        
        debugLog('✅ User settings updated successfully');
        return true;
      }
      
      return false;
    } catch (_err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      debugError('❌ Error updating user settings', _err);
      setError(errorMessage);
      
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: errorMessage.includes('Rate limit') 
          ? 'Too many updates. Please wait a moment before trying again.'
          : 'Failed to update your settings. Please try again.',
      });
      
      return false;
    }
  }, [loadSettings, toast]);

  const deleteApiKey = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      debugLog('🗑️ Deleting API key securely');
      
      const { data, error: dbError } = await supabase.rpc('delete_user_api_key');
      
      if (dbError) {
        throw dbError;
      }
      
      if (data) {
        // Refresh settings to reflect the change
        await loadSettings();
        
        toast({
          title: 'API Key Deleted',
          description: 'Your OpenAI API key has been securely removed.',
        });
        
        debugLog('✅ API key deleted successfully');
        return true;
      }
      
      return false;
    } catch (_err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete API key';
      debugError('❌ Error deleting API key', _err);
      setError(errorMessage);
      
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'Failed to delete your API key. Please try again.',
      });
      
      return false;
    }
  }, [loadSettings, toast]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    deleteApiKey,
    refresh,
  };
};