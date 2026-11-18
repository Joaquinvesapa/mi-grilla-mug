# Threat model FIX-003: Despejar la linterna y la cámara en el fondo de pantalla

| Field | Value |
|-------|-------|
| Ticket | FIX-003 |
| Spec | docs/daw/specs/fix-FIX-003.md |
| Tier | FIX |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `src/lib/wallpaper-layout.ts` (`SAFE_BOTTOM`, `BLOCK_PADDING_Y`) | Pasos 1 y 2 |
| `tests/unit/lib/wallpaper-layout.test.ts` y `tests/e2e/wallpaper.spec.ts` | Pasos 3 y 4 |

## Trust boundaries
- Almacenamiento del navegador → layout del fondo: la selección (`selectedIds`) puede venir de
  `localStorage` y el layout la trata como no confiable (solo pregunta `has(id)` por los shows del
  día, decisión de FEAT-004). Este fix no mueve esa frontera: cambia dos constantes numéricas.
- Grilla versionada (`data/schedule.json`, cargada por el seed) → layout: los shows llegan del
  servidor de la app; el fix no cambia qué datos cruzan ni cómo se validan.

## STRIDE analysis
### `src/lib/wallpaper-layout.ts`
- **Spoofing:** el módulo no maneja identidades: es una función pura que arma posiciones de una
  imagen en el dispositivo del usuario.
- **Tampering:** un usuario puede alterar su `localStorage`, pero solo cambia qué shows se ven
  encendidos en su propia imagen; las constantes cambiadas son literales del bundle y no dependen de
  ningún dato de entrada.
- **Repudiation:** no hay acciones que registrar: generar el fondo no escribe nada en el servidor.
- **Information Disclosure:** la imagen solo contiene la grilla pública y la selección del propio
  usuario, igual que antes; achicar el eje no agrega datos a la imagen.
- **Denial of Service:** el costo de armar el layout no cambia (mismos shows, mismas iteraciones); el
  canvas sigue siendo de 1290 × 2796 px.
- **Elevation of Privilege:** el módulo no tiene permisos que escalar; no toca la sesión, la base ni
  el service worker.

### `tests/unit/lib/wallpaper-layout.test.ts` y `tests/e2e/wallpaper.spec.ts`
- **Spoofing:** los E2E crean cuentas de prueba descartables contra la base local o el service de
  la CI, igual que hoy; el fix no cambia cómo se autentican.
- **Tampering:** los tests solo cambian sus números esperados (2404 y el padding de 4 px); un
  cambio que debilite una aserción se ve en el diff del PR.
- **Repudiation:** cada corrida de la CI queda registrada en GitHub Actions con su commit.
- **Information Disclosure:** los tests no usan secretos nuevos; la CI sigue con su
  `BETTER_AUTH_SECRET` descartable.
- **Denial of Service:** se suma un test unitario de costo despreciable; el E2E corre los mismos
  casos.
- **Elevation of Privilege:** los tests no cambian permisos de la CI ni del runner.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| Grilla del festival (shows, escenarios, horarios) | public | en el repo y en la base | TLS de la app |
| Selección del usuario | PII | en la base y en `localStorage` del dispositivo, sin cambios en este fix | TLS de la app; la imagen se arma en el dispositivo y no viaja |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | Un bloque real recortado queda entre 60 y 64 px y pierde su horario sin que nadie lo note | D | L | L | `test-wallpaper-every-show-has-time` corre sobre los datos reales de los 3 días y falla si algún bloque pierde el horario |
| R-02 | Una aserción del test de zonas libres se debilita al cambiar los números | T | L | M | El límite sale de `SAFE_BOTTOM` importado, y el test de regresión fija `SAFE_BOTTOM = 392` y el eje en 2404 de forma explícita |

## Supply chain
No hay dependencias nuevas: cambian dos constantes y sus tests.

## Availability
Sin vectores nuevos: el layout hace el mismo trabajo con otros números, y generar el fondo sigue
ocurriendo en el dispositivo, sin pedidos al servidor.
