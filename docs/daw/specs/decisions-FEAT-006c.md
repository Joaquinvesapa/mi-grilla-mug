# Decisiones de implementación — FEAT-006c

Supuestos que declararon los implementadores, revisados por el orquestador y mostrados al usuario
(autonomy minimal: se muestran, no se piden).

- "Solo lo guardado" (FR-05) se prueba en integración con altas y bajas en `selected_shows` y un
  amigo sin selección (`showIds: []`): los cambios sin guardar viven en el cliente y no llegan al
  servidor — implementer, revisado por el orquestador — 2026-11-18 — Block 1
- Los tests que la spec no ubica en una capa se cubren en unit y en integración, salvo
  `test-groups-picks-privacy` (solo integración) y `test-groups-picks-unavailable` (solo unit,
  necesita la base caída) — implementer, revisado por el orquestador — 2026-11-18 — Block 1
- El tipo de resultado se llama `ListGroupPicksResult` y vive en `src/server/groups.ts` con los
  demás tipos de resultado — implementer, revisado por el orquestador — 2026-11-18 — Block 1
- Archivo nuevo `src/lib/stored-value.ts` (no listado en la spec): mueve sin cambios
  `FORMAT_VERSION`, `USER_ID_MAX_LENGTH`, `USER_NAME_MAX_LENGTH`, `isFields`, `parseJson` e
  `isBoundedString` desde `offline-selection.ts`, para que `offline-selection → group-picks` no
  forme un ciclo; `selection-actions.ts` importa `USER_ID_MAX_LENGTH` de ahí — implementer, aceptado
  por las dos revisiones — 2026-11-18 — Block 2
- `parseGroupChoice` devuelve `{ groupId }` (el tipo de `readGroupChoice`), no el valor entero;
  `groupPicksOf` además rechaza ids de grupo repetidos (las opciones del select usan el id como
  key) y corta nombres largos antes de contar puntos de código; los máximos salen de
  `MAX_GROUPS_PER_USER` y `MAX_GROUP_MEMBERS - 1` — implementer y revisión de arquitectura —
  2026-11-18 — Block 2
- `heightWithFriends(geometry, nextTop: number | undefined)`: el show siguiente es el primero del
  mismo escenario que empieza estrictamente después; sin siguiente no hay tope. El selector recibe
  solo `id` y `name` y conserva el ancho `w-fit` del `native-select` de shadcn; en un bloque elegido
  el chip hereda `text-primary-foreground` — implementer, aceptado por las dos revisiones —
  2026-11-18 — Block 3
- La fila del selector es `shrink-0 px-4 pb-2` dentro de `app-fixed-screen`, debajo del AppBar (y
  del aviso de pendiente) y antes de los días. El ref de grupos de la copia se actualiza en un
  efecto sobre `[groups, userId]` declarado antes del efecto de montaje (un test falla si se
  invierte). La rama de `chooseGroup` que rechaza un id ajeno queda como defensa en profundidad sin
  test: el selector ya filtra los valores desconocidos (Block 3) — implementer, aceptado por las dos
  revisiones — 2026-11-18 — Block 4
- El worktree usa su propia base local (`mi_grilla_feat006c`): `mi_grilla_test` la comparte otra
  sesión y una corrida de integración se pisó con la suya — orquestador — 2026-11-18 — Block 1
