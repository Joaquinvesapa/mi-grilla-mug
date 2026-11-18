# SAST FEAT-004

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| Tools | grep sobre los 9 archivos de `src/` del ticket (`git diff main...HEAD`), oxlint --type-aware, pnpm audit --prod |
| Date | 2026-11-18 |

Alcance: los archivos de `src/` del ticket.

- **Nuevos:** `src/lib/wallpaper-layout.ts`, `src/lib/wallpaper-messages.ts`,
  `src/components/wallpaper-canvas.ts`, `src/components/wallpaper-delivery.ts` y
  `src/components/wallpaper-button.tsx`.
- **Modificados:** `src/lib/palette.ts`, `src/components/day-picker.tsx`,
  `src/components/schedule-screen.tsx` y `src/lib/selection-messages.ts`, este último solo en un
  comentario.

FEAT-004 no agrega rutas, Server Actions, consultas a la base ni dependencias (ADR-005): todo pasa
en el navegador.

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos en el código; `.env` está en `.gitignore` (`git check-ignore`) |
| F-SAST-02 | ✅ | no hay consultas a la base en el ticket |
| F-SAST-03 | ✅ | nada llega a exec/spawn/child_process |
| F-SAST-04 | ✅ | sin `eval`, `new Function` ni deserialización insegura |
| F-SAST-05 | ✅ | no hay rutas de archivo; el nombre de la descarga sale de `wallpaperFileName` (solo `[a-z0-9-]`) |
| F-SAST-06 | ✅ | sin `innerHTML` ni `dangerouslySetInnerHTML`; el texto se dibuja con `fillText` en canvas (R-02) y la vista previa es un `<img>` con `src` blob del mismo origen |
| F-SAST-07 | ✅ | sin `fetch` ni pedidos salientes en los archivos del ticket |
| F-SAST-08 | ✅ | no se usa criptografía |
| F-SAST-09 | ✅ | sin modo debug ni `console.*` en los archivos del ticket |
| F-SAST-10 | ✅ | no se registra nada; la imagen no lleva el nombre ni el email de la persona (FR-08) |
| F-SAST-11 | ✅ | no hay superficie de subida: la imagen sale del dispositivo por decisión de la persona (share o descarga) |
| F-SAST-12 | ✅ | no hay formularios ni acciones que cambien estado en el servidor |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found |
| F-SAST-14 | ✅ | la selección (posible pendiente de `localStorage`, no confiable) solo se consulta con `has(show.id)` sobre los shows del día (R-01) |
| F-SAST-15 | ✅ | errores por código (`CANVAS_UNSUPPORTED`, `ENCODE_FAILED`, `SHARE_CANCELLED`, `SHARE_FAILED`) y texto del catálogo; ningún `error.message` ni `.stack` llega a la UI (R-04) |
| F-SAST-16 | ✅ | sin dependencias nuevas: `package.json` y `pnpm-lock.yaml` no cambian |
| F-SAST-17 | ✅ | sin rutas de código dinámicas |

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
