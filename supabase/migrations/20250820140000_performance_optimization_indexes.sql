-- Performance Optimization: Advanced Database Indexes
-- Created: 2025-08-20
-- Purpose: Add comprehensive indexes for improved query performance

-- Sessions table performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_updated ON public.sessions (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_multiplayer_world_status ON public.sessions (is_multiplayer, world, dw_state, current_player_count) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_campaign_status ON public.sessions (campaign_id, dw_state) WHERE deleted_at IS NULL AND campaign_id IS NOT NULL;

-- Session participants indexes for join operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_participants_composite ON public.session_participants (session_id, user_id, role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_participants_user_ready ON public.session_participants (user_id, ready) WHERE ready = true;

-- Profiles table indexes for lookups and social features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_online_status ON public.profiles (is_online, last_seen) WHERE is_online = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_world_online ON public.profiles (current_world, is_online) WHERE is_online = true;

-- Campaign-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_owner_visibility ON public.campaigns (owner_id, visibility, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_members_user_role ON public.campaign_members (user_id, role, joined_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_members_campaign_role ON public.campaign_members (campaign_id, role);

-- Chat and messaging indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_time ON public.chat_messages (session_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_direct_messages_recipient_read ON public.direct_messages (recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_direct_messages_sender_time ON public.direct_messages (sender_id, created_at DESC);

-- API usage and monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_user_date ON public.api_usage (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_service_operation ON public.api_usage (service, operation, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_cost_tracking ON public.api_usage (created_at, cost_estimate) WHERE cost_estimate > 0;

-- Security and audit indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_user_action ON public.security_audit_log (user_id, action, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_resource ON public.security_audit_log (resource_type, resource_id, created_at DESC);

-- Rate limiting indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edge_function_rate_limits_user_function ON public.edge_function_rate_limits (user_id, function_name, window_start DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friend_operation_rate_limits_user_op ON public.friend_operation_rate_limits (user_id, operation_type, window_start DESC);

-- Social features indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friendships_user_status ON public.friendships (user_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friendships_friend_status ON public.friendships (friend_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_target_status ON public.user_reports (target_user_id, status, created_at DESC);

-- Character and inventory indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_user_campaign ON public.characters (user_id, campaign_id) WHERE is_npc = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_campaign_npc ON public.characters (campaign_id, is_npc) WHERE is_npc = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_character ON public.inventory_items (character_id, created_at DESC);

-- Game world and location indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_campaign_updated ON public.locations (campaign_id, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maps_campaign_updated ON public.maps (campaign_id, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_npcs_campaign_updated ON public.npcs (campaign_id, updated_at DESC);

-- Session invites and multiplayer indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_invites_invitee_status ON public.session_invites (invitee_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_invites_session_status ON public.session_invites (session_id, status);

-- Presence and real-time indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_presence_events_campaign_status ON public.presence_events (campaign_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_presence_events_user_updated ON public.presence_events (user_id, updated_at DESC);

-- Content generation indexes (for AI/media features)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_icon_generation_jobs_user_status ON public.icon_generation_jobs (user_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_icon_generation_results_job ON public.icon_generation_results (job_id, status);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_multiplayer_world ON public.sessions (user_id, is_multiplayer, world, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_social_lookup ON public.profiles (username, display_name, is_online) WHERE username IS NOT NULL;

-- Partial indexes for better performance on filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active_multiplayer ON public.sessions (world, current_player_count, max_players, updated_at DESC) 
  WHERE is_multiplayer = true AND dw_state IN ('LOBBY', 'PREP', 'ACTIVE') AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_public ON public.campaigns (visibility, updated_at DESC) 
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_has_keys ON public.user_settings (user_id) 
  WHERE openai_api_key_encrypted IS NOT NULL;

-- Function-based indexes for case-insensitive searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_username_trgm ON public.profiles 
  USING gin(username gin_trgm_ops) WHERE username IS NOT NULL;

-- Add trigram extension if not exists (for fuzzy text search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Update table statistics for query planner optimization
ANALYZE public.sessions;
ANALYZE public.session_participants;
ANALYZE public.profiles;
ANALYZE public.campaigns;
ANALYZE public.campaign_members;
ANALYZE public.chat_messages;
ANALYZE public.api_usage;
ANALYZE public.security_audit_log;

-- Add comments for documentation
COMMENT ON INDEX idx_sessions_user_updated IS 'Optimizes user session loading queries';
COMMENT ON INDEX idx_sessions_multiplayer_world_status IS 'Optimizes multiplayer session discovery';
COMMENT ON INDEX idx_session_participants_composite IS 'Optimizes session participant joins';
COMMENT ON INDEX idx_profiles_username_lower IS 'Optimizes case-insensitive username searches';
COMMENT ON INDEX idx_api_usage_user_date IS 'Optimizes user API usage analytics';
COMMENT ON INDEX idx_security_audit_user_action IS 'Optimizes security audit queries';
COMMENT ON INDEX idx_sessions_active_multiplayer IS 'Optimizes active multiplayer session discovery';

-- Performance monitoring: Create a function to monitor index usage
CREATE OR REPLACE FUNCTION public.get_index_usage_stats()
RETURNS TABLE(
  schemaname text,
  tablename text,
  indexname text,
  idx_scans bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  size_mb numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as idx_scans,
    idx_tup_read,
    idx_tup_fetch,
    round(pg_relation_size(indexrelid) / 1024.0 / 1024.0, 2) as size_mb
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY idx_scan DESC, size_mb DESC;
$$;