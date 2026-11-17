# Mi Grilla

PWA mobile-first para armar tu grilla de un festival de tres días (escenarios × horarios), llevarla
como fondo de pantalla de bloqueo del iPhone y ver con quién de tu grupo coincidís. Desde desktop se
presenta en `/demo`, dentro de un marco de iPhone.

Stack: Next.js 16 (App Router) + React 19, TypeScript 7, Tailwind CSS 4 + shadcn/ui, PostgreSQL 17 +
Prisma 7, Serwist (PWA), Vitest y Playwright. El detalle, las convenciones y las decisiones están en
[`AGENTS.md`](AGENTS.md).

## Requisitos

- Node 24 (`.nvmrc`; con nvm: `nvm use`).
- pnpm 12.18.0, la versión de `packageManager` en `package.json` (con Corepack: `corepack enable`).
- Docker con Docker Compose, para la base PostgreSQL local.

## Levantar el proyecto

```sh
cp .env.example .env
```

Completá `.env`: elegí una contraseña para `POSTGRES_PASSWORD` y usá la misma en `DATABASE_URL`.
Con el `docker-compose.yml` del repo, el usuario y la base son `mi_grilla`:

```sh
DATABASE_URL=postgresql://mi_grilla:<tu-contraseña>@127.0.0.1:5432/mi_grilla
POSTGRES_PASSWORD=<tu-contraseña>
```

`.env` no se commitea. Después:

```sh
docker compose up -d   # Postgres 17 en 127.0.0.1:5432 (o `pnpm db:up`, que espera a que esté sano)
pnpm install           # también genera el cliente de Prisma (postinstall)
pnpm db:migrate        # aplica las migraciones
pnpm dev               # http://localhost:3000
```

Con la base corriendo, `GET /api/health` responde `{"status":"ok","database":"up"}`.

El service worker (PWA instalable y pantalla "Sin conexión") solo se registra con el build de
producción: `pnpm build && pnpm start`.

## Comandos

- `pnpm dev`: servidor de desarrollo (Turbopack).
- `pnpm build`: build de producción. No chequea tipos: eso es `pnpm typecheck`.
- `pnpm start`: sirve el build de producción.
- `pnpm lint`: oxlint con reglas de tipos (incluye la separación de capas).
- `pnpm format` / `pnpm format:check`: oxfmt, formatea / verifica el formato.
- `pnpm typecheck`: `next typegen` + `tsc --noEmit` (TypeScript 7).
- `pnpm test`: tests unitarios (Vitest, jsdom) con coverage; falla bajo 80 % líneas, 70 % ramas u
  80 % funciones.
- `pnpm test:integration`: tests de integración contra la base PostgreSQL real de `DATABASE_URL`.
- `pnpm test:e2e`: Playwright contra el build de producción (`pnpm build && pnpm start`, puerto
  3100): iPhone (WebKit), Pixel 7, 360 px y desktop (`/demo`). La primera vez:
  `pnpm exec playwright install webkit chromium`.
- `pnpm test:e2e:docker`: la misma suite E2E dentro de la imagen oficial de Playwright, para hosts
  sin las bibliotecas de WebKit. Acepta los argumentos de `playwright test` (por ejemplo
  `--project iphone-webkit`).
- `pnpm db:up` / `pnpm db:down`: levanta (y espera) / baja el Postgres de `docker-compose.yml`.
- `pnpm db:generate`: regenera el cliente de Prisma.
- `pnpm db:migrate`: aplica las migraciones (`prisma migrate deploy`).

## CI

`.github/workflows/ci.yml` corre al abrir, actualizar o reabrir un PR, y al mergear a `main`, con
tres jobs en paralelo: `quality` (lint, formato, tipos y unit con coverage), `integration`
(migraciones y tests de integración contra Postgres 17) y `e2e` (Playwright con WebKit y Chromium).
