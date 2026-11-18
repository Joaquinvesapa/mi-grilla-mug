# Threat model FIX-001: Correr los E2E solo al cierre de CODE, en VERIFY y completos solo en main

| Field | Value |
|-------|-------|
| Ticket | FIX-001 |
| Spec | docs/daw/specs/fix-FIX-001.md |
| Tier | FIX |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `.github/workflows/ci.yml` (job `e2e`, step de `pnpm test:e2e`) | Paso 2 |
| `AGENTS.md` (sección Testing) | Paso 3 |

## Trust boundaries
- Autor de un PR → runner de GitHub Actions: el código del PR corre en el runner con el evento
  `pull_request` (nunca `pull_request_target`), sin secretos y con un `GITHUB_TOKEN` de solo lectura
  (R-09 de FEAT-001). Este cambio no mueve esa frontera: agrega una variable de entorno al step.
- Contexto del evento de GitHub → shell del step: `github.event_name` cruza al shell a través de la
  variable `E2E_PROJECTS` del `env:` del step, no interpolado dentro de `run:`.

## STRIDE analysis
### `.github/workflows/ci.yml`
- **Spoofing:** el valor de `E2E_PROJECTS` sale de `github.event_name`, que lo fija GitHub según el
  disparador y el autor del PR no controla; un PR no puede hacerse pasar por un push a `main`.
- **Tampering:** un PR puede editar `ci.yml` y correr menos E2E en su propia corrida, pero eso ya era
  posible antes de este cambio; el push a `main` vuelve a correr los 4 proyectos con el workflow
  mergeado, revisado en el PR (R-01).
- **Repudiation:** cada corrida queda en el historial de Actions con el evento, el commit y el log
  de Playwright, que lista los proyectos ejecutados.
- **Information Disclosure:** el step no recibe secretos nuevos; `E2E_PROJECTS` solo contiene
  `--project=iphone-webkit` o nada, y el reporte que se sube si falla es el mismo de antes.
- **Denial of Service:** en un PR la suite baja de 254 a 82 ejecuciones; el tope de 10 minutos del
  job no cambia. Un fallo solo de Chromium ya no frena el PR y aparece recién en `main` (R-02).
- **Elevation of Privilege:** `permissions: contents: read` y `persist-credentials: false` no
  cambian; pasar `github.event_name` por `env:` en vez de interpolarlo en `run:` evita la inyección
  de expresiones en el shell (R-03).

### `AGENTS.md`
- **Spoofing:** no aplica una identidad: es un documento del repo que se cambia por PR revisado.
- **Tampering:** la regla de cuándo correr los E2E solo se cambia por PR con la CI en verde.
- **Repudiation:** el historial de git registra quién cambió la regla y en qué ticket (FIX-001).
- **Information Disclosure:** el texto nuevo no incluye secretos, URLs privadas ni datos de
  usuarios.
- **Denial of Service:** no corre nada; documenta cuándo correr la suite.
- **Elevation of Privilege:** la regla no da permisos a ningún agente ni salta ningún gate de DAW:
  el gate `tests` del cierre de CODE sigue corriendo la suite completa.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| `E2E_PROJECTS` (`--project=iphone-webkit` o vacío) | public | en el workflow versionado | TLS de GitHub Actions |
| `github.event_name` | public | lo fija GitHub por corrida | TLS de GitHub Actions |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | Un PR cambia `ci.yml` para no correr E2E en su propia corrida | T | L | M | El workflow se revisa en el PR; el push a `main` corre los 4 proyectos con la versión mergeada; `tests/unit/ci/workflow.test.ts` exige la expresión exacta de `E2E_PROJECTS` |
| R-02 | Un fallo que solo aparece en Chromium o en 360 px llega a `main` | D | M | M | El cierre de CODE de cada ticket corre la suite completa en los 4 proyectos antes del PR, y `main` la corre después del merge |
| R-03 | Inyección de expresiones de GitHub en el shell del step | E | L | H | `github.event_name` va por `env:` del step, nunca dentro de `run:`; el test existente rechaza `${{ github.event.* }}` en un `run:` |

## Supply chain
No hay dependencias nuevas ni actions nuevas: el job usa las mismas actions fijadas por SHA.

## Availability
El job conserva `timeout-minutes: 10`. En un PR corre menos ejecuciones, así que se aleja del tope;
en `main` corre lo mismo que hoy.
