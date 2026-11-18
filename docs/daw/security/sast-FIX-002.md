# SAST FIX-002

| Field | Value |
|-------|-------|
| Ticket | FIX-002 |
| Tools | revisión manual del diff contra `main` (`.github/workflows/ci.yml`, `tests/unit/ci/workflow.test.ts`, `AGENTS.md`, `README.md`), `pnpm audit --prod` |
| Date | 2026-11-18 |

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | el diff no agrega secretos; `.env*` sigue en `.gitignore` (línea 31); `DATABASE_URL` cambia solo el host (`postgres`) y mantiene la credencial descartable de FEAT-001 |
| F-SAST-02 | ✅ | el diff no toca consultas a la base |
| F-SAST-03 | ✅ | se borra el único `run:` con sustitución de comandos del job (`playwright-version`); no se agrega ningún `run:` |
| F-SAST-04 | ✅ | sin `eval` ni deserialización insegura; el test usa `JSON.parse` sobre `package.json` del repo y `yaml` como antes |
| F-SAST-05 | ✅ | el test lee rutas fijas (`package.json`, `scripts/test-e2e-docker.sh`) armadas con `process.cwd()` |
| F-SAST-06 | ✅ | el diff no genera HTML |
| F-SAST-07 | ✅ | sin pedidos de red nuevos desde código; la imagen del container sale de un registry fijo (`mcr.microsoft.com`), con el riesgo del tag aceptado (R-01 de `threat-FIX-002.md`) |
| F-SAST-08 | ✅ | sin criptografía en el diff |
| F-SAST-09 | ✅ | sin modo debug nuevo |
| F-SAST-10 | ✅ | no se registra nada sensible; el reporte de Playwright que se sube si falla es el mismo de antes |
| F-SAST-11 | ✅ | no hay superficie de subida de archivos |
| F-SAST-12 | ✅ | el diff no agrega formularios ni Server Actions |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found. En dev siguen picomatch (high) y minimatch (moderate) bajo `shadcn>ts-morph`, previos a este ticket y aceptados en FEAT-003a; el diff no toca dependencias |
| F-SAST-14 | ✅ | el diff no recibe datos del usuario |
| F-SAST-15 | ✅ | sin manejo de errores nuevo en la app; los helpers del test devuelven mensajes para el propio test |
| F-SAST-16 | ✅ | sin dependencias npm nuevas; se borra `actions/cache` del job `e2e` y las actions que quedan siguen fijadas por SHA |
| F-SAST-17 | ✅ | sin caminos de código dinámico |

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
