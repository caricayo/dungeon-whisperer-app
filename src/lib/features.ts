// Feature flags for optional components
export const FEATURES = {
  // Social features (friends, messaging, etc.)
  SOCIAL_FEATURES: false,
  
  // Complex animations and visual effects
  ADVANCED_ANIMATIONS: false,
  
  // Usage tracking and analytics
  USAGE_TRACKING: true,
  
  // Multiplayer enhancements
  MULTIPLAYER_FEATURES: true,
} as const;

export const isFeatureEnabled = (feature: keyof typeof FEATURES): boolean => {
  return FEATURES[feature];
};