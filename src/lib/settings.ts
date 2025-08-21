import { supabase } from '@/integrations/supabase/client'
import { encryptData, decryptData, secureWipe } from '@/lib/crypto'
import { validateApiKey } from '@/lib/validation'
import { debugLog } from '@/lib/debug'

export interface UserSettings {
  id?: string
  user_id: string
  openai_api_key_encrypted?: string
  elevenlabs_voice_id?: string
  tts_provider?: 'elevenlabs' | 'openai' | 'auto'
  tts_speed?: number
  custom_dnd_prompt?: string
  created_at?: string
  updated_at?: string
}

export const settingsService = {
  async saveApiKey(apiKey: string): Promise<void> {
    // Validate API key format
    const validation = validateApiKey(apiKey);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required to save settings');
    }

    try {
      // Encrypt the API key using user ID
      const encryptedApiKey = await encryptData(apiKey, user.id);
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          openai_api_key_encrypted: encryptedApiKey,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error saving API key:', error);
        throw new Error('Failed to save API key');
      }
      
      // Securely wipe the original API key from memory
      secureWipe(apiKey);
      
    } catch (error) {
      console.error('Error encrypting/saving API key:', error);
      throw new Error('Failed to securely save API key');
    }
  },

  async getApiKey(): Promise<string | null> {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      debugLog('No authenticated user found');
      return null;
    }
    
    try {const { data, error } = await supabase
        .from('user_settings')
        .select('openai_api_key_encrypted')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        debugLog('No saved API key found for user');
        return null;
      }
      
      if (!data?.openai_api_key_encrypted) {
        return null;
      }
      
      // Decrypt the API key
      try {
        const decryptedApiKey = await decryptData(data.openai_api_key_encrypted, user.id);
        return decryptedApiKey;
      } catch (decryptError) {
        console.error('Failed to decrypt API key:', decryptError);
        // If decryption fails, clear the corrupted data
        await this.clearApiKey();
        return null;
      }
      
    } catch (error) {
      console.error('Error fetching API key:', error);
      return null;
    }
  },

  async clearApiKey(): Promise<void> {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      debugLog('No authenticated user found');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error clearing API key:', error);
        throw new Error('Failed to clear API key');
      }
    } catch (error) {
      console.error('Error clearing API key:', error);
      throw new Error('Failed to clear API key');
    }
  },

  // New method to check if user has saved API key
  async hasApiKey(): Promise<boolean> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return false;
    }

    try {const { data, error } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      return !error && !!data;
    } catch {
      return false;
    }
  },

  // Voice settings methods
  async saveVoiceSettings(voiceId: string, provider: 'elevenlabs' | 'openai' | 'auto' = 'elevenlabs', speed = 1.0): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required to save voice settings');
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          elevenlabs_voice_id: voiceId,
          tts_provider: provider,
          tts_speed: speed,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error saving voice settings:', error);
        throw new Error('Failed to save voice settings');
      }
      
      debugLog('Voice settings saved successfully:', { voiceId, provider, speed });
      
    } catch (error) {
      console.error('Error saving voice settings:', error);
      throw new Error('Failed to save voice settings');
    }
  },

  async getVoiceSettings(): Promise<{ voiceId: string; provider: string; speed: number } | null> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      debugLog('No authenticated user found for voice settings');
      return null;
    }
    
    try {const { data, error } = await supabase
        .from('user_settings')
        .select('elevenlabs_voice_id, tts_provider, tts_speed')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error || !data) {
        debugLog('No voice settings found for user');
        return null;
      }
      
      return {
        voiceId: data.elevenlabs_voice_id ?? 'BNgbHR0DNeZixGQVzloa', // User's custom voice
        provider: data.tts_provider ?? 'elevenlabs',
        speed: data.tts_speed ?? 1.0
      };
      
    } catch {
      console.error('Error fetching voice settings:', error);
      return null;
    }
  },

  // Custom D&D Prompt methods
  async saveCustomPrompt(prompt: string): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required to save custom prompt');
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          custom_dnd_prompt: prompt,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error saving custom prompt:', error);
        throw new Error('Failed to save custom prompt');
      }
      
      debugLog('Custom prompt saved successfully');
      
    } catch (error) {
      console.error('Error saving custom prompt:', error);
      throw new Error('Failed to save custom prompt');
    }
  },

  async getCustomPrompt(): Promise<string | null> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      debugLog('No authenticated user found for custom prompt');
      return null;
    }
    
    try {const { data, error } = await supabase
        .from('user_settings')
        .select('custom_dnd_prompt')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error || !data) {
        debugLog('No custom prompt found for user');
        return null;
      }
      
      return data.custom_dnd_prompt ?? null;
      
    } catch (error) {
      console.error('Error fetching custom prompt:', error);
      return null;
    }
  },

  // Demo mode settings
  getDemoMode(): boolean {
    return localStorage.getItem('demo-mode') === 'true';
  },

  setDemoMode(enabled: boolean): void {
    if (enabled) {
      localStorage.setItem('demo-mode', 'true');
    } else {
      localStorage.removeItem('demo-mode');
    }
  }
}
