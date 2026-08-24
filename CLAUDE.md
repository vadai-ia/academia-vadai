# CLAUDE.md — vadai-academia

> Contexto permanente para Claude Code. Este archivo manda sobre cualquier suposición.
> Fuente de verdad funcional: `academia-master-document.md` (en /docs del repo).

## QUÉ ES ESTE PROYECTO

Academia online de VADAI (academia.vadai.com.mx), tipo Skool: cursos en video con módulos, progreso, quizzes, tareas, certificados, comentarios, comunidad, blog y cohortes con sesiones en vivo (Google Meet). Primer curso lanza el 21-sep-2026.

## REGLA CERO — AISLAMIENTO POR SCHEMA

> **Actualización 20-ago-2026.** La academia vive en un proyecto Supabase **propio y dedicado**
> (`mtrojwqwnuzzcgtmmoop`), no en el compartido (`ukgbklhmjbniffssacjm`, donde conviven
> `ruleta_arysa`, `lusa`, `nacion`, `experiencia_vadai_ialextremo`, `demo_whaapy_productos`
> y `airbnb_hidekel`). Al arrancar M1 el proyecto estaba vacío: 0 tablas en `public`,
> 0 usuarios, 0 buckets.
>
> **La Regla Cero se mantiene íntegra de todas formas.** Cumplirla no cuesta nada y deja la
> puerta abierta a que otro sistema VADAI aterrice aquí después. Lo único que cambia es que
> hoy el riesgo de romperle algo a un tercero es teórico, no real.

Trabajas como si el proyecto fuera compartido con otros sistemas de VADAI que NO conoces y NO te incumben.

- Trabajas EXCLUSIVAMENTE en el schema `academia`.
- PROHIBIDO: crear/alterar objetos en `public`, `auth.*`, `storage.*` (excepto policies de buckets propios `academia-*`) o en cualquier otro schema del proyecto.
- Cliente Supabase SIEMPRE con `{ db: { schema: 'academia' } }`.
- Migraciones en `/supabase/migrations` con prefijo `academia_` en el nombre.
- Funciones/triggers con prefijo `academia_`. Triggers sobre `auth.users` deben ser aditivos, jamás reemplazar triggers existentes.
- Si una tarea parece requerir tocar otro schema: DETENTE y pregunta.

### Cómo se aplican las migraciones (decidido 20-ago-2026)

NO se usa `supabase db push` ni `supabase link`. El CLI crea el schema `supabase_migrations` en el proyecto, cuyo historial sería **global y compartido** con los demás repos de VADAI: dos repos aplicando migraciones se pisarían entre sí.

En su lugar: `pnpm db:migrate` → `scripts/migrate.mjs`, que aplica los `.sql` de `/supabase/migrations` en orden, cada uno en una transacción, y lleva su registro en `academia.schema_migrations`. Todo el estado de migración vive dentro de `academia`.

## STACK (NO NEGOCIABLE)

- Next.js 15 App Router, TypeScript estricto, React 19, pnpm
- Tailwind 4 + shadcn/ui
- Supabase JS directo, SIN ORM
- Server Actions para mutations; route handlers solo para webhooks, PDFs y endpoints firmados
- Tiptap para rich text (persistir JSON)
- `@react-pdf/renderer` para certificados
- Bunny Stream para video (token auth server-side)
- Stripe Payment Links + webhook idempotente

## ESTRUCTURA

```
/app
  /(auth)        login, reset
  /(alumno)      mis-cursos, curso/[slug], comunidad, blog, perfil
  /(admin)       admin/* (cursos, alumnos, entregas, cohortes, posts)
  /api/stripe/webhook
  /api/certificados/[folio]
  /certificado/[folio]      # verificación pública
/lib             lógica de negocio (NUNCA en componentes)
  /supabase      clients (browser, server, service-role)
  /bunny         firma de tokens, upload
  /stripe        webhook handlers
/components
/supabase/migrations
/scripts         migrate, seed, checks, pruebas de RLS
/docs            master document + doc de infraestructura
```

## ROLES Y ACCESO

- Roles en `academia.profiles.role`: `superadmin`, `admin`, `alumno`.
- Sign-up público DESHABILITADO. Cuentas solo server-side (invite manual o webhook Stripe) con service role.
- **Entrar con Google solo funciona si el correo YA tiene cuenta.** Con el sign-up deshabilitado,
  Supabase rechaza crear el usuario y el callback devuelve `signup_disabled`. Eso es correcto, no
  un fallo — pero el mensaje tiene que decirlo (`?error=sinCuenta`), no "intenta de nuevo".
- La primera cuenta real se crea con `pnpm cuenta:crear`. El panel de admin exige ya ser admin y
  todo lo demás crea `alumno`: sin ese script la plataforma no puede dar de alta a su propio dueño.
- Usuario autenticado SIN fila en `academia.profiles` → pantalla de sin-acceso + logout. Middleware lo aplica en TODAS las rutas.
- RLS habilitado en TODAS las tablas, sin excepciones ni "temporalmente off".
- `SUPABASE_SERVICE_ROLE_KEY` solo en server; jamás importar el client de service role en código de cliente.

## REGLAS DE NEGOCIO CRÍTICAS

- Alumno solo ve contenido de cursos con `enrollment` activo (`status='active'` y `expires_at` null o futura) y contenido `published`.
- Al expirar acceso: bloquear contenido con mensaje claro; NUNCA borrar progreso.
- **Acceso vencido = estructura sí, contenido no** (decidido 20-ago-2026). Un alumno con `expires_at` pasada sigue viendo el curso en /mis-cursos, sus módulos, los títulos de sus lecciones con candado y su progreso histórico; NO ve video, adjuntos, descripción rica, quizzes, tareas ni comunidad. En RLS eso son dos helpers distintos: `academia.has_enrollment()` (estructura) vs `academia.has_active_access()` (contenido).
- Tokens de video Bunny: firmados server-side, expiración 6h, solo si enrollment activo. Jamás exponer `BUNNY_STREAM_TOKEN_KEY` ni URLs sin token.
- Webhook Stripe: verificación de firma + idempotencia por `stripe_events.event_id`. `checkout.session.completed` crea usuario si no existe + enrollment + registra payment. `charge.refunded` marca refund y revoca enrollment.
- Zona horaria de sesiones: se guarda `timestamptz`; UI muestra hora local del navegador con referencia CDMX.
- Certificado solo si 100% de lecciones `is_required` completadas y quizzes/tareas obligatorias aprobadas.
- Archivos: descargas SIEMPRE por signed URL generada server-side; buckets privados.
- Los correos de la academia (bienvenida y recuperación) los manda **nuestro código por la API de Resend**, no el SMTP de Supabase. Plantillas en `/lib/correo`, en español y con marca. El SMTP queda como respaldo.
- Un fallo de correo **nunca** debe abortar un alta: la cuenta y la inscripción se crean primero, el correo se intenta después y su fallo solo se reporta.
- **Jamás se manda correo a una dirección `qa-*@academia.vadai.com.mx`.** Ese dominio no tiene MX,
  así que cada intento es un rebote duro, y la cuenta de Resend es compartida con los demás dominios
  de VADAI: la tasa de rebote de nuestras pruebas se cobra sobre la reputación de envío de todos.
  El corte vive en `lib/correo/resend.ts`, no en las pruebas, para que no se pueda olvidar.
- `quiz_questions.correct_option_id` NUNCA se expone al cliente. El alumno lee la vista `academia.quiz_questions_public`; la calificación es server-side.

## ANTI-PATTERNS — NO HACEMOS

- NO `any` en TypeScript
- NO secrets en código (todo `.env.local` / Vercel)
- NO lógica de negocio en componentes (va en `/lib`)
- NO bypass de RLS en queries de usuario (service role solo para provisioning/webhooks/PDFs)
- NO fetch de datos en client components cuando un server component puede hacerlo
- NO instalar dependencias no listadas en el stack sin justificación explícita
- NO tocar `public` ni ningún schema ajeno bajo ninguna circunstancia
- NO habilitar sign-up público "para probar"
- NO envolver una server action en un closure de cliente: `action={async (d) => { await accion(d); ... }}`
  le quita a React el `$ACTION_ID` y el `<form>` deja de funcionar sin JavaScript. La acción va
  directa (`action={accion}`) y el reset de los campos se hace con `key`, con un valor del servidor
- NO esconder un formulario detrás de `useState` + `onClick`: sin JS el botón no hace nada.
  Lo que se abre y se cierra va en `<details>`/`<summary>`
- NO poner un `loading.tsx` en una ruta que controle acceso con `redirect()` o `notFound()`.
  El límite de Suspense hace que Next transmita de inmediato, y a partir de ahí la respuesta
  sale **200** con el esqueleto: sin JS el rebote nunca ocurre y el alumno vencido se queda
  varado. Mover la guarda al `layout.tsx` no lo arregla. Ver `components/marca/esqueleto.tsx`
- NO usar un color de marca a mano para texto (`text-vadai-cyan`). Va por token semántico
  (`text-primary`): el cyan da 6.4:1 sobre navy pero 2.6:1 en tema claro, y reprueba AA

## PATTERNS — CÓMO LO HACEMOS

- Server components por default; client components solo con interactividad real
- Mutations = Server Actions con validación Zod y revalidación explícita
- Errores con contexto (qué operación, qué ids) en logs JSON
- Commits atómicos por feature, mensajes en español imperativo
- Estados vacíos y de carga diseñados en cada vista (no pantallas en blanco)
- Cada milestone cierra con su suite (`scripts/test-*.mjs`) probando el criterio **literal** de §10,
  contra la app corriendo y verificando en Postgres, no en la pantalla que acaba de escribir
- Una suite solo borra **lo suyo**, por marca exacta y nunca por patrón amplio (`like 'QA %'`
  también casa lo que siembra el seed). Y afirma **propiedades**, no números fijos: "el admin ve
  todos los perfiles que existen", no "ve 4" — lo segundo se rompe al dar de alta a alguien

## MILESTONES — DISCIPLINA

Trabajamos milestone por milestone (M0–M11 en el master document). Reglas:
1. NO avanzar al siguiente milestone sin validación explícita de Alejandro.
2. Cada milestone cierra con sus criterios de éxito demostrados.
3. Scope del milestone es cerrado: lo que no está listado, no se construye "de paso".
4. Si detectas un hueco en el spec: pregunta, no adivines.

## VARIABLES DE ENTORNO

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://academia.vadai.com.mx

# Solo local / scripts. NUNCA se carga en Vercel ni llega al cliente.
# La usa scripts/migrate.mjs para aplicar migraciones.
SUPABASE_DB_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=
BUNNY_STREAM_TOKEN_KEY=
BUNNY_STREAM_CDN_HOSTNAME=

# Correo transaccional. Dependencia de producción: sin esto no salen ni las
# invitaciones ni las recuperaciones de contraseña.
RESEND_API_KEY=
CORREO_REMITENTE=noreply@automail.vadai.com.mx
CORREO_REMITENTE_NOMBRE=VADAI Academia
```

## BRANDING

**Dos temas** (decidido 24-ago-2026, corrige "dark mode único"). El default lo pone
el sistema operativo de cada persona; un botón en el encabezado lo cambia a mano y
la elección se recuerda.

Paleta base: fondo `#0A1A2F`, primario `#00A0DB`, azul profundo `#006E96`, acento
lima `#C6F24E` (CTAs), texto `#F5F8FB`, secundario `#93A3B5`. Inter/sans sistema.
Mobile-first en vistas de alumno. Estética Skool-limpia, no LMS corporativo.

- **Los colores van por token semántico, nunca a mano.** `text-primary`, no
  `text-vadai-cyan`: el cyan da 6.4:1 sobre navy pero 2.6:1 sobre el fondo claro,
  así que reprueba AA en cuanto alguien cambia de tema. Cada token se define una
  sola vez con `light-dark()` en `app/globals.css`, con su contraste verificado en
  los dos temas.
- **El modo oscuro no es el claro invertido.** Invertir produce texto que cumple en
  un tema y desaparece en el otro. Los pares se eligen por separado.
- **El logo es arte negro sobre transparente**, así que va siempre sobre placa
  blanca (`components/marca/wordmark.tsx`). No se recolorea con filtros CSS:
  modificar los colores de una marca es lo que las guías de uso prohíben.
- **El guion de tema vive inline en el `<head>`** (`lib/tema/guion.ts`). Si se
  mueve a un componente o a un efecto, vuelve el destello al cargar.

## DEPLOYMENT

- Branch `main` → deploy automático a Vercel (proyecto vadai-academia)
- Preview deploys en PRs
- Variables en Vercel dashboard, verificadas antes de cada deploy de milestone
