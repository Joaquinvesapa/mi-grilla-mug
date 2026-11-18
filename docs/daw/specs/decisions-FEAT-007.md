# Decisiones de FEAT-007 — Fondo de pantalla del grupo

Formato: decisión — quién la aprobó — fecha — fase o bloque.

- Los 20 AC del PRD van en un solo ticket (W-PRD-06): once son casos de la misma regla de dibujo y la
  descarga, la guía y el modo sin conexión se reusan de FEAT-004 y FEAT-006c. — el usuario —
  2026-11-18 — DEFINE.
- En un bloque del fondo sin lugar para la fila de iniciales debajo del horario (los 2 shows de
  20 minutos, domingo, Kidzapalooza 18:00 y 18:30, ≈ 60 px), el nombre del artista se acorta a una
  línea y las iniciales van a su derecha, en la misma línea; el horario se mantiene (opción 2 de 3:
  las otras eran reemplazar el horario por las iniciales o dejarlas salir del bloque). — el usuario
  — 2026-11-18 — PLAN.
- Consecuencia técnica de la decisión anterior, por la auditoría de PLAN (hallazgos 1 y 2): en la
  línea del artista las píldoras ocupan a lo sumo la mitad del ancho útil, y las iniciales que no
  entran (ahí o en la fila) pasan al "+N", para que el artista nunca desaparezca y el total de
  amigos siga exacto. Con `groups === null` la hoja genera el personal sin pregunta, como la grilla.
  — el modelo, en modo minimal, sin pregunta: no cambia ningún requisito ni la opción elegida —
  2026-11-18 — PLAN.
- Supuestos del Block 1, aceptados por la revisión del bloque (daw-module-verifier) — el modelo, en
  modo minimal — 2026-11-18 — CODE, Block 1:
  - En la línea del artista, las píldoras van justo después del texto del artista más `BADGE_GAP`,
    no pegadas al borde derecho del bloque ("a su derecha" de la decisión del usuario).
  - Un bloque sin amigos, aun con grupo, conserva exactamente las líneas y el horario de FEAT-004;
    sin píldoras, el artista usa todo el ancho útil.
  - Defensas inalcanzables con la grilla real, cubiertas por tests `test-wallpaper-group-defensive-*`:
    sin lugar para una línea de artista, o sin lugar ni para "+N", el bloque no lleva píldoras; si
    ni "…" entra en el encabezado, `groupLabel` es `null`.
  - `groupLabel.y` es el mismo que el de "Mi Grilla" (los dos de 32 px, centrados en la fila del
    título).
