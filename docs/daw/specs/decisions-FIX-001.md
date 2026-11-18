# Decisiones de FIX-001

- En un PR, el job `e2e` corre solo `iphone-webkit`; al mergear a `main`, los 4 proyectos (en vez
  de no correr E2E en los PR) — el usuario — 2026-11-17 — CLASSIFY.
- En VERIFY se reusa la corrida E2E del cierre de CODE si el código no cambió; si cambió, se corre
  de nuevo — el usuario — 2026-11-17 — CLASSIFY.
- En los bloques de CODE se corre solo el E2E que el bloque escribe, en un proyecto, para que quede
  la evidencia de TDD que pide el verificador — el usuario (aceptó la propuesta) — 2026-11-17 —
  CLASSIFY.
- La regla vive en `AGENTS.md` y no en `.daw/`, que no se edita en este ticket; el encabezado de
  `AGENTS.md` dice que la sección Testing es la excepción — el orquestador, a partir del impact
  scan — 2026-11-18 — PLAN (fix-plan, paso 3).
