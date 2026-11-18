# Decisiones de FEAT-006b fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque.

- El texto de `MEMBER_NOT_FOUND` es "Esa persona ya no está en el grupo." — supuesto del
  implementer, aceptado por el module-verifier y mostrado al usuario (autonomy minimal) —
  2026-11-18 — Block 1.
- `removeMember` valida `groupId` antes que `memberUserId`: con los dos mal formados responde
  `NOT_FOUND` — supuesto del implementer, aceptado por el module-verifier y mostrado al usuario
  (autonomy minimal) — 2026-11-18 — Block 1.
- Los avisos del arch-auditor del Block 1 quedan sin cambios: `getGroup` sigue leyendo la fila propia
  y los integrantes en dos consultas (ventana preexistente de milisegundos) y los helpers de espera
  de los tests de concurrencia no se unifican — orquestador (autonomy minimal) — 2026-11-18 —
  Block 1.
- "Cambiar nombre" es el `Label` visible del input, que arranca con el nombre actual; el botón dice
  "Guardar nombre" y al guardar aparece "Nombre guardado" — supuesto del implementer, aceptado por
  el module-verifier y mostrado al usuario (autonomy minimal) — 2026-11-18 — Block 2.
- "Salir del grupo" con `variant="outline"`, "Borrar grupo" y los dos botones que confirman con
  `destructive`; la sección final va separada con `border-t` y sin título — supuesto del
  implementer, aceptado por el module-verifier y el arch-auditor — 2026-11-18 — Block 2.
- El diálogo de "Salir" no tiene descripción (la spec no la da); el de "Borrar" dice "Se borra para
  todos sus integrantes." — supuesto del implementer, aceptado — 2026-11-18 — Block 2.
- "Sacar" es un `Button` `variant="outline"` de tamaño por defecto (h-11, 44 px) — supuesto del
  implementer, aceptado — 2026-11-18 — Block 2.
- `deleteGroupAction` y `leaveGroupAction` devuelven solo `{ ok: false, error }`: si salen bien,
  redirigen — supuesto del implementer, aceptado — 2026-11-18 — Block 2.
