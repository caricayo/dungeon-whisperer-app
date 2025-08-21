import { createContext, useContext } from 'react';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  last_seen: string | null;
  is_online: boolean;
  username_reset_required?: boolean;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  needsUsername: boolean;
  checkUsernameAvailability: (username: string) => Promise<boolean>;
  createProfile: (username: string, displayName?: string) => Promise<boolean>;
  updatePresence: (isOnline: boolean) => Promise<void>;
  goOffline: () => Promise<void>;
  loadProfile: () => Promise<void>;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};
