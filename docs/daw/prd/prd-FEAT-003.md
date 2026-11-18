# Parent PRD: Grilla y mi selección

| Metric | Value |
|--------|-------|
| Ticket | FEAT-003 |
| Origen | docs/daw/prd/prd-DISC-001-03.md (DISCOVERY DISC-001, PRD 03 de 7) |
| Date | 2026-11-17 |
| Status | Split |
| Acceptance criteria to cover | 28 |

## Sub-tickets

| Sub-ticket | Title | PRD | ACs | Dependencies | Status |
|---|---|---|---|---|---|
| FEAT-003a | Grilla y mi selección con conexión | prd-FEAT-003a.md | AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-28 | none | done — merged en main (PR #4) |
| FEAT-003b | Grilla y mi selección sin conexión | prd-FEAT-003b.md | AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27 | depends on a | done — merged en main (PR #5) |

Los 28 criterios de aceptación son los del PRD de DISCOVERY (`prd-DISC-001-03.md`), sin criterios
agregados en DEFINE.

## Suggested implementation order

a → b

## Original context

La grilla del Lollapalooza Argentina 2026 (3 días, 5 escenarios, 91 shows) no entra en la pantalla
de un celular y, mirada como imagen, no deja marcar qué artistas vas a ver. El PRD 03 de DISCOVERY
define ver la grilla en el celular con el formato del póster, armar y guardar la selección propia,
ver los choques entre shows elegidos y consultarla sin señal, con guardado en el dispositivo y
sincronización al volver la conexión.

**Partición (decisión del usuario, 2026-11-17):** la validación marcó W-PRD-06 (28 AC). El usuario
eligió partir en dos: FEAT-003a (grilla, datos y selección con conexión, 20 AC) y FEAT-003b (sin
conexión y sincronización, 8 AC). FEAT-003a queda por encima de 7 AC porque casi todos sus
criterios describen una sola pantalla (la grilla) y su guardado, y esa vista no se puede entregar en
partes que funcionen solas. El funcionamiento sin conexión queda aislado en su propio ticket por ser
la parte de más riesgo técnico.
