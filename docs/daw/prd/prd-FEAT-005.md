# Parent PRD: En vivo ahora

| Metric | Value |
|--------|-------|
| Ticket | FEAT-005 |
| Origen | docs/daw/prd/prd-DISC-001-05.md (DISCOVERY DISC-001, PRD 05 de 7) |
| Date | 2026-11-18 |
| Status | Split |
| Acceptance criteria to cover | 24 |

## Sub-tickets

| Sub-ticket | Title | PRD | ACs | Dependencies | Status |
|---|---|---|---|---|---|
| FEAT-005a | En vivo con la hora real | prd-FEAT-005a.md | AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-20, AC-21, AC-22, AC-23, AC-24 | none | done |
| FEAT-005b | Reloj simulado de /demo | prd-FEAT-005b.md | AC-16, AC-17, AC-18, AC-19 | depends on a | done |

Integración: FEAT-005a mergeado en `main` por el PR #10; FEAT-005b mergeado en `main` por el PR #14
(2026-11-18, con la CI en verde y el ok del usuario).

Los 24 criterios de aceptación son los del PRD de DISCOVERY (`prd-DISC-001-05.md`), sin criterios
agregados en DEFINE.

## Suggested implementation order

a → b

## Original context

En el festival hay 5 escenarios funcionando a la vez y la pregunta más repetida del día es "¿quién
está tocando ahora y quién sigue?". El PRD 05 de DISCOVERY agrega un botón "En vivo" que abre un
panel con el show actual y el siguiente de cada escenario, con los shows elegidos por el usuario
primero. Como el festival ya pasó (13 al 15 de marzo de 2026), `/demo` tiene un reloj simulado para
mostrar la función a cualquier hora del festival.

**Partición (decisión del usuario, 2026-11-18):** el PRD tiene 24 criterios de aceptación, por
encima de los 5–7 que pide revisar W-PRD-06. El usuario eligió partir en dos: FEAT-005a (el botón y
el panel "En vivo" con la hora real, 20 AC) y FEAT-005b (el reloj simulado de `/demo`, 4 AC).
FEAT-005a queda por encima de 7 AC porque casi todos sus criterios son casos de una misma regla
(qué suena ahora y qué sigue en cada escenario) mostrada en un solo panel, y esa regla no se puede
entregar en partes que funcionen solas. El reloj simulado queda aislado porque solo existe en
`/demo` y la app real no lo necesita. Cada sub-ticket sale desde `main` con su propio PR.
