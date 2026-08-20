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

## Stack

Next.js 15 (App Router) · React 19 · TypeScript estricto · Tailwind 4 · shadcn/ui ·
Supabase (sin ORM) · Bunny Stream · Stripe Payment Links · Vercel · pnpm
