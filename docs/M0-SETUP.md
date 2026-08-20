# M0 — Setup manual de infraestructura

> **Estado: M0 COMPLETO.** `pnpm check:m0` sale en verde (15 verificaciones).
> Los avisos restantes son las variables de Stripe y Bunny, que corresponden a
> M9 y M3/M4.
> Verificado por API el 20-ago-2026 contra el proyecto `mtrojwqwnuzzcgtmmoop`.
>
> Para ver el estado en cualquier momento: `node scripts/check-m0.mjs`.
> Mientras ese script no salga en verde, **no se escribe código de aplicación**.

---

## Tablero

| # | Paso | Estado | Quién |
|---|---|---|---|
| 0 | Identificar el proyecto Supabase | ✅ confirmado | — |
| 1 | Crear schema `academia` + grants | ✅ **hecho** | automatizado |
| 2 | Exponer `academia` en la API | ✅ **hecho** | Alejandro |
| 3 | Auth: Google ON, sign-up OFF, redirect URLs | ✅ **hecho** | Alejandro |
| 4 | SMTP Gmail + templates en español | ✅ **hecho** | Alejandro |
| 5 | Crear los 3 buckets `academia-*` | ✅ **hecho** | `scripts/setup-m0.mjs` |
| 6 | Credenciales en `.env.local` | ✅ **hecho** | Alejandro |
| 7 | Vercel + dominio | ⏳ no bloquea M1 | Alejandro |
| 8 | Repo en GitHub | ⏳ no bloquea M1 | Alejandro |

---

## Paso 0 — El proyecto ✅

La academia vive en su **propio proyecto Supabase, dedicado y aislado**:

```
https://mtrojwqwnuzzcgtmmoop.supabase.co
```

Confirmado por Alejandro el 20-ago-2026. Sondeo inicial del proyecto:

```
schemas    : auth, extensions, graphql, graphql_public, public, realtime, storage, vault
tablas     : 0 en public (ningún sistema de aplicación)
usuarios   : 0 en auth.users
buckets    : ninguno
postgres   : 17.6
```

> **Ojo, esto NO es el proyecto compartido.** El proyecto con los otros sistemas de VADAI es
> `ukgbklhmjbniffssacjm` (`ruleta_arysa`, `lusa`, `nacion`, `experiencia_vadai_ialextremo`,
> `demo_whaapy_productos`, `airbnb_hidekel`). La academia no toca ese proyecto.

### Qué implica para la Regla Cero

La Regla Cero **se mantiene íntegra** aunque hoy el proyecto esté aislado: schema `academia`,
prefijos `academia_` en funciones y migraciones, RLS en todas las tablas, cliente siempre con
`{ db: { schema: 'academia' } }`. No cuesta nada y deja la puerta abierta a que otro sistema
VADAI aterrice aquí después.

Lo que sí cambia es el **riesgo**, que hoy es teórico y no real:

- Apagar el sign-up público (Paso 3) no afecta a ningún otro sistema: hay cero usuarios.
- Agregar `academia` a Exposed schemas (Paso 2) no puede romperle la API a nadie.
- Las migraciones no pueden pisar el historial de otro repo.

---

## Paso 1 — Schema `academia` ✅ HECHO

Ejecutado el 20-ago-2026 por conexión directa a Postgres:

```sql
create schema if not exists academia;
grant usage on schema academia to anon, authenticated, service_role;
```

Resultado: schema `academia`, dueño `postgres`, 0 tablas. `public` intacto (0 tablas tocadas).

Las tablas las crea `pnpm db:migrate` en M1. La migración `academia_0001` repite este SQL de
forma idempotente, así que el schema se puede recrear desde cero en otro ambiente.

---

## Paso 2 — Exponer el schema a la API ⛔ PENDIENTE

**Es el paso que bloquea todo lo demás.**

Dashboard → **Settings** → **API** → sección **Exposed schemas**

Agregar `academia` a la lista. Como el proyecto es nuevo, hoy debería decir solo:

```
public, graphql_public
```

Y debe quedar:

```
public, graphql_public, academia
```

**Añade, no reemplaces.** (En este proyecto no hay otros sistemas que romper, pero es el
hábito correcto y en el proyecto compartido de VADAI sí importa de verdad.)

- [ ] `academia` aparece en Exposed schemas

> Sin esto, PostgREST rechaza el schema y el cliente JS **falla en silencio**: devuelve
> arrays vacíos en lugar de un error. Es la causa #1 de horas perdidas.
> El verificador lo detecta como `PGRST106`.

---

## Paso 3 — Auth ⛔ PENDIENTE

Dashboard → **Authentication** → **Providers**

- [x] **Email / password** habilitado — ya está ✓
- [ ] **Google** habilitado — **hoy está apagado**
  - Necesitas Client ID y Client Secret de Google Cloud Console
  - En Google Cloud → Credentials → OAuth 2.0 Client, el *Authorized redirect URI* es:
    `https://mtrojwqwnuzzcgtmmoop.supabase.co/auth/v1/callback`

Dashboard → **Authentication** → **Sign In / Providers**

- [ ] **"Allow new users to sign up" = OFF** — **hoy está en ON**
  - Es el requisito de §0.B: el acceso es un producto pagado, las cuentas nacen de una compra
    o de una invitación, siempre server-side.
  - Aquí no rompe nada: el proyecto tiene 0 usuarios y ningún otro sistema.
- [x] **Vinculación de Google con correo/contraseña** — no hay toggle que activar.
  - En el dashboard actual **no existe** una casilla "Link accounts with the same
    email". §0.B la nombra así, pero describe un **comportamiento automático** de
    Supabase: al entrar con Google, si el correo coincide con una cuenta cuyo
    correo ya está confirmado, las identidades se vinculan solas.
  - **"Allow manual linking" es otra cosa** y puede quedarse en OFF: habilita la
    API `linkIdentity()` para que un usuario ya dentro pegue otro proveedor a
    mano. No hace falta para lo que pide §0.B.
  - Lo que sí importa y `pnpm check:m0` ya verifica: que las cuentas tengan el
    correo confirmado.

Dashboard → **Authentication** → **URL Configuration**

- [ ] Site URL: `https://academia.vadai.com.mx`
- [ ] Redirect URLs incluye `https://academia.vadai.com.mx/**` y `http://localhost:3000/**`

---

## Paso 4 — SMTP (Gmail) ⛔ PENDIENTE

Dashboard → **Settings** → **Authentication** → **SMTP Settings** → Enable Custom SMTP

| Campo | Valor |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | la cuenta de Gmail que envía |
| Password | **App Password** de Google (no la contraseña normal) |
| Sender email | el mismo correo |
| Sender name | `VADAI Academia` |

- [ ] SMTP configurado y probado
- [ ] Templates de **Invite** y **Reset password** en español
      (Authentication → Email Templates)

> Límite ~500 correos/día y entregabilidad limitada. Aceptado para el lanzamiento.
> Trigger para migrar a Resend: >100 invitaciones/día sostenidas, o correos cayendo a spam.
>
> **No bloquea M1** (las migraciones y los seeds no mandan correo), pero sí bloquea M2,
> donde el alta de alumnos depende del email de invitación.

---

## Paso 5 — Buckets de Storage ✅ HECHO

Creados el 20-ago-2026 con `node scripts/setup-m0.mjs` (idempotente, se puede recorrer):

| Bucket | Público | Límite | Uso |
|---|---|---|---|
| `academia-adjuntos` | No | tope global | Adjuntos de lecciones y entregas de tareas |
| `academia-media` | Sí | 10 MB, solo imágenes | Portadas, avatares, imágenes de blog |
| `academia-certificados` | No | 10 MB, solo PDF | PDFs de certificados |

### ⚠️ Pendiente menor: límite de subida

§3.2 del master document pide **100 MB por adjunto**, pero el tope global del proyecto es
menor y un bucket no puede excederlo. `academia-adjuntos` quedó heredando el tope global.

- [ ] Subir el límite en **Settings → Storage → Upload file size limit** a 100 MB
      y volver a correr `node scripts/setup-m0.mjs`

No bloquea M1. Sí importa antes de M3 (carga de contenido real del curso).

> Las **policies** de estos buckets las crea la migración `academia_0015_storage.sql` en M1.
> No las configures a mano.

---

## Paso 6 — Credenciales ✅ HECHO

`.env.local` tiene las 5 variables de M0, todas verificadas:

- `NEXT_PUBLIC_SUPABASE_URL` ✓ responde
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✓ rol `anon` correcto
- `SUPABASE_SERVICE_ROLE_KEY` ✓ rol `service_role`, autoriza el endpoint admin
- `NEXT_PUBLIC_APP_URL` ✓
- `SUPABASE_DB_URL` ✓ conecta (session pooler 5432, PostgreSQL 17.6, usuario `postgres`)

Las de Stripe (M9) y Bunny (M3/M4) siguen vacías y no bloquean nada todavía.

### Sobre `SUPABASE_DB_URL`

Variable que **no** estaba en el CLAUDE.md original; se agregó al decidir aplicar las
migraciones con un runner propio en vez del CLI de Supabase.

- Vive **solo** en `.env.local`, en tu máquina.
- **Nunca** se carga en Vercel, nunca lleva prefijo `NEXT_PUBLIC_`, nunca la lee la app.
- La usan exclusivamente `scripts/migrate.mjs` y `scripts/seed.mjs`.
- Debe ser el **session pooler (5432)**. El transaction pooler (6543) no soporta el DDL de
  las migraciones; el verificador lo rechaza explícitamente.

---

## Pasos 7 y 8 — Vercel y GitHub ⏳

No bloquean M1, pero conviene tenerlos antes de cerrar Fase B.

- [ ] Proyecto `vadai-academia` en Vercel, dominio `academia.vadai.com.mx`
- [ ] Variables en Vercel: las `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY` y
      `NEXT_PUBLIC_APP_URL`. **`SUPABASE_DB_URL` no.**
- [ ] Repo `vadai-academia` en la org `vadai-ia`

> La carpeta local se llama `academia-vadai` y el repo `vadai-academia`. Solo un detalle de
> nombre; el `package.json` usará `vadai-academia`.

---

## Verificación

```bash
node scripts/setup-m0.mjs   # crea/verifica buckets (idempotente)
node scripts/check-m0.mjs   # verifica todo M0, solo lecturas
```

Ambos corren con Node pelón, sin instalar nada. `check-m0` verifica:

1. Variables de entorno presentes y no vacías
2. La URL de Supabase responde
3. **`academia` expuesto en la API** ← Paso 2
4. Llaves `anon` y `service_role` con los roles correctos y del mismo proyecto
5. Sign-up público OFF ← Paso 3
6. Providers Email y Google habilitados ← Paso 3
7. Los tres buckets existen con el flag público correcto ← Paso 5
8. `SUPABASE_DB_URL` parseable y con host que resuelve
9. Conexión real a Postgres y existencia del schema (cuando `pg` esté instalado)

Salida esperada: todo en `✓` y exit code 0.

---

## Cuando esto esté en verde

- **Fase B** — scaffold: Next 15 + Tailwind 4 + shadcn/ui + clientes de Supabase + commit inicial
- **Fase C (M1)** — migraciones, RLS, policies de storage, seeds y la matriz de pruebas de policies
