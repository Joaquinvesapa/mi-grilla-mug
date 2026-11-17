# Threat model FEAT-002: Cuentas

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| Spec | docs/daw/specs/spec-FEAT-002.md |
| Tier | FEATURE |
| Date | 2026-11-17 |

## Components
| Component | Source in the spec |
|---|---|
| `src/app/auth-actions.ts` (Server Actions de registro, inicio y cierre de sesión) | Block 3 |
| `src/server/accounts.ts` (registro, inicio y cierre de sesión, usuario actual) | Block 2 |
| `src/server/login-throttle.ts` (bloqueo por email, tabla `login_throttles`) | Block 2 |
| `src/server/auth.ts` (configuración de Better Auth: cookies, sesiones, hash) | Block 1 |
| `src/proxy.ts` + `src/server/session-cookie.ts` (redirección optimista de `/`) | Block 4 |
| `src/app/page.tsx` (pantalla principal protegida, botón "Cerrar sesión") | Block 4 |
| `src/components/login-form.tsx`, `register-form.tsx`, `password-input.tsx` | Block 3 |

## Trust boundaries
- Navegador → servidor Next: los POST de las Server Actions de `/login` y `/register` llevan email y
  contraseña; la cookie de sesión viaja en cada pedido a `/`.
- Servidor Next → PostgreSQL: Better Auth y `login-throttle.ts` leen y escriben usuarios, cuentas
  (hash de contraseña), sesiones (token) y el estado del bloqueo.
- Proxy de Next (`src/proxy.ts`) → página: el proxy solo ve si existe la cookie; la verificación
  real (firma HMAC y fila vigente en la base) ocurre en la página.
- Service worker → red: las navegaciones a `/`, `/login` y `/register` son NetworkOnly; nada de
  esas respuestas se guarda en el dispositivo.

## STRIDE analysis
### `src/app/auth-actions.ts`
- **Spoofing:** un sitio ajeno podría intentar enviar el formulario en nombre del usuario (CSRF).
  Next compara `Origin` con `Host` en toda Server Action y rechaza las de otro origen (R-06).
- **Tampering:** el `FormData` se trata como `unknown`: solo se leen `email`, `password` y `name`
  como strings; un `File`, un campo de más o un `callbackURL` se ignoran (R-07).
- **Repudiation:** cada rechazo por bloqueo y cada error inesperado se registra con su código y la
  hora, sin email ni contraseña (R-08).
- **Information Disclosure:** el estado que vuelve al formulario nunca incluye la contraseña, y los
  mensajes salen de un catálogo cerrado en español; `error.message` de infraestructura nunca llega
  al cliente (R-08).
- **Denial of Service:** cada intento corre un hash scrypt; una ráfaga desde muchas IPs consume CPU
  (R-03, aceptado).
- **Elevation of Privilege:** las acciones no reciben ni devuelven ids de usuario: la identidad
  sale siempre de la cookie verificada por Better Auth.

### `src/server/accounts.ts`
- **Spoofing:** prueba de contraseñas contra un email (R-01): antes de verificar la contraseña se
  reserva un intento en `login-throttle.ts`; al 5.º fallo en 15 minutos ese email queda bloqueado.
- **Tampering:** a `auth.api.signUpEmail` solo llegan `email`, `password` y `name` ya validados por
  `account-rules`; `rememberMe` va fijo en `true` en `signInEmail` (R-07).
- **Repudiation:** el registro y el inicio de sesión quedan en las tablas de usuarios y sesiones con
  fecha de creación; los fallos quedan en `login_throttles` hasta que vence su ventana.
- **Information Disclosure:** el inicio de sesión responde "Email o contraseña incorrectos" en los
  dos casos y Better Auth corre un hash de relleno ante un email inexistente, así que ni el texto ni
  el tiempo revelan qué emails existen (R-09). El registro sí lo revela (R-10, aceptado en el PRD).
- **Denial of Service:** un tercero puede bloquear un email ajeno durante 15 minutos (R-11, aceptado
  en el PRD).
- **Elevation of Privilege:** el registro no acepta `emailVerified`, `image` ni otros campos del
  modelo de usuario; no hay roles.

### `src/server/login-throttle.ts`
- **Spoofing:** pedidos en paralelo podrían probar más de 5 contraseñas antes de que exista el
  bloqueo. La reserva del intento es un único `INSERT … ON CONFLICT … DO UPDATE` atómico por email,
  así que nunca hay más de 5 intentos en vuelo ni consumidos por ventana (R-02).
- **Tampering:** la clave es el email ya normalizado (trim y minúsculas), así que `Ana@Mail.com` no
  esquiva el contador de `ana@mail.com` (R-02).
- **Repudiation:** el bloqueo registra `lockedUntil`; el log emite el código `LOGIN_LOCKED` y la hora.
- **Information Disclosure:** se cuentan los fallos también para emails inexistentes, así que el
  mensaje de bloqueo no confirma que un email tenga cuenta (R-09).
- **Denial of Service:** emails al azar harían crecer la tabla; hay una sola fila por email y cada
  escritura purga las filas con la ventana vencida y sin bloqueo vigente (R-12).
- **Elevation of Privilege:** no aplica: el módulo no concede acceso, solo lo niega.

### `src/server/auth.ts`
- **Spoofing:** una cookie de sesión falsificada no pasa: Better Auth la firma con HMAC-SHA256 y
  `BETTER_AUTH_SECRET`; `getAuth()` se niega a arrancar con un secreto ausente o de menos de 32
  caracteres (R-13).
- **Tampering:** la cookie es `httpOnly` y `SameSite=Lax`, y lleva `Secure` y el prefijo
  `__Secure-` cuando `BETTER_AUTH_URL` es https (R-05).
- **Repudiation:** el logger de Better Auth se reemplaza por uno propio que emite solo un código
  genérico y la hora (R-08).
- **Information Disclosure:** las contraseñas se guardan con scrypt (N=16384, r=16, p=1, sal de 16
  bytes) y nunca en texto legible; el token de sesión queda sin hashear en la base (R-04,
  aceptado). La telemetría queda apagada (`telemetry.enabled: false`).
- **Denial of Service:** el rate limiter de Better Auth no actúa sobre `auth.api` (ADR-003); el
  freno es `login-throttle.ts` (R-01) y lo que queda se acepta en R-03.
- **Elevation of Privilege:** la sesión dura 30 días fijos (`expiresIn`, `disableSessionRefresh`):
  usarla no la extiende; una sesión vencida se borra al consultarla (R-14).

### `src/proxy.ts` + `src/server/session-cookie.ts`
- **Spoofing:** una cookie inventada pasa el chequeo optimista del proxy, pero la página llama a
  `getCurrentUser()`, que verifica firma y sesión en la base y redirige a `/login` si no es válida
  (R-15).
- **Tampering:** el nombre de la cookie (con o sin `__Secure-`) sale de la misma función que usa
  `auth.ts`, así que el proxy y Better Auth no pueden desincronizarse (R-15).
- **Repudiation:** no aplica: el proxy no toma decisiones de acceso definitivas ni guarda estado.
- **Information Disclosure:** el proxy redirige sin renderizar; su `matcher` es solo `/`, así que no
  toca `/api/health`, `/serwist/*`, `/~offline`, `/demo` ni los estáticos.
- **Denial of Service:** el proxy no consulta la base: solo lee un header.
- **Elevation of Privilege:** la redirección siempre va a `/login` sin parámetro de destino, así que
  no hay redirección abierta (R-16).

### `src/app/page.tsx`
- **Spoofing:** sin usuario verificado la página redirige a `/login` antes de renderizar (R-15).
- **Tampering:** "Cerrar sesión" es un `<form>` con una Server Action (POST con chequeo de origen);
  un GET no cierra la sesión (R-06).
- **Repudiation:** el cierre borra la fila de la sesión y la cookie.
- **Information Disclosure:** la página es dinámica y el service worker no la guarda; después de
  cerrar sesión, volver a `/` termina en `/login` (R-17).
- **Denial of Service:** cada visita hace una consulta de sesión por token único indexado.
- **Elevation of Privilege:** la página solo muestra datos del usuario de la sesión.

### `src/components/login-form.tsx`, `register-form.tsx`, `password-input.tsx`
- **Spoofing:** no aplica: son componentes de cliente sin credenciales propias.
- **Tampering:** la validación del cliente es solo ayuda; el servidor revalida todo (R-07).
- **Repudiation:** no aplica: no registran acciones.
- **Information Disclosure:** la contraseña se muestra solo al tocar el control, que es
  `type="button"`; los campos usan `autocomplete` `current-password` y `new-password` para que el
  gestor de contraseñas no la confunda; el nombre se muestra escapado por React (R-18).
- **Denial of Service:** el botón queda deshabilitado mientras la acción está pendiente, así que un
  doble toque no duplica el pedido.
- **Elevation of Privilege:** no aplica: no manejan permisos.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| contraseña | credentials | hash scrypt con sal en `accounts.password`; nunca en texto legible ni en logs | HTTPS en producción (TLS del hosting o del túnel); en los E2E, http solo en 127.0.0.1 |
| token de sesión | credentials | texto plano en `sessions.token`, base solo en 127.0.0.1 o red privada (R-04, aceptado) | cookie `httpOnly`, `SameSite=Lax`, firmada con HMAC; `Secure` sobre HTTPS |
| `BETTER_AUTH_SECRET` | credentials | variable de entorno, fuera de git (`.env`); en la CI, un valor descartable | no viaja |
| email | PII | texto plano en `users.email` y `login_throttles.email`, sin cifrado de columna (R-04, aceptado) | HTTPS en producción |
| nombre visible | PII | texto plano en `users.name`, sin cifrado de columna (R-04, aceptado) | HTTPS en producción |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | prueba de contraseñas contra un email | S | H | H | bloqueo de 15 min al 5.º fallo en 15 min, chequeado antes del hash (`login-throttle.ts`) |
| R-02 | intentos en paralelo o con mayúsculas que esquivan el contador | S | M | H | reserva atómica con `INSERT … ON CONFLICT DO UPDATE` sobre el email normalizado; test de integración con 10 intentos concurrentes |
| R-03 | prueba de una contraseña contra muchos emails y CPU de scrypt ante ráfagas | D | M | M | aceptado, ver abajo |
| R-04 | volcado de la base expone tokens de sesión vigentes, emails y nombres | I | L | H | aceptado, ver abajo |
| R-05 | robo de la cookie por script o por red | I | L | H | `httpOnly`, `SameSite=Lax`, `Secure` y `__Secure-` sobre HTTPS; React escapa todo el contenido |
| R-06 | CSRF sobre registro, inicio o cierre de sesión | T | L | M | solo Server Actions (POST con chequeo de origen de Next); no se monta el handler HTTP de Better Auth |
| R-07 | campos extra o tipos inesperados en el `FormData` | T | M | M | lectura como `unknown`, lista cerrada de campos, revalidación con `account-rules` en `src/server`, `rememberMe: true` fijo |
| R-08 | contraseña, email o errores de infraestructura en logs o respuestas | I | M | H | catálogo cerrado de códigos y mensajes; logger propio de Better Auth que emite solo códigos; el estado del formulario nunca devuelve la contraseña |
| R-09 | averiguar qué emails tienen cuenta por el inicio de sesión | I | M | M | mensaje idéntico, hash de relleno de Better Auth y bloqueo también para emails inexistentes |
| R-10 | el registro revela que un email ya tiene cuenta | I | M | L | aceptado, ver abajo |
| R-11 | un tercero bloquea a propósito el email de otro por 15 min | D | M | L | aceptado, ver abajo |
| R-12 | crecimiento sin límite de `login_throttles` con emails al azar | D | M | M | una fila por email y purga de filas con ventana vencida en cada escritura |
| R-13 | secreto de firma ausente o débil | S | L | C | `getAuth()` falla con `AUTH_CONFIG_INVALID` si falta o tiene menos de 32 caracteres; `.env` fuera de git |
| R-14 | sesión que se extiende con el uso | E | L | M | `expiresIn` de 30 días con `disableSessionRefresh: true` y sin `cookieCache` |
| R-15 | ver `/` con una cookie inventada o vencida | S | M | H | verificación real con `getCurrentUser()` en la página; nombre de cookie compartido entre proxy y `auth.ts` |
| R-16 | redirección abierta tras el inicio de sesión | T | L | M | el destino es siempre `/`; no se acepta parámetro de retorno |
| R-17 | ver la pantalla protegida tras cerrar sesión (caché) | I | L | M | página dinámica, service worker NetworkOnly; E2E que cierra sesión y vuelve a `/` |
| R-18 | sesión de 30 días abierta en un celular perdido | I | L | M | aceptado, ver abajo |

## Accepted risks
### R-03
- **Accepted by:** el usuario (dueño del producto), 2026-11-17, en PLAN de FEAT-002
- **Justification:** Mi Grilla es una demo de portfolio; un límite por IP en memoria depende de
  confiar en `x-forwarded-for` sin saber qué proxy hay delante, y Better Auth no aplica el suyo a
  `auth.api`. El bloqueo por email (R-01) cubre el ataque dirigido a una cuenta.
- **Review conditions:** antes de un despliegue público con tráfico real, o si los logs muestran
  ráfagas de `LOGIN_FAILED` sobre muchos emails.

### R-04
- **Accepted by:** el usuario (dueño del producto), 2026-11-17, en PLAN de FEAT-002
- **Justification:** Better Auth (ADR-003) guarda el token sin hashear y mitigarlo exige código
  sensible propio dentro de la librería; la base solo escucha en 127.0.0.1 o en la red privada del
  hosting, y la app no guarda datos sensibles más allá de la selección y los grupos.
- **Review conditions:** antes de abrir la app al público, si la base pasa a un hosting compartido,
  o si Better Auth incorpora el hash de tokens.

### R-10
- **Accepted by:** el usuario (dueño del producto), 2026-11-16, en el PRD (Risks and Mitigations)
- **Justification:** el mensaje claro al registrarse vale más que ocultar la existencia de un email
  en una app sin datos sensibles; el inicio de sesión no revela nada.
- **Review conditions:** si la app guarda datos sensibles o se detecta enumeración masiva.

### R-11
- **Accepted by:** el usuario (dueño del producto), 2026-11-16, en el PRD (Risks and Mitigations)
- **Justification:** el bloqueo es corto y se levanta solo (AC-13).
- **Review conditions:** si hay reportes de bloqueos intencionales.

### R-18
- **Accepted by:** el usuario (dueño del producto), 2026-11-16, en el PRD (Risks and Mitigations)
- **Justification:** la sesión larga evita volver a loguearse con mala señal en el festival; el
  usuario puede cerrarla y la app no guarda datos sensibles.
- **Review conditions:** si se agregan datos sensibles o cierre de sesión remoto.

## Supply chain
`better-auth` 1.7.25 (ADR-003) es la única dependencia nueva, fijada en versión exacta con el
lockfile congelado en la CI. Trae `@better-auth/*` 1.7.25, `better-call` 1.4.5, `kysely`, `zod`,
`jose` y `@noble/*`; la telemetría queda apagada y sin endpoint configurado no envía nada. El SAST de
CODE corre `pnpm audit` sobre el árbol nuevo.

## Availability
El hash scrypt es el costo por intento y el bloqueo por email lo limita para cada cuenta; lo que
queda de ráfagas distribuidas se acepta en R-03. El proxy no consulta la base, y cada visita a `/`
hace una sola consulta indexada por token. El pool de la base sigue en 5 conexiones (FEAT-001), y la
reserva del intento es una sola sentencia, sin transacciones largas que retengan conexiones.
