export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_event_participants: {
        Row: {
          contact_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          event_id: string
          id: string
          response_status: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          event_id: string
          id?: string
          response_status?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          event_id?: string
          id?: string
          response_status?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_events: {
        Row: {
          all_day: boolean
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_slug: string | null
          city: string | null
          color_key: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          ends_at: string
          external_calendar_id: string | null
          external_event_id: string | null
          id: string
          is_blocking: boolean
          is_recurring: boolean
          location: string | null
          meeting_url: string | null
          modality: string | null
          notes: string | null
          owner_id: string | null
          recurrence_parent_id: string | null
          recurrence_rule: string | null
          recurrence_timezone: string | null
          responsible_id: string | null
          source: string
          source_record_id: string | null
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          all_day?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_slug?: string | null
          city?: string | null
          color_key?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          ends_at: string
          external_calendar_id?: string | null
          external_event_id?: string | null
          id?: string
          is_blocking?: boolean
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          modality?: string | null
          notes?: string | null
          owner_id?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          recurrence_timezone?: string | null
          responsible_id?: string | null
          source?: string
          source_record_id?: string | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          all_day?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_slug?: string | null
          city?: string | null
          color_key?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          ends_at?: string
          external_calendar_id?: string | null
          external_event_id?: string | null
          id?: string
          is_blocking?: boolean
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          modality?: string | null
          notes?: string | null
          owner_id?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          recurrence_timezone?: string | null
          responsible_id?: string | null
          source?: string
          source_record_id?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_keyword_map: {
        Row: {
          created_at: string
          id: string
          keyword: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_keyword_map_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_azul_oauth_tokens: {
        Row: {
          access_token_ciphertext: string | null
          connected_by: string | null
          conta_azul_identity: Json | null
          created_at: string
          id: string
          last_error: string | null
          refresh_token_ciphertext: string
          scope: string | null
          status: string
          token_expires_at: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          connected_by?: string | null
          conta_azul_identity?: Json | null
          created_at?: string
          id?: string
          last_error?: string | null
          refresh_token_ciphertext: string
          scope?: string | null
          status?: string
          token_expires_at?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string | null
          connected_by?: string | null
          conta_azul_identity?: Json | null
          created_at?: string
          id?: string
          last_error?: string | null
          refresh_token_ciphertext?: string
          scope?: string | null
          status?: string
          token_expires_at?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          interest: string | null
          last_contact_at: string | null
          name: string
          next_contact_at: string | null
          notes: string | null
          origin: string | null
          owner_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          interest?: string | null
          last_contact_at?: string | null
          name: string
          next_contact_at?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          interest?: string | null
          last_contact_at?: string | null
          name?: string
          next_contact_at?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      editorial_drafts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          knowledge_node_id: string
          previous_content_hash: string
          proposed_content: string
          proposed_content_hash: string
          proposed_metadata: Json
          proposed_summary: string | null
          proposed_title: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string
          source_uri: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          knowledge_node_id: string
          previous_content_hash: string
          proposed_content: string
          proposed_content_hash: string
          proposed_metadata?: Json
          proposed_summary?: string | null
          proposed_title?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id: string
          source_uri?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          knowledge_node_id?: string
          previous_content_hash?: string
          proposed_content?: string
          proposed_content_hash?: string
          proposed_metadata?: Json
          proposed_summary?: string | null
          proposed_title?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string
          source_uri?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_drafts_knowledge_node_id_fkey"
            columns: ["knowledge_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_prefs: {
        Row: {
          calendar_id: string
          calendar_summary: string | null
          color: string | null
          created_at: string
          id: string
          is_visible: boolean | null
          sector: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id: string
          calendar_summary?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean | null
          sector?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          calendar_summary?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean | null
          sector?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          google_email: string | null
          refresh_token: string
          scope: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          google_email?: string | null
          refresh_token: string
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          google_email?: string | null
          refresh_token?: string
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_asset_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          indexation_run_id: string | null
          knowledge_asset_id: string
          knowledge_node_id: string
          previous_content_hash: string | null
          proposed_alt_text: string | null
          proposed_asset_category: string
          proposed_asset_type: string
          proposed_content_hash: string | null
          proposed_description: string | null
          proposed_external_url: string | null
          proposed_file_extension: string | null
          proposed_license_reference: string | null
          proposed_manifest_hash: string
          proposed_metadata: Json
          proposed_mime_type: string | null
          proposed_name: string
          proposed_original_filename: string | null
          proposed_rights_holder: string | null
          proposed_rights_status: string
          proposed_size_bytes: number | null
          proposed_storage_bucket: string | null
          proposed_storage_path: string | null
          proposed_storage_provider: string
          proposed_usage_notes: string | null
          proposed_visibility: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_reference: string | null
          stable_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          indexation_run_id?: string | null
          knowledge_asset_id: string
          knowledge_node_id: string
          previous_content_hash?: string | null
          proposed_alt_text?: string | null
          proposed_asset_category: string
          proposed_asset_type: string
          proposed_content_hash?: string | null
          proposed_description?: string | null
          proposed_external_url?: string | null
          proposed_file_extension?: string | null
          proposed_license_reference?: string | null
          proposed_manifest_hash: string
          proposed_metadata?: Json
          proposed_mime_type?: string | null
          proposed_name: string
          proposed_original_filename?: string | null
          proposed_rights_holder?: string | null
          proposed_rights_status: string
          proposed_size_bytes?: number | null
          proposed_storage_bucket?: string | null
          proposed_storage_path?: string | null
          proposed_storage_provider: string
          proposed_usage_notes?: string | null
          proposed_visibility: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          stable_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          indexation_run_id?: string | null
          knowledge_asset_id?: string
          knowledge_node_id?: string
          previous_content_hash?: string | null
          proposed_alt_text?: string | null
          proposed_asset_category?: string
          proposed_asset_type?: string
          proposed_content_hash?: string | null
          proposed_description?: string | null
          proposed_external_url?: string | null
          proposed_file_extension?: string | null
          proposed_license_reference?: string | null
          proposed_manifest_hash?: string
          proposed_metadata?: Json
          proposed_mime_type?: string | null
          proposed_name?: string
          proposed_original_filename?: string | null
          proposed_rights_holder?: string | null
          proposed_rights_status?: string
          proposed_size_bytes?: number | null
          proposed_storage_bucket?: string | null
          proposed_storage_path?: string | null
          proposed_storage_provider?: string
          proposed_usage_notes?: string | null
          proposed_visibility?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          stable_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_asset_revisions_knowledge_asset_id_fkey"
            columns: ["knowledge_asset_id"]
            isOneToOne: false
            referencedRelation: "knowledge_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_asset_revisions_knowledge_node_id_fkey"
            columns: ["knowledge_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_assets: {
        Row: {
          alt_text: string | null
          archived_at: string | null
          archived_by: string | null
          asset_category: string
          asset_type: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          description: string | null
          external_url: string | null
          file_extension: string | null
          id: string
          is_primary: boolean
          knowledge_node_id: string
          language: string | null
          license_reference: string | null
          metadata: Json
          mime_type: string | null
          name: string
          original_filename: string | null
          rights_holder: string | null
          rights_status: string
          size_bytes: number | null
          sort_order: number
          source_reference: string | null
          source_type: string
          stable_id: string
          status: string
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string
          updated_at: string
          updated_by: string | null
          usage_notes: string | null
          version: number
          visibility: string
        }
        Insert: {
          alt_text?: string | null
          archived_at?: string | null
          archived_by?: string | null
          asset_category: string
          asset_type: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_extension?: string | null
          id?: string
          is_primary?: boolean
          knowledge_node_id: string
          language?: string | null
          license_reference?: string | null
          metadata?: Json
          mime_type?: string | null
          name: string
          original_filename?: string | null
          rights_holder?: string | null
          rights_status?: string
          size_bytes?: number | null
          sort_order?: number
          source_reference?: string | null
          source_type: string
          stable_id: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider: string
          updated_at?: string
          updated_by?: string | null
          usage_notes?: string | null
          version?: number
          visibility?: string
        }
        Update: {
          alt_text?: string | null
          archived_at?: string | null
          archived_by?: string | null
          asset_category?: string
          asset_type?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_extension?: string | null
          id?: string
          is_primary?: boolean
          knowledge_node_id?: string
          language?: string | null
          license_reference?: string | null
          metadata?: Json
          mime_type?: string | null
          name?: string
          original_filename?: string | null
          rights_holder?: string | null
          rights_status?: string
          size_bytes?: number | null
          sort_order?: number
          source_reference?: string | null
          source_type?: string
          stable_id?: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          updated_at?: string
          updated_by?: string | null
          usage_notes?: string | null
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_assets_knowledge_node_id_fkey"
            columns: ["knowledge_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_edges: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          relation_type: string
          source_id: string
          status: string
          target_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          relation_type: string
          source_id: string
          status?: string
          target_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          relation_type?: string
          source_id?: string
          status?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_edges_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_edges_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_node_versions: {
        Row: {
          authority_level: string
          change_reason: string | null
          changed_by: string | null
          content: string
          content_hash: string
          created_at: string
          id: string
          metadata: Json
          node_id: string
          source_uri: string | null
          status: string
          summary: string | null
          title: string
          version: number
          visibility: string
        }
        Insert: {
          authority_level: string
          change_reason?: string | null
          changed_by?: string | null
          content: string
          content_hash: string
          created_at?: string
          id?: string
          metadata?: Json
          node_id: string
          source_uri?: string | null
          status: string
          summary?: string | null
          title: string
          version: number
          visibility: string
        }
        Update: {
          authority_level?: string
          change_reason?: string | null
          changed_by?: string | null
          content?: string
          content_hash?: string
          created_at?: string
          id?: string
          metadata?: Json
          node_id?: string
          source_uri?: string | null
          status?: string
          summary?: string | null
          title?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_node_versions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_nodes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          author_name: string | null
          authority_level: string
          content: string
          content_hash: string
          created_at: string
          created_by: string | null
          id: string
          language: string
          metadata: Json
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          source_id: string
          source_title: string | null
          source_type: string
          source_uri: string | null
          status: string
          summary: string | null
          title: string
          type: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
          visibility: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          author_name?: string | null
          authority_level?: string
          content: string
          content_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          source_id: string
          source_title?: string | null
          source_type: string
          source_uri?: string | null
          status?: string
          summary?: string | null
          title: string
          type: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
          visibility?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          author_name?: string | null
          authority_level?: string
          content?: string
          content_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          source_id?: string
          source_title?: string | null
          source_type?: string
          source_uri?: string | null
          status?: string
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
          visibility?: string
        }
        Relationships: []
      }
      link_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      links: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          url: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "link_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role_title: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      text_snippet_variants: {
        Row: {
          body: string
          created_at: string
          id: string
          snippet_id: string
          updated_at: string
          variant: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          snippet_id: string
          updated_at?: string
          variant: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          snippet_id?: string
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_snippet_variants_snippet_id_fkey"
            columns: ["snippet_id"]
            isOneToOne: false
            referencedRelation: "text_snippets"
            referencedColumns: ["id"]
          },
        ]
      }
      text_snippets: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_snippets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: { Args: { _user_id: string }; Returns: boolean }
      has_knowledge_admin_role: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
