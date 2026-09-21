/**
 * Tipos del schema `academia`.
 *
 * ARCHIVO GENERADO. No lo edites a mano: se regenera con
 *
 *   pnpm db:types
 *
 * tras aplicar migraciones nuevas. El generador vive en scripts/gen-types.mjs
 * e introspecciona la base directamente (sin el CLI de Supabase, que exige
 * Docker). Los CHECK del tipo `col in ('a','b')` se convierten en uniones de
 * TypeScript, así que los estados y roles quedan tipados de verdad.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [clave: string]: Json | undefined }
  | Json[]

export type Database = {
  academia: {
    Tables: {
      access_links: {
        Row: {
          id: string
          user_id: string
          token_hash: string
          expires_at: string
          used_count: number
          last_used_at: string | null
          revoked_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token_hash: string
          expires_at: string
          used_count?: number
          last_used_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token_hash?: string
          expires_at?: string
          used_count?: number
          last_used_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          id: string
          assignment_id: string
          user_id: string
          text_content: string | null
          files: Json
          status: 'submitted' | 'approved' | 'rejected'
          feedback: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assignment_id: string
          user_id: string
          text_content?: string | null
          files?: Json
          status?: 'submitted' | 'approved' | 'rejected'
          feedback?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assignment_id?: string
          user_id?: string
          text_content?: string | null
          files?: Json
          status?: 'submitted' | 'approved' | 'rejected'
          feedback?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          id: string
          lesson_id: string
          instructions_rich: Json | null
          allow_files: boolean
          allow_text: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          instructions_rich?: Json | null
          allow_files?: boolean
          allow_text?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          instructions_rich?: Json | null
          allow_files?: boolean
          allow_text?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          id: string
          user_id: string
          course_id: string
          folio: string
          issued_at: string
          pdf_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          folio: string
          issued_at?: string
          pdf_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          folio?: string
          issued_at?: string
          pdf_path?: string | null
          created_at?: string
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          id: string
          mensaje: string | null
          pila: string | null
          ruta: string | null
          digest: string | null
          navegador: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mensaje?: string | null
          pila?: string | null
          ruta?: string | null
          digest?: string | null
          navegador?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mensaje?: string | null
          pila?: string | null
          ruta?: string | null
          digest?: string | null
          navegador?: string | null
          created_at?: string
        }
        Relationships: []
      }
      cohort_sessions: {
        Row: {
          id: string
          cohort_id: string
          title: string
          description: string | null
          scheduled_at: string
          meet_url: string | null
          recording_lesson_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cohort_id: string
          title: string
          description?: string | null
          scheduled_at: string
          meet_url?: string | null
          recording_lesson_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cohort_id?: string
          title?: string
          description?: string | null
          scheduled_at?: string
          meet_url?: string | null
          recording_lesson_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cohorts: {
        Row: {
          id: string
          course_id: string
          name: string
          starts_on: string | null
          ends_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          starts_on?: string | null
          ends_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          name?: string
          starts_on?: string | null
          ends_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          id: string
          post_id: string
          user_id: string
          content: string
          status: 'visible' | 'hidden' | 'deleted'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          content: string
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          content?: string
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          id: string
          course_id: string
          user_id: string
          title: string
          content_rich: Json | null
          images: Json
          pinned: boolean
          status: 'visible' | 'hidden' | 'deleted'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          user_id: string
          title: string
          content_rich?: Json | null
          images?: Json
          pinned?: boolean
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          user_id?: string
          title?: string
          content_rich?: Json | null
          images?: Json
          pinned?: boolean
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          cover_url: string | null
          price_mxn: number | null
          price_usd: number | null
          stripe_payment_link_mxn: string | null
          stripe_payment_link_usd: string | null
          access_days: number | null
          course_type: 'cohort' | 'evergreen'
          status: 'draft' | 'published' | 'archived'
          certificate_enabled: boolean
          created_at: string
          updated_at: string
          is_default: boolean
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description?: string | null
          cover_url?: string | null
          price_mxn?: number | null
          price_usd?: number | null
          stripe_payment_link_mxn?: string | null
          stripe_payment_link_usd?: string | null
          access_days?: number | null
          course_type?: 'cohort' | 'evergreen'
          status?: 'draft' | 'published' | 'archived'
          certificate_enabled?: boolean
          created_at?: string
          updated_at?: string
          is_default?: boolean
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string | null
          cover_url?: string | null
          price_mxn?: number | null
          price_usd?: number | null
          stripe_payment_link_mxn?: string | null
          stripe_payment_link_usd?: string | null
          access_days?: number | null
          course_type?: 'cohort' | 'evergreen'
          status?: 'draft' | 'published' | 'archived'
          certificate_enabled?: boolean
          created_at?: string
          updated_at?: string
          is_default?: boolean
        }
        Relationships: []
      }
      dynamic_boards: {
        Row: {
          id: string
          dynamic_id: string
          company_id: string | null
          owner_user_id: string | null
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dynamic_id: string
          company_id?: string | null
          owner_user_id?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dynamic_id?: string
          company_id?: string | null
          owner_user_id?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dynamic_cells: {
        Row: {
          id: string
          board_id: string
          column_id: string
          row_id: string
          numeric_value: number | null
          text_value: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          column_id: string
          row_id: string
          numeric_value?: number | null
          text_value?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          column_id?: string
          row_id?: string
          numeric_value?: number | null
          text_value?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dynamic_columns: {
        Row: {
          id: string
          board_id: string
          label: string
          position: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          label: string
          position?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          label?: string
          position?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dynamic_rows: {
        Row: {
          id: string
          dynamic_id: string
          row_kind: 'criterio' | 'informativa'
          label: string
          weight: number | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dynamic_id: string
          row_kind: 'criterio' | 'informativa'
          label: string
          weight?: number | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dynamic_id?: string
          row_kind?: 'criterio' | 'informativa'
          label?: string
          weight?: number | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dynamics: {
        Row: {
          id: string
          course_id: string
          cohort_id: string | null
          kind: string
          title: string
          description: string | null
          scale_min: number
          scale_max: number
          status: 'draft' | 'open' | 'closed'
          closes_at: string | null
          created_by: string | null
          opened_at: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          cohort_id?: string | null
          kind?: string
          title: string
          description?: string | null
          scale_min?: number
          scale_max?: number
          status?: 'draft' | 'open' | 'closed'
          closes_at?: string | null
          created_by?: string | null
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          cohort_id?: string | null
          kind?: string
          title?: string
          description?: string | null
          scale_min?: number
          scale_max?: number
          status?: 'draft' | 'open' | 'closed'
          closes_at?: string | null
          created_by?: string | null
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          cohort_id: string | null
          source: 'stripe' | 'manual'
          starts_at: string
          expires_at: string | null
          status: 'active' | 'revoked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          cohort_id?: string | null
          source?: 'stripe' | 'manual'
          starts_at?: string
          expires_at?: string | null
          status?: 'active' | 'revoked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          cohort_id?: string | null
          source?: 'stripe' | 'manual'
          starts_at?: string
          expires_at?: string | null
          status?: 'active' | 'revoked'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_attachments: {
        Row: {
          id: string
          lesson_id: string
          storage_path: string
          file_name: string
          mime_type: string | null
          size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          storage_path: string
          file_name: string
          mime_type?: string | null
          size_bytes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          storage_path?: string
          file_name?: string
          mime_type?: string | null
          size_bytes?: number | null
          created_at?: string
        }
        Relationships: []
      }
      lesson_comments: {
        Row: {
          id: string
          lesson_id: string
          user_id: string
          parent_id: string | null
          content: string
          status: 'visible' | 'hidden' | 'deleted'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          user_id: string
          parent_id?: string | null
          content: string
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          user_id?: string
          parent_id?: string | null
          content?: string
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          user_id: string
          lesson_id: string
          completed: boolean
          seconds_watched: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          lesson_id: string
          completed?: boolean
          seconds_watched?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          lesson_id?: string
          completed?: boolean
          seconds_watched?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          description_rich: Json | null
          position: number
          lesson_type: 'video' | 'text' | 'quiz' | 'assignment'
          bunny_video_id: string | null
          video_duration_sec: number | null
          is_required: boolean
          status: 'draft' | 'published'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          description_rich?: Json | null
          position?: number
          lesson_type?: 'video' | 'text' | 'quiz' | 'assignment'
          bunny_video_id?: string | null
          video_duration_sec?: number | null
          is_required?: boolean
          status?: 'draft' | 'published'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          description_rich?: Json | null
          position?: number
          lesson_type?: 'video' | 'text' | 'quiz' | 'assignment'
          bunny_video_id?: string | null
          video_duration_sec?: number | null
          is_required?: boolean
          status?: 'draft' | 'published'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          user_id: string | null
          first_name: string
          last_name: string
          email: string
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          first_name?: string
          last_name?: string
          email: string
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          user_id: string | null
          email: string
          course_id: string
          stripe_session_id: string
          stripe_payment_intent: string | null
          amount: number
          currency: 'mxn' | 'usd'
          status: 'paid' | 'refunded'
          created_at: string
          updated_at: string
          account_deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          course_id: string
          stripe_session_id: string
          stripe_payment_intent?: string | null
          amount: number
          currency: 'mxn' | 'usd'
          status?: 'paid' | 'refunded'
          created_at?: string
          updated_at?: string
          account_deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          course_id?: string
          stripe_session_id?: string
          stripe_payment_intent?: string | null
          amount?: number
          currency?: 'mxn' | 'usd'
          status?: 'paid' | 'refunded'
          created_at?: string
          updated_at?: string
          account_deleted_at?: string | null
        }
        Relationships: []
      }
      poll_answers: {
        Row: {
          id: string
          question_id: string
          poll_participant_id: string
          ordinal: number
          text_value: string | null
          option_id: string | null
          numeric_value: number | null
          text_norm: string | null
          hidden: boolean
          created_at: string
          corrida: number
        }
        Insert: {
          id?: string
          question_id: string
          poll_participant_id: string
          ordinal?: number
          text_value?: string | null
          option_id?: string | null
          numeric_value?: number | null
          text_norm?: string | null
          hidden?: boolean
          created_at?: string
          corrida: number
        }
        Update: {
          id?: string
          question_id?: string
          poll_participant_id?: string
          ordinal?: number
          text_value?: string | null
          option_id?: string | null
          numeric_value?: number | null
          text_norm?: string | null
          hidden?: boolean
          created_at?: string
          corrida?: number
        }
        Relationships: []
      }
      poll_join_attempts: {
        Row: {
          id: number
          poll_id: string
          ip_hash: string
          kind: 'join' | 'account' | 'answer'
          created_at: string
        }
        Insert: {
          id?: number
          poll_id: string
          ip_hash: string
          kind: 'join' | 'account' | 'answer'
          created_at?: string
        }
        Update: {
          id?: number
          poll_id?: string
          ip_hash?: string
          kind?: 'join' | 'account' | 'answer'
          created_at?: string
        }
        Relationships: []
      }
      poll_participants: {
        Row: {
          id: string
          poll_id: string
          participant_id: string
          session_token: string
          display_name: string
          joined_at: string
          corrida: number
        }
        Insert: {
          id?: string
          poll_id: string
          participant_id: string
          session_token: string
          display_name?: string
          joined_at?: string
          corrida: number
        }
        Update: {
          id?: string
          poll_id?: string
          participant_id?: string
          session_token?: string
          display_name?: string
          joined_at?: string
          corrida?: number
        }
        Relationships: []
      }
      poll_questions: {
        Row: {
          id: string
          poll_id: string
          position: number
          prompt: string
          question_type: 'nube' | 'opcion' | 'escala' | 'muro'
          options: Json
          settings: Json
          status: 'pending' | 'open' | 'closed'
          opened_at: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          position?: number
          prompt: string
          question_type: 'nube' | 'opcion' | 'escala' | 'muro'
          options?: Json
          settings?: Json
          status?: 'pending' | 'open' | 'closed'
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          poll_id?: string
          position?: number
          prompt?: string
          question_type?: 'nube' | 'opcion' | 'escala' | 'muro'
          options?: Json
          settings?: Json
          status?: 'pending' | 'open' | 'closed'
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      polls: {
        Row: {
          id: string
          course_id: string
          cohort_id: string | null
          title: string
          description: string | null
          join_code: string
          projection_token: string
          status: 'draft' | 'live' | 'closed'
          allow_guests: boolean
          show_names: boolean
          state_version: number
          created_by: string | null
          opened_at: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
          corrida: number
        }
        Insert: {
          id?: string
          course_id: string
          cohort_id?: string | null
          title: string
          description?: string | null
          join_code: string
          projection_token: string
          status?: 'draft' | 'live' | 'closed'
          allow_guests?: boolean
          show_names?: boolean
          state_version?: number
          created_by?: string | null
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
          corrida?: number
        }
        Update: {
          id?: string
          course_id?: string
          cohort_id?: string | null
          title?: string
          description?: string | null
          join_code?: string
          projection_token?: string
          status?: 'draft' | 'live' | 'closed'
          allow_guests?: boolean
          show_names?: boolean
          state_version?: number
          created_by?: string | null
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
          corrida?: number
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          author_id: string
          post_type: 'announcement' | 'blog'
          title: string
          content_rich: Json | null
          cover_url: string | null
          audience_course_id: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          post_type?: 'announcement' | 'blog'
          title: string
          content_rich?: Json | null
          cover_url?: string | null
          audience_course_id?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          post_type?: 'announcement' | 'blog'
          title?: string
          content_rich?: Json | null
          cover_url?: string | null
          audience_course_id?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: 'superadmin' | 'admin' | 'alumno' | 'invitado'
          status: 'active' | 'suspended'
          created_at: string
          updated_at: string
          notifications_seen_at: string | null
          company_id: string | null
          last_sign_in_at: string | null
        }
        Insert: {
          user_id: string
          email: string
          full_name?: string
          avatar_url?: string | null
          role?: 'superadmin' | 'admin' | 'alumno' | 'invitado'
          status?: 'active' | 'suspended'
          created_at?: string
          updated_at?: string
          notifications_seen_at?: string | null
          company_id?: string | null
          last_sign_in_at?: string | null
        }
        Update: {
          user_id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'superadmin' | 'admin' | 'alumno' | 'invitado'
          status?: 'active' | 'suspended'
          created_at?: string
          updated_at?: string
          notifications_seen_at?: string | null
          company_id?: string | null
          last_sign_in_at?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          id: string
          quiz_id: string
          user_id: string
          answers: Json
          score: number
          passed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          user_id: string
          answers?: Json
          score?: number
          passed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          user_id?: string
          answers?: Json
          score?: number
          passed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string
          question: string
          options: Json
          correct_option_id: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question: string
          options?: Json
          correct_option_id: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          question?: string
          options?: Json
          correct_option_id?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          id: string
          lesson_id: string
          passing_score: number
          reveal_answers: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          passing_score?: number
          reveal_answers?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          passing_score?: number
          reveal_answers?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      schema_migrations: {
        Row: {
          archivo: string
          checksum: string
          aplicada_en: string
          duracion_ms: number | null
        }
        Insert: {
          archivo: string
          checksum: string
          aplicada_en?: string
          duracion_ms?: number | null
        }
        Update: {
          archivo?: string
          checksum?: string
          aplicada_en?: string
          duracion_ms?: number | null
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          event_id: string
          event_type: string | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type?: string | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string | null
          processed_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      actividad_por_curso: {
        Row: {
          user_id: string | null
          course_id: string | null
          lecciones: number | null
          quizzes: number | null
          tareas: number | null
          tareas_aprobadas: number | null
          publicaciones: number | null
          comentarios: number | null
          certificados: number | null
          dinamicas: number | null
        }
        Relationships: []
      }
      lesson_outline: {
        Row: {
          id: string | null
          module_id: string | null
          course_id: string | null
          title: string | null
          position: number | null
          lesson_type: string | null
          is_required: boolean | null
          tiene_video: boolean | null
          video_duration_sec: number | null
          desbloqueada: boolean | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          user_id: string | null
          full_name: string | null
          avatar_url: string | null
          es_equipo: boolean | null
        }
        Relationships: []
      }
      quiz_questions_public: {
        Row: {
          id: string | null
          quiz_id: string | null
          question: string | null
          options: Json | null
          position: number | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type EsquemaAcademia = Database['academia']

export type Tabla<T extends keyof EsquemaAcademia['Tables']> =
  EsquemaAcademia['Tables'][T]['Row']

export type NuevaFila<T extends keyof EsquemaAcademia['Tables']> =
  EsquemaAcademia['Tables'][T]['Insert']

export type CambioEnFila<T extends keyof EsquemaAcademia['Tables']> =
  EsquemaAcademia['Tables'][T]['Update']

export type Vista<V extends keyof EsquemaAcademia['Views']> =
  EsquemaAcademia['Views'][V]['Row']
