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

## Block 2 — Inicio y shell nativo

- E2E de WebKit (perfil iPhone) con `pnpm test:e2e:docker` en la imagen oficial
  `mcr.microsoft.com/playwright:v1.65.1-noble` (`scripts/test-e2e-docker.sh`, carpeta nueva
  `scripts/`): el host Arch no tiene las bibliotecas de WebKit. Volúmenes con nombre para
  `node_modules`/`.next`, corre con el uid del host, `--ipc=host` (recomendado por Playwright para
  Chromium). La imagen está fijada por tag, no por digest. — usuario — 2026-11-17 — Block 2
- `--accent` = highlight-med (#403d52): highlight-low casi no se distinguía del fondo. — usuario —
  2026-11-17 — Block 2
- `Button`: solo tamaños ≥ 44 px (`default`, `lg`, `icon`, `icon-lg`); `destructive` con token
  nuevo `--destructive-foreground` = base. Escala de radios extendida con `--radius-2xl`
  (`--radius` + 8px), solo para la silueta del teléfono. Hovers bajo `(hover: hover) and
  (pointer: fine)`. — usuario — 2026-11-17 — Block 2
- `shadcn add` (CLI 4.23.0) había instalado los paquetes npm `cn` y `radix-ui` con caret: se
  quitaron y los imports apuntan a `@/lib/utils` y a `@radix-ui/react-*`. Cada `shadcn add` futuro
  se revisa. — usuario — 2026-11-17 — Block 2
- Naming: constantes de módulo inmutables en SCREAMING_SNAKE_CASE. Paleta Rosé Pine (neutros con
  tinte violeta) prevalece sobre el "sin violeta" de design-taste para fondos y neutros. — usuario —
  2026-11-17 — Block 2
- Pendientes registrados (no se resuelven en este bloque): (a) la regla `user-select`/
  `-webkit-touch-callout: none` alcanza también a `a` porque la spec lo pide; revisar cuando
  aparezca el primer link dentro de texto; (b) inputs a 16 px e `interactive-widget` llegan con el
  PRD 02, el primero con formularios; (c) el test de AC-18 pasa también por el preflight de
  Tailwind; (d) el test de NFR-07 mide con puntero `mouse`: el camino táctil se verifica en el
  iPhone real en VERIFY. — usuario — 2026-11-17 — Block 2
