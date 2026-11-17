# PRD FEAT-002: Cuentas

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| Origen | docs/daw/prd/prd-DISC-001-02.md (DISCOVERY DISC-001, PRD 02 de 7) |
| Tracker | none |
| Date | 2026-11-17 |
| PRD loops | 1 |
| Loops since last human decision | 0 |

## Context and Problem

En Mi Grilla, la selección de artistas, los grupos y los fondos de pantalla son de cada persona
(concepto: `docs/daw/discovery/concept-DISC-001.md`). Para guardarlos y compartirlos hace falta
saber quién es cada usuario. El producto pide un acceso simple con email y contraseña. El MVP no
tiene servicio de envío de emails, así que no hay verificación de mail ni recuperación de
contraseña. Además, en los grupos los amigos se tienen que reconocer entre sí, y para eso cada
cuenta necesita un nombre visible.

Este PRD parte del PRD 02 de DISCOVERY (`prd-DISC-001-02.md`) y lo lleva al estado actual del
código, que ya tiene la plataforma base de FEAT-001: la pantalla principal (`/`), la página
`/demo`, la pantalla "sin conexión" y el chequeo de salud. Con eso a la vista, FR-09 nombra qué
pantallas requieren cuenta y cuáles quedan públicas. Que la pantalla principal requiera cuenta sale
de los PRDs siguientes: la grilla vive ahí y requiere sesión iniciada (PRD 04 y PRD 05 de
DISCOVERY).

**Alcance (decisión del usuario, 2026-11-17):** los 14 criterios de aceptación quedan en un solo
ticket, sin dividir. El Scope Check propuso partirlo en dos (a: cuenta y sesión, 8 AC; b: reglas,
bloqueo y mostrar contraseña, 6 AC), y el usuario eligió mantenerlo junto: es un solo módulo, varios
criterios son reglas chicas de validación, y la parte a sola aceptaría contraseñas débiles y no
tendría bloqueo contra la prueba de contraseñas.

## Goals

- Que una persona cree su cuenta y entre a la app en menos de un minuto desde el celular.
- Que la sesión no venza en pleno festival, donde la señal es mala y volver a loguearse es un
  problema.
- Que las cuentas estén protegidas contra el robo de contraseñas por prueba y error.

## Functional Requirements

- FR-01: Un visitante puede crear una cuenta con email, contraseña y nombre visible.
- FR-02: El email de una cuenta es único y no distingue mayúsculas de minúsculas:
  `Ana@Mail.com` y `ana@mail.com` son la misma cuenta.
- FR-03: La contraseña tiene como mínimo 8 caracteres e incluye al menos una letra y al menos un
  número (decisión del usuario, 2026-11-16).
- FR-04: El nombre visible tiene entre 1 y 40 caracteres, sin contar los espacios del principio y
  del final.
- FR-05: Al crear la cuenta, el usuario queda con la sesión iniciada y llega a la pantalla
  principal de la app.
- FR-06: Un usuario registrado puede iniciar sesión con su email y su contraseña.
- FR-07: La sesión iniciada dura 30 días desde el último inicio de sesión, salvo que el usuario la
  cierre antes (decisión del usuario, 2026-11-16).
- FR-08: Un usuario con sesión iniciada puede cerrarla desde la app.
- FR-09: Las pantallas de la app que requieren cuenta solo se pueden ver con sesión iniciada. Un
  visitante sin sesión que intenta abrirlas es llevado a la pantalla de inicio de sesión. Hoy
  requiere cuenta la pantalla principal; quedan públicas las pantallas de inicio de sesión y de
  registro, `/demo`, la pantalla "sin conexión" y el chequeo de salud.
- FR-10: Después de 5 intentos fallidos de inicio de sesión para un mismo email en 15 minutos, el
  inicio de sesión de ese email queda bloqueado durante 15 minutos (decisión del usuario,
  2026-11-16).
- FR-11: Los campos de contraseña tienen un control para mostrar u ocultar lo que se escribe.

## Non-Functional Requirements

- NFR-01: Seguridad. Las contraseñas nunca se guardan ni se transmiten en texto legible, ni
  aparecen en logs, respuestas o mensajes de error. Solo se almacena una forma no reversible, en el
  100 % de los casos.
- NFR-02: Con la base de datos disponible, el registro y el inicio de sesión responden en 1 segundo
  o menos en el 95 % de los intentos.
- NFR-03: Mobile first. Entre 360 px y 430 px de ancho, las pantallas de registro e inicio de sesión
  se ven sin scroll horizontal, y sus campos y botones miden al menos 44 × 44 pt.
- NFR-04: Seguridad. En el 100 % de los inicios de sesión fallidos, el mensaje es el mismo exista
  o no el email, así no se puede averiguar qué emails tienen cuenta.

## Acceptance Criteria

- AC-01 (FR-01, FR-05): WHEN un visitante completa el registro con un email nuevo, una contraseña
  válida y un nombre válido, THE app SHALL crear la cuenta, dejarlo con la sesión iniciada y
  mostrarle la pantalla principal.
- AC-02 (FR-02): IF un visitante intenta registrarse con un email que ya tiene cuenta, aunque cambien
  las mayúsculas, THEN THE app SHALL rechazar el registro e indicar que ese email ya está
  registrado, sin crear una segunda cuenta.
- AC-03 (FR-03): IF la contraseña tiene menos de 8 caracteres, no tiene letras o no tiene números,
  THEN THE app SHALL rechazar el registro e indicar qué regla no se cumple.
- AC-04 (FR-04): IF el nombre visible queda vacío después de quitar los espacios, o supera los 40
  caracteres, THEN THE app SHALL rechazar el registro e indicar el límite.
- AC-05 (FR-01): IF el email no tiene un formato válido, por ejemplo `ana@` o `ana.mail.com`, THEN
  THE app SHALL rechazar el registro e indicar que el email no es válido.
- AC-06 (FR-06): WHEN un usuario ingresa su email y su contraseña correctos, THE app SHALL iniciar
  la sesión y mostrarle la pantalla principal.
- AC-07 (FR-06): IF el email no existe o la contraseña es incorrecta, THEN THE app SHALL mostrar el
  mensaje "Email o contraseña incorrectos", idéntico en los dos casos.
- AC-08 (FR-07): WHILE no pasaron 30 días desde el último inicio de sesión y el usuario no la
  cerró, THE app SHALL mantener la sesión iniciada aunque se cierre y se vuelva a abrir la app.
- AC-09 (FR-07): WHEN pasan 30 días desde el último inicio de sesión, THE app SHALL considerar
  vencida la sesión y pedir que se inicie de nuevo.
- AC-10 (FR-08): WHEN un usuario cierra la sesión, THE app SHALL terminarla y llevarlo a la
  pantalla de inicio de sesión, y las pantallas que requieren cuenta SHALL dejar de verse en ese
  dispositivo.
- AC-11 (FR-09): IF un visitante sin sesión abre una pantalla que requiere cuenta, THEN THE app
  SHALL llevarlo a la pantalla de inicio de sesión sin mostrar el contenido protegido.
- AC-12 (FR-10): IF hubo 5 intentos fallidos para un mismo email en los últimos 15 minutos, THEN
  THE app SHALL rechazar los intentos de ese email durante 15 minutos, aunque la contraseña sea
  correcta, e informar que el acceso está bloqueado temporalmente.
- AC-13 (FR-10): WHEN pasan 15 minutos desde el bloqueo, THE app SHALL volver a aceptar inicios de
  sesión de ese email.
- AC-14 (FR-11): WHEN el usuario toca el control de mostrar contraseña, THE app SHALL mostrar el
  texto escrito, y al tocarlo de nuevo SHALL ocultarlo.

## Out of Scope

- Verificar el email con un link o un código.
- Recuperar o restablecer la contraseña.
- Iniciar sesión con Google, Apple u otros proveedores.
- Editar el perfil (nombre, email o contraseña) después del registro.
- Avatar o foto de perfil.
- Borrar la cuenta.
- Autenticación de dos factores.
- Abrir la app sin conexión con la sesión iniciada para ver contenido guardado (PRD 03).
- La vuelta a un link de invitación después de iniciar sesión (PRD 06).

## Risks and Mitigations

- **Sin recuperación de contraseña, quien la olvida pierde la cuenta.** → Riesgo aceptado para el
  MVP. El control de mostrar contraseña (FR-11) reduce los errores de tipeo al registrarse.
- **Sin verificación, alguien puede registrarse con el email de otra persona.** → Riesgo aceptado:
  la cuenta no da acceso a nada de esa persona, y el MVP no manda emails.
- **AC-02 revela que un email ya tiene cuenta.** Es una enumeración limitada al registro, aceptada
  para que el mensaje sea claro. → El inicio de sesión no revela nada (NFR-04), y el bloqueo (FR-10)
  frena las pruebas masivas.
- **El bloqueo por email permite que un tercero bloquee a propósito la cuenta de otro durante 15
  minutos.** → Es corto y se levanta solo (AC-13). Se acepta para el MVP.
- **Una sesión de 30 días en un celular perdido queda abierta.** → La app no guarda datos sensibles
  más allá de la selección de artistas y los grupos, y el usuario puede cerrar la sesión.
- **Con la pantalla principal protegida, quien mira `/demo` ve primero el inicio de sesión.** →
  Puede registrarse ahí mismo, dentro del mockup. Una cuenta de demostración precargada no entra en
  este PRD.

## Dependencies

- FEAT-001 (Plataforma base, mergeado en `main`): la aplicación, la base de datos, la pantalla
  principal, `/demo` y la corrida automática de tests.
- Los PRDs 03, 04, 05, 06 y 07 de DISCOVERY dependen de este: la selección es por usuario, la
  grilla y el panel "En vivo" requieren sesión iniciada, y los grupos muestran el nombre visible.
