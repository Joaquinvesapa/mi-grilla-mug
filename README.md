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
Con el `docker-compose.yml` del repo, el usuario y la base son `mi_grilla`. Las cuentas (Better Auth)
necesitan además un secreto de 32 caracteres o más, que firma las cookies de sesión (generalo con
`openssl rand -base64 32` y no lo reuses entre entornos), y la URL pública de la app:

```sh
DATABASE_URL=postgresql://mi_grilla:<tu-contraseña>@127.0.0.1:5432/mi_grilla
POSTGRES_PASSWORD=<tu-contraseña>
BETTER_AUTH_SECRET=<el-secreto-generado>
BETTER_AUTH_URL=http://localhost:3000
```

Con `BETTER_AUTH_URL` en `https:`, la cookie de sesión es `Secure` y lleva el prefijo `__Secure-`.

`.env` no se commitea. Después:

```sh
docker compose up -d   # Postgres 17 en 127.0.0.1:5432 (o `pnpm db:up`, que espera a que esté sano)
pnpm install           # también genera el cliente de Prisma (postinstall)
pnpm db:migrate        # aplica las migraciones
pnpm db:seed           # carga la grilla del festival (data/schedule.json)
pnpm dev               # http://localhost:3000
```

Con la base corriendo, `GET /api/health` responde `{"status":"ok","database":"up"}`. La pantalla
principal `/` pide sesión: sin una, redirige a `/login` (o creá una cuenta en `/register`).

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
- `pnpm test:integration`: tests de integración contra la base PostgreSQL real de `DATABASE_URL`,
  levantada, migrada y sembrada (`pnpm db:up && pnpm db:migrate && pnpm db:seed`).
- `pnpm test:e2e`: Playwright contra el build de producción (`pnpm build && pnpm start`, puerto
  3100): iPhone (WebKit), Pixel 7, 360 px y desktop (`/demo`). Los tests crean cuentas y leen la
  grilla, así que necesitan la base levantada, migrada y sembrada
  (`pnpm db:up && pnpm db:migrate && pnpm db:seed`) y `BETTER_AUTH_SECRET` en
  `.env`; `BETTER_AUTH_URL` la fija la config de Playwright (`http://127.0.0.1:3100`). La primera
  vez: `pnpm exec playwright install webkit chromium`.
- `pnpm test:e2e:docker`: la misma suite E2E dentro de la imagen oficial de Playwright, para hosts
  sin las bibliotecas de WebKit. Acepta los argumentos de `playwright test` (por ejemplo
  `--project iphone-webkit`). **Solo Linux:** el contenedor usa la red del host
  (`--network host`), así que llega a la base de `docker-compose.yml` en `127.0.0.1:5432` y necesita
  el puerto 3100 libre en el host. Igual que `pnpm test:e2e`, pide la base levantada, migrada y sembrada antes.
  `DATABASE_URL` y `BETTER_AUTH_SECRET` se pasan por nombre, sin mostrar sus valores: los del
  entorno si están definidas, y si no, las de `.env`.
- `pnpm db:up` / `pnpm db:down`: levanta (y espera) / baja el Postgres de `docker-compose.yml`.
- `pnpm db:generate`: regenera el cliente de Prisma.
- `pnpm db:migrate`: aplica las migraciones (`prisma migrate deploy`).
- `pnpm db:seed`: carga la grilla de `data/schedule.json` (días, escenarios y shows) en la base. Se
  puede correr de nuevo: actualiza lo que ya está. Si en la base hay un show que no está en el JSON,
  falla sin tocar nada (`[seed] SCHEDULE_ORPHANED`).

## CI

`.github/workflows/ci.yml` corre al abrir, actualizar o reabrir un PR, y al mergear a `main`, con
tres jobs en paralelo: `quality` (lint, formato, tipos y unit con coverage), `integration`
(migraciones y tests de integración contra Postgres 17) y `e2e` (migraciones y Playwright con WebKit
y Chromium, contra su propio Postgres 17). `integration` y `e2e` reciben un `BETTER_AUTH_SECRET`
descartable escrito en el workflow, que no es un secreto, y su `BETTER_AUTH_URL`; `quality` no
necesita ninguna de las dos.
