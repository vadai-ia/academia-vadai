# MASTER DOCUMENT — VADAI ACADEMIA

> **Versión:** 1.2 — Agosto 2026
> **Fuente de verdad para Claude Code del repo `vadai-academia`. Documento autocontenido.**
> Lanzamiento del primer curso: **lunes 21 de septiembre de 2026.**

---

## 0. CONTEXTO Y VISIÓN — POR QUÉ EXISTE ESTA PLATAFORMA

### Quién construye esto
VADAI es una agencia mexicana de automatización con IA (Morelia, con presencia en CDMX y Querétaro), Odoo Partner, dirigida por Alejandro Martínez, quien además opera la marca educativa **@ialextremo** con audiencia significativa de emprendedores en LATAM. VADAI vende implementaciones de agentes de IA, ERP y plataformas a medida; la educación es la extensión natural: enseñar a dueños de negocio a usar IA en su empresa.

### El problema que resuelve
Hoy no existe un lugar propio donde vender y entregar cursos. Las alternativas (Skool, Hotmart, Kajabi) cobran comisión o mensualidad, no se integran al ecosistema VADAI (Stripe propio, branding propio, datos propios) y no permiten el control fino que el negocio necesita (accesos por vigencia, alta manual, cohortes en vivo a la mexicana). Esta plataforma es **el activo educativo propio de VADAI**: cero comisiones de terceros, datos de alumnos en casa, y base para todo curso futuro.

### Quién la va a usar
- **El alumno típico:** dueño de negocio o directivo LATAM, 30–55 años, NO técnico, consume mucho desde el celular, habla español, valora claridad sobre sofisticación. Si algo requiere explicación, está mal diseñado. Cero jerga técnica en la UI de alumno.
- **El admin:** Alejandro y equipo VADAI. Necesitan cargar y editar contenido rápido, sin fricción, y moderar la comunidad desde el mismo lugar donde ven todo.

### El primer curso (con el que se lanza)
**"Claude en tu Empresa"** — enseña a dueños de negocio a implementar Claude en su operación. 5 módulos, 8 sesiones en vivo de 2.5 horas por Google Meet (lunes y jueves), cohorte que arranca el **21 de septiembre de 2026**. Incluye +50 prompts listos, materiales descargables y bonos. Acceso de por vida. Se vende con pago único en MXN y USD, con factura. La plataforma debe hacer sentir al alumno que compró algo premium desde el primer login.

### Visión (para construir hoy sin cerrarse el futuro)
1. **Hoy:** un curso, cohorte en vivo, venta directa.
2. **Después:** catálogo de cursos VADAI/@ialextremo (grabados y por cohorte).
3. **Meta:** membresía mensual/anual con acceso al catálogo completo, comunidad activa, clases y reuniones semanales, blog diario — competir de frente con Skool en el mercado hispano.

Implicación de diseño: todo se modela multi-curso y membership-ready desde el día 1, aunque la UI de membresía no exista aún. Ninguna decisión de MVP debe estorbar la fase 3.

### Qué significa "éxito"
- 21-sep: la cohorte completa entra sin fricción (compra → cuenta → primer video en minutos, cero tickets de "no puedo entrar").
- Semana 1: alumnos ven las sesiones en vivo desde el calendario y las grabaciones al día siguiente.
- Mes 1: tasa de avance visible por alumno, comunidad con actividad, cero contenido filtrado (videos protegidos).
- La plataforma se siente VADAI: premium, oscura, rápida, en español.

### Principios de producto (rigen cualquier decisión no cubierta por este spec)
1. **Claridad sobre sofisticación** — el alumno nunca debe pensar; feature ambigua se resuelve hacia lo más simple.
2. **El contenido es el negocio** — protección de video y accesos es innegociable.
3. **Todo editable por el admin sin tocar código** — cursos, textos, precios, sesiones.
4. **Mexicano por diseño** — español, MXN primero, horario CDMX como referencia, factura como promesa cumplida.
5. **Simple gana** — entre dos soluciones, la más simple que cumpla el spec.

---

## 0.B REGISTRO DE DECISIONES (POR QUÉ ASÍ Y NO DE OTRA FORMA)

| Decisión | Por qué |
|----------|---------|
| Plataforma propia en vez de Skool/Hotmart | Cero comisiones, datos propios, branding propio, control de accesos/cohortes, base del negocio educativo a largo plazo |
| Bunny Stream para video | Mejor costo por mucho (storage + streaming por GB vs Mux por minuto), player propio, y token authentication para que los videos no se compartan por URL |
| Login-only, sin registro público | El acceso es un producto pagado; la cuenta nace de una compra o invitación. Evita cuentas basura y protege el contenido |
| Google + email/password vinculados por correo | Mínima fricción para un público no técnico: cada quien entra como se le facilite, misma cuenta |
| Stripe Payment Links (no checkout embebido) | Lo más rápido y confiable para lanzar en 4.5 semanas; el checkout embebido es optimización futura, no requisito |
| Gmail SMTP de Supabase (no Resend) | Una herramienta menos que conectar hoy; volumen del lanzamiento cabe en los límites. Migración a Resend documentada con trigger claro |
| Cohortes por Google Meet externo | Streaming embebido es complejidad enorme sin valor para 8 sesiones; Meet ya es el hábito del público |
| Acceso configurable por curso | El curso 1 promete "acceso para siempre" (así lo dice la landing), pero cursos futuros podrán vender vigencias limitadas |
| Supabase compartido con otros sistemas VADAI | Un solo costo y un solo pool de auth; el aislamiento lo garantiza el schema `academia` + RLS, no la separación de proyectos |
| Membresía solo schema-ready | El modelo de membresía se definirá después con datos reales del curso 1; construir la UI hoy sería adivinar |

### Decisiones añadidas el 20-ago-2026 (arranque de M1)

| Decisión | Por qué |
|----------|---------|
| Migraciones con script propio (`scripts/migrate.mjs`), no `supabase db push` | El CLI crea el schema `supabase_migrations` en el proyecto **compartido**, con historial global: otro repo VADAI usando el CLI pisaría nuestras migraciones. Nuestro runner guarda el ledger en `academia.schema_migrations` y no crea nada fuera de `academia` |
| Acceso vencido ve estructura pero no contenido | §4 (RLS) y §3.3/§6.3 se contradecían. Se resuelve a favor de §3.3/§6.3: hay candado y CTA de recompra, luego el alumno vencido debe seguir viendo el curso y los títulos de sus lecciones |
| `profiles.email` denormalizado | El webhook de Stripe (§3.1-B) resuelve al usuario por email y el admin lista alumnos por correo; PostgREST no puede hacer join con `auth.users` desde el schema `academia` |
| `correct_option_id` fuera del cliente vía vista | Fuga no contemplada en el spec: con RLS a nivel de fila, un alumno con acceso podría leer la respuesta correcta antes de contestar |
| Usuarios QA con prefijo `qa-` + script de purga | M11 exige "datos de prueba purgados" de un `auth.users` compartido; el prefijo los hace identificables y borrables sin tocar usuarios reales |
| **Proyecto Supabase dedicado**, no el compartido | Corrige la decisión original de §0.B. La academia vive en `mtrojwqwnuzzcgtmmoop` (vacío al arrancar: 0 tablas en `public`, 0 usuarios, 0 buckets), no en `ukgbklhmjbniffssacjm` donde ya viven otros seis sistemas VADAI. Se gana aislamiento real de auth y de datos, y desaparece el riesgo de que un cambio de configuración global (sign-up, exposed schemas) afecte a sistemas ajenos. La Regla Cero se conserva igual: cuesta cero y deja la puerta abierta a convivir después |

---

## 1. RESUMEN EJECUTIVO

### Qué se va a construir
Plataforma de academia online de VADAI (academia.vadai.com.mx), tipo Skool: cursos con módulos y lecciones en video, tracking de progreso, quizzes, tareas con entrega, certificados, comentarios por lección, comunidad por curso, blog/anuncios, y gestión de cohortes con sesiones en vivo por Google Meet. Multi-curso desde el día 1, aunque lanza con uno.

### Por qué importa
El primer curso, **"Claude en tu Empresa"** (5 módulos, 8 sesiones en vivo de 2.5h, lunes y jueves, cohorte con lanzamiento 21-sep), ya tiene landing y demanda. La plataforma es también la base del futuro modelo de membresía y de todos los cursos de VADAI/@ialextremo.

### Estado actual
Landing del curso viva en claude-en-tu-empresa.vadai.com.mx (estática, sin checkout funcional). No existe plataforma. Supabase compartido configurado según §1.B.

### Resumen de alcance MVP (21-sep)
1. Auth: login only (Google + email/password vinculados), sin registro público, recuperación de contraseña
2. Alta de alumnos: manual por admin (invitación por email) + automática vía Stripe Payment Link (webhook)
3. Course builder completo para admin: cursos → módulos → lecciones (video Bunny, texto enriquecido, adjuntos)
4. Vista alumno: mis cursos, player de lección, progreso por lección/curso
5. Quizzes autocalificables + tareas con entrega de archivos y revisión
6. Certificado PDF al completar curso
7. Comentarios por lección (moderables) + comunidad por curso (posts + comentarios)
8. Blog / portal de anuncios
9. Cohortes: calendario de sesiones en vivo con links de Google Meet y grabaciones asociadas
10. Acceso configurable por curso (días de vigencia o de por vida)

---

## 1.B INFRAESTRUCTURA Y REGLA CERO — AISLAMIENTO POR SCHEMA

> **Corrección 20-ago-2026.** Esta sección se escribió asumiendo un proyecto Supabase
> compartido. En los hechos la academia quedó en un **proyecto propio y dedicado**
> (`mtrojwqwnuzzcgtmmoop`), vacío al arrancar. El proyecto compartido con los otros seis
> sistemas VADAI es `ukgbklhmjbniffssacjm` y esta app no lo toca.
> Las reglas de abajo **se conservan sin cambios**: cumplirlas no cuesta nada, y si mañana
> otro sistema VADAI aterriza en este proyecto, el aislamiento ya está construido.

Las reglas:

- Esta app trabaja **exclusivamente en el schema `academia`**.
- **Prohibido** crear o alterar objetos en `public`, en `auth.*`, en `storage.*` (salvo policies de buckets propios `academia-*`) o en cualquier otro schema del proyecto.
- Cliente Supabase siempre con `{ db: { schema: 'academia' } }`.
- Migraciones en `/supabase/migrations`, solo sobre el schema `academia`, con prefijo `academia_` en el nombre de archivo.
- Funciones y triggers con prefijo `academia_`. Cualquier trigger sobre `auth.users` debe ser aditivo (nunca reemplazar triggers existentes que no creó este repo).
- `auth.users` es compartido por diseño: estar autenticado NO significa pertenecer a la academia. La pertenencia la da la fila en `academia.profiles` + RLS. El middleware rechaza a cualquier usuario autenticado sin perfil.

### Configuración Supabase requerida por esta app (setup manual de Alejandro, previo a M1)

> Checklist ejecutable paso a paso: **`docs/M0-SETUP.md`**.

1. Schema creado y expuesto:
```sql
create schema if not exists academia;
grant usage on schema academia to anon, authenticated, service_role;
```
   Dashboard → Settings → API → **Exposed schemas:** agregar `academia`. Sin esto PostgREST no expone las tablas y el cliente JS falla silenciosamente.
2. **Auth:** provider Google OAuth + Email/Password habilitados. **"Allow new users to sign up" = OFF** (las cuentas se crean solo server-side con service role). **la vinculación por correo es automática** (no hay toggle: Supabase vincula
   identidades cuando el correo de la cuenta existente está confirmado; el ajuste
   "Allow manual linking" del dashboard es otra función y no hace falta). Redirect URLs: `https://academia.vadai.com.mx/**` y `http://localhost:3000/**`.
3. **SMTP:** Gmail SMTP (smtp.gmail.com:587 con App Password) para invite y reset. Templates en español. Límite ~500 correos/día y entregabilidad limitada — aceptado para el lanzamiento; trigger de migración a Resend: >100 invitaciones/día sostenidas o correos cayendo a spam.
4. **Storage — buckets de esta app:**

| Bucket | Público | Uso |
|---|---|---|
| `academia-adjuntos` | No (signed URLs) | Adjuntos de lecciones, entregas de tareas |
| `academia-media` | Sí | Portadas, avatares, imágenes de blog |
| `academia-certificados` | No (signed URLs) | PDFs de certificados |

---

## 2. USUARIOS Y ROLES

Roles en `academia.profiles.role`:

### `superadmin` (Alejandro)
Todo lo de admin + gestión de admins, configuración de Stripe products, borrado duro.

### `admin` (equipo VADAI)
- CRUD completo de cursos, módulos, lecciones, quizzes, tareas, cohortes, sesiones
- Alta manual de alumnos e inscripciones; extender/revocar accesos
- Moderación de comentarios y comunidad (ocultar, editar, eliminar, fijar)
- Revisión y calificación de tareas
- Publicación de blog/anuncios
- Dashboard: alumnos activos, progreso promedio, pagos recibidos

### `alumno`
- Ve SOLO cursos con inscripción activa (vigente por fecha)
- Reproduce lecciones, descarga adjuntos, marca progreso
- Responde quizzes, entrega tareas, obtiene certificado
- Comenta en lecciones y participa en comunidad
- Ve calendario de su cohorte con links de Meet
- Perfil propio: nombre, avatar, cambio de contraseña

**Sin registro público.** Un usuario autenticado sin fila en `academia.profiles` → pantalla "Tu cuenta no tiene acceso a la academia. Si compraste un curso, contáctanos" + logout.

---

## 3. FUNCIONALIDAD DETALLADA

### 3.1 Autenticación y provisioning
- Login con Google o email/password. Mismo correo = misma cuenta (account linking ON en Supabase).
- "Olvidé mi contraseña" → email de reset vía SMTP configurado.
- **Flujo A — Alta manual (MVP core):** Admin captura nombre + email + curso (+ cohorte) → server action con service role: `inviteUserByEmail()` → crea `profiles` (rol alumno) + `enrollments` → el alumno recibe email, define contraseña o entra con Google.
- **Flujo B — Stripe Payment Link (MVP):** Payment Link por curso (uno MXN, uno USD). Webhook `checkout.session.completed` → idempotencia por `event.id` en `stripe_events` → busca user por email; si no existe lo crea + invita; crea `enrollment` con vigencia del curso; registra `payments`. Si el webhook falla, el pago queda visible en Stripe y el admin usa Flujo A como respaldo.
- **Flujo C — Membresía:** FUERA de MVP. El schema lo soporta (ver §4) pero no se construye UI ni webhooks de suscripción.

### 3.2 Course builder (admin)
- Curso: título, slug, descripción rich text, portada, precio MXN/USD, links de Payment Link, vigencia de acceso (`access_days` null = de por vida), estado (borrador/publicado/archivado), tipo (cohorte/evergreen).
- Módulos ordenables (drag & drop simple o botones subir/bajar — botones bastan para MVP).
- Lecciones ordenables dentro de módulo. Tipos: `video`, `texto`, `quiz`, `tarea`. Toda lección tiene descripción rich text y adjuntos ilimitados (cualquier tipo de archivo, límite 100 MB c/u, bucket `academia-adjuntos`).
- Video: upload a Bunny Stream desde el admin (ver §7.2), preview embebido, duración auto-capturada.
- Edición simple e inmediata de todo (títulos, orden, contenido) sin flujos de aprobación.

### 3.3 Experiencia del alumno
- **/mis-cursos:** cards de cursos inscritos con % de progreso y días restantes de acceso si aplica.
- **Player de curso:** sidebar con módulos/lecciones (candado en lecciones si el acceso expiró), área principal con video Bunny (player embebido con token), descripción, adjuntos descargables (signed URLs), botón "Marcar como completada" + autocompletado al llegar a 90% del video (evento del player), comentarios abajo.
- Progreso: por lección (`completed`, `seconds_watched`) y agregado por curso. Se retoma donde se quedó.

### 3.4 Quizzes
- Builder admin: preguntas de opción múltiple (una correcta), orden, puntaje mínimo aprobatorio (%), reintentos ilimitados por default.
- Alumno: responde, calificación inmediata, ve cuáles falló (sin revelar la correcta si no aprobó — configurable por quiz).
- Un quiz aprobado marca su lección como completada.

### 3.5 Tareas
- Builder admin: instrucciones rich text, permite archivos y/o texto.
- Alumno: entrega texto + archivos (bucket `academia-adjuntos`, path por usuario). Estados: `entregada` → `revisada` (con feedback y aprobada/rechazada). Rechazada permite reentrega.
- Bandeja admin de entregas pendientes por curso.

### 3.6 Certificados
- Al completar 100% de lecciones obligatorias (y aprobar quizzes/tareas marcadas como obligatorias), botón "Obtener certificado".
- PDF generado server-side (route handler con `@react-pdf/renderer`): plantilla con branding del curso, nombre del alumno, curso, fecha, folio único.
- Verificación pública: `/certificado/[folio]` muestra validez sin requerir login.
- Se guarda en `academia-certificados`; re-descargable desde el perfil.

### 3.7 Comentarios por lección
- Hilo por lección con replies de 1 nivel. Alumno crea/edita/elimina los propios (ventana de edición 15 min).
- Admin: editar, ocultar, eliminar, responder (badge "Equipo VADAI").
- Sin likes ni reacciones en MVP.

### 3.8 Comunidad por curso
- Feed tipo Skool por curso: posts (título + contenido rich + imágenes) de alumnos y admins, comentarios, fijado de posts por admin, moderación total admin.
- Sin categorías, sin gamificación/puntos en MVP.

### 3.9 Blog / anuncios
- Posts creados por admin: tipo `anuncio` (aparece destacado en dashboard del alumno) o `blog` (sección /blog dentro de la plataforma).
- Audiencia: todos los alumnos o un curso específico.
- Rich text + imagen de portada. Sin comentarios en blog para MVP.

### 3.10 Cohortes y sesiones en vivo
- Cohorte pertenece a un curso: nombre, fecha inicio/fin. Inscripción puede o no tener cohorte (evergreen).
- Sesiones: título, fecha/hora (zona América/Ciudad_de_México, mostrada con conversión local del navegador), link de Google Meet, descripción.
- Vista alumno: calendario/lista "Próximas sesiones" con botón "Unirse" (activo desde 15 min antes).
- Post-sesión: admin liga la grabación (lección de tipo video creada en el módulo correspondiente) → la sesión muestra "Ver grabación".

---

## 4. MODELO DE DATOS (schema `academia`)

Convenciones: `uuid` PK default `gen_random_uuid()`, `created_at/updated_at timestamptz`, soft delete solo donde se indica, FKs con `on delete` explícito. RLS habilitado en TODAS las tablas.

```
profiles            user_id (PK, FK auth.users), email unique, full_name, avatar_url,
                    role text check in ('superadmin','admin','alumno'),
                    status text check in ('active','suspended') default 'active'

courses             id, slug unique, title, description, cover_url,
                    price_mxn numeric, price_usd numeric,
                    stripe_payment_link_mxn text, stripe_payment_link_usd text,
                    access_days int null,            -- null = de por vida
                    course_type text check in ('cohort','evergreen'),
                    status text check in ('draft','published','archived'),
                    certificate_enabled bool default true

cohorts             id, course_id FK, name, starts_on date, ends_on date

cohort_sessions     id, cohort_id FK, title, description, scheduled_at timestamptz,
                    meet_url text, recording_lesson_id FK lessons null

modules             id, course_id FK, title, position int

lessons             id, module_id FK, title, description_rich jsonb/text,
                    position int, lesson_type check in ('video','text','quiz','assignment'),
                    bunny_video_id text null, video_duration_sec int null,
                    is_required bool default true,
                    status check in ('draft','published') default 'published'

lesson_attachments  id, lesson_id FK, storage_path, file_name, mime_type, size_bytes

enrollments         id, user_id FK, course_id FK, cohort_id FK null,
                    source check in ('stripe','manual'),
                    starts_at timestamptz default now(),
                    expires_at timestamptz null,     -- null = sin expiración
                    status check in ('active','revoked') default 'active',
                    unique (user_id, course_id)

lesson_progress     user_id + lesson_id (PK compuesta), completed bool,
                    seconds_watched int, completed_at timestamptz null

quizzes             id, lesson_id FK unique, passing_score int default 80,
                    reveal_answers bool default false

quiz_questions      id, quiz_id FK, question text, options jsonb,  -- [{id,text}]
                    correct_option_id text, position int

quiz_attempts       id, quiz_id FK, user_id FK, answers jsonb, score int,
                    passed bool, created_at

assignments         id, lesson_id FK unique, instructions_rich, allow_files bool,
                    allow_text bool

assignment_submissions  id, assignment_id FK, user_id FK, text_content,
                    files jsonb,  -- [{storage_path,name}]
                    status check in ('submitted','approved','rejected'),
                    feedback text, reviewed_by FK profiles null, reviewed_at

certificates        id, user_id FK, course_id FK, folio text unique,
                    issued_at, pdf_path, unique (user_id, course_id)

lesson_comments     id, lesson_id FK, user_id FK, parent_id FK self null,
                    content text, status check in ('visible','hidden','deleted')

community_posts     id, course_id FK, user_id FK, title, content_rich,
                    images jsonb, pinned bool default false,
                    status check in ('visible','hidden','deleted')

community_comments  id, post_id FK, user_id FK, content,
                    status check in ('visible','hidden','deleted')

posts               id, author_id FK, post_type check in ('announcement','blog'),
                    title, content_rich, cover_url,
                    audience_course_id FK null,      -- null = todos
                    published_at timestamptz null    -- null = borrador

payments            id, user_id FK null, email text, course_id FK,
                    stripe_session_id unique, stripe_payment_intent,
                    amount numeric, currency check in ('mxn','usd'),
                    status check in ('paid','refunded')

stripe_events       event_id text PK, processed_at   -- idempotencia

schema_migrations   filename text PK, checksum, applied_at  -- ledger del runner propio
```

### Vistas (añadidas en M1, 20-ago-2026)

```
lesson_outline          estructura de lección SIN description_rich ni bunny_video_id.
                        Visible con enrollment aunque esté vencido → es lo que ve el
                        alumno con acceso expirado (títulos con candado)
quiz_questions_public   quiz_questions SIN correct_option_id
public_profiles         user_id, full_name, avatar_url (para autoría en comentarios
                        y comunidad, sin exponer email ni role)
```

### RLS — principios (policies explícitas por tabla en migraciones)
- Helper: función `academia.current_role()` (security definer, lee `profiles`).
- Dos niveles de acceso al curso:
  - `academia.has_enrollment(course_id)` → enrollment `status='active'`, **sin importar expiración**. Da acceso a **estructura**: `courses`, `modules`, `cohorts`, `lesson_outline`, progreso propio.
  - `academia.has_active_access(course_id)` → lo anterior **y** `expires_at is null or expires_at > now()`. Da acceso a **contenido**: `lessons`, `lesson_attachments`, `quizzes`, `assignments`, `cohort_sessions`, comentarios, comunidad.
- `alumno` SELECT en contenido solo si el contenido está `published`.
- `alumno` INSERT/UPDATE solo en filas propias: progress, attempts, submissions, comments, community.
- `admin/superadmin`: acceso total al schema salvo borrado de `payments`/`stripe_events` (solo superadmin).
- `certificates` verificación pública: la página `/certificado/[folio]` consulta server-side con service role; sin policy pública.
- Storage: `academia-adjuntos` y `academia-certificados` privados con policies por prefijo de path `user_id`; `academia-media` público en lectura. Descargas de contenido privado siempre por signed URL server-side.

---

## 5. STACK TÉCNICO

- Next.js 15 App Router + TypeScript estricto + React 19
- Tailwind 4 + shadcn/ui
- Supabase JS (`db: { schema: 'academia' }`), sin ORM
- Server Actions para mutations; route handlers para webhooks y PDFs
- `@react-pdf/renderer` para certificados
- Rich text: Tiptap (contenido en JSON, render controlado)
- Bunny Stream (video) — §7.2
- Stripe Payment Links + webhook — §7.1
- Vercel (deploy desde `main`), pnpm

---

## 6. FLUJOS CRÍTICOS QUE DEBEN QUEDAR PERFECTOS

1. **Compra → acceso:** pago en Payment Link → webhook → cuenta + inscripción + email de invitación en <2 min, idempotente, con respaldo manual visible en admin.
2. **Login → lección:** un alumno invitado entra (Google o password) y llega a su video en ≤3 clics.
3. **Expiración de acceso:** al vencer `expires_at`, el contenido se bloquea con mensaje claro y CTA de recompra; el progreso NO se borra. El alumno sigue viendo la estructura del curso con candados.
4. **Moderación:** admin oculta/elimina cualquier comentario o post en ≤2 clics desde el propio hilo.

---

## 7. INTEGRACIONES EXTERNAS

### 7.1 Stripe
- Products/Prices creados manualmente en dashboard: "Claude en tu Empresa" en MXN y USD (pago único). Payment Links con `allow_promotion_codes` y campo obligatorio de email.
- Webhook endpoint: `/api/stripe/webhook`. Eventos: `checkout.session.completed`, `charge.refunded` (marca payment `refunded` y revoca enrollment).
- Verificación de firma obligatoria + idempotencia vía `stripe_events`.
- La moneda/curso se resuelve por metadata del Payment Link (`course_id`, `currency`).

### 7.2 Bunny Stream
- Una Video Library "vadai-academia" con **Token Authentication habilitado**.
- Upload: desde admin UI vía TUS resumible directo a Bunny (crear video por API server-side → subir con headers firmados desde el cliente). Guardar `guid` en `lessons.bunny_video_id`.
- Reproducción: iframe del player de Bunny con token firmado server-side (`token = sha256(security_key + video_id + expiration)`), expiración 6 h, generado en el server component de la lección SOLO si el enrollment está activo.
- Env vars: `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_CDN_HOSTNAME`.

### 7.3 Google OAuth + SMTP
Definidos en §1.B. La app no envía correos propios en MVP fuera de los de Supabase Auth (invite, reset). Notificaciones de sesiones en vivo = anuncio en plataforma, no email (post-MVP).

---

## 8. MODELO DE NEGOCIO

- MVP: cursos de pago único, precio por curso en MXN y USD, vigencia configurable (curso "Claude en tu Empresa" = de por vida).
- Futuro (schema-ready, sin construir): membresía mensual/anual con acceso a catálogo + comunidad + sesiones semanales. Requerirá tabla `subscriptions` y webhooks de suscripción — explícitamente fase 2.
- Facturación CFDI de ventas del curso: se gestiona fuera de la plataforma por ahora (proceso manual VADAI); la plataforma admin (repo aparte) llevará el registro.

---

## 9. DISEÑO Y BRANDING

- **Paleta (de la landing del curso):** fondo navy `#0A1A2F`, primario cyan `#00A0DB`, azul profundo `#006E96`, acento lima `#C6F24E` (CTAs y highlights), texto blanco `#F5F8FB`, gris secundario `#93A3B5`.
- Dark mode premium como único tema. Tipografía sans del sistema (Inter). Sin gradientes barrocos.
- **Mobile-first** para vista alumno (mucho consumo desde celular); admin puede ser desktop-first.
- Logo VADAI wordmark (asset a proveer por Alejandro en `/public`).
- Sensación: Skool-limpio, no LMS corporativo.

---

## 10. MILESTONES (M0–M11) — RUMBO AL 21-SEP

Hoy: 19-ago. 4.5 semanas efectivas. Cada milestone cierra con validación manual de Alejandro antes de avanzar. **Mínimo lanzable = M1–M4 + M8 + M9.** Si el calendario aprieta, M5–M7 pueden entrar la semana del lanzamiento (la cohorte empieza en vivo; quizzes/comunidad pueden llegar días después).

| M | Alcance | Criterio de éxito | Semana |
|---|---------|-------------------|--------|
| M0 | Infra manual (§1.B): Supabase configurado, repo `vadai-academia` en org `vadai-ia`, proyecto Vercel con dominio academia.vadai.com.mx, env vars cargadas, CLAUDE.md en raíz | App "hello world" deployada en el dominio | 19–20 ago |
| M1 | Migraciones completas schema `academia` + RLS + seeds de prueba | Policies probadas con 2 usuarios de roles distintos | S1 |
| M2 | Auth: login (Google+password), reset, middleware de rol, pantalla sin-acceso | Alumno de prueba entra por invite y por Google con el mismo email | S1 |
| M3 | Admin: CRUD cursos/módulos/lecciones + upload Bunny + adjuntos | Curso "Claude en tu Empresa" cargado completo con 1 video real | S2 |
| M4 | Alumno: mis cursos, player con token Bunny, progreso, adjuntos | Alumno de prueba completa una lección y el % avanza | S2–S3 |
| M5 | Quizzes: builder + resolución + calificación | Quiz de 5 preguntas aprobado marca lección completa | S3 |
| M6 | Tareas: builder + entrega + bandeja de revisión | Entrega con archivo revisada y aprobada end-to-end | S3 |
| M7 | Comentarios por lección + comunidad + blog/anuncios | Post fijado visible, comentario oculto por admin desaparece para alumno | S4 |
| M8 | Cohortes y sesiones en vivo + grabaciones ligadas | Calendario muestra las 8 sesiones con Meet links; una liga a grabación | S4 |
| M9 | Stripe: Payment Links + webhook provisioning + alta manual pulida | Pago de prueba (test mode) crea cuenta e inscripción sola | S4 |
| M10 | Certificados + branding final + responsive + estados vacíos | Certificado PDF descargable y verificable por folio | S5 |
| M11 | QA + hardening: edge cases, mobile, performance, smoke en prod | Checklist QA firmado; datos de prueba purgados | S5 (buffer 17–20 sep) |

---

## 11. RIESGOS Y MITIGACIONES

| Riesgo | Prob. | Impacto | Mitigación |
|--------|-------|---------|-----------|
| Timeline de 4.5 semanas | Alta | Alto | Mínimo lanzable definido (M1–M4+M8+M9); M5–M7 degradables a semana post-lanzamiento |
| Gmail SMTP a spam / límite 500/día | Media | Medio | Aceptado para lanzamiento; trigger de migración a Resend documentado en §1.B |
| Webhook Stripe falla en compra real | Baja | Alto | Idempotencia + alta manual como respaldo + pagos visibles en dashboard admin |
| Upload de videos largos falla | Media | Medio | TUS resumible; fallback: subir directo en panel de Bunny y pegar guid en el admin |
| Token de video filtrado | Baja | Medio | Expiración 6h + validación de enrollment en cada render |
| RLS mal configurado expone contenido | Media | Alto | M1 incluye pruebas explícitas de policies con usuarios de cada rol antes de avanzar |

---

## 12. FUERA DE ALCANCE (EXPLÍCITO)

- Membresía/suscripciones activas (solo schema preparado)
- Emisión de CFDI desde la plataforma
- App móvil nativa (web responsive solamente)
- Gamificación tipo Skool (puntos, niveles, leaderboard)
- Afiliados, cupones avanzados, upsells
- Multi-idioma (solo español)
- Notificaciones por email más allá de invite/reset de Supabase Auth
- Streaming en vivo embebido (las sesiones son Google Meet externo)
- Analytics de video finos (minutos vistos por segundo, heatmaps)
- Migración de datos de otra plataforma
