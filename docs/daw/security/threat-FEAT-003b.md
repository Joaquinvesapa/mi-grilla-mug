# Threat model FEAT-003b: Grilla y mi selección sin conexión

| Field | Value |
|-------|-------|
| Ticket | FEAT-003b |
| Spec | docs/daw/specs/spec-FEAT-003b.md |
| Tier | FEATURE |
| Date | 2026-11-17 |

## Components
| Component | Source in the spec |
|---|---|
| `src/lib/offline-selection.ts` | Block 1 |
| `src/components/device-store.ts` | Block 1 |
| `src/app/selection-actions.ts` | Block 2 |
| `src/components/schedule-screen.tsx` | Block 2 |
| `src/components/app-menu.tsx` + `src/components/forget-device-copy.tsx` | Block 2 |
| `src/components/offline-app.tsx` + `src/app/~offline/page.tsx` | Block 3 |

## Trust boundaries
- Servidor Next → navegador: `src/app/page.tsx` manda ahora también el `id` del usuario (el id
  aleatorio de Better Auth) como prop de `ScheduleScreen`, que lo usa como dueño de la copia y de la
  selección pendiente.
- Navegador → `localStorage` del dispositivo: `src/components/device-store.ts` escribe la copia del
  dispositivo (`mi-grilla:snapshot`: grilla, id y nombre del usuario, selección guardada) y la
  selección pendiente de cada usuario (`mi-grilla:pending:<userId>`). Lo que vuelve de ahí es dato
  no confiable: cualquier script del mismo origen, o la persona con el celular en la mano, puede
  haberlo cambiado.
- Navegador → servidor Next: al sincronizar, `saveSelectionAction(showIds, expectedUserId)` recibe
  del cliente la selección pendiente y el id de su dueño, junto con la cookie de sesión.
- Service worker → navegador: sin señal, `src/app/sw.ts` responde cualquier navegación de documento
  con el `/~offline` precacheado, que ahora puede mostrar la grilla desde la copia del dispositivo
  sin verificar ninguna sesión.

## STRIDE analysis
### `src/lib/offline-selection.ts`
- **Spoofing:** no identifica a nadie: solo lee y valida lo que `device-store` le pasa; el dueño de
  una selección pendiente es el `userId` guardado con ella, que nunca se usa como identidad ante el
  servidor (R-01).
- **Tampering:** `parseSnapshot` y `parsePending` reciben texto de `localStorage` y lo tratan como no
  confiable: versión exacta, tipos de cada campo, ids de shows con el mismo patrón y largo que
  `src/server/selection.ts`, sin repetidos; cualquier otra forma devuelve `null` y la app se comporta
  como si no hubiera copia (R-02).
- **Repudiation:** no hay acción que repudiar: es una función pura sin efectos.
- **Information Disclosure:** no escribe ni registra nada; no expone datos fuera de lo que recibe.
- **Denial of Service:** un JSON enorme o malformado en `localStorage` solo hace fallar el parseo,
  que devuelve `null`; nunca lanza hacia la pantalla (R-06).
- **Elevation of Privilege:** el resultado no da permisos: solo decide qué se pinta en este
  dispositivo.

### `src/components/device-store.ts`
- **Spoofing:** las claves de la selección pendiente llevan el `userId` del dueño; leer la de otro
  usuario exige pedir explícitamente su clave, y la pantalla solo pide la del usuario de la copia
  (R-01).
- **Tampering:** cualquiera con acceso al dispositivo puede editar `localStorage`; lo que lee pasa
  por `offline-selection.ts` y lo que llega al servidor se valida de nuevo allá (R-02).
- **Repudiation:** las escrituras son locales y no hay quien las audite; el guardado real en la
  cuenta deja su rastro en el servidor como cualquier "Guardar".
- **Information Disclosure:** guarda nombre, id y selección del usuario en texto plano en el
  dispositivo; ningún secreto: la cookie de sesión sigue siendo `httpOnly` y no se copia (R-04).
- **Denial of Service:** con el almacenamiento lleno o bloqueado (modo privado, iOS) cada acceso va
  en `try/catch` y devuelve `{ ok: false, code: "STORAGE_UNAVAILABLE" }`; la pantalla muestra un
  error en vez de prometer un guardado que no ocurrió (R-06).
- **Elevation of Privilege:** no hay permisos en juego del lado del dispositivo.

### `src/app/selection-actions.ts`
- **Spoofing:** la identidad sigue saliendo solo de la sesión verificada; `expectedUserId` es una
  guarda extra: si no es un string de hasta 64 caracteres igual al id de la sesión, la acción
  devuelve `USER_MISMATCH` sin tocar la base. Así una selección pendiente de la cuenta A nunca se
  guarda en la cuenta B (R-01). El CSRF sigue cubierto por el chequeo de origen de Next (R-03 de
  FEAT-003a).
- **Tampering:** `showIds` se sigue validando completo en `src/server/selection.ts` contra la grilla
  (R-02); una selección pendiente alterada en el dispositivo termina en `INVALID_SELECTION`.
- **Repudiation:** igual que en FEAT-003a: `SERVICE_UNAVAILABLE` se registra con código y hora; la
  sincronización es un guardado más del usuario dueño de la sesión.
- **Information Disclosure:** responde solo `{ ok: true }` o `{ ok: false, code }`;
  `USER_MISMATCH` no dice de quién es la sesión ni de quién era la selección.
- **Denial of Service:** la sincronización corre como mucho una vez por montaje y una por evento
  `online`, nunca dos a la vez (R-05); cada llamada es un guardado acotado por el tamaño de la
  grilla.
- **Elevation of Privilege:** no se agrega ningún permiso: cada usuario solo reemplaza su propia
  selección.

### `src/components/schedule-screen.tsx`
- **Spoofing:** solo lee la selección pendiente de su `userId` (la prop que viene de la página con
  la sesión verificada, o de la copia sin conexión); una pendiente de otra cuenta no se muestra ni
  se sincroniza (AC-27).
- **Tampering:** una selección pendiente vieja podría pisar un guardado más nuevo; un "Guardar"
  exitoso con conexión borra la pendiente del usuario, y mientras sincroniza "Guardar" queda
  deshabilitado (R-05).
- **Repudiation:** la selección que queda en la cuenta es la del último guardado del usuario (FR-05),
  sin fusiones que nadie pidió.
- **Information Disclosure:** solo pinta datos del usuario de la copia; los errores se muestran con
  el catálogo de `src/lib/selection-messages.ts`, nunca con el texto de una excepción.
- **Denial of Service:** el reintento no es un bucle: ocurre al montar y en cada evento `online`,
  con una sola sincronización en curso (R-05).
- **Elevation of Privilege:** no hay permisos en la pantalla; el servidor decide cada guardado.

### `src/components/app-menu.tsx` + `src/components/forget-device-copy.tsx`
- **Spoofing:** al cerrar sesión, y al mostrarse `/login` o `/register` (donde no hay nadie con la
  sesión iniciada), se borra la copia del dispositivo, así que la siguiente persona que entre no
  hereda el nombre ni la selección de la anterior (R-03).
- **Tampering:** borrar la copia no toca las selecciones pendientes: siguen siendo de su dueño hasta
  que vuelva a entrar (FR-06).
- **Repudiation:** cerrar sesión sigue siendo la Server Action de FEAT-002, con su registro.
- **Information Disclosure:** sin conexión, "Cerrar sesión" queda deshabilitado con su motivo en
  pantalla, en vez de fallar en silencio dejando la copia a la vista.
- **Denial of Service:** borrar es una operación local; si el almacenamiento falla, el cierre de
  sesión sigue igual.
- **Elevation of Privilege:** no cambia permisos de nadie.

### `src/components/offline-app.tsx` + `src/app/~offline/page.tsx`
- **Spoofing:** sin señal no hay forma de verificar quién tiene el celular: muestra la copia de quien
  la dejó. Es el riesgo aceptado R-03, acotado porque la copia se borra al cerrar sesión, al entrar
  otra cuenta y al pasar por `/login` o `/register`.
- **Tampering:** lee la copia a través de `parseSnapshot`; una copia alterada o de otra versión se
  descarta y se ve la pantalla "Sin conexión" (AC-21).
- **Repudiation:** no guarda nada por su cuenta: los guardados van por `ScheduleScreen`.
- **Information Disclosure:** el service worker usa `/~offline` para cualquier documento que falle,
  también `/login` y `/register`; la grilla solo se pinta si la URL que falló es `/`, y en
  cualquier otra se muestra la tarjeta "Sin conexión" (R-08). El HTML precacheado no tiene datos de
  ningún usuario: todo sale del dispositivo después de montar.
- **Denial of Service:** si la copia no se puede leer, cae en la tarjeta "Sin conexión" con
  "Reintentar", como hasta ahora.
- **Elevation of Privilege:** las Server Actions que recibe como props validan la sesión en el
  servidor igual que desde `/`.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| nombre del usuario | PII | `localStorage` del dispositivo, en texto plano bajo el cifrado del sistema operativo (protección de datos de iOS y Android con el celular bloqueado); se borra al cerrar sesión o al entrar otra cuenta | HTTPS (TLS) en el payload de la página |
| id del usuario (Better Auth) | PII (identificador interno, no secreto) | `localStorage`, igual que el nombre | HTTPS (TLS) como prop de la página y argumento de la Server Action |
| selección de shows | PII (preferencia personal, sensibilidad baja) | `localStorage` y la tabla `selected_shows` (PostgreSQL, como en FEAT-003a) | HTTPS (TLS) en la Server Action |
| grilla del festival | public | `localStorage` y la tabla `shows` | HTTPS (TLS) |
| cookie de sesión | credentials | no se copia al dispositivo: sigue `httpOnly`, fuera del alcance de `localStorage` y de JavaScript | HTTPS (TLS), `Secure`, `SameSite=Lax` (FEAT-002) |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | La selección pendiente de la cuenta A se sincroniza en la cuenta B que inició sesión en el mismo celular | E | M | H | La pendiente se guarda bajo la clave de su dueño y la pantalla solo lee la de su `userId`; además `saveSelectionAction` exige `expectedUserId` igual al usuario de la sesión y si no, devuelve `USER_MISMATCH` sin tocar la base |
| R-02 | Datos alterados en `localStorage` (a mano o por un script) llegan a la pantalla o al servidor | T | L | L | `parseSnapshot`/`parsePending` validan versión, tipos e ids y descartan lo que no cumple; el servidor vuelve a validar los ids contra la grilla |
| R-03 | Sin conexión, otra persona con el celular ve el nombre y la selección de quien dejó la copia | I | M | M | La copia se borra al cerrar sesión, al montar `/login` y `/register` y al entrar otra cuenta; sin conexión "Cerrar sesión" se deshabilita con su motivo. El remanente (sesión vencida sola y sin señal) se acepta, ver abajo |
| R-04 | Un XSS lee `localStorage` | I | L | M | Ahí no hay secretos (la cookie de sesión es `httpOnly`); React escapa todo el texto y no se usa `dangerouslySetInnerHTML` |
| R-05 | Una selección pendiente vieja pisa un guardado más nuevo, o se sincroniza dos veces a la vez | T | M | M | Un "Guardar" exitoso con conexión borra la pendiente; una sola sincronización en curso (guarda en un `ref`), y "Guardar" deshabilitado mientras sincroniza |
| R-06 | Almacenamiento lleno, bloqueado o con JSON roto hace fallar la pantalla o pierde un guardado sin avisar | D | L | M | Cada acceso en `try/catch` con resultado tipado; si no se pudo escribir la pendiente se muestra un error y el borrador queda en pantalla; el JSON roto se trata como "sin copia" |
| R-07 | Una selección pendiente que el servidor rechaza como inválida se reintenta para siempre | D | L | L | Con `INVALID_SELECTION` la pendiente se descarta y se muestra el mensaje del catálogo; cualquier otra falla la conserva para el próximo intento (AC-24) |
| R-08 | Sin señal, el respaldo de `/login` o `/register` muestra la grilla del último usuario | I | M | M | `OfflineApp` pinta la grilla solo si `location.pathname` es `/`; en cualquier otra ruta, la tarjeta "Sin conexión" |

## Accepted risks
### R-03
- **Accepted by:** el usuario (dueño del producto), en PLAN de FEAT-003b, 2026-11-17: "la copia se
  conserva hasta cerrar sesión".
- **Justification:** en el festival cada persona usa su propio celular y sin señal la app no tiene
  forma de verificar la sesión; un vencimiento podría dejar sin grilla a alguien que pasa el día sin
  señal, que es justo el caso que este ticket resuelve. La copia no tiene credenciales: solo nombre,
  selección y la grilla pública.
- **Review conditions:** se revisa si la app suma datos más sensibles a la copia (grupos e
  integrantes del PRD 05, por ejemplo) o si aparece un caso de uso con celulares compartidos.

## Supply chain
Sin dependencias nuevas: `localStorage` es una API del navegador, y el service worker, Serwist y
Next siguen en las versiones fijadas de FEAT-001.

## Availability
El único vector nuevo es local: el almacenamiento del dispositivo lleno o bloqueado, cubierto por
R-06. La sincronización suma como mucho un guardado por apertura de la app y uno por cada vuelta
de la señal, cada uno acotado por el tamaño de la grilla (91 shows), así que no cambia la carga del
servidor respecto de FEAT-003a.
