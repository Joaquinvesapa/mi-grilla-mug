# PRD FEAT-003b: Grilla y mi selección sin conexión

| Field | Value |
|-------|-------|
| Ticket | FEAT-003b |
| Origen | docs/daw/prd/prd-FEAT-003.md (índice de la partición) y docs/daw/prd/prd-DISC-001-03.md |
| Tracker | none |
| Date | 2026-11-17 |
| PRD loops | 0 |
| Loops since last human decision | 0 |

## Context and Problem

En el festival la señal es mala. Con FEAT-003a el usuario ve la grilla y guarda su selección, pero
solo con conexión: sin señal ve la pantalla "sin conexión" y no puede consultar qué shows eligió ni
guardar cambios. Este PRD hace que la grilla y la selección se puedan consultar sin conexión, que
"Guardar" funcione sin señal guardando en el dispositivo, y que lo guardado se sincronice solo con
la cuenta al volver la conexión (concepto: `docs/daw/discovery/concept-DISC-001.md`).

Parte del PRD 03 de DISCOVERY (`prd-DISC-001-03.md`, FR-16 a FR-21). Los FR se renumeraron desde
FR-01; los AC conservan la numeración del PRD original.

**Alcance (decisión del usuario, 2026-11-17):** el PRD de FEAT-003 (28 criterios de aceptación)
se partió en dos: FEAT-003a, la grilla y la selección con conexión (AC-01 a AC-19 y AC-28), y
FEAT-003b, el funcionamiento sin conexión y la sincronización (AC-20 a AC-27). Los AC conservan la
numeración del PRD original. FEAT-003b depende de FEAT-003a.

## Goals

- Que el usuario pueda consultar la grilla y su selección sin señal en el festival.
- Que lo que guardó sin señal no se pierda y llegue a su cuenta sin que tenga que hacer nada.

## Functional Requirements

- FR-01: Sin conexión, la app muestra la grilla y la selección del usuario, si ya las vio antes con
  conexión en ese dispositivo. Esa selección incluye los cambios guardados en el dispositivo que
  todavía no se sincronizaron.
- FR-02: Si el usuario toca "Guardar" sin conexión, la selección queda guardada en el dispositivo
  como pendiente de sincronizar. No se pierde aunque se cierre la app o se apague el celular
  (decisión del usuario, 2026-11-16).
- FR-03: Cuando vuelve la conexión y el usuario que guardó tiene la sesión iniciada, la app
  sincroniza automáticamente la selección pendiente con su cuenta, sin que tenga que hacer nada.
- FR-04: Mientras haya una selección pendiente de sincronizar, la app muestra un aviso que dice que
  los cambios están guardados solo en el dispositivo hasta que haya conexión. El aviso sugiere
  descargar la grilla como fondo de pantalla para tenerla a mano mientras tanto (decisión del
  usuario, 2026-11-16).
- FR-05: Si la sincronización encuentra que la selección de la cuenta cambió desde otro dispositivo
  mientras tanto, gana la selección pendiente de este dispositivo, porque es el último guardado que
  hizo el usuario.
- FR-06: La selección pendiente de sincronizar pertenece al usuario que la guardó. Si en ese
  dispositivo inicia sesión otra cuenta, no se le muestra ni se sincroniza en esa cuenta.

## Non-Functional Requirements

- NFR-01: Al sincronizar una selección pendiente, guardarla en la cuenta se confirma en 1 segundo o
  menos en el 95 % de los casos, con la base de datos disponible (el mismo umbral que NFR-02 de
  FEAT-003a).
- NFR-02: Mobile first. Entre 360 px y 430 px de ancho, el aviso de selección pendiente de
  sincronizar se ve completo, sin scroll horizontal (el mismo rango que NFR-03 de FEAT-003a).

## Acceptance Criteria

- AC-20 (FR-01): WHEN el usuario abre la grilla sin conexión en un dispositivo donde antes la vio
  con conexión, THE app SHALL mostrar la grilla y su última selección guardada.
- AC-21 (FR-01): IF el usuario abre la grilla sin conexión en un dispositivo donde nunca la vio con
  conexión, THEN THE app SHALL mostrar la pantalla de "sin conexión" del PRD 01.
- AC-22 (FR-02): IF el usuario toca "Guardar" sin conexión, THEN THE app SHALL guardar la selección
  en el dispositivo como pendiente de sincronizar, y al cerrar y volver a abrir la app sin conexión
  SHALL seguir mostrando esa selección.
- AC-23 (FR-03): WHEN vuelve la conexión, hay una selección pendiente y su usuario tiene la sesión
  iniciada, THE app SHALL sincronizarla con la cuenta y quitar el aviso de pendiente. Al entrar
  desde otro dispositivo SHALL verse esa selección.
- AC-24 (FR-03): IF la sincronización falla, THEN THE app SHALL conservar la selección pendiente en
  el dispositivo y reintentar la próxima vez que haya conexión.
- AC-25 (FR-04): WHILE hay una selección pendiente de sincronizar, THE app SHALL mostrar el aviso de
  que los cambios están solo en el dispositivo, con la sugerencia de descargar la grilla como fondo
  de pantalla.
- AC-26 (FR-05): WHEN se sincroniza una selección pendiente y la cuenta tenía otra selección
  guardada desde otro dispositivo, THE app SHALL dejar en la cuenta la selección pendiente de este
  dispositivo.
- AC-27 (FR-06): IF en un dispositivo con selección pendiente de la cuenta A inicia sesión la
  cuenta B, THEN THE app SHALL no mostrar ni sincronizar esa selección en la cuenta B, y SHALL
  conservarla para cuando vuelva a entrar la cuenta A.

## Out of Scope

- Guardar en el dispositivo los cambios que el usuario no confirmó con "Guardar". Si la app se
  cierra antes, esos cambios se pierden.
- Fusionar selecciones de varios dispositivos marca por marca. Gana el último guardado (FR-05).
- Generar el fondo de pantalla sin conexión (PRD 04).
- Avisar por notificaciones cuando termina la sincronización.

## Risks and Mitigations

- **Con "gana el último guardado" (FR-05), lo que se cambió en otro dispositivo mientras este
  estaba sin conexión se pisa.** → Riesgo aceptado: lo normal es usar un solo celular en el
  festival.
- **Si iOS borra los datos de la PWA antes de que vuelva la conexión**, la selección pendiente se
  pierde. → El aviso de FR-04 sugiere descargar la grilla como fondo de pantalla, que no depende de
  la app.
- **iOS puede borrar los datos guardados sin conexión de una PWA** que no se usa por un tiempo. →
  Se vuelven a cachear cada vez que se abre con conexión, y si no están, la app lo informa
  (AC-21).
- **Un dispositivo compartido podría mostrar la selección de otra cuenta.** → La selección
  pendiente pertenece a quien la guardó (FR-06, AC-27).

## Dependencies

- FEAT-003a: la grilla, la selección y el guardado con conexión.
- FEAT-001 (PRD 01, Plataforma base): la pantalla de "sin conexión" y el service worker de la PWA.
- FEAT-002 (PRD 02, Cuentas): la sesión que identifica de quién es la selección pendiente.
- PRD 04 (Fondo de pantalla personal): es lo que permite descargar la grilla que sugiere el aviso
  de FR-04. Mientras no exista, el aviso solo informa.
