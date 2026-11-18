# PRD FEAT-004: Fondo de pantalla personal

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| Origen | docs/daw/prd/prd-DISC-001-04.md (PRD 04 de 7 de DISC-001) |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 1 |
| Loops since last human decision | 0 |

## Context and Problem

En el festival, la persona mira mil veces por día qué le toca ver y dónde. Desbloquear el celular,
abrir una app y depender de la señal, que en el festival suele ser mala, es lento. Tener su grilla
del día como fondo de la pantalla de bloqueo del iPhone resuelve eso con un vistazo, sin conexión
y sin desbloquear (concepto: `docs/daw/discovery/concept-DISC-001.md`).

Este PRD convierte la selección de FEAT-003 (PRD 03) en una imagen para la pantalla de bloqueo.
Respeta el formato del póster oficial (escenarios × horarios). Los artistas elegidos se ven
encendidos y el resto opacos.

FEAT-003a y FEAT-003b ya están en producción: la grilla, la selección, los cambios pendientes, la
selección pendiente de sincronizar y la grilla sin conexión armada desde la copia del dispositivo.
El aviso de selección pendiente de FEAT-003b (su FR-04) ya sugiere descargar la grilla como fondo de
pantalla; este PRD es lo que hace posible esa sugerencia.

## Goals

- Que el usuario descargue en segundos la grilla de un día como fondo de pantalla de su iPhone.
- Que en la pantalla de bloqueo se lea a simple vista qué artistas eligió, incluso de noche.
- Que funcione sin conexión y con la selección guardada en el dispositivo que todavía no se
  sincronizó, porque es lo que sugiere el aviso de FEAT-003b.

## Functional Requirements

- FR-01: Desde la pantalla de la grilla, el usuario puede descargar el fondo de pantalla del día
  que está viendo.
- FR-02: La imagen mide 1290 × 2796 píxeles y sirve para cualquier iPhone actual (decisión del
  usuario, 2026-11-16).
- FR-03: La imagen muestra la grilla completa del día con el formato del póster oficial: los 5
  escenarios en columnas en el orden de la app, el rango horario completo del día con marcas por
  hora, y cada show como un bloque con el nombre del artista y su horario. Los bloques tienen la
  altura proporcional a su duración (decisión del usuario, 2026-11-16).
- FR-04: Los shows elegidos por el usuario aparecen encendidos, con color de acento y opacidad
  completa. Los no elegidos aparecen opacos.
- FR-05: Si el día no tiene ningún show elegido, la imagen se descarga igual con todos los shows
  encendidos, como una grilla para tener a mano. Todos opacos no se leerían, menos bajo el sol
  (decisión del usuario, 2026-11-16).
- FR-06: La imagen usa un único tema oscuro fijo (decisión del usuario, 2026-11-16).
- FR-07: La imagen deja libres las zonas que tapa la pantalla de bloqueo del iPhone: el 25 %
  superior, donde van la hora y la fecha, y el 8 % inferior, donde van la linterna y la cámara. En
  esas zonas no hay bloques de shows ni marcas de hora.
- FR-08: La imagen incluye el nombre del día (por ejemplo, "Viernes") y la marca "Mi Grilla", sin
  logos ni marcas de Lollapalooza.
- FR-09: La imagen usa la selección que el usuario ve en la pantalla en ese momento. Eso incluye
  los cambios guardados en el dispositivo que todavía no se sincronizaron, y los cambios pendientes
  que todavía no confirmó con "Guardar".
- FR-10: El fondo de pantalla se genera y se descarga sin conexión, siempre que la grilla esté
  disponible en el dispositivo (PRD 03, FR-16; entregado en FEAT-003b).
- FR-11: En un iPhone, el usuario termina con la imagen guardada en su app Fotos. En una
  computadora, la imagen se descarga como archivo `mi-grilla-<día>.png`, por ejemplo
  `mi-grilla-viernes.png`.
- FR-12: Después de descargar, la app muestra una guía breve de cómo ponerla como fondo de la
  pantalla de bloqueo en el iPhone.

## Decisión de alcance

El PRD tiene 15 criterios de aceptación, por encima de los 5–7 que pide revisar W-PRD-06. El usuario
decidió el 2026-11-18 mantenerlo como un solo ticket: 9 de los 15 son propiedades de una misma
imagen, y el único corte que se publica solo (la imagen con la selección guardada por un lado, los
cambios sin guardar y el modo sin conexión por el otro) deja una parte de 12 y otra de 3.

## Non-Functional Requirements

- NFR-01: En un iPhone 12 o más nuevo, generar la imagen tarda 3 segundos o menos desde que se toca
  "Descargar".
- NFR-02: Legibilidad. En la imagen de 1290 × 2796 px, el texto del nombre de artista mide al menos
  28 px de alto, y un bloque de un show de 30 minutos mide al menos 70 px de alto.
- NFR-03: Contraste. Entre el texto de un show encendido y el fondo de su bloque, la relación de
  contraste es de al menos 4.5:1. Un show opaco se ve con, como mucho, el 35 % de la opacidad de
  uno encendido.
- NFR-04: La imagen pesa 5 MB o menos.
- NFR-05: El 100 % de los shows del día que se descarga aparecen en la imagen con su escenario y su
  horario correctos.

## Acceptance Criteria

- AC-01 (FR-01, FR-11): WHEN el usuario está viendo el viernes en la grilla de un iPhone y toca
  "Descargar fondo", THE app SHALL generar la imagen del viernes y permitir guardarla en Fotos.
- AC-02 (FR-11): WHEN el usuario descarga el fondo desde una computadora, THE app SHALL descargar
  un archivo llamado `mi-grilla-viernes.png`, o el nombre del día que corresponda.
- AC-03 (FR-02): WHEN se genera la imagen, THE imagen SHALL medir exactamente 1290 × 2796 píxeles.
- AC-04 (FR-03, NFR-05): WHEN se genera la imagen del viernes, THE imagen SHALL mostrar las 5
  columnas de escenario en el orden de la app, todos los shows del viernes con su horario (incluido
  Peggy Gou de 23:30 a 01:00) y marcas de hora en todo el rango del día.
- AC-05 (FR-04): WHEN el usuario eligió Tyler, The Creator y Lorde el viernes y descarga el
  viernes, THE imagen SHALL mostrar esos dos shows encendidos y todos los demás opacos.
- AC-06 (FR-05): IF el día que se descarga no tiene ningún show elegido, THEN THE imagen SHALL
  mostrar todos los shows del día encendidos.
- AC-07 (FR-06, NFR-03): WHEN se genera cualquier imagen, THE imagen SHALL usar el tema oscuro, con
  fondo oscuro, los shows encendidos en color de acento con contraste de al menos 4.5:1 entre su
  texto y su bloque, y los opacos con, como mucho, el 35 % de la opacidad de uno encendido.
- AC-08 (FR-07): WHEN se genera la imagen, THE imagen SHALL no tener bloques de shows ni marcas de
  hora en los 699 px superiores (25 %) ni en los 224 px inferiores (8 %).
- AC-09 (FR-08): WHEN se genera la imagen del sábado, THE imagen SHALL incluir el texto "Sábado" y
  la marca "Mi Grilla", y SHALL no incluir logos ni marcas de Lollapalooza.
- AC-10 (FR-09): WHEN el usuario marca un show, no toca "Guardar" y descarga el fondo, THE imagen
  SHALL mostrar ese show encendido.
- AC-11 (FR-09, FR-10): WHILE hay una selección pendiente de sincronizar y no hay conexión, THE app
  SHALL generar la imagen con esa selección pendiente.
- AC-12 (FR-10): IF no hay conexión pero la grilla está disponible en el dispositivo, THEN THE app
  SHALL generar y descargar la imagen igual que con conexión.
- AC-13 (FR-12): WHEN termina la descarga, THE app SHALL mostrar la guía de cómo ponerla como fondo
  de la pantalla de bloqueo.
- AC-14 (NFR-02, NFR-04): WHEN se genera la imagen de cualquier día, THE nombre de artista SHALL
  medir al menos 28 px de alto, un show de 30 minutos SHALL medir al menos 70 px de alto y THE
  imagen SHALL pesar 5 MB o menos.
- AC-15 (NFR-01): WHEN el usuario toca "Descargar fondo" en un iPhone 12 o más nuevo, THE app SHALL
  tener la imagen lista en 3 segundos o menos.

## Out of Scope

- Una imagen con los 3 días juntos.
- Elegir modelo de iPhone, resolución o paleta de colores.
- Fondos para Android o para la pantalla de inicio.
- Marcas de choque entre shows dentro de la imagen.
- Indicadores de amigos (PRD 07).
- Ponerla automáticamente como fondo de pantalla: iOS no lo permite, el usuario la pone a mano.
- Compartir la imagen directamente en redes sociales.
- Cambiar el aviso de selección pendiente de FEAT-003b: su texto ya sugiere descargar el fondo.

## Risks and Mitigations

- **La pantalla de bloqueo de iOS puede recortar o mover la imagen**, por ejemplo con el efecto de
  profundidad o con los widgets. → Las zonas libres de FR-07 y la guía de FR-12, que indica
  desactivar el zoom de perspectiva.
- **Un día de 11 horas y media con 5 escenarios puede no entrar legible** en el espacio que queda
  entre las zonas libres. → Los mínimos de NFR-02 se verifican en el día más largo: el domingo, de
  13:30 a 00:35.
- **En iOS, guardar en Fotos desde una PWA depende de la hoja de compartir del sistema**, y puede
  cambiar entre versiones de iOS. → Se verifica en un iPhone real antes de dar por terminado el
  ticket.
- **Generar la imagen sin conexión exige que todo lo que necesita** (tipografías, colores, datos)
  **ya esté en el dispositivo.** → La grilla sin conexión de FEAT-003b deja los datos; AC-12 verifica
  que la imagen también se genera sin conexión.
- **Incluir en la imagen cambios no guardados** (FR-09) puede mostrar algo que la cuenta todavía no
  tiene. → Se elige así porque el usuario descarga lo que ve en la pantalla.
- **AC-01 y AC-15 dependen de un iPhone real** (la hoja de compartir y el tiempo en el hardware).
  → Las pruebas automáticas cubren la generación en WebKit; el guardado en Fotos y el tiempo en un
  iPhone 12 se verifican a mano y quedan registrados en la verificación.

## Dependencies

- FEAT-003a (PRD 03): la grilla, la selección y los cambios pendientes.
- FEAT-003b (PRD 03): la selección pendiente de sincronizar y la grilla sin conexión.
- FEAT-001 (PRD 01, Plataforma base): la aplicación instalable y la corrida automática de tests.
- FEAT-002 (PRD 02, Cuentas): la grilla requiere sesión iniciada.
- El PRD 07 (Fondo de pantalla del grupo) depende de este y reusa el formato de la imagen.
