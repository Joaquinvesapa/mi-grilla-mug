# AGENTS.md — Mi Grilla

> Contexto del **proyecto**. El **proceso** (fases, gates, cuándo testear, cuándo commitear) lo
> define DAW en `.daw/` y no se repite acá.

---

## Language

Working language: **español (Argentina)**. Todos los artefactos — PRDs, specs, ADRs, reportes,
mensajes de commit, status lines y textos de la UI — se escriben en español.

En el código: **identificadores en inglés** (archivos, variables, funciones, componentes, tipos,
tablas) y **textos de la UI en español** (decidido en el PLAN de FEAT-001).

---

## What this project is

**Mi Grilla** es una PWA mobile-first para el Lollapalooza Argentina 2026 (13 al 15 de marzo de
2026, ya realizado): cada persona arma su grilla eligiendo los shows que va a ver, la descarga como
fondo de pantalla de bloqueo para iPhone y la comparte con grupos de amigos para ver con quién
coincide. Es una demo / proyecto de portfolio con datos reales, presentable desde desktop en `/demo`
dentro de un mockup de iPhone.

**Concepto:** `docs/daw/discovery/concept-DISC-001.md`
**PRDs (orden de implementación 1 → 7):** `docs/daw/prd/prd-DISC-001-01.md` a `prd-DISC-001-07.md`

---

## Stack

| Field | Value |
|-------|-------|
| Language | TypeScript 7.0.2 (`strict`, `noUncheckedIndexedAccess`) — compilador nativo (ADR-001) |
| Runtime | Node 24 LTS (`.nvmrc`, `engines.node` 24.x) |
| Framework | Next.js 16.4.6 (App Router, Turbopack) + React 19.3.1 · PWA instalable con Serwist 9.5.15 (`serwist` + `@serwist/turbopack`, ADR-002; el service worker solo corre con `next build` + `next start`) |
| Database | PostgreSQL 17 (imagen `postgres:17.12`, la misma en `docker-compose.yml` en local y en los services de la CI) + Prisma 7.10.1 (`@prisma/adapter-pg`; cliente generado en `src/server/generated/prisma/`) |
| Auth | Better Auth 1.7.25 (ADR-003): email y contraseña sobre Prisma, sesión en cookie `httpOnly` de 30 días; sin el handler HTTP montado: las Server Actions de `src/app/auth-actions.ts` llaman a `src/server/accounts.ts`, que usa `auth.api`. Necesita `BETTER_AUTH_SECRET` (≥ 32 caracteres) y `BETTER_AUTH_URL` |
| UI | Tailwind CSS 4.3.5 (`@tailwindcss/postcss`) + shadcn/ui (CLI 4.23.0, estilo new-york) · paleta Rosé Pine, tema oscuro único |
| Test runner | Vitest 5.1.0 (unit en jsdom con coverage v8 / integración en node) + Playwright 1.65.1 (E2E; navegadores: `pnpm exec playwright install webkit chromium`. WebKit necesita bibliotecas del sistema que en algunos hosts faltan, por ejemplo en Arch: ahí se corre con `pnpm test:e2e:docker`) |
| Linter / formatter | oxlint 1.94.0 + oxlint-tsgolint 7.0.2007 (lint con tipos) · oxfmt 0.79.0 — sin ESLint ni Prettier (ADR-001) |
| Type check | `next typegen && tsc --noEmit` con TypeScript 7 (`next build` no chequea tipos: `ignoreBuildErrors`, ADR-001) |
| Package manager | pnpm 12.18.0 (`packageManager`) |

> Todas las versiones de `package.json` son exactas (sin `^` ni `~`).

---

## Testing

| Field | Value |
|-------|-------|
| Coverage floor — line | 80 % (PRD 01, NFR-05; `vitest.config.ts`) |
| Coverage floor — branch | 70 % (PLAN de FEAT-001; `vitest.config.ts`) |
| Coverage floor — function | 80 % (PLAN de FEAT-001; `vitest.config.ts`) |
| How the suite is run | `pnpm test` (unit en jsdom + coverage con los pisos). `pnpm test:integration`: Vitest en node contra una base PostgreSQL real (`DATABASE_URL` de `.env`; antes, `pnpm db:up`, `pnpm db:migrate` y `pnpm db:seed`). `pnpm test:e2e`: Playwright contra el build de producción (`pnpm build && pnpm start` en el puerto 3100, ADR-002; los tests crean cuentas y leen la grilla, así que antes, `pnpm db:up`, `pnpm db:migrate` y `pnpm db:seed`, con `BETTER_AUTH_SECRET` en `.env`) en 4 proyectos: `iphone-webkit` (iPhone 15), `mobile-chromium` (Pixel 7), `mobile-360` (Chromium 360×780) y `desktop` (Chromium 1280×800, solo `/demo`). `pnpm test:e2e:docker`: la misma suite dentro de la imagen oficial `mcr.microsoft.com/playwright:v1.65.1-noble`, para hosts sin las bibliotecas de WebKit (solo Linux: usa la red del host para llegar a la base; no toca el `node_modules` del host; acepta los argumentos de `playwright test`). Calidad: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`. CI: `.github/workflows/ci.yml`, con tres jobs en paralelo de 10 minutos como máximo: `quality` (lint, formato, tipos y `pnpm test`), `integration` (`pnpm db:migrate` + `pnpm db:seed` + `pnpm test:integration` contra un service `postgres:17.12`) y `e2e` (`pnpm db:migrate` + `pnpm db:seed` + `pnpm test:e2e` con WebKit y Chromium, contra su propio service `postgres:17.12`). `integration` y `e2e` reciben un `BETTER_AUTH_SECRET` descartable escrito en el workflow y su `BETTER_AUTH_URL`; `quality`, ninguna de las dos |
| What a skipped test owes | El motivo, en la misma línea del test salteado. |

- El mínimo de la CI son los tres pisos de arriba: la cobertura bajo cualquiera de ellos hace fallar
  `pnpm test`.

- La CI corre al abrir o actualizar un PR y al mergear a `main`; nunca en un push sin PR.
- Obligatorio: tests unitarios, tests de integración y al menos 1 test E2E.
- Los tests de integración usan una base PostgreSQL real, no un mock.

Si un número de acá no coincide con el que exige la CI, gana el de la CI y se corrige este archivo.

---

## Architecture conventions

- **Folder structure:** `src/app/` (rutas, layouts, route handlers y Server Actions delgados, como
  `src/app/auth-actions.ts`), `src/proxy.ts` (el proxy de Next 16: solo redirige `/` a `/login` sin
  cookie de sesión; la verificación real la hace la página), `src/components/`
  (UI; `ui/` = shadcn; también los helpers de cliente con acceso al almacenamiento del navegador,
  como `device-store.ts`, ADR-004), `src/lib/` (utilidades puras, sin I/O), `src/server/`
  (acceso a la base y lógica de servidor; cada módulo con `import "server-only"`),
  `src/server/generated/prisma/` (cliente generado, fuera de git). Tests en
  `tests/{unit,integration,e2e}/`. `scripts/`: herramientas de desarrollo en shell, invocadas
  desde `package.json`; nunca se importan desde `src/`. `data/`: la grilla versionada
  (`schedule.json`, el formato normalizado, y
  `schedule-source-248dba3.json`, la fuente de la que se convirtió, que solo lee su test).
  `prisma/seed.ts`: carga `data/schedule.json` en la base (`pnpm db:seed`); corre con `node` sin
  transpilar, así que importa con extensión `.ts` y solo de `src/lib/`.
- **Layer separation:** `src/app/` y `src/components/` nunca importan `@prisma/*` ni
  `@/server/generated/*`; usan funciones de `src/server/`. Lo hace cumplir `no-restricted-imports`
  en oxlint.
- **Error handling:** en `src/server/` los errores esperados se devuelven como resultado tipado con
  un código (`{ ok: false, code: "DB_UNREACHABLE" }`). Ningún `catch` silencioso: o registra un código
  genérico o re-lanza. Al cliente nunca llega `error.message` de infraestructura.
- **Naming:** archivos y carpetas en kebab-case; componentes en PascalCase; funciones y variables en
  camelCase, salvo las constantes de módulo inmutables, que van en SCREAMING_SNAKE_CASE
  (`STEPS`, `LOAD_BUDGET_MS`); identificadores en inglés; textos de UI en español.
- **Dependencies:** versiones exactas (sin `^` ni `~`); una dependencia nueva se justifica en la
  spec de su ticket; ESLint y Prettier no se instalan (ADR-001).

---

## Code conventions

- TypeScript en modo `strict`.
- UI con los componentes reales de shadcn/ui (copiados al repo y personalizables), no componentes
  propios que imiten su estilo.
- Mobile first: se diseña para 360–430 px de ancho; desktop solo sirve para `/demo`.
- **Frontend mobile (decisión del usuario, 2026-11-16):** todo lo que sea UI/UX mobile se diseña,
  implementa y revisa siguiendo las guías del repo en `.agents/skills/` (versiones fijadas en
  `skills-lock.json`):
  - `mobile-native/SKILL.md` — que la PWA se sienta nativa en el celular: safe areas y notch,
    `100dvh`, sin zoom en inputs, sin tap highlight ni hover pegado, taps sin demora, scroll y
    pull-to-refresh.
  - `gestures/SKILL.md` — gestos que siguen al dedo 1:1 e interrumpibles: bottom sheets (panel "En
    vivo"), swipe para cerrar, scroll x/y de la grilla.
  - `design-taste-frontend/SKILL.md` — criterio visual: un solo sistema, copy propio, sin estética
    genérica de plantilla. Está pensada para sitios de marketing: en Mi Grilla se toman sus
    principios visuales, no su estructura de landing (hero, secciones, fotos).
  Cada spec de una pantalla mobile cita qué puntos de estas guías aplica, y la revisión de cada
  bloque de UI los verifica.
- **Paleta Rosé Pine (decisión del usuario, 2026-11-16):** sus neutros con tinte violeta (base,
  surface, overlay, highlight) son el fondo de la app, y esta decisión prevalece sobre el "nada de
  violeta ni lavanda" de `design-taste-frontend` para fondos y neutros. Iris (`#c4a7e7`) sigue sin
  usarse como acento: el acento es foam.
- Sin `any` (si es inevitable, con un comentario del motivo).
- Componentes de servidor por defecto y `"use client"` solo donde hay interacción.

---

## What NOT to do in this project

- **No usar logos, nombres de marca ni identidad visual de Lollapalooza.** La app tiene identidad
  propia ("Mi Grilla") con el mismo formato escenarios × horarios.
- **No identificar un show por el nombre del artista.** Siempre por su `id` estable: un mismo
  artista puede repetirse (Arjaus Crew toca los 3 días).
- **No editar la grilla desde la app ni scrapearla.** La fuente es el JSON normalizado versionado en
  el repo, cargado con un seed de Prisma.
- **No agregar envío de emails** (verificación, recuperación de contraseña, invitaciones por mail):
  el MVP no tiene servicio de correo.
- **No exponer el reloj simulado fuera de `/demo`.** En la app normal la hora es siempre la real.
- **No mostrar a un no integrante** el nombre, los integrantes ni las selecciones de un grupo.
- **No commitear secretos** (`.env`, credenciales de la base).
- **No sumar funciones que quedaron fuera del MVP** (agenda, amistad 1 a 1, comparar con un amigo,
  perfil con avatar, panel de admin) sin pasar antes por un PRD.

---

## Domain glossary

- **Show:** una actuación de un artista en un escenario, un día, con hora de inicio y fin. Tiene un
  `id` estable.
- **Escenario:** Flow, Samsung, Alternative, Perry's y Kidzapalooza, en ese orden de columnas.
- **Día del festival:** viernes, sábado o domingo. Va de las 06:00 a las 06:00 del día siguiente:
  un show entre las 00:00 y las 06:00 pertenece al día anterior (Peggy Gou, viernes 23:30–01:00).
- **Grilla:** la tabla de doble entrada escenarios (columnas) × horarios (filas) de un día, con el
  formato del póster oficial.
- **Selección:** los shows que el usuario eligió ver.
- **Cambios pendientes:** marcas hechas en la grilla que todavía no se confirmaron con "Guardar".
- **Selección pendiente de sincronizar:** una selección guardada sin conexión, en el dispositivo,
  que se sube sola al volver la señal.
- **Choque:** dos shows elegidos que comparten al menos un minuto.
- **Fondo de pantalla:** imagen 1290 × 2796 de un día para la pantalla de bloqueo del iPhone.
  *Personal:* elegidos encendidos y el resto opacos. *Del grupo:* además, las iniciales de los
  amigos.
- **Grupo:** hasta 20 integrantes que comparten su selección. Lo administra quien lo creó.
- **Link de invitación:** el único link activo de un grupo; vence a los 3 días.
- **En vivo:** el panel con el show actual y el siguiente de cada escenario.
- **Reloj simulado:** la hora elegida en `/demo` para mostrar la app como si fuera el festival.
- **`/demo`:** la página de desktop que muestra la app dentro de un mockup de iPhone.

---

<!-- BEGIN DAW (managed by DAW — do not edit by hand) -->
# DAW — Dilux Agentic Workflow

This repo uses **DAW**: an agent-driven development pipeline with the phases
`CLASSIFY → DEFINE → PLAN → CODE → VERIFY → CLOSEOUT`.

Before answering, read `.daw/orchestrator.md` and run its Boot Sequence. It is a strict state
machine: it decides what you are allowed to do based on the phase recorded in `.daw-state.json`.

The project's own context — stack, architecture, domain — is elsewhere in this file. It lives here,
in `AGENTS.md`, and not in any one tool's file, on purpose: it is tool-agnostic and comes along
unchanged when the pipeline is ported to another agent.
<!-- END DAW -->
