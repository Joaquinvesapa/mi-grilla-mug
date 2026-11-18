# SAST FEAT-005b

| Field | Value |
|-------|-------|
| Ticket | FEAT-005b |
| Tools | revisión manual del diff (`git diff origin/main...HEAD -- src`) + grep de patrones (`postMessage`, `addEventListener`, `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `fetch`, `process.env`, storage, `console`) + `pnpm audit --prod` |
| Date | 2026-11-18 |
| Alcance | `src/lib/demo-clock.ts`, `src/components/demo-clock.ts`, `src/components/demo-clock-control.tsx`, `src/components/demo-stage.tsx`, `src/components/iphone-frame.tsx`, `src/components/schedule-screen.tsx`, `src/components/live-button.tsx`, `src/components/use-now.ts`, `src/app/demo/page.tsx` (424 líneas sumadas, 8 sacadas) |

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos en el diff; `.env` está en `.gitignore` (`git check-ignore .env`) |
| F-SAST-02 | ✅ | el ticket no toca la base: no hay queries nuevas |
| F-SAST-03 | ✅ | nada llega a exec/spawn; todo el código nuevo es de cliente |
| F-SAST-04 | ✅ | sin `eval` ni `new Function`; el mensaje de `postMessage` se lee como dato (`parseDemoClockMessage`, `src/lib/demo-clock.ts:72`), sin deserializar código |
| F-SAST-05 | ✅ | sin rutas de archivo |
| F-SAST-06 | ✅ | sin `innerHTML` ni `dangerouslySetInnerHTML`; la hora se muestra con el escapado de React |
| F-SAST-07 | ✅ | sin `fetch` ni pedidos salientes nuevos; el iframe sigue en `src="/"`, fijo |
| F-SAST-08 | ✅ | sin criptografía |
| F-SAST-09 | ✅ | sin flags de debug; `resetDemoClockForTests` solo borra la hora simulada en memoria y lo usan solo los tests |
| F-SAST-10 | ✅ | sin logging nuevo |
| F-SAST-11 | ✅ | no hay subida de archivos |
| F-SAST-12 | ✅ | sin acciones que cambien estado del servidor; el canal `postMessage` es entre ventanas del mismo origen: la app acepta mensajes solo si `event.source === window.parent` y `event.origin === window.location.origin` (`src/components/demo-clock.ts:36`), y `/demo` acepta el saludo solo de su propio iframe y de su origen (`src/components/demo-clock.ts:114`) |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found |
| F-SAST-14 | ✅ | el mensaje tiene que ser un objeto con `type` exacto y `at` finito dentro de los 3 días del festival (`src/lib/demo-clock.ts:72-86`); el control valida día y hora con `demoInstant` (`Object.hasOwn` + `TIME_PATTERN`); la app solo abre el canal si su padre es `/demo` del mismo origen (`isInsideDemo`, un padre de otro origen tira `SecurityError` y queda cerrado) |
| F-SAST-15 | ✅ | sin mensajes de error al usuario nuevos; el `catch` de `isInsideDemo` no se traga el error en silencio: lo trata como "no es /demo" y lo documenta (R-01) |
| F-SAST-16 | ✅ | sin dependencias nuevas (`package.json` y `pnpm-lock.yaml` sin cambios en la rama) |
| F-SAST-17 | ✅ | sin caminos de código dinámicos |

Notas:
- `postMessage` sale siempre con `targetOrigin` = `window.location.origin`, nunca `"*"`
  (`src/components/demo-clock.ts:49` y `:103`). Así, la hora no llega a un marco de otro origen
  (R-03 del threat model).
- El reloj simulado no sale de `/demo`: fuera del iframe de `/demo` nadie escucha mensajes y la app
  usa la hora real de `useNow`. Respeta la regla de `AGENTS.md` de no exponer el reloj simulado
  fuera de `/demo`.
- Los headers anti-clickjacking (`X-Frame-Options SAMEORIGIN`, `frame-ancestors 'self'`) no cambian.
  Los cubre `demo.spec.ts` (R-08), que pasó en la corrida del cierre.

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
