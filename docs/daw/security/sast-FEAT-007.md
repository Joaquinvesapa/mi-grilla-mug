# SAST FEAT-007

| Field | Value |
|-------|-------|
| Ticket | FEAT-007 |
| Tools | revisión del diff `main..HEAD` (8 archivos de `src/` y 11 de `tests/`) con grep de patrones y lectura; `pnpm audit --prod` y `pnpm audit`; oxlint 1.94.0 con tipos |
| Date | 2026-11-18 |

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos en el código; `.env` está en `.gitignore`; el diff no agrega credenciales, tokens ni URLs de base |
| F-SAST-02 | ✅ | FEAT-007 no agrega consultas: no toca `src/server/` ni la base; los E2E siembran con los helpers parametrizados existentes de `tests/e2e/db.ts` |
| F-SAST-03 | ✅ | nada llega a exec/spawn/child_process |
| F-SAST-04 | ✅ | sin `eval` ni `new Function`; los grupos de la copia del dispositivo siguen pasando por `groupPicksOf` (todo o nada) antes de llegar a la hoja |
| F-SAST-05 | ✅ | el nombre de archivo sale de `wallpaperFileName` (`src/lib/wallpaper-layout.ts`), que reduce día y grupo a `[a-z0-9-]` (R-06); no hay rutas armadas con entrada del usuario |
| F-SAST-06 | ✅ | el nombre del grupo y las iniciales se dibujan con `fillText` en el canvas (`src/components/wallpaper-canvas.ts`) y como texto de React en el `<option>`; sin `innerHTML` ni `dangerouslySetInnerHTML` (R-02) |
| F-SAST-07 | ✅ | sin pedidos salientes: todo se genera en el navegador (ADR-005) |
| F-SAST-08 | ✅ | no se agrega criptografía |
| F-SAST-09 | ✅ | sin modo debug ni `console.log` nuevos en `src/` |
| F-SAST-10 | ✅ | no se agrega ningún log; la imagen lleva iniciales y nombre del grupo, nunca nombres completos, ids ni emails (R-03) |
| F-SAST-11 | ✅ | no hay superficie de subida de archivos |
| F-SAST-12 | ✅ | no hay Server Actions ni rutas nuevas: no cambia ningún estado del servidor |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found; `package.json` y `pnpm-lock.yaml` sin cambios. `pnpm audit` completo marca minimatch (moderate) y picomatch (high) solo bajo la CLI `shadcn` (desarrollo), previos a esta rama; el High de picomatch fue aceptado por el usuario en FEAT-003a |
| F-SAST-14 | ✅ | el selector de la hoja solo acepta ids de la copia de `groups` y descarta `""` con `withNoGroup={false}` (`src/components/group-picker.tsx`, `wallpaper-button.tsx`, R-05) |
| F-SAST-15 | ✅ | los errores del canvas y de la entrega siguen saliendo como códigos con texto fijo de `wallpaper-messages.ts`, sin `error.message` (R-04 de FEAT-004) |
| F-SAST-16 | ✅ | no hay paquetes nuevos |
| F-SAST-17 | ✅ | sin rutas de código dinámico |

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
