# VADAI Academia

Academia online de VADAI — [academia.vadai.com.mx](https://academia.vadai.com.mx)

Cursos en video con módulos, progreso, quizzes, tareas, certificados, comunidad y
cohortes con sesiones en vivo. Primer curso: **Claude en tu Empresa**, 21 de
septiembre de 2026.

## Documentación

| Documento | Para qué |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Contexto permanente, reglas y anti-patterns. Manda sobre cualquier suposición |
| [docs/academia-master-document.md](docs/academia-master-document.md) | Fuente de verdad funcional: negocio, modelo de datos, milestones |
| [docs/M0-SETUP.md](docs/M0-SETUP.md) | Checklist de infraestructura, con el estado de cada paso |
| [docs/M1.md](docs/M1.md) | Schema, RLS y seeds: qué se construyó y cómo verificarlo |
| [docs/M2.md](docs/M2.md) | Autenticación: login, middleware y pantalla de sin-acceso |
| [docs/M3.md](docs/M3.md) | Admin de cursos, módulos, lecciones y adjuntos |
| [docs/M4.md](docs/M4.md) | Vista del alumno: mis cursos, player con token y progreso |
| [docs/M8.md](docs/M8.md) | Cohortes, sesiones en vivo y grabaciones ligadas |
| [docs/M9.md](docs/M9.md) | Stripe: webhook, provisioning y alta manual |

## Migraciones

Se aplican con un runner propio, **no** con `supabase db push`: el CLI crea el
schema `supabase_migrations` con un historial global del proyecto. El nuestro
guarda su ledger en `academia.schema_migrations`, aplica cada archivo en una
transacción, detecta si una migración ya aplicada cambió, y **aborta si aparece
cualquier objeto fuera de `academia`**.

Una migración aplicada es historia: no se edita. El cambio va en un archivo nuevo.

## Regla Cero

Esta app trabaja **exclusivamente en el schema `academia`** de Postgres. Nunca crea
ni altera objetos en `public`, `auth.*` ni `storage.*` (salvo policies de los buckets
propios `academia-*`). El cliente de Supabase siempre se construye con
`{ db: { schema: 'academia' } }`.

Ver CLAUDE.md para el detalle y el porqué.

## Arranque

```bash
pnpm install
cp .env.local.example .env.local   # y llénalo: docs/M0-SETUP.md paso 6
pnpm check:m0                      # verifica la infraestructura
pnpm dev
```

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint (prohíbe `any`) |
| `pnpm typecheck` | TypeScript en modo estricto, sin emitir |
| `pnpm setup:m0` | Crea los buckets `academia-*` (idempotente) |
| `pnpm check:m0` | Verifica variables, conexión, schema expuesto, Auth y buckets |
| `pnpm db:status` | Qué migraciones están aplicadas y cuáles faltan |
| `pnpm db:migrate` | Aplica las migraciones pendientes, cada una en su transacción |
| `pnpm db:seed` | Siembra los datos QA (idempotente) |
| `pnpm test:rls` | Matriz de policies con cinco usuarios reales |
| `pnpm test:auth` | Matriz de acceso contra la app corriendo (requiere `pnpm start`) |
| `pnpm test:admin` | Ejecuta las server actions del admin de verdad (requiere `pnpm start`) |
| `pnpm test:alumno` | Progreso, player firmado y acceso vencido (requiere `pnpm start`) |
| `pnpm test:cohortes` | Calendario, zona horaria y grabaciones (requiere `pnpm start`) |
| `pnpm test:stripe` | Webhook con eventos firmados sintéticos (requiere `pnpm start`) |
| `pnpm check:bunny` | Verifica las credenciales de Bunny Stream contra su API |
| `pnpm db:types` | Regenera `lib/supabase/types.ts` desde la base |
| `pnpm db:purge` | Lista los datos QA a borrar (`--confirmar` para ejecutar) |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript estricto · Tailwind 4 · shadcn/ui ·
Supabase (sin ORM) · Bunny Stream · Stripe Payment Links · Vercel · pnpm
