/**
 * @fileoverview User settings management hook
 */

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UserSettings {
  context7Enabled: boolean;
  voiceEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

const DEFAULT_SETTINGS: UserSettings = {
  context7Enabled: true,
  voiceEnabled: true,
  notificationsEnabled: true,
  theme: 'system',
};

const SETTINGS_KEY = 'user-settings';

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
    } catch (error) {
      console.warn('Failed to load user settings:', error);
      toast({
        title: 'Settings load warning',
        description: 'Using default settings due to load error',
        variant: 'default',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Update a specific setting
  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      
      toast({
        title: 'Setting updated',
        description: `${key} has been updated successfully`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to update setting:', error);
      toast({
        title: 'Setting update failed',
        description: 'Failed to save your preference',
        variant: 'destructive',
      });
    }
  };

  // Reset all settings to defaults
  const resetSettings = () => {
    try {
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem(SETTINGS_KEY);
      toast({
        title: 'Settings reset',
        description: 'All settings have been reset to defaults',
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast({
        title: 'Reset failed',
        description: 'Failed to reset settings',
        variant: 'destructive',
      });
    }
  };

  return {
    settings,
    updateSetting,
    resetSettings,
    isLoading,
  };
}