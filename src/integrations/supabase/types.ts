export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      api_usage: {
        Row: {
          cost_estimate: number | null
          created_at: string
          demo_mode_blocked: boolean | null
          endpoint: string | null
          error_message: string | null
          id: string
          operation: string
          response_time_ms: number | null
          service: string
          session_id: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string
          demo_mode_blocked?: boolean | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          operation: string
          response_time_ms?: number | null
          service: string
          session_id?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string
          demo_mode_blocked?: boolean | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          operation?: string
          response_time_ms?: number | null
          service?: string
          session_id?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          name: string
          uploaded_by: string
          url: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          name: string
          uploaded_by: string
          url: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          name?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["campaign_role"]
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["campaign_role"]
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["campaign_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          dw_status: Database["public"]["Enums"]["dw_session_state"] | null
          id: string
          last_scene_state: Json | null
          length: number | null
          max_stories: number | null
          owner_id: string
          participants: Json | null
          scene_prefs: Json | null
          system: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["campaign_visibility"]
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          dw_status?: Database["public"]["Enums"]["dw_session_state"] | null
          id?: string
          last_scene_state?: Json | null
          length?: number | null
          max_stories?: number | null
          owner_id: string
          participants?: Json | null
          scene_prefs?: Json | null
          system?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["campaign_visibility"]
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          dw_status?: Database["public"]["Enums"]["dw_session_state"] | null
          id?: string
          last_scene_state?: Json | null
          length?: number | null
          max_stories?: number | null
          owner_id?: string
          participants?: Json | null
          scene_prefs?: Json | null
          system?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["campaign_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          avatar_url: string | null
          campaign_id: string
          character_data: Json
          class: Database["public"]["Enums"]["character_class"] | null
          created_at: string
          id: string
          is_npc: boolean
          level: number | null
          locked_campaign_id: string | null
          name: string
          race: Database["public"]["Enums"]["character_race"] | null
          stats: Json | null
          subclass: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          campaign_id: string
          character_data?: Json
          class?: Database["public"]["Enums"]["character_class"] | null
          created_at?: string
          id?: string
          is_npc?: boolean
          level?: number | null
          locked_campaign_id?: string | null
          name: string
          race?: Database["public"]["Enums"]["character_race"] | null
          stats?: Json | null
          subclass?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          campaign_id?: string
          character_data?: Json
          class?: Database["public"]["Enums"]["character_class"] | null
          created_at?: string
          id?: string
          is_npc?: boolean
          level?: number | null
          locked_campaign_id?: string | null
          name?: string
          race?: Database["public"]["Enums"]["character_race"] | null
          stats?: Json | null
          subclass?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          message_type: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          message_type?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          message_type?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      edge_function_rate_limits: {
        Row: {
          created_at: string
          function_name: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      encounters: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          encounter_data: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          encounter_data?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          encounter_data?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          created_at: string
          entity_id: string
          entity_kind: Database["public"]["Enums"]["entity_kind"]
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_kind: Database["public"]["Enums"]["entity_kind"]
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_kind?: Database["public"]["Enums"]["entity_kind"]
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_operation_rate_limits: {
        Row: {
          created_at: string
          id: string
          operation_count: number
          operation_type: string
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation_count?: number
          operation_type: string
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation_count?: number
          operation_type?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      icon_generation_jobs: {
        Row: {
          completed_at: string | null
          completed_icons: number
          created_at: string
          csv_data: Json
          error_message: string | null
          id: string
          name: string
          render_settings: Json
          status: string
          total_icons: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_icons?: number
          created_at?: string
          csv_data?: Json
          error_message?: string | null
          id?: string
          name: string
          render_settings?: Json
          status?: string
          total_icons?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_icons?: number
          created_at?: string
          csv_data?: Json
          error_message?: string | null
          id?: string
          name?: string
          render_settings?: Json
          status?: string
          total_icons?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      icon_generation_results: {
        Row: {
          category: string
          created_at: string
          enriched_prompt: string | null
          error_message: string | null
          file_path: string | null
          file_url: string | null
          icon_name: string
          id: string
          job_id: string
          metadata: Json
          status: string
          updated_at: string
          user_id: string
          variant: string
        }
        Insert: {
          category: string
          created_at?: string
          enriched_prompt?: string | null
          error_message?: string | null
          file_path?: string | null
          file_url?: string | null
          icon_name: string
          id?: string
          job_id: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id: string
          variant: string
        }
        Update: {
          category?: string
          created_at?: string
          enriched_prompt?: string | null
          error_message?: string | null
          file_path?: string | null
          file_url?: string | null
          icon_name?: string
          id?: string
          job_id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "icon_generation_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "icon_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          bind: Database["public"]["Enums"]["item_bind"] | null
          character_id: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          quantity: number | null
          rarity: Database["public"]["Enums"]["item_rarity"] | null
          server_signature: string | null
          source_session_id: string | null
        }
        Insert: {
          bind?: Database["public"]["Enums"]["item_bind"] | null
          character_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          quantity?: number | null
          rarity?: Database["public"]["Enums"]["item_rarity"] | null
          server_signature?: string | null
          source_session_id?: string | null
        }
        Update: {
          bind?: Database["public"]["Enums"]["item_bind"] | null
          character_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          quantity?: number | null
          rarity?: Database["public"]["Enums"]["item_rarity"] | null
          server_signature?: string | null
          source_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          campaign_id: string
          created_at: string
          expires_at: string
          id: string
          invite_token: string
          invitee_username: string
          inviter_id: string
          role: Database["public"]["Enums"]["campaign_role"]
          status: Database["public"]["Enums"]["invite_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invitee_username: string
          inviter_id: string
          role?: Database["public"]["Enums"]["campaign_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invitee_username?: string
          inviter_id?: string
          role?: Database["public"]["Enums"]["campaign_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          campaign_id: string
          coords: Json
          created_at: string
          description: string | null
          id: string
          metadata_version: number
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          coords?: Json
          created_at?: string
          description?: string | null
          id?: string
          metadata_version?: number
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          coords?: Json
          created_at?: string
          description?: string | null
          id?: string
          metadata_version?: number
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      map_layers: {
        Row: {
          created_at: string
          data: Json
          id: string
          kind: Database["public"]["Enums"]["map_layer_kind"]
          map_id: string
          metadata_version: number
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          kind: Database["public"]["Enums"]["map_layer_kind"]
          map_id: string
          metadata_version?: number
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          kind?: Database["public"]["Enums"]["map_layer_kind"]
          map_id?: string
          metadata_version?: number
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_layers_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      map_markers: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          label: string
          map_id: string
          meta: Json
          metadata_version: number
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          label: string
          map_id: string
          meta?: Json
          metadata_version?: number
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          label?: string
          map_id?: string
          meta?: Json
          metadata_version?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_markers_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          ai_notes: string | null
          campaign_id: string
          created_at: string
          doors: Json
          fog: Json
          grid: Json
          id: string
          image_url: string | null
          metadata_version: number
          regions: Json
          title: string
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          campaign_id: string
          created_at?: string
          doors?: Json
          fog?: Json
          grid?: Json
          id?: string
          image_url?: string | null
          metadata_version?: number
          regions?: Json
          title: string
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          campaign_id?: string
          created_at?: string
          doors?: Json
          fog?: Json
          grid?: Json
          id?: string
          image_url?: string | null
          metadata_version?: number
          regions?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      npcs: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          metadata_version: number
          name: string
          notes: string | null
          role: string | null
          stat_block: Json
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          metadata_version?: number
          name: string
          notes?: string | null
          role?: string | null
          stat_block?: Json
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          metadata_version?: number
          name?: string
          notes?: string | null
          role?: string | null
          stat_block?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_events: {
        Row: {
          campaign_id: string
          id: string
          metadata: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          metadata?: Json
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_world: number
          density_preference: string | null
          display_name: string | null
          id: string
          is_online: boolean | null
          last_seen: string | null
          privacy_settings: Json | null
          status: string | null
          theme_preference: string | null
          updated_at: string
          username: string
          username_reset_required: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_world?: number
          density_preference?: string | null
          display_name?: string | null
          id: string
          is_online?: boolean | null
          last_seen?: string | null
          privacy_settings?: Json | null
          status?: string | null
          theme_preference?: string | null
          updated_at?: string
          username: string
          username_reset_required?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_world?: number
          density_preference?: string | null
          display_name?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          privacy_settings?: Json | null
          status?: string | null
          theme_preference?: string | null
          updated_at?: string
          username?: string
          username_reset_required?: boolean | null
        }
        Relationships: []
      }
      reward_proposals: {
        Row: {
          confirmed_by: Json | null
          created_at: string | null
          finalized: boolean | null
          id: string
          items: Json | null
          nonce: string
          rarity_budget: string | null
          round: number
          server_signature: string | null
          session_id: string
          xp: number | null
        }
        Insert: {
          confirmed_by?: Json | null
          created_at?: string | null
          finalized?: boolean | null
          id?: string
          items?: Json | null
          nonce: string
          rarity_budget?: string | null
          round: number
          server_signature?: string | null
          session_id: string
          xp?: number | null
        }
        Update: {
          confirmed_by?: Json | null
          created_at?: string | null
          finalized?: boolean | null
          id?: string
          items?: Json | null
          nonce?: string
          rarity_budget?: string | null
          round?: number
          server_signature?: string | null
          session_id?: string
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_proposals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      session_invites: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_session_invites_invitee_id"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_session_invites_inviter_id"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_session_invites_session_id"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          character_at_join: Json | null
          character_id: string | null
          id: string
          joined_at: string
          last_action: Json | null
          permissions: Json
          ready: boolean | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          character_at_join?: Json | null
          character_id?: string | null
          id?: string
          joined_at?: string
          last_action?: Json | null
          permissions?: Json
          ready?: boolean | null
          role?: string
          session_id: string
          user_id: string
        }
        Update: {
          character_at_join?: Json | null
          character_id?: string | null
          id?: string
          joined_at?: string
          last_action?: Json | null
          permissions?: Json
          ready?: boolean | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_session_participants_session_id"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_session_participants_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_state: {
        Row: {
          campaign_id: string
          id: string
          state_data: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          campaign_id: string
          id?: string
          state_data?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          campaign_id?: string
          id?: string
          state_data?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_state_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_state_snapshots: {
        Row: {
          campaign_id: string
          created_at: string | null
          created_by: string
          id: string
          session_id: string
          state: Json
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          created_by: string
          id?: string
          session_id: string
          state: Json
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          session_id?: string
          state?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_state_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_state_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          action_queue: Json | null
          campaign_id: string | null
          created_at: string
          current_player_count: number
          custom_prompt: string | null
          deleted_at: string | null
          dw_state: Database["public"]["Enums"]["dw_session_state"] | null
          ended_at: string | null
          id: string
          initiative_order: Json | null
          invitees: Json | null
          is_multiplayer: boolean
          max_players: number | null
          messages: Json
          mode: Database["public"]["Enums"]["session_mode"] | null
          name: string
          narrative_log: Json | null
          owner_id: string | null
          present: Json | null
          room_id: string | null
          round: number | null
          scene_data: Json | null
          started_at: string | null
          status: string | null
          story_phase: Database["public"]["Enums"]["story_phase"] | null
          title: string | null
          updated_at: string
          user_id: string
          world: number
        }
        Insert: {
          action_queue?: Json | null
          campaign_id?: string | null
          created_at?: string
          current_player_count?: number
          custom_prompt?: string | null
          deleted_at?: string | null
          dw_state?: Database["public"]["Enums"]["dw_session_state"] | null
          ended_at?: string | null
          id?: string
          initiative_order?: Json | null
          invitees?: Json | null
          is_multiplayer?: boolean
          max_players?: number | null
          messages?: Json
          mode?: Database["public"]["Enums"]["session_mode"] | null
          name?: string
          narrative_log?: Json | null
          owner_id?: string | null
          present?: Json | null
          room_id?: string | null
          round?: number | null
          scene_data?: Json | null
          started_at?: string | null
          status?: string | null
          story_phase?: Database["public"]["Enums"]["story_phase"] | null
          title?: string | null
          updated_at?: string
          user_id: string
          world?: number
        }
        Update: {
          action_queue?: Json | null
          campaign_id?: string | null
          created_at?: string
          current_player_count?: number
          custom_prompt?: string | null
          deleted_at?: string | null
          dw_state?: Database["public"]["Enums"]["dw_session_state"] | null
          ended_at?: string | null
          id?: string
          initiative_order?: Json | null
          invitees?: Json | null
          is_multiplayer?: boolean
          max_players?: number | null
          messages?: Json
          mode?: Database["public"]["Enums"]["session_mode"] | null
          name?: string
          narrative_log?: Json | null
          owner_id?: string | null
          present?: Json | null
          room_id?: string | null
          round?: number | null
          scene_data?: Json | null
          started_at?: string | null
          status?: string | null
          story_phase?: Database["public"]["Enums"]["story_phase"] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          world?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_sessions_room_id"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          campaign_id: string
          color: string | null
          created_at: string
          id: string
          label: string
          meta: Json
          updated_at: string
        }
        Insert: {
          campaign_id: string
          color?: string | null
          created_at?: string
          id?: string
          label: string
          meta?: Json
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          color?: string | null
          created_at?: string
          id?: string
          label?: string
          meta?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          assigned_to: string | null
          category: string
          context: string | null
          created_at: string | null
          id: string
          message: string | null
          reporter_id: string
          resolution: string | null
          status: string | null
          target_user_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category: string
          context?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          reporter_id: string
          resolution?: string | null
          status?: string | null
          target_user_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          context?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          reporter_id?: string
          resolution?: string | null
          status?: string | null
          target_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          custom_dnd_prompt: string | null
          elevenlabs_voice_id: string | null
          id: string
          openai_api_key_encrypted: string | null
          tts_provider: string | null
          tts_speed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_dnd_prompt?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          openai_api_key_encrypted?: string | null
          tts_provider?: string | null
          tts_speed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_dnd_prompt?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          openai_api_key_encrypted?: string | null
          tts_provider?: string | null
          tts_speed?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      accept_friend_request: {
        Args: { friend_user_id: string }
        Returns: boolean
      }
      accept_session_invite: {
        Args: { invite_id: string }
        Returns: Json
      }
      append_session_messages: {
        Args: {
          assistant_message: Json
          session_id: string
          user_message: Json
        }
        Returns: boolean
      }
      can_access_invite_by_email: {
        Args: { invite_email: string }
        Returns: boolean
      }
      can_invite_to_session: {
        Args: { session_id: string }
        Returns: boolean
      }
      can_view_multiplayer_participant: {
        Args: { participant_user_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      check_edge_function_rate_limit: {
        Args: {
          p_function_name: string
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_friend_operation_rate_limit: {
        Args: {
          max_operations?: number
          operation_type: string
          window_minutes?: number
        }
        Returns: boolean
      }
      check_user_settings_rate_limit: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      cleanup_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_user_api_key: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_all_users_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          current_world: number
          display_name: string
          id: string
          is_online: boolean
          last_seen: string
          username: string
        }[]
      }
      get_api_usage_analytics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_response_time: number
          blocked_calls: number
          operation: string
          service: string
          total_calls: number
          total_cost: number
          total_tokens: number
          usage_date: string
        }[]
      }
      get_discoverable_sessions_for_current_world: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          current_player_count: number
          id: string
          max_players: number
          name: string
          owner_id: string
          owner_username: string
          world: number
        }[]
      }
      get_display_name: {
        Args: {
          user_profile_row: Database["public"]["Tables"]["profiles"]["Row"]
        }
        Returns: string
      }
      get_safe_user_settings: {
        Args: { target_user_id?: string }
        Returns: {
          created_at: string
          custom_dnd_prompt: string
          elevenlabs_voice_id: string
          has_openai_key: boolean
          id: string
          tts_provider: string
          tts_speed: number
          updated_at: string
          user_id: string
        }[]
      }
      get_user_by_username: {
        Args: { username_to_find: string }
        Returns: string
      }
      get_user_campaign_role: {
        Args: { check_campaign_id: string }
        Returns: string
      }
      get_user_role_in_session: {
        Args: { session_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_campaign_member: {
        Args: { check_campaign_id: string; check_user_id: string }
        Returns: boolean
      }
      is_campaign_owner: {
        Args: { check_campaign_id: string; check_user_id: string }
        Returns: boolean
      }
      is_multiplayer_session_discoverable: {
        Args: { session_id: string }
        Returns: boolean
      }
      is_participant_safe: {
        Args: { session_id: string; user_id: string }
        Returns: boolean
      }
      is_session_dm: {
        Args: { check_session_id: string; check_user_id: string }
        Returns: boolean
      }
      is_session_member: {
        Args: { check_session_id: string; check_user_id: string }
        Returns: boolean
      }
      is_session_owner: {
        Args: { session_id: string; user_id: string }
        Returns: boolean
      }
      is_session_owner_safe: {
        Args: { session_id: string; user_id: string }
        Returns: boolean
      }
      is_session_participant: {
        Args: { session_id: string }
        Returns: boolean
      }
      is_session_participant_user: {
        Args: { session_id: string; user_id: string }
        Returns: boolean
      }
      is_settings_owner: {
        Args: { settings_user_id: string }
        Returns: boolean
      }
      is_user_session_participant: {
        Args: { check_session_id: string; check_user_id: string }
        Returns: boolean
      }
      is_username_available: {
        Args: { username_to_check: string }
        Returns: boolean
      }
      is_username_taken: {
        Args: { check_username: string }
        Returns: boolean
      }
      join_multiplayer_session: {
        Args: { session_id: string }
        Returns: Json
      }
      join_session_v2: {
        Args: { session_id: string }
        Returns: Json
      }
      log_api_usage: {
        Args: {
          p_cost_estimate?: number
          p_demo_mode_blocked?: boolean
          p_endpoint?: string
          p_error_message?: string
          p_operation: string
          p_response_time_ms?: number
          p_service: string
          p_session_id?: string
          p_tokens_used?: number
        }
        Returns: string
      }
      reset_user_username: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      send_friend_request: {
        Args: { target_username: string }
        Returns: Json
      }
      send_friend_request_by_user_id: {
        Args: { target_user_id: string }
        Returns: Json
      }
      update_user_presence: {
        Args: { online_status: boolean; user_id: string }
        Returns: undefined
      }
      update_user_settings_secure: {
        Args: {
          p_custom_dnd_prompt?: string
          p_elevenlabs_voice_id?: string
          p_openai_api_key_encrypted?: string
          p_tts_provider?: string
          p_tts_speed?: number
        }
        Returns: boolean
      }
      user_is_campaign_member: {
        Args: { check_campaign_id: string; check_user_id: string }
        Returns: boolean
      }
      user_is_campaign_owner: {
        Args: { check_campaign_id: string; check_user_id: string }
        Returns: boolean
      }
      validate_invite_token: {
        Args: { token_to_check: string }
        Returns: {
          campaign_id: string
          expires_at: string
          invite_id: string
          invitee_username: string
          role: Database["public"]["Enums"]["campaign_role"]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_role: "gm" | "player" | "viewer"
      campaign_visibility: "private" | "invite_only" | "public"
      character_class:
        | "Fighter"
        | "Wizard"
        | "Rogue"
        | "Cleric"
        | "Ranger"
        | "Barbarian"
        | "Bard"
        | "Druid"
        | "Monk"
        | "Paladin"
        | "Sorcerer"
        | "Warlock"
      character_race:
        | "Human"
        | "Elf"
        | "Dwarf"
        | "Halfling"
        | "Dragonborn"
        | "Gnome"
        | "Half-Elf"
        | "Half-Orc"
        | "Tiefling"
      dw_session_state: "LOBBY" | "PREP" | "ACTIVE" | "PAUSED" | "ENDED"
      entity_kind: "map" | "marker" | "asset" | "npc" | "location"
      friendship_status: "pending" | "accepted" | "blocked"
      invite_status: "pending" | "accepted" | "declined" | "expired"
      item_bind: "account" | "character" | "campaign"
      item_rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
      map_layer_kind: "tiles" | "markers" | "fog" | "effects"
      presence_event_type:
        | "join"
        | "leave"
        | "status_update"
        | "typing_start"
        | "typing_stop"
        | "heartbeat"
      presence_status: "online" | "idle" | "dnd" | "offline"
      session_mode: "solo" | "multi"
      story_phase: "setup" | "rising" | "climax" | "denouement" | "complete"
    }
    CompositeTypes: Record<never, never>
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      campaign_role: ["gm", "player", "viewer"],
      campaign_visibility: ["private", "invite_only", "public"],
      character_class: [
        "Fighter",
        "Wizard",
        "Rogue",
        "Cleric",
        "Ranger",
        "Barbarian",
        "Bard",
        "Druid",
        "Monk",
        "Paladin",
        "Sorcerer",
        "Warlock",
      ],
      character_race: [
        "Human",
        "Elf",
        "Dwarf",
        "Halfling",
        "Dragonborn",
        "Gnome",
        "Half-Elf",
        "Half-Orc",
        "Tiefling",
      ],
      dw_session_state: ["LOBBY", "PREP", "ACTIVE", "PAUSED", "ENDED"],
      entity_kind: ["map", "marker", "asset", "npc", "location"],
      friendship_status: ["pending", "accepted", "blocked"],
      invite_status: ["pending", "accepted", "declined", "expired"],
      item_bind: ["account", "character", "campaign"],
      item_rarity: ["common", "uncommon", "rare", "epic", "legendary"],
      map_layer_kind: ["tiles", "markers", "fog", "effects"],
      presence_event_type: [
        "join",
        "leave",
        "status_update",
        "typing_start",
        "typing_stop",
        "heartbeat",
      ],
      presence_status: ["online", "idle", "dnd", "offline"],
      session_mode: ["solo", "multi"],
      story_phase: ["setup", "rising", "climax", "denouement", "complete"],
    },
  },
} as const
