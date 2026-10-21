# CLAUDE.md — vadai-academia

> Contexto permanente para Claude Code. Este archivo manda sobre cualquier suposición.
> Fuente de verdad funcional: `academia-master-document.md` (en /docs del repo).

## QUÉ ES ESTE PROYECTO

Academia online de VADAI (academia.vadai.com.mx), tipo Skool: cursos en video con módulos, progreso, quizzes, tareas, certificados, comentarios, comunidad, blog y generaciones con sesiones en vivo (Google Meet). Desde M16 un curso «por generaciones» tiene contenido, comunidad, dinámicas y ranking POR generación. Primer curso lanza el 21-sep-2026.

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
  /(alumno)      mis-cursos (Inicio), cursos (Mis cursos), curso/[slug] (+ comunidad = pestaña «Grupo», en-vivo, dinamicas),
                 perfil (+ membresia, certificaciones, puntos), dinamicas, blog; comunidad solo redirige (M22)
  /vaip          V-AI-P: venta para quien no es miembro; para el miembro, Muro + clases, herramientas, ranking
                 # curso/[slug]/(marco)/ = el marco del curso (título, avance, pestañas) para Contenido,
                 # En vivo, Grupo y Dinámicas; curso/[slug]/[leccionId] va FUERA: modo lección (25-sep-2026)
  /(admin)       admin/* en dos mundos (M25): vaip (resumen), vaip/{muro,noticias,clases,miembros,herramientas,planes};
                 cursos, entregas, grupos, publicaciones (Anuncios y blog), puntos, dinamicas, encuestas, certificaciones;
                 alumnos (+ [userId] ficha), empresas; agente (+ ajustes), ajustes/api;
                 modulos/[id]/acceso = quién entra a una sesión exclusiva. comunidad solo redirige a grupos o vaip/muro
                 # cursos/[id]?gen=<id>|nueva|sin = la pestaña de una generación (M16); generaciones/[id] solo redirige ahí
  /api/stripe/webhook
  /api/certificados/[folio]
  /api/calendario/cohorte/[id]  # .ics con todas las sesiones; firmado (?t=) para abrirse desde el correo sin sesión
  /certificado/[folio]      # verificación pública
  /e/[codigo]               # encuesta en vivo, sin sesión (QR)
  /proyectar/[token]        # pantalla que se proyecta; exige sesión de admin (3-sep-2026)
  /acceso/[token]           # liga del correo de bienvenida, 30 días, sin sesión
  /api/encuestas/*          # sondeo de estado y de resultados
  /api/dinamicas/*          # sondeo del tablero; exige sesión (no es prefijo público)
  /api/reportes/dinamicas/* # Excel de una dinámica; solo equipo
/lib             lógica de negocio (NUNCA en componentes)
  /encuestas     encuestas en vivo: códigos, consultas y acciones
  /dinamicas     dinámicas empresariales: comun (ponderado), consultas, acciones, tablero, exportación
  /supabase      clients (browser, server, service-role)
  /bunny         firma de tokens, upload
  /stripe        webhook handlers
/components
/supabase/migrations
/scripts         migrate, seed, checks, pruebas de RLS, capturas (pantallas a 390/1280 px: se miran)
/docs            master document + doc de infraestructura
```

## ROLES Y ACCESO

- Roles en `academia.profiles.role`: `superadmin`, `admin`, `community_manager`, `alumno`, `invitado`.
  `invitado` nació contestando una encuesta en vivo: tiene cuenta para volver a la
  siguiente, pero no compró nada. `rutaDeInicio()` lo manda a `/mis-encuestas`, no a
  `/mis-cursos`, donde solo vería un vacío que le pide escribirnos por un curso que
  nunca compró.
- **`community_manager`** (0036, 3-oct-2026): "casi admin". Entra al panel, atiende la comunidad,
  opera encuestas, dinámicas, empresas, blog y entregas, y con los alumnos hace todo menos alta y
  eliminar. En contenido **solo sesiones y grabaciones** (sube el video de una lección, la publica,
  sus adjuntos); no crea cursos, módulos, lecciones, quizzes, tareas ni generaciones, y **no ve
  pagos**. Contesta como «Equipo VADAI». Solo un superadmin da o quita el rol.
  En la base: `is_admin()` sigue siendo admin|superadmin y `is_equipo()` suma al CM; **una
  política nueva usa `is_admin()` salvo que se decida abrírsela al CM** (negar por default).
  Lo que una política no alcanza lo cierran triggers: `lessons_solo_grabacion` y
  `enrollments_sin_mover`. En la app: `exigirEquipo()` / `exigirAdmin()` y `lib/auth/roles.ts`.
- Sign-up público DESHABILITADO. Cuentas solo server-side con service role, por **tres**
  caminos: invite manual, webhook de Stripe, y —desde M12— registro desde una encuesta en
  vivo, que nace con rol `invitado`. El tercero es el único expuesto a internet sin
  autenticación previa, así que lleva cuota por IP en `academia.poll_join_attempts`.
  Sigue sin haber sign-up público: la ruta de Supabase continúa cerrada.
- **Entrar con Google solo funciona si el correo YA tiene cuenta.** Con el sign-up deshabilitado,
  Supabase rechaza crear el usuario y el callback devuelve `signup_disabled`. Eso es correcto, no
  un fallo — pero el mensaje tiene que decirlo (`?error=sinCuenta`), no "intenta de nuevo".
- La primera cuenta real se crea con `pnpm cuenta:crear`. El panel de admin exige ya ser admin y
  todo lo demás crea `alumno`: sin ese script la plataforma no puede dar de alta a su propio dueño.
- Usuario autenticado SIN fila en `academia.profiles` → pantalla de sin-acceso + logout. Middleware lo aplica en TODAS las rutas.
- **Suspender es reversible; eliminar es real** (M14, 21-sep-2026). `eliminarCuenta`
  (`lib/admin/acciones-baja.ts`) borra en Auth y la academia en cascada, conserva los pagos
  marcados con `account_deleted_at` y reasigna las publicaciones del blog; se confirma
  tecleando el correo y solo desde la ficha `/admin/alumnos/[userId]`. Nadie se borra a sí
  mismo; al equipo solo lo borra un superadmin.
- **"¿Ya entró?" vive en `profiles.last_sign_in_at`**, que la app sella al abrir sesión
  (`lib/auth/inicio-de-sesion.ts`). Nunca un trigger sobre `auth.users` ni un barrido de la
  Admin API para leerlo.
- RLS habilitado en TODAS las tablas, sin excepciones ni "temporalmente off".
- `SUPABASE_SERVICE_ROLE_KEY` solo en server; jamás importar el client de service role en código de cliente.

## REGLAS DE NEGOCIO CRÍTICAS

- Alumno solo ve contenido de cursos con `enrollment` activo (`status='active'` y `expires_at` null o futura) y contenido `published`.
- Al expirar acceso: bloquear contenido con mensaje claro; NUNCA borrar progreso.
- **Acceso vencido = estructura sí, contenido no** (decidido 20-ago-2026). Un alumno con `expires_at` pasada sigue viendo el curso en /mis-cursos, sus módulos, los títulos de sus lecciones con candado y su progreso histórico; NO ve video, adjuntos, descripción rica, quizzes, tareas ni comunidad. En RLS eso son dos helpers distintos: `academia.has_enrollment()` (estructura) vs `academia.has_active_access()` (contenido).
- Tokens de video Bunny: firmados server-side, expiración 6h, solo si enrollment activo. Jamás exponer `BUNNY_STREAM_TOKEN_KEY` ni URLs sin token.
- Webhook Stripe: verificación de firma + idempotencia por `stripe_events.event_id`. `checkout.session.completed` crea usuario si no existe + enrollment + registra payment. `charge.refunded` marca refund y revoca enrollment.
- Zona horaria de sesiones: se guarda `timestamptz`; **la UI muestra SIEMPRE hora de la Ciudad de
  México, en servidor y en navegador** (decidido 21-sep-2026, día del lanzamiento). Pintar la hora
  del navegador rompía la hidratación (React 418, página entera caída) y en las PCs con zona
  "Central Time (US)" salía una hora adelantada. Todo `Intl.DateTimeFormat` de cliente lleva
  `timeZone: 'America/Mexico_City'`.
- Certificado solo si 100% de lecciones `is_required` completadas y quizzes/tareas obligatorias aprobadas.
- Archivos: descargas SIEMPRE por signed URL generada server-side; buckets privados.
- Los correos de la academia (bienvenida y recuperación) los manda **nuestro código por la API de Resend**, no el SMTP de Supabase. Plantillas en `/lib/correo`, en español y con marca. El SMTP queda como respaldo.
- Un fallo de correo **nunca** debe abortar un alta: la cuenta y la inscripción se crean primero, el correo se intenta después y su fallo solo se reporta.
- **La liga del correo de bienvenida vale 30 días y un GET no la gasta** (decidido 20-sep-2026,
  víspera del lanzamiento, con 75 alumnos que tenían en el buzón una liga muerta). Es
  `/acceso/<token>`, con el hash en `academia.access_links`; lo que abre sesión es el POST del
  botón, que pide a Supabase un recovery fresco en ese momento. Los escáneres de enlaces de
  Outlook y Gmail hacen GET, nunca POST. `/recuperar` sigue con el recovery corto de Supabase.
- **Jamás se manda correo a una dirección `qa-*@academia.vadai.com.mx`.** Ese dominio no tiene MX,
  así que cada intento es un rebote duro, y la cuenta de Resend es compartida con los demás dominios
  de VADAI: la tasa de rebote de nuestras pruebas se cobra sobre la reputación de envío de todos.
  El corte vive en `lib/correo/resend.ts`, no en las pruebas, para que no se pueda olvidar.
- `quiz_questions.correct_option_id` NUNCA se expone al cliente. El alumno lee la vista `academia.quiz_questions_public`; la calificación es server-side.
- **Cursos base** (`courses.is_default`, 20-sep-2026): todo alumno los recibe al darse de alta por
  cualquier camino, además de lo que compre. Lo hace `darDeAlta()`; los cursos QA nunca son base.
- **Los puntos de gamificación no se guardan**: se calculan de la vista `academia.actividad_por_curso`
  con los pesos de `lib/gamificacion/reglas.ts` (única fuente). La vista solo enseña la actividad
  de los grupos donde está inscrito quien pregunta. **Desde M22 (20-oct-2026) el alumno ya no ve
  rankings por generación** (ya se premió al top 3): sus puntos están en Mi perfil → Puntos y el
  único ranking vivo es el de V-AI-P (`/vaip/ranking`). El equipo lo ve en
  `/admin/puntos` (`lib/admin/puntos.ts`, 26-sep-2026): mismos pesos, sin cuentas `qa-*` ni cursos
  archivados, y el **lugar se calcula antes de filtrar** — filtrar por empresa enseña en qué lugar
  va cada quien en el ranking completo, no un ranking nuevo de esa empresa.
- **Las conversaciones se atienden desde el panel** (`lib/admin/comunidad.ts`, 3-oct-2026; partida en
  dos desde M25): los grupos de los cursos en **Cursos → Grupos** (`/admin/grupos`) y el muro de
  V-AI-P en **V-AI-P → Muro** (`/admin/vaip/muro`), con el mismo componente (`components/admin/bandeja.tsx`)
  y nunca mezclados: cada hilo es de un mundo (`Hilo.mundo`). Cada hilo trae curso · generación ·
  lección. El estado **no se guarda**: "sin respuesta" = el último mensaje visible no es del
  equipo. «Atendida sin responder» (0037, `attended_at` en la raíz del hilo) lo saca sin
  escribir ni ocultar, y si el alumno vuelve a escribir regresa solo. La campana del panel
  cuenta solo lo que lleva más de 12 h esperando. El enlace del
  equipo al lado del alumno se llama **«Portal de alumnos»**, no "Vista de alumno": es el
  portal real, no una simulación. En el portal, el equipo siempre ve el selector de
  generación, aunque haya una sola.
- **Sesiones exclusivas** (0038, 9-oct-2026): un módulo con `is_restricted` solo abre para su lista
  (`module_members`), que se elige **solo entre los inscritos de su generación** y manejan admin y
  community manager en `/admin/modulos/[id]/acceso`. Quien no está **la ve con candado** (título sí,
  lecciones no) y en En vivo su grabación dice «exclusiva». La protección vive en `ve_modulo()`, de
  la que cuelgan lecciones, video, adjuntos, quizzes, tareas, avance y comentarios. **No cuenta**
  en el avance ni en el certificado de quien no la tiene: el alumno lo lee de
  `lesson_outline.para_mi`; el panel lo resta con `lib/acceso/exclusivas.ts`. Una pantalla nueva
  que mida avance por persona tiene que restarlo también. Correo opcional al guardar, solo a los
  nuevos (`plantillaSesionExclusiva`), y aviso en la campana.
- **El agente de la comunidad** (M21, 19-oct-2026; `lib/agente/*`, docs/M21.md): contesta a los
  alumnos 25–120 min después, de 8 a 21 h CDMX, como la cuenta «Equipo VADAI» (`es_bot`). Lo que
  publica solo va `via = 'agente'` y dice «con Claude, nuestra IA»; un borrador que una persona
  revisó va `agente_revisado` (`lib/agente/firma.ts`). **El modelo nunca escribe una liga**: devuelve
  claves del mapa y el código las arma; ligas, precios, fechas o correos en su texto lo mandan a
  borrador. El tope mensual se **reserva antes de cada llamada** en la base
  (`academia_agente_reservar`). Su suite corre con `ANTHROPIC_SIMULADO` (solo localhost), que lo
  vuelve el agente QA: ajustes, cola, gasto, borradores y resumen con `es_qa = true`, y solo sus
  cursos (`qa-agente-…`) y cuentas QA. Nunca se le manda al modelo un nombre, correo o teléfono de alumno, ni contenido de
  evaluaciones, quizzes o módulos exclusivos.
- **Noticias de V-AI-P** (M24, 20-oct-2026; `lib/noticias/*`, docs/M24.md): se cazan (botón y cron de
  las 7:00) o se crean desde una liga, y quedan como PROPUESTAS en `news_items`; **nada se publica
  sin el clic de una persona**. Solo cuentan ligas que salieron en la búsqueda y de
  `DOMINIOS_DE_NOTICIAS`; el código normaliza, deduplica por hash, abre cada página con
  `lib/red/seguro.ts` (nunca IPs internas) y quita URLs del texto del modelo. La imagen de cada
  noticia y aviso se **dibuja con código** (`lib/noticias/imagen.tsx`, `next/og`), no es la foto
  del medio. Todo lo del equipo en el muro pasa por `publicarComoEquipo()`. Avisos = tema
  «Avisos» fijado con fecha (`pinned_until`, se apaga al leer con `academia_desfijar_vencidos`).
- **Notificaciones internas sin tabla**: "nuevo" es lo publicado después de
  `profiles.notifications_seen_at`. Abrir la campana lo sella.
- **Empresas** (`academia.companies`, `profiles.company_id`; 20-sep-2026): de dónde viene cada
  alumno; null = General. Las asigna solo el equipo (trigger de perfil). El importador crea las
  que trae la columna Empresa. Es la base del puntaje y las dinámicas por empresa.
- **Toda alta manda su correo de acceso y queda en la bitácora** (M25, 20-oct-2026; `access_emails`,
  0047). Todos los caminos —alta manual, Excel, desde el curso o la ficha, Stripe, membresía,
  encuestas, reenvíos y recordatorio— pasan por `avisarAccesos` (`lib/correo/avisos-de-acceso.ts`), y
  qué correo le toca a quién lo decide `decidirCorreo` (`lib/correo/decision.ts`, pura y probada):
  cuenta nueva o que **nunca entró** → bienvenida con liga de 30 días; ya entró → «curso nuevo»;
  cambio de generación → «Ya estás en la Generación N» con las fechas (más liga si nunca entró);
  nada cambió → nada. Un camino nuevo de alta NO manda correo por su cuenta: usa `darDeAlta`
  (`correo: 'diferir'` si junta varios cursos) o `avisarAccesos`. La fila se escribe `pendiente`
  antes de mandar; las QA quedan `omitido`. Alumnos enseña «N correos de acceso no salieron ·
  Reenviar», la lista «Correo falló» y la ficha la bitácora con «Reintentar».
- **Gen 1 → Gen 2 es MOVER la misma inscripción** (decisión de Alejandro, 20-oct-2026): una sola
  inscripción por curso, conserva su avance, se reactiva sin acortar la vigencia y se le avisa. Al
  dar de alta o agregar desde la pestaña de una generación, quien está en otra se cambia a esa.
- **El recordatorio «Mandar a quien falta» solo va a quien nunca entró y tiene un curso o generación
  activa** (`academia_por_activar`, 0047): inscripción vigente en un curso publicado que no es base y
  cuya generación no terminó (`ends_on` ≥ hoy CDMX; incluye la que no ha empezado y «Miembros» de
  V-AI-P). Solo el curso base o una generación terminada no cuentan.
- **Dinámicas empresariales** (M13, 21-sep-2026): una calificación compartida por celda, gana el
  último y queda firmada con `updated_by`; el tablero se crea con un POST, nunca en un GET; "abierta
  de verdad" es `academia.dinamica_abierta()` (status open y fecha límite nula o futura, evaluada al
  leer: no hay pg_cron); los puntos (30 por dinámica cerrada con un proyecto completo) se calculan en
  la vista, no se guardan; `dynamic_boards.company_id` es `restrict`. La palabra "dinámica" ya no
  nombra a las encuestas en ninguna pantalla.
- **Los cursos QA se archivan fuera de las corridas, y archivado gana.** El seed **NO** toca su
  `status`: respeta el que encuentre. Publicarlos es deliberado —`pnpm qa:mostrar`—, y lo hacen
  solos `test-todo` y `pnpm qa` antes de probar; los dos los archivan al terminar. Si corres una
  suite suelta: `pnpm qa:mostrar` antes y `pnpm qa:esconder` después. Hasta el 21-sep-2026 el seed
  los forzaba a `published` en cada corrida, así que un `pnpm db:seed` de cualquiera —incluida otra
  sesión trabajando en paralelo sobre la misma base— los devolvía al panel del admin real. Alejandro
  los archivó a mano cuatro veces y "se desarchivaban solos"; la última, con la sala enfrente.
- **Una cuenta real nunca ve un curso QA, esté publicado o no** (3-oct-2026). Archivar al terminar
  no basta: mientras corren las suites los cursos QA están publicados en esta misma base, y en esa
  ventana le salían al equipo en su «Vista de alumno». `misCursos()`, las sesiones en vivo, los
  anuncios, las dinámicas y el ranking los filtran con
  `lib/qa.ts` (`esCursoQa`: slug `qa-…`; `esCuentaQa`: `qa-*@academia.vadai.com.mx`); las cuentas
  QA sí los ven, que es para lo que existen. Ningún curso real puede tener slug que empiece con `qa-`.

## ANTI-PATTERNS — NO HACEMOS

- NO `any` en TypeScript
- NO secrets en código (todo `.env.local` / Vercel)
- NO lógica de negocio en componentes (va en `/lib`)
- NO bypass de RLS en queries de usuario (service role solo para provisioning/webhooks/PDFs, y desde
  M20 para la API con llave: `/api/v1`, cuyo único punto de entrada es `lib/api/contexto.ts`, que
  verifica la llave, el permiso y la cuota antes de entregar el cliente; y desde M21 para el agente
  de la comunidad, cuyo único cliente sale de `lib/agente/servidor.ts` y lo usan solo los crons
  con `CRON_SECRET` y las acciones del panel después de `exigirEquipo()`/`exigirAdmin()`; desde
  M24 también las noticias (`lib/noticias`) y el compositor de V-AI-P, con esa misma regla)
- NO fetch de datos en client components cuando un server component puede hacerlo
- NO instalar dependencias no listadas en el stack sin justificación explícita
- NO tocar `public` ni ningún schema ajeno bajo ninguna circunstancia
- NO habilitar sign-up público "para probar"
- NO envolver una server action en un closure de cliente: `action={async (d) => { await accion(d); ... }}`
  le quita a React el `$ACTION_ID` y el `<form>` deja de funcionar sin JavaScript. La acción va
  directa (`action={accion}`) y el reset de los campos se hace con `key`, con un valor del servidor
- NO esconder un formulario detrás de `useState` + `onClick`: sin JS el botón no hace nada.
  Lo que se abre y se cierra va en `<details>`/`<summary>`. En el admin, un formulario detrás
  de un botón es `components/admin/desplegable.tsx` (M14): cerrado por default, y `abierto`
  lo decide el servidor con el estado de la acción (`estado.error || estado.aviso`)
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
- **En policies y vistas, `is_admin()` e `is_superadmin()` van SIEMPRE como `(select academia.is_admin())`**
  (decidido 24-sep-2026, migración 0031). Son `security definer` —tienen que serlo para leer
  `profiles` sin recursión—, así que Postgres no las inlinea: a pelo se evalúan **una vez por
  fila** (una búsqueda en `profiles` cada una) y leer 188 inscripciones costaba 67 ms; envueltas
  son un InitPlan que se evalúa una vez por consulta, y cuestan 0.9 ms. Las que reciben una columna
  (`has_enrollment(course_id)`) no pueden ser InitPlan; en vistas se escriben como
  `course_id in (select … where user_id = (select auth.uid()))`. Se comprueba con
  `explain analyze` como el rol `authenticated` con los claims puestos, no como `postgres`

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

BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=
BUNNY_STREAM_TOKEN_KEY=
BUNNY_STREAM_CDN_HOSTNAME=

# Correo transaccional. Dependencia de producción: sin esto no salen ni las
# invitaciones ni las recuperaciones de contraseña.
RESEND_API_KEY=
CORREO_REMITENTE=noreply@automail.vadai.com.mx
CORREO_REMITENTE_NOMBRE=VADAI Academia

# M18: llave restringida del panel de planes (escribe productos, precios, links,
# portal y suscripciones). La del webhook (STRIPE_SECRET_KEY) sigue de solo lectura.
STRIPE_ADMIN_KEY=

# M20: la API y sus tareas programadas. Solo servidor, 32+ caracteres al azar.
API_KEYS_PEPPER=      # HMAC de las llaves de la API; sin él ninguna llave entra
WEBHOOKS_MASTER=      # deriva el secreto de cada webhook saliente
CRON_SECRET=          # Vercel Cron lo manda en Authorization; sin él /api/cron no hace nada

# M21: el agente de la comunidad. Llave de un workspace propio con límite de US$50.
ANTHROPIC_API_KEY=
# Solo local, para scripts/agente-conocimiento.mjs (las clases de Fireflies).
FIREFLIES_API_KEY=

# Sal del hash de IP de la cuota de encuestas en vivo. Solo servidor.
# Si falta, se deriva de la service role key y todo sigue funcionando; se
# define aparte para poder rotarla sin tocar la llave de Supabase.
ENCUESTAS_IP_SALT=

# Sal de los folios de diplomas. Fijada el 20-oct-2026 con el valor que antes se
# derivaba de la service role key: así esa llave se puede rotar sin romper los
# folios ya entregados. No se rota.
DIPLOMAS_SALT=
```

## VOZ

Tomada de vadai.com.mx y de la landing del curso, no inventada aquí. Directa, en
segunda persona, **anti-teoría**. Nombra objetos que el dueño de una empresa
reconoce —Excel, Word, correo— en vez de hablar de "transformación digital".

- Los textos de la plataforma hablan de la **academia**, no de un curso: es
  multi-curso desde el día uno (§1), y un texto que anuncia "5 módulos" caduca
  en cuanto entra el segundo curso.
- Credenciales que VADAI ya afirma en público y se pueden reusar: **+40 empresas
  capacitadas**, **4.9/5** de calificación, **agencia #1 de IA en México**.
- Cada línea dice algo comprobable. Nada de promesas abstractas.

## BRANDING

**Dos temas** (decidido 24-ago-2026, corrige "dark mode único"). El default es el
**claro** — es la vista en la que el logo, el cyan y el lima se ven como se
diseñaron. Un botón en el encabezado lo cambia a oscuro y la elección se recuerda.

Paleta base: fondo `#0A1A2F`, primario `#00A0DB`, azul profundo `#006E96`, acento
lima `#C6F24E` (CTAs), texto `#F5F8FB`, secundario `#93A3B5`. Inter/sans sistema.
Mobile-first en vistas de alumno. Estética Skool-limpia, no LMS corporativo.

**Qué significa "Skool-limpia", medido de su CSS el 24-ago-2026** (no de memoria):

| | Skool | Nosotros |
|---|---|---|
| Radio | `10px` en 33 de 51 declaraciones | `--radius: 10px` |
| Borde | hairline 1px muy claro | `--border`, 1px |
| Sombra | casi ninguna, y solo al levantar | igual |
| Peso de letra | **500 en 40 de 41 declaraciones** | `font-medium`, casi cero negritas |
| Escala | **18px dominante**, no 14 | base 16, títulos 1.75rem |
| Color | blanco cálido + ámbar | navy + cyan de §9 |

Se copia la **geometría y la densidad**, no la paleta: Skool es blanco cálido con
ámbar y la marca es navy con cyan. Lo que hace que se vea limpio y no corporativo
es que la jerarquía la carga el **espacio y el tamaño**, no el color ni las
negritas — por eso casi todo va en peso 500 y las tarjetas se separan con un
borde de 1px en vez de flotar con sombra.

**El encabezado va en dos filas, nunca en una** (decidido 24-ago-2026). Arriba
marca y cuenta —la cuenta es UN avatar con menú `<details>` que guarda nombre, rol,
tema y salir—; abajo las secciones solas a todo el ancho. Con seis secciones en
una sola fila, "Vista de alumno" se recortaba y la barra de scroll oculta no
avisaba: un menú que se esconde es peor que uno que no existe. En escritorio las
pastillas **envuelven** si no caben; en móvil se desplazan con un degradado en el
borde (`mask-image`) que dice "hay más". No es un sidebar a propósito.

**El menú del alumno son cuatro pastillas** (M22, 20-oct-2026): Inicio · V-AI-P · Mis cursos ·
Perfil, sin icono en el teléfono para que quepan. Eran nueve y había hasta siete formas de llegar
a lo mismo. **Cada cosa vive en un lugar** (docs/M22.md): una pantalla nueva no agrega una
pastilla, entra como pestaña de su lugar (V-AI-P, el curso o Mi perfil). La casa de V-AI-P no es un
curso: no sale en Inicio ni en Mis cursos y sus pestañas redirigen a `/vaip`.

**Teléfono, tableta y computadora** (M23, 20-oct-2026). Una pantalla no está lista hasta pasar
`pnpm capturas -- --auditar` a 390, 768 y 1280 (y 1024 si tiene columna lateral) en los dos temas,
y MIRAR las hojas. Lo que se toca mide 44 px con `pointer-coarse` (no con el ancho: una tableta
también es táctil). Lo que se pega arriba usa `--alto-encabezado`; lo que se pega abajo, `.pb-seguro`.
Un contenedor con scroll horizontal lleva `relative`, o un `sr-only` absoluto se escapa y desborda
la página. **Página de venta**: cada botón de compra es `BotonSuscribir` (mismo link, nada si la
suscripción no abre), 3–4 en la página con texto distinto, el del encabezado visible sin scroll en
390×844, y la barra `BarraSuscribir` en teléfono y tableta.

**El panel de admin es la excepción: barra lateral agrupada en «dos mundos»** (M19; M25,
20-oct-2026, Alejandro: «hay tantas pestañas… muchas cosas significan lo mismo»). La barra es la
ÚNICA navegación: ninguna página repite sus destinos en pestañas, y el encabezado de cada página
lleva la ceja de su grupo (`<Titulo ceja="V-AI-P">`). Panel · **V-AI-P** (Resumen, Muro, Noticias,
Clases, Miembros, Herramientas, Planes y cobros —solo admin—) · **Cursos** (Cursos, Entregas, Grupos,
Anuncios y blog, Puntos, Dinámicas, Encuestas, Certificaciones) · **Personas** (Alumnos, Empresas) ·
**Ajustes** (Agente IA; API solo admin), y al pie «Portal de alumnos». Cada destino aparece una vez.
Nada de Cursos enseña V-AI-P ni al revés (`lib/membresia/mundo.ts`: las casas de los planes y las
herramientas): la casa se edita en V-AI-P → Clases y sus herramientas en V-AI-P → Herramientas. En
escritorio es una columna fija; en teléfono, un `<details>` «Menú · V-AI-P · Muro»
(`components/admin/barra-lateral.tsx`). El encabezado del panel queda en una fila: marca, campana
(muro de V-AI-P y grupos por separado) y cuenta. El portal de alumnos sigue con dos filas.

**Vocabulario fijo** (M25): «**Comunidad**» es solo V-AI-P, la única comunidad. El canal interno de
cada generación de un curso es su «**Grupo**» (pestaña del curso; la URL sigue siendo /comunidad).
Las clases de un curso viven en «**En vivo**»; las de V-AI-P en «**Clases**». «**Avisos**» son de
V-AI-P: publicaciones fijadas en su Muro (tema Avisos). «**Anuncios**» son de los cursos, con el
blog; las clases de V-AI-P no publican anuncio.

Estructura copiada de Skool: **pestañas por sección dentro del curso**
(`components/ui-vadai/pestanas.tsx`) — Contenido · Grupo · En vivo · Dinámicas (M22: el
curso abre en Contenido y el grupo va segundo; M25: se llama «Grupo») —, rejilla
de cursos con portada 16:9 y barra de avance, y feed con avatar a la izquierda.
Las sesiones en vivo viven en **su propia pestaña** (21-sep-2026): encima del
temario estorbaban para llegar a la primera lección. Y en el índice del curso
**los módulos se abren y se cierran** con `<details>`, abierto solo aquel en el
que estás: abiertos todos, dieciséis módulos son una lista plana de cuarenta
renglones donde nadie se ubica. Los primitivos viven en
`components/ui-vadai/superficie.tsx`; una pantalla nueva se arma con esos, no con
clases sueltas.

**La lección va fuera del marco del curso** (decidido 25-sep-2026). `curso/[slug]/(marco)/`
envuelve Contenido, Grupo, En vivo y Dinámicas con el título del curso, el avance y
las pestañas; `[leccionId]` queda fuera, con un encabezado corto (← curso, sesión, título,
avance), el video primero —de borde a borde en teléfono— y a la derecha **solo la sesión
actual** y el material, nunca el índice completo, que vive en Contenido: "que se vean
todas las sesiones y módulos a la derecha no hace sentido". En teléfono la misma
estructura se reordena con `order` (material bajo el video, la sesión después del
cierre): nada se duplica en el DOM. El cierre —"Marcar como completada" en lima, la única
lima de la pantalla, con Anterior y Siguiente al lado— va **al final del contenido** y
antes de los comentarios. El texto de lectura es de 16 px (`render-rico.tsx`), no de 14.

**El color de marca va como acento, sobre fondos claros** (decidido 25-sep-2026: "que se
sienta mucho más atractivo e interactivo"). Tres papeles, siempre por token: **cyan/azul
(`primary`)** para lo que orienta y se toca —icono de tipo de lección, número de módulo,
eyebrow, pestaña activa, porcentaje de avance, avatares—; **lima (`accent`)** para lo
logrado y la acción principal —lección o módulo completado (disco lima con palomita navy),
"Completada", nivel, certificado, el CTA de cada pantalla, la barra al 100 %—; **`exito`**
solo para resultados de calificación (quiz o tarea aprobada). El color va en discos,
pastillas, bordes y barras, nunca en planos grandes: el único plano de marca es el hero de
Mis cursos.

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
