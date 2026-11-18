# Threat model FIX-002: Correr el job e2e de la CI dentro del container de Playwright

| Field | Value |
|-------|-------|
| Ticket | FIX-002 |
| Spec | docs/daw/specs/fix-FIX-002.md |
| Tier | FIX |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `.github/workflows/ci.yml` (job `e2e`: `container`, `DATABASE_URL`, steps borrados) | Paso 2 |
| `tests/unit/ci/workflow.test.ts` (`test-workflow-e2e-container`, `test-e2e-docker-image`) | Paso 1 |
| `scripts/test-e2e-docker.sh` (línea `IMAGE=`) | Paso 3 |

## Trust boundaries
- Registry de Microsoft (`mcr.microsoft.com`) → runner de GitHub Actions: la imagen
  `playwright:v1.65.1-noble` entra como entorno de ejecución del job `e2e`. Reemplaza dos fuentes que
  hoy cruzan esa misma frontera en cada corrida: el mirror de Ubuntu (apt) y el CDN de los
  navegadores de Playwright.
- Autor de un PR → runner: el código del PR corre en el container con el evento `pull_request` (nunca
  `pull_request_target`), sin secretos reales y con un `GITHUB_TOKEN` de solo lectura (R-09 de
  FEAT-001). El cambio no mueve esa frontera.
- Container del job → service `postgres`: la red del job lleva la credencial descartable
  `ci-only-password` en texto plano, dentro de la red privada de Docker del runner.

## STRIDE analysis
### `.github/workflows/ci.yml`
- **Spoofing:** el tag `v1.65.1-noble` es mutable: Microsoft podría volver a publicarlo, o alguien
  podría suplantarlo si comprometiera el registry. Hoy pasa lo mismo con apt y con el CDN de los
  navegadores, sin fijar digest (R-01).
- **Tampering:** un PR puede cambiar la imagen en su propio `ci.yml`, pero solo para su corrida, sin
  secretos; el test `test-workflow-e2e-container` exige la imagen oficial con la versión de
  `@playwright/test`, y `quality` falla si no coincide (R-02).
- **Repudiation:** cada corrida deja en el log de Actions la imagen y el digest que bajó
  (`Initialize containers`), el commit y el evento.
- **Information Disclosure:** el job no tiene secretos reales: `BETTER_AUTH_SECRET` y la contraseña
  de postgres son descartables y están escritas en el workflow. El container no recibe nada nuevo.
- **Denial of Service:** el pull de la imagen (más de 1 GB) entra en el tope de 10 minutos; si el
  registry anda lento, el job se cancela como hoy con apt (R-03).
- **Elevation of Privilege:** el container corre como root, pero dentro de una VM efímera del runner
  que se descarta al terminar, sin secretos ni token con escritura; Chromium corre con
  `--no-sandbox`, y solo navega la app propia en `127.0.0.1:3100` (R-04).

### `tests/unit/ci/workflow.test.ts`
- **Spoofing:** no aplica: el test lee archivos del repo y no habla con ningún servicio.
- **Tampering:** un PR puede editar el test junto con el workflow para aflojar el chequeo; eso queda
  visible en el diff que se revisa antes de mergear (R-02).
- **Repudiation:** los cambios al test quedan en el historial de git, con el commit y su autor.
- **Information Disclosure:** el test solo lee `ci.yml`, `package.json` y el script; ninguno tiene
  secretos.
- **Denial of Service:** son lecturas de tres archivos chicos y no agregan tiempo apreciable a
  `pnpm test`.
- **Elevation of Privilege:** el test no ejecuta comandos ni el workflow; solo lo parsea.

### `scripts/test-e2e-docker.sh`
- **Spoofing:** usa el mismo tag mutable que la CI (R-01); el valor no cambia en este ticket.
- **Tampering:** si se sube `@playwright/test` sin subir el `IMAGE=`, `test-e2e-docker-image` falla.
- **Repudiation:** el script corre en la máquina del desarrollador, que es quien lo dispara; no hay
  otro actor.
- **Information Disclosure:** el script usa la `DATABASE_URL` del `.env` local; este ticket no lo
  cambia.
- **Denial of Service:** no aplica: el script lo corre una persona a mano.
- **Elevation of Privilege:** este ticket no toca cómo corre el container local (Docker rootless sigue
  fuera de alcance).

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| `POSTGRES_PASSWORD` / `DATABASE_URL` del job `e2e` | credentials (descartable, solo CI) | en texto plano en `ci.yml`, a propósito: no protege nada real | red privada de Docker del runner, sin TLS (`src/lib/database-url.ts` acepta el host `postgres` sin TLS) |
| `BETTER_AUTH_SECRET` del job `e2e` | credentials (descartable, solo CI) | en texto plano en `ci.yml`, a propósito | no sale del container |
| Imagen `mcr.microsoft.com/playwright:v1.65.1-noble` | public | cache de imágenes del runner, efímera | TLS al registry |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | El tag de la imagen se vuelve a publicar con otro contenido o se compromete el registry | S | L | M | Imagen oficial de Microsoft, la misma que ya usa `pnpm test:e2e:docker`; el job no tiene secretos reales ni permisos de escritura. Riesgo menor que el de hoy (apt + CDN). Aceptado, ver abajo |
| R-02 | Un PR cambia la imagen por otra o vuelve a instalar con apt | T | L | L | `test-workflow-e2e-container` exige la imagen oficial con la versión de `@playwright/test` y prohíbe `playwright install` y la cache; la revisión del PR ve el cambio |
| R-03 | El pull de la imagen agota el tope de 10 minutos | D | L | M | El registry de Microsoft no depende de un mirror de Ubuntu; AC-06 mide `Initialize containers` en el PR, y el rollback plan define cuándo volver atrás (más de 3 min sostenidos) |
| R-04 | Código del PR corre como root con Chromium sin sandbox | E | L | L | VM efímera, sin secretos reales, `GITHUB_TOKEN` de solo lectura; Chromium solo abre `127.0.0.1:3100` |

## Accepted risks
### R-01
- **Accepted by:** Joaquin Vesco Aparicio, dueño del repo, en el PLAN de FIX-002 (2026-11-18): eligió
  fijar la imagen por tag, igual que `scripts/test-e2e-docker.sh`, en lugar de por digest
- **Justification:** fijar el digest obligaría a actualizarlo a mano en cada versión de Playwright,
  sin dependabot ni renovate en el repo; el job no tiene nada que robar, y la exposición es menor que
  la de hoy, que baja paquetes de apt y navegadores sin fijar.
- **Review conditions:** se revisa si el job `e2e` pasa a recibir un secreto real o un token con
  escritura, o si el repo suma dependabot o renovate (entonces se fija el digest).

## Supply chain
La única dependencia nueva es la imagen `mcr.microsoft.com/playwright:v1.65.1-noble`, que reemplaza a
dos que se van: los paquetes de apt del mirror de Ubuntu y la descarga de navegadores del CDN de
Playwright. Las actions (`checkout`, `pnpm/action-setup`, `setup-node`, `upload-artifact`) siguen
fijadas por SHA; se borra `actions/cache` del job `e2e`. No hay dependencias npm nuevas.

## Availability
El vector es el tope de 10 minutos del job (R-03): hoy lo agota apt; con el cambio, el único paso de
red grande es el pull de la imagen. La app y la base no cambian, así que no hay un DoS nuevo sobre
Mi Grilla.
