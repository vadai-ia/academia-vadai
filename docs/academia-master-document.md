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

### Decisiones añadidas durante la construcción (M1–M10, 20-ago-2026 en adelante)

| Decisión | Por qué |
|----------|---------|
| Migraciones con script propio (`scripts/migrate.mjs`), no `supabase db push` | El CLI crea el schema `supabase_migrations` en el proyecto **compartido**, con historial global: otro repo VADAI usando el CLI pisaría nuestras migraciones. Nuestro runner guarda el ledger en `academia.schema_migrations` y no crea nada fuera de `academia` |
| Acceso vencido ve estructura pero no contenido | §4 (RLS) y §3.3/§6.3 se contradecían. Se resuelve a favor de §3.3/§6.3: hay candado y CTA de recompra, luego el alumno vencido debe seguir viendo el curso y los títulos de sus lecciones |
| `profiles.email` denormalizado | El webhook de Stripe (§3.1-B) resuelve al usuario por email y el admin lista alumnos por correo; PostgREST no puede hacer join con `auth.users` desde el schema `academia` |
| `correct_option_id` fuera del cliente vía vista | Fuga no contemplada en el spec: con RLS a nivel de fila, un alumno con acceso podría leer la respuesta correcta antes de contestar |
| Usuarios QA con prefijo `qa-` + script de purga | M11 exige "datos de prueba purgados" de un `auth.users` compartido; el prefijo los hace identificables y borrables sin tocar usuarios reales |
| **Correo por la API de Resend, no por SMTP** | El SMTP de Supabase fallaba con un 500 sin detalle y sus intentos nunca aparecían en los logs de Resend: una caja negra imposible de depurar a un mes del lanzamiento. Mandar desde nuestro código da error legible, control de reintentos y, sobre todo, **plantillas propias en español y con marca** en vez de las default de Supabase en inglés. Corrige §7.3 y convierte `RESEND_API_KEY` en dependencia de producción |
| **Resend en vez de Gmail SMTP** | Corrige la decisión original de §0.B, que ya contemplaba este cambio con el disparador "correos cayendo a spam". Se adelanta por dos motivos: Gmail rechaza enviar desde una dirección de `vadai.com.mx` porque no es la cuenta autenticada (era la causa del 500 en `/auth/v1/recover`), y 40 invitaciones simultáneas desde un Gmail sin autenticación de dominio es justo el patrón que los filtros marcan. Con SPF/DKIM sobre un subdominio dedicado (`automail.vadai.com.mx`) el correo llega a bandeja y la reputación de envío queda aislada del correo corporativo, que es de lo que depende §6.1. **No cambia una línea de código**: la app nunca manda correo por su cuenta (§7.3) |
| **Solo tarjeta en los Payment Links**, sin OXXO ni SPEI | Con métodos asíncronos, `checkout.session.completed` llega con `payment_status: 'unpaid'` y el pago real confirma horas o días después. Eso rompe la promesa de §6.1 ("compra → acceso en <2 min") y obligaría a diseñar qué ve el alumno mientras su voucher se paga. Se acepta perder a quien no usa tarjeta a cambio de que el acceso sea inmediato y el flujo, uno solo. Los eventos async quedan suscritos igual, por si se activa después |
| **Proyecto Supabase dedicado**, no el compartido | Corrige la decisión original de §0.B. La academia vive en `mtrojwqwnuzzcgtmmoop` (vacío al arrancar: 0 tablas en `public`, 0 usuarios, 0 buckets), no en `ukgbklhmjbniffssacjm` donde ya viven otros seis sistemas VADAI. Se gana aislamiento real de auth y de datos, y desaparece el riesgo de que un cambio de configuración global (sign-up, exposed schemas) afecte a sistemas ajenos. La Regla Cero se conserva igual: cuesta cero y deja la puerta abierta a convivir después |
| **El equipo entra a los cursos sin estar inscrito** | §6.4 pide moderar "a dos clics desde el propio hilo", pero los hilos viven dentro de `/curso/[slug]/...` y un admin nunca tiene `enrollment`: la consulta devolvía `null` y la página respondía 404. Los botones de *Ocultar* y *Fijar* estaban en código inalcanzable. RLS ya se lo permitía (`is_admin() or has_active_access()`); lo que cortaba era la consulta. Ahora el equipo entra con `vigente = true`, y el detalle del curso en el panel enlaza a la vista de alumno y a la comunidad |
| **Los recuadros colapsables son `<details>`, no estado de React** | Un botón con `onClick` no hace nada sin JavaScript: el formulario que esconde nunca llega a existir. Aplica a *Responder*, *Escribir una publicación* y *Comentar*. Junto con la regla de no envolver las server actions en closures —eso le quita a React el `$ACTION_ID`—, es lo que sostiene que la plataforma funcione con JS desactivado o todavía sin hidratar |
| **El cuerpo de la comunidad se escribe en `<textarea>`, no en Tiptap** | Pedirle un editor rico a un alumno para preguntar una duda es fricción pura. Se convierte a documento Tiptap al guardar, así `content_rich` tiene una sola forma en toda la base y la comunidad, el blog y las lecciones comparten renderizador |
| **El certificado no se fía de `lesson_progress.completed`** | §3.6 pide "100% de lecciones obligatorias (y aprobar quizzes/tareas marcadas como obligatorias)", y ese paréntesis no es una aclaración: el botón *Marcar como completada* de §3.3 funciona en cualquier lección, incluidas las de quiz y tarea. Fiándose de la marca, cualquiera obtendría el certificado con cuatro clics. Se exige además un intento con `passed = true` y una entrega con `status = 'approved'` |
| **Aprobar una tarea completa su lección** | §3.4 lo dice de los quizzes y §3.5 no dice nada de las tareas, así que una lección de tipo `assignment` no tenía NINGÚN camino a `completed`: la barra de progreso nunca se movía y un curso con tarea obligatoria jamás llegaba al 100%, dejando §3.6 fuera del alcance de cualquier curso real |
| **Folio de azar criptográfico con alfabeto Crockford** | Es la única llave de una página sin login y se teclea desde un PDF impreso: sin I, L, O ni U (se confunden con 1, 0 y entre sí) y 10 caracteres aleatorios, 32^10 ≈ 1.1e15. Un folio secuencial convertiría `/certificado/[folio]` en un directorio de alumnos |
| **Sin nombre no se emite certificado** | El PDF puede caer al correo si falta el nombre —lo recibe su dueño— pero la página pública de verificación no: publicaría la dirección del alumno a quien tenga el folio. De aquí sale `/perfil`, que §3.6 pedía de pasada y donde el alumno corrige el nombre que se imprime |
| **Las rutas `/api/` contestan 401, no redirigen al login** | Quien las llama es un `fetch`, que sigue el 307 y recibe el HTML del login con un 200 encima. Un 401 se puede manejar; una página de login disfrazada de respuesta exitosa, no |
| **Ningún correo sale hacia una dirección QA** | `academia.vadai.com.mx` no tiene registro MX, así que todo envío a un `qa-*@` de ese dominio rebota duro. `test:stripe` provisiona una cuenta y manda la bienvenida en cada corrida: se acumularon 14 rebotes y 3 supresiones antes de notarlo. La cuenta de Resend es COMPARTIDA con los otros dominios de VADAI, así que esa tasa de rebote se cobra sobre la reputación de envío de todos — la misma de la que depende §6.1 para que las 40 invitaciones lleguen a bandeja. El corte va en la capa de envío, donde no se puede olvidar |
| **Dos temas en vez de dark mode único** | Corrige §9. El default sale del sistema operativo de cada persona y un botón del encabezado lo cambia a mano. Se resuelve con `light-dark()` en CSS, así que el tema del sistema funciona SIN JavaScript y no hay que mantener dos listas de 30 tokens en sincronía — que es lo que siempre acaba desincronizándose. Un bloque `@supports not` cubre los navegadores anteriores a 2024, donde la declaración sería inválida y la página saldría sin ningún color |
| **La raíz redirige, no es una portada** | En `/` había un tablero con el avance por milestone y una sonda de conexión que le informaba a cualquier visitante qué base de datos usamos y cómo se llama el schema. Servía como smoke test del scaffold; como página pública era una fuga de detalles internos y además envejeció mal (seguía diciendo que M7 estaba "en curso" días después de cerrarlo). Ahora la raíz manda a cada quien a su lugar: alumno a /mis-cursos, admin a /admin, y quien no tiene sesión al login |
| **El cyan de marca no se usa para texto en tema claro** | Da 2.6:1 sobre el fondo claro y reprueba AA. En claro el token `primary` es el azul profundo `#006E96` (5.4:1), que es la misma marca en el tono que sí se lee; el cyan queda para acentos grandes, donde 3:1 basta |

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
3. **Correo transaccional:** **Resend** (`smtp.resend.com:587`, usuario `resend`, contraseña = API key) con el subdominio `automail.vadai.com.mx` verificado por SPF/DKIM, para invite y reset. Templates en español. Sustituye a Gmail SMTP; ver el registro de decisiones. Pasos en `docs/M0-SETUP.md` paso 4, y `pnpm check:m0` verifica el envío de verdad.
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
- Webhook endpoint: `/api/stripe/webhook`. Eventos suscritos:

| Evento | Qué hace |
|---|---|
| `checkout.session.completed` | Crea cuenta si no existe + enrollment + registra payment |
| `charge.refunded` | Marca payment `refunded` y revoca el enrollment |
| `checkout.session.async_payment_succeeded` | Suscrito por si se activa OXXO/SPEI. Hoy no debería dispararse |
| `checkout.session.async_payment_failed` | Ídem |
| `charge.dispute.created` | Contracargo. Solo para enterarse; no revoca automáticamente |

  **El handler valida `payment_status === 'paid'` antes de provisionar**, aunque hoy
  solo se acepte tarjeta. Es correcto en ambos escenarios y evita que activar OXXO
  algún día regale cursos a quien genere un voucher y nunca lo pague.

- Llave de API: **restringida (`rk_`)**, no secreta. El backend solo lee Checkout
  Sessions, Customers y Charges; no escribe nada en Stripe. Si se filtra, no
  permite cobrar ni mover dinero.
- Verificación de firma obligatoria + idempotencia vía `stripe_events`.
- La moneda/curso se resuelve por metadata del Payment Link (`course_id`, `currency`).

### 7.2 Bunny Stream
- Una Video Library "vadai-academia" con **Token Authentication habilitado**.
- Upload: desde admin UI vía TUS resumible directo a Bunny (crear video por API server-side → subir con headers firmados desde el cliente). Guardar `guid` en `lessons.bunny_video_id`.
- Reproducción: iframe del player de Bunny con token firmado server-side (`token = sha256(security_key + video_id + expiration)`), expiración 6 h, generado en el server component de la lección SOLO si el enrollment está activo.
- Env vars: `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_CDN_HOSTNAME`.

### 7.3 Google OAuth + correo transaccional
Google OAuth definido en §1.B.

**Corrección 21-ago-2026.** Esta sección decía que la app no envía correos propios. Ya no es cierto: los dos correos del MVP —bienvenida tras el alta y recuperación de contraseña— **los manda nuestro código por la API de Resend**, con plantillas propias en `/lib/correo`.

El motivo fue doble. El SMTP de Supabase fallaba con un `500 unexpected_failure` indescifrable, y los logs de Resend confirmaron que sus intentos nunca llegaban siquiera. Pero aunque hubiera funcionado, las plantillas default de Supabase están **en inglés y sin marca**: el primer correo que recibe alguien que acaba de pagar 15 000 pesos no puede decir "Follow this link to reset your password" (§0: cero jerga, español, sensación premium).

El enlace se arma con `admin.generateLink` y apunta a nuestro `/auth/confirmar`, no al dominio de Supabase, para no depender de su Site URL.

Notificaciones de sesiones en vivo siguen fuera del MVP: anuncio en plataforma, no correo.

---

## 8. MODELO DE NEGOCIO

- MVP: cursos de pago único, precio por curso en MXN y USD, vigencia configurable (curso "Claude en tu Empresa" = de por vida).
- Futuro (schema-ready, sin construir): membresía mensual/anual con acceso a catálogo + comunidad + sesiones semanales. Requerirá tabla `subscriptions` y webhooks de suscripción — explícitamente fase 2.
- Facturación CFDI de ventas del curso: se gestiona fuera de la plataforma por ahora (proceso manual VADAI); la plataforma admin (repo aparte) llevará el registro.

---

## 9. DISEÑO Y BRANDING

- **Paleta (de la landing del curso):** fondo navy `#0A1A2F`, primario cyan `#00A0DB`, azul profundo `#006E96`, acento lima `#C6F24E` (CTAs y highlights), texto blanco `#F5F8FB`, gris secundario `#93A3B5`.
- ~~Dark mode premium como único tema.~~ **Corregido el 24-ago-2026: dos temas.** El default lo decide el sistema operativo de cada persona y un botón del encabezado lo cambia a mano. Tipografía sans del sistema (Inter). Sin gradientes barrocos.
- **Mobile-first** para vista alumno (mucho consumo desde celular); admin puede ser desktop-first.
- Logo VADAI wordmark en `/public` (entregado el 24-ago-2026): `vadai-wordmark.png` horizontal y `vadai-sello.png` circular. Arte negro sobre transparente, así que siempre sobre placa blanca.
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

### Decisión de M12 (2-sep-2026)

| Decisión | Por qué |
|----------|---------|
| La gamificación **en vivo** entra; la **de perfil** sigue fuera | §12 excluyó "gamificación tipo Skool (puntos, niveles, leaderboard)" y esa parte se mantiene: son mecánicas de retención para una comunidad grande y en un grupo de 40 solo agregan ruido. M12 agrega otra cosa: una dinámica en vivo con QR donde el juego es la anticipación de ver aparecer las respuestas de la sala en la pantalla, y que termina cuando termina la sesión. No deja marcador, no compara personas y no persiste nada que se pueda "subir de nivel". La prueba de que son distintas: quitarle los puntos a Skool no cambia nada de esto |
| Encuestas en vivo: se instala `qrcode-generator` | Es la excepción que CLAUDE.md pide justificar. Leer un `.xlsx` a mano (`lib/admin/padron.ts`) era recorrer un ZIP y sacar dos columnas: código aburrido y verificable de un vistazo. Un QR lleva Reed–Solomon sobre GF(256), ocho máscaras con penalizaciones y bits de formato con BCH; un error sutil no lanza excepción, produce un código que **no escanea** frente a la sala y en vivo |
| Tiempo real por sondeo, no por Supabase Realtime | `postgres_changes` exige `alter publication supabase_realtime`, un objeto **global** de la base, y los canales privados viven en el schema `realtime`. Las dos cosas caen del lado prohibido de la Regla Cero. Se sondea un route handler: la proyección cada segundo con los agregados, el celular cada tres y **solo** para saber qué pregunta está abierta. Además funciona detrás del wifi de un hotel, que es donde esto se va a usar |
| Dos contadores de versión, no uno | `state_version` se mueve cuando el admin abre o cierra una pregunta; las respuestas **no** lo tocan. Con un solo contador, cada persona que contesta obligaría a las demás a volver a pedir: cien asistentes convertirían cada respuesta en cien peticiones |
| Exportaciones armadas al vuelo, sin bucket | El certificado se guarda porque es inmutable: una vez emitido, dice lo mismo para siempre. Un reporte de encuesta cambia cada vez que alguien contesta, así que guardarlo solo serviría para repartir una versión vieja. Se genera en la petición y se manda en la respuesta |
| El `.xlsx` se escribe a mano, sin `sharedStrings` y sin fórmulas | Espejo del lector de `padron.ts`. Lo de las fórmulas no es una simplificación sino una defensa: el texto va dentro de `<is><t>`, que Excel trata como literal, así que un `=...` escrito por alguien que escaneó el QR no se evalúa al abrir el archivo. En un CSV sí se evaluaría |
| Las gráficas del PDF se redibujan en vector, no se capturan | No hay navegador sin cabeza en el stack. `@react-pdf/renderer` trae primitivas SVG, y el acomodo sale de los mismos módulos puros que usa la proyección (`acomodarNube`, `matrizQr`): así el reporte muestra el mismo dibujo que vio la sala. Si el PDF calculara por su cuenta, habría dos versiones del mismo evento |
| Rol nuevo `invitado` en `profiles` | Quien se registra desde el QR obtiene cuenta real para volver a la siguiente encuesta, pero no compró nada. Con `alumno` acabaría en /mis-cursos viendo un vacío que no le explica nada, y ensuciaría el padrón |

## 12. FUERA DE ALCANCE (EXPLÍCITO)

- Membresía/suscripciones activas (solo schema preparado)
- Emisión de CFDI desde la plataforma
- App móvil nativa (web responsive solamente)
- Gamificación **de perfil** tipo Skool (puntos acumulados, niveles, leaderboard permanente)
  — *matizado el 2-sep-2026: la dinámica en vivo de M12 sí entra. Ver el registro de decisiones.*
- Afiliados, cupones avanzados, upsells
- Multi-idioma (solo español)
- Notificaciones por email más allá de invite/reset de Supabase Auth
- Streaming en vivo embebido (las sesiones son Google Meet externo)
- Analytics de video finos (minutos vistos por segundo, heatmaps)
- Migración de datos de otra plataforma
