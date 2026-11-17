# Decisiones de implementación — FEAT-001

Supuestos y decisiones tomadas durante CODE que la spec no fijaba. Formato: decisión — quién la
aprobó — fecha — bloque.

## Block 1 — Scaffold y calidad local

- `pnpm-workspace.yaml` con `minimumReleaseAgeExclude` para oxlint 1.94.0, oxfmt 0.79.0 y sus
  bindings nativos (publicados el 2026-11-16): sin la excepción, pnpm 12 rechaza el lockfile con
  `--frozen-lockfile`. Excepción puntual por versión exacta; se retira cuando esas versiones superen
  la ventana de antigüedad. — usuario — 2026-11-16 — Block 1
- `agentRules: false` en `next.config.ts`: `next dev` escribía un bloque de instrucciones para
  agentes dentro de `AGENTS.md` en cada arranque. — usuario — 2026-11-16 — Block 1
- `no-restricted-imports` con patrones más amplios que los literales de la spec (`@prisma/**`,
  `@/server/generated(/**)`, `**/server/generated(/**)`, `**/generated/prisma(/**)`), para cubrir
  subrutas e imports relativos; `typescript/no-explicit-any` en error. — usuario — 2026-11-16 —
  Block 1
- `typecheck` = `next typegen && tsc --noEmit`, para que funcione en un clon limpio y en la CI sin
  `.next/`. — usuario — 2026-11-16 — Block 1
- `.gitignore` con `.env*` + `!.env.example` (en lugar de `.env` + `.env*.local`). — usuario —
  2026-11-16 — Block 1
- oxfmt ignora además `AGENTS.md` y `CLAUDE.md` (formateaba dentro de los bloques DAW) y ordena las
  clases de Tailwind (`sortTailwindcss`, como prevé ADR-001). — usuario — 2026-11-16 — Block 1
- Variables de shadcn que la spec no mapeaba: card/popover-foreground = text, secondary = overlay,
  muted = overlay, accent = highlight-low, `--warning` = gold, `--radius` 0.625rem. El color de
  `--accent` se revisa en el Block 2 (hoy casi no se distingue del fondo). — usuario — 2026-11-16 —
  Block 1
- `components.json` escrito a mano (sin `shadcn init`) para que la CLI no pise `globals.css` con su
  paleta ni agregue `tw-animate-css`. — usuario — 2026-11-16 — Block 1
- Los scripts `test:integration`, `test:e2e` y `db:*`, y las dependencias de los Blocks 2 a 6
  (Radix, Prisma, Serwist, Playwright, yaml…), llegan con su bloque y con la versión fijada en la
  spec. — usuario — 2026-11-16 — Block 1
