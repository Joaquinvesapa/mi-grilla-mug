# PRD FEAT-001: Plataforma base de Mi Grilla

| Field | Value |
|-------|-------|
| Ticket | FEAT-001 |
| Origen | docs/daw/prd/prd-DISC-001-01.md (DISCOVERY DISC-001, PRD 01 de 7) |
| Tracker | none |
| Date | 2026-11-16 |
| PRD loops | 1 |
| Loops since last human decision | 0 |

## Context and Problem

Mi Grilla es una PWA mobile first para armar la grilla personal del Lollapalooza Argentina 2026
(concepto: `docs/daw/discovery/concept-DISC-001.md`). Antes de construir cualquier funcionalidad
visible hace falta una base sobre la cual se apoyen los otros 6 PRDs:

- Una aplicación que se pueda instalar en el iPhone.
- Que se vea y se sienta como una app nativa en el celular, no como una página web.
- Que se pueda presentar desde una PC.
- Que tenga desde el primer día una red de seguridad automática: tests unitarios, de integración y
  E2E que corren solos en cada cambio subido al repositorio remoto.

Si la red de seguridad queda para el final, cada feature anterior se construye sin ella. Y el
proyecto tiene como requisito no negociable un flujo de integración continua con tests de los tres
tipos.

Este PRD parte del PRD 01 de DISCOVERY (`prd-DISC-001-01.md`). Agrega los requisitos de "shell
nativo" (FR-10 a FR-13), que el usuario pidió el 2026-11-16 para que las guías mobile del proyecto
se verifiquen con criterios de aceptación y no queden solo como guía.

**Alcance (decisión del usuario, 2026-11-16):** los 20 criterios de aceptación quedan en un solo
ticket, sin dividir. El Scope Check propuso partirlo en tres (app base y shell nativo; salud y CI;
instalable, sin conexión y `/demo`), y el usuario eligió mantenerlo junto: es el scaffold, gran
parte es configuración y la base no tiene sentido a medias.

## Goals

- Que exista una aplicación mínima, instalable y mobile first, con la identidad de Mi Grilla, que
  los PRDs siguientes extiendan sin rehacer la base.
- Que esa base se sienta nativa en el iPhone: sin contenido bajo el notch, sin saltos de alto, sin
  destellos al tocar y con respuesta inmediata.
- Que todo cambio subido al repositorio remoto se verifique automáticamente con tests unitarios,
  de integración y E2E, y que un fallo se vea en el cambio.
- Que la app se pueda mostrar en una PC dentro de un mockup de iPhone, en una página de demo.

## Functional Requirements

- FR-01: La aplicación muestra una pantalla de inicio con el nombre "Mi Grilla" y la identidad
  visual propia del producto, sin logo ni branding de Lollapalooza.
- FR-02: La aplicación se puede instalar en un iPhone desde Safari con "Agregar a pantalla de
  inicio". Una vez instalada, abre en modo pantalla completa (sin la barra del navegador), con el
  ícono y el nombre de Mi Grilla.
- FR-03: Cuando no hay conexión, la aplicación instalada muestra una pantalla propia de "sin
  conexión" en lugar del error genérico del navegador.
- FR-04: La aplicación ofrece un chequeo de salud que informa si la aplicación y su base de datos
  están respondiendo.
- FR-05: Existe una página de demo, en la ruta `/demo`, que muestra un marco de iPhone con la
  aplicación real corriendo adentro, al tamaño de pantalla de un iPhone y con la que se puede
  interactuar.
- FR-06: La corrida automática de los tests unitarios, los de integración y los E2E se dispara en
  dos momentos: cuando se abre un pull request o se le suben cambios, y cuando un pull request se
  mergea a `main`. Un push a una rama que no tiene pull request no dispara nada (decisión del
  usuario, 2026-11-16).
- FR-07: El resultado de esa corrida automática aparece en el pull request o en el commit de `main`
  correspondiente, como aprobado o fallido.
- FR-08: El proyecto incluye al menos un test E2E que abre la aplicación en un viewport de iPhone y
  verifica la pantalla de inicio.
- FR-09: El proyecto incluye al menos un test de integración que verifica el chequeo de salud contra
  una base de datos real.
- FR-10: Ningún contenido de la aplicación queda tapado por el notch o la Dynamic Island ni por la
  barra de inicio del iPhone, tanto instalada como en Safari (decisión del usuario, 2026-11-16).
- FR-11: Cada pantalla ocupa exactamente el alto visible del celular. Cuando la barra de Safari se
  contrae o se expande, no queda contenido escondido detrás de ella ni un espacio vacío abajo
  (decisión del usuario, 2026-11-16).
- FR-12: Al tocar un elemento no aparece el destello gris que agrega el navegador, y mantener
  apretado un botón no selecciona su texto ni abre el menú de copiar (decisión del usuario,
  2026-11-16).
- FR-13: Los botones y links responden al primer toque, sin la demora que el navegador agrega para
  detectar un doble toque (decisión del usuario, 2026-11-16).

## Non-Functional Requirements

- NFR-01: Mobile first. Entre 360 px y 430 px de ancho, todas las pantallas de este PRD se ven sin
  scroll horizontal, y los elementos que se tocan miden al menos 44 × 44 pt.
- NFR-02: La página `/demo` se ve completa, sin scroll, en una pantalla de 1280 × 800 px o más
  grande.
- NFR-03: Con una red móvil 4G simulada, la pantalla de inicio carga en 3 segundos o menos.
- NFR-04: La corrida automática completa (unit + integración + E2E) tarda 10 minutos o menos.
- NFR-05: La corrida automática falla si la cobertura de líneas de los tests unitarios queda debajo
  del 80 %.
- NFR-06: El chequeo de salud responde en 1 segundo o menos cuando la base de datos está disponible.
- NFR-07: En un iPhone 12 o más nuevo, un botón muestra su respuesta visual al toque en 100 ms o
  menos.

## Acceptance Criteria

- AC-01 (FR-01): WHEN un usuario abre la aplicación en el navegador de un celular, THE aplicación
  SHALL mostrar la pantalla de inicio con el nombre "Mi Grilla" y sin logos ni marcas de
  Lollapalooza.
- AC-02 (FR-02): WHEN un usuario de iPhone agrega la aplicación a la pantalla de inicio desde Safari
  y la abre desde su ícono, THE aplicación SHALL abrir en pantalla completa, sin la barra del
  navegador, con el ícono y el nombre "Mi Grilla".
- AC-03 (FR-03): IF la aplicación instalada se abre sin conexión a internet, THEN THE aplicación
  SHALL mostrar su propia pantalla de "sin conexión" en lugar del error del navegador.
- AC-04 (FR-04): WHEN se consulta el chequeo de salud con la base de datos disponible, THE
  aplicación SHALL informar estado saludable en 1 segundo o menos.
- AC-05 (FR-04): IF se consulta el chequeo de salud y la base de datos no responde, THEN THE
  aplicación SHALL informar estado no saludable indicando que la base de datos no responde, sin
  exponer credenciales ni detalles internos de conexión.
- AC-06 (FR-05): WHEN un usuario abre `/demo` en una pantalla de 1280 × 800 px o más grande, THE
  aplicación SHALL mostrar un marco de iPhone con la aplicación real adentro, entera y sin scroll de
  página.
- AC-07 (FR-05): WHILE la demo está abierta, THE aplicación dentro del marco SHALL responder a
  clicks y scroll igual que en un celular.
- AC-08 (FR-06): WHEN se abre un pull request o se le suben cambios, THE corrida automática SHALL
  ejecutar los tests unitarios, los de integración y los E2E sobre ese pull request.
- AC-09 (FR-06): WHEN un pull request se mergea a `main`, THE corrida automática SHALL volver a
  ejecutar los tests unitarios, los de integración y los E2E sobre el `main` resultante.
- AC-10 (FR-06): IF se hace push a una rama que no tiene un pull request abierto, THEN THE corrida
  automática SHALL no ejecutarse.
- AC-11 (FR-07): IF algún test falla o la cobertura de líneas queda debajo del 80 %, THEN THE
  corrida automática SHALL marcar el pull request o el commit de `main` como fallido.
- AC-12 (FR-07): WHEN todos los tests pasan y la cobertura alcanza el mínimo, THE corrida automática
  SHALL marcar el pull request o el commit de `main` como aprobado.
- AC-13 (FR-08): WHEN corre el test E2E, THE test SHALL abrir la aplicación en un viewport de
  iPhone y verificar que se ve la pantalla de inicio de Mi Grilla.
- AC-14 (FR-09): WHEN corre el test de integración, THE test SHALL verificar el chequeo de salud
  contra una base de datos real, no simulada.
- AC-15 (FR-01): WHERE el ancho de pantalla está entre 360 px y 430 px, THE pantalla de inicio SHALL
  verse sin scroll horizontal.
- AC-16 (FR-10): WHEN la aplicación instalada se abre en un iPhone con notch o Dynamic Island, THE
  pantalla de inicio SHALL mostrar todo su contenido fuera de la zona del notch y de la barra de
  inicio.
- AC-17 (FR-11): WHEN la pantalla de inicio está abierta en Safari de iPhone y la barra del
  navegador se contrae o se expande, THE pantalla SHALL ocupar el alto visible sin esconder
  contenido detrás de la barra ni dejar un espacio vacío abajo.
- AC-18 (FR-12): WHEN el usuario toca un botón o un link, THE aplicación SHALL no mostrar el
  destello gris de toque del navegador.
- AC-19 (FR-12): WHEN el usuario mantiene apretado un botón, THE aplicación SHALL no seleccionar su
  texto ni mostrar el menú de copiar.
- AC-20 (FR-13, NFR-07): WHEN el usuario toca un botón en un iPhone 12 o más nuevo, THE botón SHALL
  mostrar su respuesta visual en 100 ms o menos, sin esperar un posible doble toque.

## Out of Scope

- Registro, login y cualquier pantalla que requiera usuario (PRD 02). Los campos de texto, y que no
  hagan zoom al enfocarlos, llegan con ese PRD.
- La grilla, los datos del festival y la selección de artistas (PRD 03).
- Ver la grilla o la selección sin conexión (PRD 03). Este PRD solo cubre la pantalla genérica de
  "sin conexión".
- Gestos de arrastre (bottom sheets, deslizar para cerrar): llegan con los PRDs que los usan.
- Exportar fondos de pantalla (PRDs 04 y 07).
- El reloj simulado de la demo para "En vivo ahora" (PRD 05).
- Desplegar la aplicación en un servidor público.
- Orientación horizontal: la app se usa en vertical.
- Soporte específico para Android o tablets. Pueden funcionar, pero no se verifican.
- Notificaciones push.

## Risks and Mitigations

- **iOS limita las PWAs**: no hay aviso automático de instalación y el almacenamiento offline es
  limitado. → La instalación se hace a mano con "Agregar a pantalla de inicio", y en este PRD el
  offline se limita a una pantalla propia, que es liviana.
- **Algunos sitios no se dejan mostrar dentro de otro**, y el mismo bloqueo puede impedir que la app
  aparezca dentro del marco de `/demo`. → Se habilita explícitamente mostrar la app embebida en su
  propia página de demo, y nada más.
- **Los tests de integración y E2E en la corrida automática necesitan una base de datos**, que puede
  volverlos lentos o inestables. → Se usa una base de datos efímera dentro de la corrida, y el tiempo
  total tiene un tope (NFR-04).
- **El chequeo de salud puede filtrar información interna.** → Solo informa estados genéricos
  (AC-05).
- **El notch, la barra de inicio y el alto de Safari no se reproducen del todo en un emulador.** →
  AC-16, AC-17 y AC-20 se verifican también en un iPhone real antes de cerrar el ticket.

## Dependencies

- Ninguna de otros PRDs: es el primero de la cadena.
- Un repositorio remoto con integración continua habilitada (`origin` en GitHub ya existe).
- Las guías mobile del proyecto (`AGENTS.md`, sección "Code conventions"), que FR-10 a FR-13 vuelven
  verificables.
- Las PRDs 02 a 07 dependen de este.
