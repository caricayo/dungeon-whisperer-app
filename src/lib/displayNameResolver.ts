// Single source of truth for display name resolution
// This ensures consistent naming across presence, chat, and UI components

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

/**
 * Resolves display name using the same logic as the database function
 * Priority: display_name > username > "Adventurer-<shortId>"
 */
export function getDisplayName(profile: UserProfile | null | undefined): string {
  if (!profile) return 'Unknown Player';
  
  return profile.display_name ?? profile.username ?? `Adventurer-${profile.id.substring(0, 8)}`;
}

/**
 * Creates a consistent user presence payload with resolved display name
 */
export function createPresencePayload(profile: UserProfile): {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  timestamp: string;
} {
  return {
    userId: profile.id,
    displayName: getDisplayName(profile),
    username: profile.username,
    avatarUrl: profile.avatar_url,
    timestamp: new Date().toISOString()
  };
}

/**
 * Formats user data for UI display with consistent naming
 */
export function formatUserForDisplay(profile: UserProfile) {
  return {
    id: profile.id,
    displayName: getDisplayName(profile),
    username: profile.username,
    avatarUrl: profile.avatar_url
  };
}