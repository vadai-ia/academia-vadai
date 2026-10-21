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
      access_emails: {
        Row: {
          id: string
          user_id: string
          email: string
          tipo: 'bienvenida' | 'recordatorio' | 'nuevo_curso' | 'nueva_generacion'
          origen: 'alta_manual' | 'alta_masiva' | 'curso' | 'ficha' | 'stripe' | 'membresia' | 'encuesta' | 'equipo' | 'recordatorio' | 'reenvio' | 'reenvio_fallidos' | 'cambio_correo' | 'cambio_generacion'
          con_enlace: boolean
          access_link_id: string | null
          course_ids: string[]
          cohort_id: string | null
          estado: 'pendiente' | 'enviado' | 'fallido' | 'omitido'
          motivo: string | null
          resend_id: string | null
          lote_id: string | null
          es_qa: boolean
          creado_por: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          tipo: 'bienvenida' | 'recordatorio' | 'nuevo_curso' | 'nueva_generacion'
          origen: 'alta_manual' | 'alta_masiva' | 'curso' | 'ficha' | 'stripe' | 'membresia' | 'encuesta' | 'equipo' | 'recordatorio' | 'reenvio' | 'reenvio_fallidos' | 'cambio_correo' | 'cambio_generacion'
          con_enlace?: boolean
          access_link_id?: string | null
          course_ids?: string[]
          cohort_id?: string | null
          estado?: 'pendiente' | 'enviado' | 'fallido' | 'omitido'
          motivo?: string | null
          resend_id?: string | null
          lote_id?: string | null
          es_qa?: boolean
          creado_por?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          tipo?: 'bienvenida' | 'recordatorio' | 'nuevo_curso' | 'nueva_generacion'
          origen?: 'alta_manual' | 'alta_masiva' | 'curso' | 'ficha' | 'stripe' | 'membresia' | 'encuesta' | 'equipo' | 'recordatorio' | 'reenvio' | 'reenvio_fallidos' | 'cambio_correo' | 'cambio_generacion'
          con_enlace?: boolean
          access_link_id?: string | null
          course_ids?: string[]
          cohort_id?: string | null
          estado?: 'pendiente' | 'enviado' | 'fallido' | 'omitido'
          motivo?: string | null
          resend_id?: string | null
          lote_id?: string | null
          es_qa?: boolean
          creado_por?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      agent_digests: {
        Row: {
          fecha: string
          es_qa: boolean
          contenido: Json
          created_at: string
        }
        Insert: {
          fecha: string
          es_qa?: boolean
          contenido: Json
          created_at?: string
        }
        Update: {
          fecha?: string
          es_qa?: boolean
          contenido?: Json
          created_at?: string
        }
        Relationships: []
      }
      agent_drafts: {
        Row: {
          id: string
          tipo: 'respuesta' | 'noticia'
          es_qa: boolean
          job_id: string | null
          course_id: string | null
          tipo_origen: 'post' | 'comentario' | 'leccion' | null
          hilo_id: string | null
          titulo: string | null
          texto: string
          fuente: string | null
          certeza: number | null
          motivo: string | null
          estado: 'pendiente' | 'publicado' | 'descartado'
          revisado_por: string | null
          revisado_en: string | null
          publicado_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tipo: 'respuesta' | 'noticia'
          es_qa?: boolean
          job_id?: string | null
          course_id?: string | null
          tipo_origen?: 'post' | 'comentario' | 'leccion' | null
          hilo_id?: string | null
          titulo?: string | null
          texto: string
          fuente?: string | null
          certeza?: number | null
          motivo?: string | null
          estado?: 'pendiente' | 'publicado' | 'descartado'
          revisado_por?: string | null
          revisado_en?: string | null
          publicado_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tipo?: 'respuesta' | 'noticia'
          es_qa?: boolean
          job_id?: string | null
          course_id?: string | null
          tipo_origen?: 'post' | 'comentario' | 'leccion' | null
          hilo_id?: string | null
          titulo?: string | null
          texto?: string
          fuente?: string | null
          certeza?: number | null
          motivo?: string | null
          estado?: 'pendiente' | 'publicado' | 'descartado'
          revisado_por?: string | null
          revisado_en?: string | null
          publicado_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      agent_jobs: {
        Row: {
          id: string
          tipo_origen: 'post' | 'comentario' | 'leccion'
          origen_id: string
          es_qa: boolean
          course_id: string
          hilo_id: string
          estado: 'pendiente' | 'procesando' | 'hecho' | 'borrador' | 'omitido' | 'fallido'
          toca_en: string
          intentos: number
          bloqueado_hasta: string | null
          resultado: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tipo_origen: 'post' | 'comentario' | 'leccion'
          origen_id: string
          es_qa?: boolean
          course_id: string
          hilo_id: string
          estado?: 'pendiente' | 'procesando' | 'hecho' | 'borrador' | 'omitido' | 'fallido'
          toca_en: string
          intentos?: number
          bloqueado_hasta?: string | null
          resultado?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tipo_origen?: 'post' | 'comentario' | 'leccion'
          origen_id?: string
          es_qa?: boolean
          course_id?: string
          hilo_id?: string
          estado?: 'pendiente' | 'procesando' | 'hecho' | 'borrador' | 'omitido' | 'fallido'
          toca_en?: string
          intentos?: number
          bloqueado_hasta?: string | null
          resultado?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_knowledge: {
        Row: {
          id: string
          fuente: 'repo' | 'plataforma' | 'fireflies' | 'bunny' | 'equipo'
          clave: string
          titulo: string
          course_id: string | null
          contenido: string
          caracteres: number | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fuente: 'repo' | 'plataforma' | 'fireflies' | 'bunny' | 'equipo'
          clave: string
          titulo: string
          course_id?: string | null
          contenido: string
          caracteres?: number | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fuente?: 'repo' | 'plataforma' | 'fireflies' | 'bunny' | 'equipo'
          clave?: string
          titulo?: string
          course_id?: string | null
          contenido?: string
          caracteres?: number | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          id: string
          job_id: string | null
          es_qa: boolean
          tarea: 'responder' | 'escalar' | 'resumen' | 'noticias' | 'probador' | 'noticias_redactar' | 'noticia_liga'
          modelo: string
          estado: 'reservada' | 'cerrada'
          reservado_usd: number
          costo_usd: number
          tokens_entrada: number
          tokens_salida: number
          tokens_cache_lectura: number
          tokens_cache_escritura: number
          busquedas: number
          decision: string | null
          certeza: number | null
          motivo: string | null
          created_at: string
          lecturas: number
          news_hunt_id: string | null
        }
        Insert: {
          id?: string
          job_id?: string | null
          es_qa?: boolean
          tarea: 'responder' | 'escalar' | 'resumen' | 'noticias' | 'probador' | 'noticias_redactar' | 'noticia_liga'
          modelo: string
          estado?: 'reservada' | 'cerrada'
          reservado_usd?: number
          costo_usd?: number
          tokens_entrada?: number
          tokens_salida?: number
          tokens_cache_lectura?: number
          tokens_cache_escritura?: number
          busquedas?: number
          decision?: string | null
          certeza?: number | null
          motivo?: string | null
          created_at?: string
          lecturas?: number
          news_hunt_id?: string | null
        }
        Update: {
          id?: string
          job_id?: string | null
          es_qa?: boolean
          tarea?: 'responder' | 'escalar' | 'resumen' | 'noticias' | 'probador' | 'noticias_redactar' | 'noticia_liga'
          modelo?: string
          estado?: 'reservada' | 'cerrada'
          reservado_usd?: number
          costo_usd?: number
          tokens_entrada?: number
          tokens_salida?: number
          tokens_cache_lectura?: number
          tokens_cache_escritura?: number
          busquedas?: number
          decision?: string | null
          certeza?: number | null
          motivo?: string | null
          created_at?: string
          lecturas?: number
          news_hunt_id?: string | null
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          es_qa: boolean
          modo: 'apagado' | 'borradores' | 'automatico'
          prompt: string
          umbral: number
          espera_min: number
          espera_max: number
          hora_inicio: number
          hora_fin: number
          busqueda_web: boolean
          noticias: boolean
          tope_usd: number
          modelo_rapido: string
          modelo_fuerte: string
          pausado_por_tope: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          es_qa?: boolean
          modo?: 'apagado' | 'borradores' | 'automatico'
          prompt?: string
          umbral?: number
          espera_min?: number
          espera_max?: number
          hora_inicio?: number
          hora_fin?: number
          busqueda_web?: boolean
          noticias?: boolean
          tope_usd?: number
          modelo_rapido?: string
          modelo_fuerte?: string
          pausado_por_tope?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          es_qa?: boolean
          modo?: 'apagado' | 'borradores' | 'automatico'
          prompt?: string
          umbral?: number
          espera_min?: number
          espera_max?: number
          hora_inicio?: number
          hora_fin?: number
          busqueda_web?: boolean
          noticias?: boolean
          tope_usd?: number
          modelo_rapido?: string
          modelo_fuerte?: string
          pausado_por_tope?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_bitacora: {
        Row: {
          id: number
          key_id: string | null
          metodo: string
          ruta: string
          status: number
          duracion_ms: number
          ip_huella: string | null
          created_at: string
        }
        Insert: {
          id?: number
          key_id?: string | null
          metodo: string
          ruta: string
          status: number
          duracion_ms: number
          ip_huella?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          key_id?: string | null
          metodo?: string
          ruta?: string
          status?: number
          duracion_ms?: number
          ip_huella?: string | null
          created_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          id: string
          nombre: string
          key_id: string
          hash: string
          permisos: string[]
          creada_por: string | null
          created_at: string
          expires_at: string | null
          revoked_at: string | null
          last_used_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          key_id: string
          hash: string
          permisos?: string[]
          creada_por?: string | null
          created_at?: string
          expires_at?: string | null
          revoked_at?: string | null
          last_used_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          key_id?: string
          hash?: string
          permisos?: string[]
          creada_por?: string | null
          created_at?: string
          expires_at?: string | null
          revoked_at?: string | null
          last_used_at?: string | null
        }
        Relationships: []
      }
      api_uso: {
        Row: {
          key_id: string
          hora: string
          cuenta: number
        }
        Insert: {
          key_id: string
          hora: string
          cuenta?: number
        }
        Update: {
          key_id?: string
          hora?: string
          cuenta?: number
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
          kind: 'clase' | 'evento'
          location: string | null
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
          kind?: 'clase' | 'evento'
          location?: string | null
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
          kind?: 'clase' | 'evento'
          location?: string | null
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
          open_for_enrollment: boolean
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          starts_on?: string | null
          ends_on?: string | null
          created_at?: string
          updated_at?: string
          open_for_enrollment?: boolean
        }
        Update: {
          id?: string
          course_id?: string
          name?: string
          starts_on?: string | null
          ends_on?: string | null
          created_at?: string
          updated_at?: string
          open_for_enrollment?: boolean
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
          via: 'humano' | 'api' | 'agente' | 'agente_revisado'
          api_key_id: string | null
          agent_job_id: string | null
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          content: string
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
          via?: 'humano' | 'api' | 'agente' | 'agente_revisado'
          api_key_id?: string | null
          agent_job_id?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          content?: string
          status?: 'visible' | 'hidden' | 'deleted'
          created_at?: string
          updated_at?: string
          via?: 'humano' | 'api' | 'agente' | 'agente_revisado'
          api_key_id?: string | null
          agent_job_id?: string | null
        }
        Relationships: []
      }
      community_insights: {
        Row: {
          id: string
          tipo: 'idea' | 'peticion' | 'queja' | 'duda_frecuente' | 'elogio'
          es_qa: boolean
          resumen: string
          course_id: string | null
          hilo_id: string | null
          atendida: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tipo: 'idea' | 'peticion' | 'queja' | 'duda_frecuente' | 'elogio'
          es_qa?: boolean
          resumen: string
          course_id?: string | null
          hilo_id?: string | null
          atendida?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tipo?: 'idea' | 'peticion' | 'queja' | 'duda_frecuente' | 'elogio'
          es_qa?: boolean
          resumen?: string
          course_id?: string | null
          hilo_id?: string | null
          atendida?: boolean
          created_at?: string
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
          cohort_id: string | null
          broadcast_id: string | null
          attended_at: string | null
          attended_by: string | null
          topic_id: string | null
          via: 'humano' | 'api' | 'agente' | 'agente_revisado'
          api_key_id: string | null
          enlace_url: string | null
          enlace_medio: string | null
          resumen: string | null
          pinned_until: string | null
          publicado_por: string | null
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
          cohort_id?: string | null
          broadcast_id?: string | null
          attended_at?: string | null
          attended_by?: string | null
          topic_id?: string | null
          via?: 'humano' | 'api' | 'agente' | 'agente_revisado'
          api_key_id?: string | null
          enlace_url?: string | null
          enlace_medio?: string | null
          resumen?: string | null
          pinned_until?: string | null
          publicado_por?: string | null
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
          cohort_id?: string | null
          broadcast_id?: string | null
          attended_at?: string | null
          attended_by?: string | null
          topic_id?: string | null
          via?: 'humano' | 'api' | 'agente' | 'agente_revisado'
          api_key_id?: string | null
          enlace_url?: string | null
          enlace_medio?: string | null
          resumen?: string | null
          pinned_until?: string | null
          publicado_por?: string | null
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          id: string
          post_id: string | null
          comment_id: string | null
          user_id: string
          emoji: '👍' | '👏' | '🚀' | '❤️' | '💡' | '🔥'
          created_at: string
        }
        Insert: {
          id?: string
          post_id?: string | null
          comment_id?: string | null
          user_id: string
          emoji: '👍' | '👏' | '🚀' | '❤️' | '💡' | '🔥'
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string | null
          comment_id?: string | null
          user_id?: string
          emoji?: '👍' | '👏' | '🚀' | '❤️' | '💡' | '🔥'
          created_at?: string
        }
        Relationships: []
      }
      community_topics: {
        Row: {
          id: string
          course_id: string
          name: string
          slug: string
          position: number
          archived: boolean
          created_at: string
          solo_equipo: boolean
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          slug: string
          position?: number
          archived?: boolean
          created_at?: string
          solo_equipo?: boolean
        }
        Update: {
          id?: string
          course_id?: string
          name?: string
          slug?: string
          position?: number
          archived?: boolean
          created_at?: string
          solo_equipo?: boolean
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
          in_catalog: boolean
          is_free: boolean
          category: 'creativas' | 'administrativas' | 'comerciales' | null
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
          in_catalog?: boolean
          is_free?: boolean
          category?: 'creativas' | 'administrativas' | 'comerciales' | null
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
          in_catalog?: boolean
          is_free?: boolean
          category?: 'creativas' | 'administrativas' | 'comerciales' | null
        }
        Relationships: []
      }
      diploma_events: {
        Row: {
          user_id: string
          clave: string
          abierto_primero: string | null
          abierto_ultimo: string | null
          aperturas: number
          descargado_primero: string | null
          descargado_ultimo: string | null
          descargas: number
        }
        Insert: {
          user_id: string
          clave: string
          abierto_primero?: string | null
          abierto_ultimo?: string | null
          aperturas?: number
          descargado_primero?: string | null
          descargado_ultimo?: string | null
          descargas?: number
        }
        Update: {
          user_id?: string
          clave?: string
          abierto_primero?: string | null
          abierto_ultimo?: string | null
          aperturas?: number
          descargado_primero?: string | null
          descargado_ultimo?: string | null
          descargas?: number
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
          source: 'stripe' | 'manual' | 'catalogo' | 'membresia'
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
          source?: 'stripe' | 'manual' | 'catalogo' | 'membresia'
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
          source?: 'stripe' | 'manual' | 'catalogo' | 'membresia'
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
          attended_at: string | null
          attended_by: string | null
          via: 'humano' | 'api' | 'agente' | 'agente_revisado'
          agent_job_id: string | null
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
          attended_at?: string | null
          attended_by?: string | null
          via?: 'humano' | 'api' | 'agente' | 'agente_revisado'
          agent_job_id?: string | null
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
          attended_at?: string | null
          attended_by?: string | null
          via?: 'humano' | 'api' | 'agente' | 'agente_revisado'
          agent_job_id?: string | null
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
      membership_cancellations: {
        Row: {
          id: string
          plan_id: string
          stripe_subscription_id: string
          user_id: string | null
          reason: 'precio' | 'tiempo' | 'contenido' | 'otra_opcion' | 'calidad' | 'otro' | 'sin_motivo'
          comment: string | null
          origin: 'plataforma' | 'portal'
          created_at: string
          reverted_at: string | null
        }
        Insert: {
          id?: string
          plan_id: string
          stripe_subscription_id: string
          user_id?: string | null
          reason: 'precio' | 'tiempo' | 'contenido' | 'otra_opcion' | 'calidad' | 'otro' | 'sin_motivo'
          comment?: string | null
          origin: 'plataforma' | 'portal'
          created_at?: string
          reverted_at?: string | null
        }
        Update: {
          id?: string
          plan_id?: string
          stripe_subscription_id?: string
          user_id?: string | null
          reason?: 'precio' | 'tiempo' | 'contenido' | 'otra_opcion' | 'calidad' | 'otro' | 'sin_motivo'
          comment?: string | null
          origin?: 'plataforma' | 'portal'
          created_at?: string
          reverted_at?: string | null
        }
        Relationships: []
      }
      membership_invoices: {
        Row: {
          stripe_invoice_id: string
          stripe_subscription_id: string
          plan_id: string
          user_id: string | null
          email: string | null
          amount: number
          currency: string
          period_start: string | null
          period_end: string | null
          status: 'paid' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          stripe_invoice_id: string
          stripe_subscription_id: string
          plan_id: string
          user_id?: string | null
          email?: string | null
          amount: number
          currency: string
          period_start?: string | null
          period_end?: string | null
          status: 'paid' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          stripe_invoice_id?: string
          stripe_subscription_id?: string
          plan_id?: string
          user_id?: string | null
          email?: string | null
          amount?: number
          currency?: string
          period_start?: string | null
          period_end?: string | null
          status?: 'paid' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_plan_courses: {
        Row: {
          plan_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          plan_id: string
          course_id: string
          created_at?: string
        }
        Update: {
          plan_id?: string
          course_id?: string
          created_at?: string
        }
        Relationships: []
      }
      membership_plan_prices: {
        Row: {
          stripe_price_id: string
          plan_id: string
          amount_mxn: number
          created_at: string
        }
        Insert: {
          stripe_price_id: string
          plan_id: string
          amount_mxn: number
          created_at?: string
        }
        Update: {
          stripe_price_id?: string
          plan_id?: string
          amount_mxn?: number
          created_at?: string
        }
        Relationships: []
      }
      membership_plans: {
        Row: {
          id: string
          slug: string
          name: string
          price_mxn: number
          hub_course_id: string | null
          stripe_product_id: string | null
          stripe_price_id: string | null
          stripe_payment_link: string | null
          portal_login_url: string | null
          created_at: string
          updated_at: string
          price_compare_mxn: number | null
          tagline: string | null
          description: string | null
          image_url: string | null
          status: 'draft' | 'active' | 'archived'
          stripe_payment_link_id: string | null
          stripe_portal_config_id: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          price_mxn: number
          hub_course_id?: string | null
          stripe_product_id?: string | null
          stripe_price_id?: string | null
          stripe_payment_link?: string | null
          portal_login_url?: string | null
          created_at?: string
          updated_at?: string
          price_compare_mxn?: number | null
          tagline?: string | null
          description?: string | null
          image_url?: string | null
          status?: 'draft' | 'active' | 'archived'
          stripe_payment_link_id?: string | null
          stripe_portal_config_id?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          price_mxn?: number
          hub_course_id?: string | null
          stripe_product_id?: string | null
          stripe_price_id?: string | null
          stripe_payment_link?: string | null
          portal_login_url?: string | null
          created_at?: string
          updated_at?: string
          price_compare_mxn?: number | null
          tagline?: string | null
          description?: string | null
          image_url?: string | null
          status?: 'draft' | 'active' | 'archived'
          stripe_payment_link_id?: string | null
          stripe_portal_config_id?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          plan_id: string
          user_id: string | null
          email: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string
          status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          ended_at: string | null
          access_until: string | null
          last_event_at: string | null
          started_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id?: string | null
          email?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id: string
          status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          ended_at?: string | null
          access_until?: string | null
          last_event_at?: string | null
          started_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          user_id?: string | null
          email?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string
          status?: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          ended_at?: string | null
          access_until?: string | null
          last_event_at?: string | null
          started_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      module_members: {
        Row: {
          module_id: string
          user_id: string
          added_by: string | null
          added_at: string
          notified_at: string | null
        }
        Insert: {
          module_id: string
          user_id: string
          added_by?: string | null
          added_at?: string
          notified_at?: string | null
        }
        Update: {
          module_id?: string
          user_id?: string
          added_by?: string | null
          added_at?: string
          notified_at?: string | null
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
          cohort_id: string | null
          is_restricted: boolean
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          position?: number
          created_at?: string
          updated_at?: string
          cohort_id?: string | null
          is_restricted?: boolean
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          position?: number
          created_at?: string
          updated_at?: string
          cohort_id?: string | null
          is_restricted?: boolean
        }
        Relationships: []
      }
      news_hunts: {
        Row: {
          id: string
          es_qa: boolean
          tipo: 'caceria' | 'liga'
          origen: 'boton' | 'cron'
          estado: 'buscando' | 'lista' | 'sin_resultados' | 'fallida'
          paso: string | null
          pedido_por: string | null
          url_pedida: string | null
          enfoque: string | null
          descartes: Json
          detalle: string | null
          started_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          es_qa?: boolean
          tipo: 'caceria' | 'liga'
          origen: 'boton' | 'cron'
          estado?: 'buscando' | 'lista' | 'sin_resultados' | 'fallida'
          paso?: string | null
          pedido_por?: string | null
          url_pedida?: string | null
          enfoque?: string | null
          descartes?: Json
          detalle?: string | null
          started_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          es_qa?: boolean
          tipo?: 'caceria' | 'liga'
          origen?: 'boton' | 'cron'
          estado?: 'buscando' | 'lista' | 'sin_resultados' | 'fallida'
          paso?: string | null
          pedido_por?: string | null
          url_pedida?: string | null
          enfoque?: string | null
          descartes?: Json
          detalle?: string | null
          started_at?: string
          finished_at?: string | null
        }
        Relationships: []
      }
      news_items: {
        Row: {
          id: string
          es_qa: boolean
          hunt_id: string | null
          course_id: string
          url: string
          url_original: string | null
          url_hash: string
          tipo_fuente: 'articulo' | 'video'
          medio: string | null
          titulo: string
          resumen: string
          texto: string
          imagen_url: string | null
          imagen_path: string | null
          publicado_en_fuente: string | null
          orden: number | null
          notas: string | null
          estado: 'propuesta' | 'publicada' | 'descartada'
          post_id: string | null
          revisado_por: string | null
          revisado_en: string | null
          created_at: string
        }
        Insert: {
          id?: string
          es_qa?: boolean
          hunt_id?: string | null
          course_id: string
          url: string
          url_original?: string | null
          url_hash: string
          tipo_fuente?: 'articulo' | 'video'
          medio?: string | null
          titulo: string
          resumen: string
          texto: string
          imagen_url?: string | null
          imagen_path?: string | null
          publicado_en_fuente?: string | null
          orden?: number | null
          notas?: string | null
          estado?: 'propuesta' | 'publicada' | 'descartada'
          post_id?: string | null
          revisado_por?: string | null
          revisado_en?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          es_qa?: boolean
          hunt_id?: string | null
          course_id?: string
          url?: string
          url_original?: string | null
          url_hash?: string
          tipo_fuente?: 'articulo' | 'video'
          medio?: string | null
          titulo?: string
          resumen?: string
          texto?: string
          imagen_url?: string | null
          imagen_path?: string | null
          publicado_en_fuente?: string | null
          orden?: number | null
          notas?: string | null
          estado?: 'propuesta' | 'publicada' | 'descartada'
          post_id?: string | null
          revisado_por?: string | null
          revisado_en?: string | null
          created_at?: string
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
          audience_cohort_id: string | null
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
          audience_cohort_id?: string | null
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
          audience_cohort_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: 'superadmin' | 'admin' | 'community_manager' | 'alumno' | 'invitado'
          status: 'active' | 'suspended'
          created_at: string
          updated_at: string
          notifications_seen_at: string | null
          company_id: string | null
          last_sign_in_at: string | null
          blog_seen_at: string | null
          community_seen_at: string | null
          bio: string | null
          es_bot: boolean
        }
        Insert: {
          user_id: string
          email: string
          full_name?: string
          avatar_url?: string | null
          role?: 'superadmin' | 'admin' | 'community_manager' | 'alumno' | 'invitado'
          status?: 'active' | 'suspended'
          created_at?: string
          updated_at?: string
          notifications_seen_at?: string | null
          company_id?: string | null
          last_sign_in_at?: string | null
          blog_seen_at?: string | null
          community_seen_at?: string | null
          bio?: string | null
          es_bot?: boolean
        }
        Update: {
          user_id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'superadmin' | 'admin' | 'community_manager' | 'alumno' | 'invitado'
          status?: 'active' | 'suspended'
          created_at?: string
          updated_at?: string
          notifications_seen_at?: string | null
          company_id?: string | null
          last_sign_in_at?: string | null
          blog_seen_at?: string | null
          community_seen_at?: string | null
          bio?: string | null
          es_bot?: boolean
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
      webhook_entregas: {
        Row: {
          id: string
          webhook_id: string
          evento_id: string
          tipo: string
          datos: Json
          estado: 'pendiente' | 'entregada' | 'fallida'
          intentos: number
          proximo_intento: string
          ultimo_error: string | null
          created_at: string
          entregada_at: string | null
        }
        Insert: {
          id?: string
          webhook_id: string
          evento_id: string
          tipo: string
          datos: Json
          estado?: 'pendiente' | 'entregada' | 'fallida'
          intentos?: number
          proximo_intento?: string
          ultimo_error?: string | null
          created_at?: string
          entregada_at?: string | null
        }
        Update: {
          id?: string
          webhook_id?: string
          evento_id?: string
          tipo?: string
          datos?: Json
          estado?: 'pendiente' | 'entregada' | 'fallida'
          intentos?: number
          proximo_intento?: string
          ultimo_error?: string | null
          created_at?: string
          entregada_at?: string | null
        }
        Relationships: []
      }
      webhooks_salientes: {
        Row: {
          id: string
          nombre: string
          url: string
          eventos: string[]
          activo: boolean
          secreto_version: number
          fallas_seguidas: number
          creado_por: string | null
          created_at: string
          desactivado_en: string | null
        }
        Insert: {
          id?: string
          nombre: string
          url: string
          eventos: string[]
          activo?: boolean
          secreto_version?: number
          fallas_seguidas?: number
          creado_por?: string | null
          created_at?: string
          desactivado_en?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          url?: string
          eventos?: string[]
          activo?: boolean
          secreto_version?: number
          fallas_seguidas?: number
          creado_por?: string | null
          created_at?: string
          desactivado_en?: string | null
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
          cohort_id: string | null
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
          cohort_id: string | null
          exclusiva: boolean | null
          para_mi: boolean | null
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
