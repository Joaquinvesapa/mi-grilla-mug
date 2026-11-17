# Threat model FEAT-003a: Grilla y mi selección con conexión

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| Spec | docs/daw/specs/spec-FEAT-003a.md |
| Tier | FEATURE |
| Date | 2026-11-17 |

## Components
| Component | Source in the spec |
|---|---|
| `src/app/selection-actions.ts` | Block 2 |
| `src/server/selection.ts` | Block 2 |
| `src/server/schedule.ts` | Block 2 |
| `src/app/page.tsx` | Block 3 |
| `src/components/schedule-screen.tsx` | Block 3 |
| `prisma/seed.ts` + `data/schedule.json` | Block 1 |

## Trust boundaries
- Navegador → servidor Next: la Server Action `saveSelectionAction` recibe del cliente la lista de
  ids de shows elegidos (dato no confiable) junto con la cookie de sesión.
- Servidor Next → PostgreSQL: `src/server/selection.ts` y `src/server/schedule.ts` leen y escriben
  `shows` y `selected_shows` por la red privada (o 127.0.0.1 en desarrollo).
- Servidor Next → navegador: `src/app/page.tsx` serializa la grilla y la selección guardada del
  usuario como props del componente cliente `ScheduleScreen`.
- Repositorio → base: `prisma/seed.ts` lleva el contenido versionado de `data/schedule.json` a la
  base, con la `DATABASE_URL` del entorno de quien lo corre.

## STRIDE analysis
### `src/app/selection-actions.ts`
- **Spoofing:** un sitio ajeno podría intentar invocar la acción en nombre del usuario (CSRF). Las
  Server Actions de Next 16 solo aceptan POST y comparan `Origin` con `Host` (R-03); la cookie de
  sesión es `SameSite=Lax` (FEAT-002).
- **Tampering:** el argumento llega del cliente y se trata como `unknown`: solo se acepta un arreglo
  de strings, sin repetidos, de a lo sumo tantos elementos como shows haya y cada uno de hasta 64
  caracteres; cualquier otra forma da `INVALID_SELECTION` sin tocar la base (R-02).
- **Repudiation:** cada `SERVICE_UNAVAILABLE` se registra con el código y la hora
  (`[selection] SERVICE_UNAVAILABLE at=…`); el guardado exitoso deja `created_at` en cada fila.
- **Information Disclosure:** la acción devuelve solo `{ ok: true }` o `{ ok: false, code }`; nunca
  el `message` de Prisma o de `pg` (R-05).
- **Denial of Service:** el arreglo acotado (R-02) limita cada guardado a un `DELETE` y un `INSERT`
  de a lo sumo 91 filas en una transacción; exige sesión verificada antes de tocar la base (R-06).
- **Elevation of Privilege:** la acción no recibe ningún id de usuario: lo toma de la sesión
  verificada con `getAccounts().getCurrentUser(headers)`; sin sesión válida devuelve
  `UNAUTHENTICATED` (R-01).

### `src/server/selection.ts`
- **Spoofing:** no autentica: recibe el `userId` solo desde la Server Action y desde la página, que
  lo leyeron de la sesión verificada (R-01).
- **Tampering:** dos guardados simultáneos del mismo usuario (dos pestañas) podrían intercalar el
  borrado y la inserción; la transacción toma primero un lock de la fila del usuario
  (`SELECT … FOR UPDATE`), así que gana el último en confirmar y nunca queda una mezcla (R-10). Los
  ids desconocidos se rechazan antes de escribir: la FK a `shows` es la segunda barrera (R-02).
- **Repudiation:** registra el código genérico y la hora ante un error de la base, sin el mensaje.
- **Information Disclosure:** `getSelection(userId)` filtra siempre por el `userId` recibido; no
  existe una función que liste selecciones de otros usuarios (R-04).
- **Denial of Service:** consultas por clave primaria `(user_id, show_id)`; el tamaño máximo es la
  cantidad de shows.
- **Elevation of Privilege:** no aplica: el módulo no concede permisos, solo guarda preferencias del
  usuario dado.

### `src/server/schedule.ts`
- **Spoofing:** no aplica: la grilla es la misma para todos los usuarios con sesión y no depende de
  quién la pide.
- **Tampering:** solo lee; la grilla no se edita desde la app (AGENTS.md), así que no hay camino de
  escritura desde el navegador.
- **Repudiation:** registra `SERVICE_UNAVAILABLE` con la hora si la base no responde.
- **Information Disclosure:** el resultado memoizado en el proceso contiene solo datos públicos de
  la grilla, nunca datos de usuario (R-12).
- **Denial of Service:** la memoización evita una consulta por pedido; un fallo no se memoiza, así
  que la siguiente carga reintenta.
- **Elevation of Privilege:** no aplica: no concede ni consulta permisos.

### `src/app/page.tsx`
- **Spoofing:** sigue verificando la sesión de verdad antes de renderizar (FEAT-002, R-15 de ese
  ticket); sin sesión válida redirige a `/login` antes de leer la selección (R-01).
- **Tampering:** el día inicial se calcula en el servidor con el reloj real; no lee parámetros de la
  URL.
- **Repudiation:** no aplica: solo lee.
- **Information Disclosure:** la página es dinámica (lee cookies), Next la sirve con
  `Cache-Control: private, no-cache, no-store`, y el service worker no cachea navegaciones
  (`NetworkOnly`, FEAT-001); así la selección de un usuario no queda en una cache compartida ni en
  el dispositivo para otra cuenta (R-11). Si la grilla no carga, muestra un mensaje propio sin el
  error (R-05).
- **Denial of Service:** dos consultas por carga (selección del usuario; la grilla sale de la
  memoización).
- **Elevation of Privilege:** el `userId` que pasa a `getSelection` es el de la sesión; el cliente
  nunca lo ve ni lo envía.

### `src/components/schedule-screen.tsx`
- **Spoofing:** no aplica: corre en el navegador del propio usuario y no decide identidades.
- **Tampering:** el estado del cliente (elegidos y pendientes) no es confiable para el servidor: todo
  lo que manda pasa por la validación de R-02.
- **Repudiation:** no aplica: no registra ni decide.
- **Information Disclosure:** los nombres de artistas y subtítulos se renderizan como texto de React
  (escapado); no se usa `dangerouslySetInnerHTML`, así que un dato mal cargado no ejecuta HTML
  (R-07).
- **Denial of Service:** no aplica: un usuario solo puede degradar su propia pestaña.
- **Elevation of Privilege:** no aplica: la UI no expone acciones que la sesión no permita.

### `prisma/seed.ts` + `data/schedule.json`
- **Spoofing:** no aplica: lo corre un desarrollador o la CI, nunca un pedido HTTP.
- **Tampering:** un JSON alterado mandaría a la gente al show equivocado; el archivo entra por PR y
  un test unitario lo compara show por show con la fuente versionada (NFR-05, R-08). El seed escribe
  con consultas parametrizadas, nunca concatenando valores del JSON en el SQL.
- **Repudiation:** el historial de git registra quién cambió el JSON.
- **Information Disclosure:** el seed no imprime la `DATABASE_URL`; ante un error muestra un código
  y termina con salida distinta de cero.
- **Denial of Service:** no aplica: 3 días, 5 escenarios y 91 shows, en una sola transacción.
- **Elevation of Privilege:** solo hace upsert de `festival_days`, `stages` y `shows`; no toca
  `users` ni `selected_shows`.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| selección (`selected_shows`: user_id + show_id) | PII (preferencias asociadas a una cuenta) | PostgreSQL; en producción, volumen cifrado del proveedor (AES-256); sin cifrado de columna, igual que `users` (R-04 de FEAT-002) | TLS del hosting entre navegador y servidor; red privada entre servidor y base |
| grilla (`festival_days`, `stages`, `shows`) | public | PostgreSQL, sin cifrado (es el line-up público) | TLS del hosting |
| cookie de sesión | credentials | sin cambios respecto de FEAT-002 (firmada con HMAC-SHA256, `httpOnly`) | TLS del hosting, `Secure` en HTTPS |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | guardar o leer la selección de otro usuario pasando su id | E | M | H | el `userId` sale siempre de la sesión verificada; la acción no acepta ids de usuario; sin sesión, `UNAUTHENTICATED` |
| R-02 | payload manipulado: ids inexistentes, repetidos, no strings o un arreglo enorme | T | M | M | validación en `saveSelection` (arreglo de strings únicos, largo ≤ cantidad de shows, cada id ≤ 64 caracteres y existente) antes de escribir; FK como segunda barrera |
| R-03 | CSRF sobre el guardado | S | L | M | Server Action (POST + chequeo de `Origin` de Next 16) y cookie `SameSite=Lax` |
| R-04 | una consulta que devuelva selecciones de otros usuarios | I | L | H | `getSelection` filtra por `userId` y es la única lectura de `selected_shows` en este ticket; test de integración con dos cuentas |
| R-05 | mensajes de infraestructura en la respuesta o en la página | I | M | L | solo códigos (`INVALID_SELECTION`, `UNAUTHENTICATED`, `SERVICE_UNAVAILABLE`) y mensajes de `selection-messages.ts`; el log lleva código y hora |
| R-06 | guardados repetidos para cargar la base | D | L | L | sesión obligatoria y payload acotado (R-02): cada guardado es una transacción de a lo sumo 91 filas |
| R-07 | HTML o script en un nombre de artista | T | L | M | render como texto de React, sin `dangerouslySetInnerHTML`; el JSON entra por PR y lo verifica el test de NFR-05 |
| R-08 | JSON de la grilla con un horario o un escenario mal cargado | T | M | M | test unitario que compara `data/schedule.json` con la fuente versionada (91 shows, nombres, escenarios, días y horas); seed con consultas parametrizadas |
| R-09 | dependencia nueva comprometida (`vaul`, `@radix-ui/react-tabs`, `@radix-ui/react-alert-dialog`) | T | L | H | versiones exactas, lockfile con integridad, ventana de antigüedad de pnpm 12 y el SAST del CODE |
| R-10 | dos guardados simultáneos del mismo usuario dejan una mezcla | T | L | L | transacción con `SELECT … FOR UPDATE` sobre la fila del usuario antes del reemplazo |
| R-11 | la página con la selección queda en una cache compartida o en el dispositivo | I | L | M | página dinámica con `no-store`; el service worker sigue sin cachear navegaciones (FEAT-001); E2E que verifica el header |
| R-12 | la memoización de la grilla filtra datos de un usuario a otro | I | L | H | se memoiza solo `getSchedule()`, que no recibe ni devuelve datos de usuario; `getSelection` nunca se memoiza |

## Supply chain
Dependencias nuevas, todas con versión exacta y justificadas en la spec: `vaul` (el `drawer` de
shadcn, para el menú desde abajo que sigue al dedo, guía `gestures`), `@radix-ui/react-tabs` (el
`tabs` de shadcn, selector de día) y `@radix-ui/react-alert-dialog` (el `alert-dialog` de shadcn,
confirmación al salir con cambios pendientes). Entran por el lockfile con integridad, respetan la
ventana de antigüedad de pnpm 12 (`pnpm-workspace.yaml`) y las revisa el SAST del CODE (R-09). El
JSON fuente viene de un repo propio del usuario, en un commit fijo (`248dba3`), y se versiona en
este repo: no se descarga en build ni en runtime.

## Availability
La grilla se lee una vez por proceso (memoizada) y la selección por clave primaria, así que cada
carga de `/` hace una consulta liviana. El guardado exige sesión y está acotado a 91 filas (R-02,
R-06). No hay límite de frecuencia propio: el volumen lo acota la sesión, y un límite por IP queda
fuera por lo mismo que en FEAT-002 (R-03 de ese ticket). Si la base no responde, la página muestra
un error propio y el guardado devuelve `SERVICE_UNAVAILABLE` sin perder los cambios pendientes en
pantalla.
