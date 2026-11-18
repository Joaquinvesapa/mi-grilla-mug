# SAST FEAT-005a

| Field | Value |
|-------|-------|
| Ticket | FEAT-005a |
| Tools | grep sobre los 9 archivos de `src/` del ticket (`git diff main...HEAD`), oxlint --type-aware, pnpm audit --prod |
| Date | 2026-11-18 |

Alcance: los archivos de `src/` del ticket, sobre `1cecf85`. Re-cierre de CODE sobre `b9af62b` (vuelta 3
de la spec, solo ids de test): `git diff 1cecf85 HEAD -- src package.json pnpm-lock.yaml` vacío y
`pnpm audit --prod` sin vulnerabilidades conocidas, así que el escaneo sigue vigente.

- **Nuevos:** `src/lib/live-now.ts`, `src/lib/live-messages.ts`, `src/components/use-now.ts`,
  `src/components/live-button.tsx`, `src/components/live-panel.tsx`.
- **Modificados:** `src/lib/festival-time.ts`, `src/components/schedule-screen.tsx`,
  `src/components/schedule-grid.tsx`, `src/app/globals.css`.

El ticket no agrega rutas, Server Actions, consultas a la base ni dependencias: todo corre en el
navegador con la grilla, el `draft` y `Date.now()`. El grep de `dangerouslySetInnerHTML`,
`innerHTML`, `eval(`, `new Function`, `exec(`, `spawn(`, `fetch(`, `console.*`, `localStorage`,
`password`, `secret` y `token` sobre esos archivos no encontró nada.

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos ni credenciales en los archivos del ticket; `.env` sigue en `.gitignore` |
| F-SAST-02 | ✅ | no hay consultas: el ticket no toca `src/server/` ni Prisma |
| F-SAST-03 | ✅ | nada llega a exec/spawn |
| F-SAST-04 | ✅ | sin `eval`, `new Function` ni deserialización insegura |
| F-SAST-05 | ✅ | no hay rutas de archivo |
| F-SAST-06 | ✅ | los nombres de artista y escenario se renderizan como hijos de React, sin `dangerouslySetInnerHTML` ni `innerHTML` (R-06); un test inyecta HTML en un instante y verifica que no se crea ningún elemento |
| F-SAST-07 | ✅ | sin `fetch` ni pedidos salientes: el panel no llama al servidor |
| F-SAST-08 | ✅ | no hay criptografía |
| F-SAST-09 | ✅ | sin modo debug ni `console.*` en los archivos del ticket |
| F-SAST-10 | ✅ | no se registra nada |
| F-SAST-11 | ✅ | no hay superficie de subida |
| F-SAST-12 | ✅ | no hay formularios ni acciones que cambien estado: el panel solo lee |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found |
| F-SAST-14 | ✅ | `liveNow` ignora ids que no son de la grilla (R-01) y shows con instantes ilegibles (R-02); `now` inválido lanza `RangeError` |
| F-SAST-15 | ✅ | ningún mensaje de error llega a la UI; el panel no tiene errores propios |
| F-SAST-16 | ✅ | sin dependencias nuevas (`package.json` y `pnpm-lock.yaml` sin cambios) |
| F-SAST-17 | ✅ | sin rutas de código dinámico; `useNow` no lee la URL ni el almacenamiento (FR-14) |

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
