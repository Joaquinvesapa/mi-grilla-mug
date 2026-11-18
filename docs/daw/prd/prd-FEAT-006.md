# Parent PRD: Grupos

| Metric | Value |
|--------|-------|
| Ticket | FEAT-006 |
| Origen | docs/daw/prd/prd-DISC-001-06.md (DISCOVERY DISC-001, PRD 06 de 7) |
| Date | 2026-11-18 |
| Status | Split |
| Acceptance criteria to cover | 32 |

## Sub-tickets

| Sub-ticket | Title | PRD | ACs | Dependencies | Status |
|---|---|---|---|---|---|
| FEAT-006a | Crear grupos, invitar y unirse | prd-FEAT-006a.md | AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-29, AC-31 | none | active |
| FEAT-006b | Administrar y salir de un grupo | prd-FEAT-006b.md | AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-28 | depends on a | pending |
| FEAT-006c | El grupo en la grilla | prd-FEAT-006c.md | AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-30, AC-32 | depends on a | pending |

Los 32 criterios de aceptación son los del PRD de DISCOVERY (`prd-DISC-001-06.md`), sin criterios
agregados en DEFINE.

## Suggested implementation order

a → b → c (b y c dependen solo de a; entre ellos son independientes)

## Original context

Al festival se va en grupo, y cada uno quiere ver artistas distintos. El PRD 06 de DISCOVERY permite
crear grupos, invitar amigos con un link que vence a los 3 días y ver en la grilla qué shows eligió
cada integrante, con la selección visible solo para los integrantes. Es la base del fondo de
pantalla del grupo (PRD 07).

**Partición (decisión del usuario, 2026-11-18):** el PRD tiene 32 criterios de aceptación y toca
esquema, migraciones y permisos. El usuario eligió partir en tres: FEAT-006a (crear, invitar,
unirse, listar y privacidad, 15 AC), FEAT-006b (administrar, sacar, salir y borrar, 7 AC) y
FEAT-006c (el grupo en la grilla, con iniciales y sin conexión, 10 AC). FEAT-006a queda por encima
de 7 AC porque crear un grupo, su link y unirse forman un solo recorrido que no entrega nada por
partes: sin link no hay a quién sumar, y sin unirse el grupo tiene un solo integrante. La
privacidad (AC-29) y la aleatoriedad del link (AC-31) van con él porque son la primera vez que
existe un grupo que proteger. FEAT-006b agrupa todo lo que cambia o borra un grupo existente, con el
aviso de "Necesitás conexión" (AC-28), que cubre todas las acciones. FEAT-006c agrupa lo que pasa en
la grilla. Cada sub-ticket sale desde `main` con su propio PR (decisión del usuario: sin apilar).
