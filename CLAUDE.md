<!-- BEGIN DAW (managed by DAW — do not edit by hand) -->
@AGENTS.md
@.daw/orchestrator.md
<!-- END DAW -->

# Memoria (Cortex)

Proyecto: `mi-grilla-mug` en todas las llamadas. Las memorias se escriben en español.
Cortex es la única memoria de este repo: no usar engram (aunque su hook lo pida) ni la memoria en
archivos de Claude Code.

## Al arrancar (junto con el Boot Sequence de DAW, en silencio)

1. `memoria_context({ project: "mi-grilla-mug", goal, start_session: true })`.
2. La memoria es contexto, no estado: la fase, el ticket y qué retomar salen de `.daw-state.json`
   y de la rama. Los "next steps" de la última sesión NUNCA autorizan retomar trabajo: se aplica
   igual el "¿qué querés hacer?" de DAW.

## Durante el trabajo

- Antes de clasificar o planear: `memoria_search` con las palabras del pedido (DAW, Step 1.3),
  citando el id de cada memoria que se use.
- Error o síntoma → `memoria_recall` antes de diagnosticar.
- Guardar con `memoria_save`, sin preguntar, después de:
  - un bug arreglado (`bug_fix`, la causa raíz en `why`);
  - algo no obvio descubierto (`discovery`): APIs sin documentar, cosas de Next 16, Prisma 7,
    Serwist, WebKit;
  - una preferencia del usuario (`preference`);
  - un cambio de config o infraestructura (`config`);
  - un patrón que adoptamos (`pattern`).
- Decisiones de arquitectura: la fuente es el ADR o la spec. La memoria guarda un resumen de
  2 líneas y la ruta en `where_at` (`topic_key: architecture/<area>`), nunca el contenido completo.
- `topic_key` con el ticket cuando es del ticket: `ticket/<ID>/<tema>` (ej. `ticket/FEAT-003a/rls`).
- Solo guarda el agente principal: los subagentes de DAW devuelven sus hallazgos en el informe y
  no llaman a `memoria_save`.
- Las tools de Cortex no escriben en el repo: se pueden usar en cualquier fase, no cuentan como
  artefacto de ninguna y no cambian gates ni estado.
- Nunca guardar secretos, contenido de `.env` ni datos personales de usuarios.

## Campos de `memoria_save`

- `title`: corto y fácil de buscar.
- `what`: verbo + objeto.
- `why`: el motivo.
- `where_at`: archivos o rutas.
- `learned`: gotchas y casos borde.
- `topic_key`: ID estable para actualizar en vez de duplicar.

## Cierre (no hay un "fin de sesión" confiable: se engancha a DAW)

`memoria_session_end` con `goal`, `accomplished`, `discoveries`, `next_steps` y `files`:

- al cerrar cada fase de un ticket (DEFINE→PLAN, PLAN→CODE, …);
- en CLOSEOUT, antes de volver a IDLE;
- al pausar un ticket (protocolo de pausa).
