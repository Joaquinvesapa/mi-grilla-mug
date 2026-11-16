# Concepto: Mi Grilla — MVP Lollapalooza 2026

| Métrica | Valor |
|---------|-------|
| Ticket | DISC-001 |
| Fecha | 2026-11-16 |
| Estado | Explorando |

## Visión

Una PWA mobile-first donde cada persona arma su propia grilla del Lollapalooza 2026 marcando los
artistas que va a ir a ver, la descarga como fondo de pantalla de bloqueo para su iPhone y la
comparte con su grupo de amigos para saber con quién coincide en cada show.

## Problema / Oportunidad

En el festival, la grilla oficial muestra todo: decenas de artistas en varios escenarios a la vez.
Lo que la persona necesita mirar mil veces por día es otra cosa: **su** recorrido, y con quién va a
estar en cada show. Hoy eso se resuelve con capturas de pantalla, notas o grupos de WhatsApp.
Tenerlo en la pantalla de bloqueo deja la información a un vistazo, sin desbloquear el celular ni
depender de la señal, que en un festival suele ser mala.

## Usuarios objetivo

- **Asistente al festival:** usa principalmente el celular, antes y durante el festival. Arma su
  grilla y la descarga como fondo de pantalla.
- **Grupo de amigos que va junto:** se arman grupos para ver qué artistas eligió cada uno y
  coordinar con quién ir a cada show.
- Plataforma inicial: **iPhone** (formato del fondo de pantalla de bloqueo).

## Features candidatas

- **Cuentas:** registro e inicio de sesión con email y contraseña.
- **Grilla del festival:** vista tipo calendario con días, escenarios, horarios y artistas, con
  scroll horizontal y vertical. Siempre con el formato del line-up oficial: tabla de doble entrada
  con escenarios en columnas y horarios en filas.
- **Mi selección:** el usuario marca y desmarca los artistas que va a ir a ver.
- **Fondo de pantalla personal:** exporta la grilla como imagen para la pantalla de bloqueo del
  iPhone. Los artistas elegidos aparecen resaltados y el resto más opacos.
- **Grupos:** crear un grupo, invitar gente, unirse y ver qué artistas eligió cada integrante.
- **Fondo de pantalla del grupo:** el mismo formato de grilla, con un indicador de qué amigos van a
  los MISMOS artistas que eligió el usuario.
- **PWA instalable:** se instala en el celular como una app. La grilla y la última selección del
  usuario se pueden ver sin conexión. Editar requiere conexión.
- **En vivo ahora:** muestra quién está tocando ahora y quién sigue en cada escenario.
- **Demo en desktop:** una página que muestra la app corriendo dentro de un mockup de iPhone, para
  presentarla desde la PC.

### Fuera del MVP (ideas futuras)

Funciones que tenía la app anterior (`joaquinvesapa/mi-grilla-app`) y que quedan afuera de esta
versión: la agenda (lista cronológica de los artistas elegidos), la amistad 1 a 1 con solicitudes,
la comparación con un amigo, el perfil con avatar y el panel de admin para editar la grilla.

## Restricciones y consideraciones

- **Un solo festival:** Lollapalooza 2026. No hace falta modelar varios festivales en el MVP.
- **Mobile first:** el uso principal es desde el celular en el festival. Desktop sirve para la demo.
- **Formato de la grilla:** siempre la tabla de doble entrada del line-up oficial (escenarios ×
  horarios), tanto en pantalla como en las imágenes exportadas.
- **Stack** (AGENTS.md): Next.js (App Router), TypeScript, PostgreSQL + Prisma, Tailwind +
  shadcn/ui, pnpm, Vitest + Playwright, ESLint + Prettier.
- **Calidad obligatoria:**
  - CI en el repo remoto que corra los tests unitarios.
  - Algunos tests de integración.
  - Al menos 1 test E2E del proyecto.
- **Fuente de datos de la grilla:** el archivo `lollapalooza-schedule.json` del repo anterior
  `joaquinvesapa/mi-grilla-app`, en el commit `248dba3` del 2026-03-12. Tiene 3 días × 5
  escenarios (Flow, Samsung, Alternative, Perry's y Kidzapalooza) y 91 shows. Coincide con el póster
  oficial del viernes. Tres shows terminan después de la medianoche: Peggy Gou, Skrillex y Kygo.
  Algunos shows de Kidzapalooza tienen subtítulo.
- **El festival ya pasó.** Las fechas del 13 al 15 de marzo de 2026 hay que confirmarlas. "En vivo
  ahora" nunca mostraría nada con el reloj real, así que necesita una forma de simular la hora
  (por ejemplo, en `/demo`). Eso se define en su PRD.

## Decisiones tomadas

- 2026-11-16: Stack Next.js + Prisma + PostgreSQL + Tailwind — lo definió el usuario.
- 2026-11-16: shadcn/ui con sus componentes reales, no componentes propios con ese estilo — se
  copian al repo y se pueden personalizar, y hay menos código propio que mantener.
- 2026-11-16: pnpm, Vitest + Playwright, ESLint + Prettier — elegidos en CLASSIFY.
- 2026-11-16: Mobile first, con una demo en desktop dentro de un mockup de iPhone — la app se usa
  sobre todo en el festival.
- 2026-11-16: CI con tests unitarios, tests de integración y 1 E2E como requisito no negociable del
  proyecto.
- 2026-11-16: El fondo de pantalla apunta primero a iPhone.
- 2026-11-16: Datos reales del Lollapalooza Argentina 2026 (la edición ya se hizo, en marzo de
  2026) — es una demo o proyecto de portfolio funcional con datos reales.
- 2026-11-16: La grilla se carga con un seed desde un archivo versionado en el repo: un JSON
  transcripto del line-up oficial, que carga un seed de Prisma. No hay panel de admin ni scraping:
  es lo más simple y testeable, y la grilla de una edición pasada no cambia.
- 2026-11-16: Las invitaciones a grupos son por link o código compartible (por ejemplo, por
  WhatsApp). No hay envío de emails, así que no hace falta infraestructura de correo.
- 2026-11-16: Identidad visual propia de Mi Grilla con el mismo formato (escenarios × horarios), sin
  logo ni branding de Lollapalooza — evita problemas de marca registrada si se publica.
- 2026-11-16: El MVP solo tiene registro y login con email y contraseña. No hay verificación de
  mail ni recuperación de contraseña, para ser coherentes con no tener servicio de emails.
- 2026-11-16: Se pueden elegir dos artistas que se superponen en horario, y la UI marca el choque —
  en un festival es común ver medio show de cada uno.
- 2026-11-16: El fondo de pantalla es una imagen por día, como el póster oficial, y el usuario elige
  qué día descargar — una sola imagen con los 3 días no se lee en la pantalla de un celular.
- 2026-11-16: La demo en desktop es una ruta `/demo` que muestra un marco de iPhone con la app real
  corriendo adentro, en un iframe del tamaño de un iPhone.
- 2026-11-16: El JSON de la grilla pasa a un formato normalizado y plano: `festival` (con zona
  horaria), `dias` (con fecha), `escenarios` (con `orden`) y `shows` (con `id` estable). Se
  convierte una sola vez desde el JSON anterior. La selección del usuario guarda la referencia al
  `id` del show, que no depende del nombre del artista: Arjaus Crew, por ejemplo, se repite los 3
  días. Las horas se escriben como en el póster, y una hora entre las 00:00 y las 06:00 corresponde
  al día calendario siguiente.
- 2026-11-16: Lectura offline en la PWA — la grilla y la última selección del usuario se ven sin
  señal, que en el festival es mala. Editar requiere conexión.
- 2026-11-16: "En vivo ahora" entra en el MVP. El resto de las funciones de la app anterior queda
  afuera (ver "Fuera del MVP").
- 2026-11-16: La CI corre al abrir o actualizar un pull request, y de nuevo al mergear a `main`.
  Un push a una rama sin pull request no la dispara — así lo decidió el usuario.
- 2026-11-16: Cuentas. El registro pide email, contraseña y nombre visible — el nombre sirve para
  reconocerse en los grupos. La contraseña tiene mínimo 8 caracteres, con al menos una letra y un
  número. La sesión dura 30 días, para que no venza en pleno festival. Después de 5 intentos
  fallidos en 15 minutos, el inicio de sesión de ese email se bloquea por 15 minutos.
- 2026-11-16: Grilla. La selección se guarda con un botón "Guardar", con cambios pendientes y la
  opción "Descartar"; el usuario lo prefirió al guardado automático. La grilla solo se ve con sesión
  iniciada. En el celular se ven 3 escenarios a la vez. El día inicial depende de la hora de la app:
  durante el festival abre ese día, fuera del festival abre el viernes.
- 2026-11-16: Guardar sin conexión. Si el usuario toca "Guardar" sin señal, la selección queda
  guardada en el dispositivo como pendiente y se sincroniza sola cuando vuelve la conexión. Un aviso
  sugiere descargar la grilla como fondo de pantalla mientras tanto. Si hubo cambios desde otro
  dispositivo, gana la selección pendiente, que es el último guardado. La selección pendiente es
  del usuario que la guardó. Consecuencia para el PRD 04: el fondo de pantalla se tiene que poder
  generar sin conexión y con la selección pendiente.
- 2026-11-16: Fondo de pantalla personal. Una sola resolución, 1290 × 2796. Muestra el día completo
  con los 5 escenarios, con un tema oscuro fijo. Si el día no tiene ningún artista elegido, se
  descarga igual con todos encendidos, como una grilla para tener a mano — todos opacos no se
  leerían bajo el sol. La imagen usa la selección que se ve en la pantalla, y se genera sin
  conexión.
- 2026-11-16: Se aprueba la partición en 7 PRDs con el orden de la tabla de abajo — el usuario la
  aprobó explícitamente.

## PRDs identificados

| # | Título | Archivo | Estado |
|---|--------|---------|--------|
| 1 | Plataforma base: scaffold, PWA instalable (base offline), shell mobile first, CI (unit + integración + E2E), `/demo` con mockup de iPhone | prd-DISC-001-01.md | validado |
| 2 | Cuentas: registro e inicio de sesión con email y contraseña | prd-DISC-001-02.md | validado |
| 3 | Grilla y mi selección: JSON normalizado + seed, vista escenarios × horarios con scroll x/y, selección, aviso de solapados, lectura offline | prd-DISC-001-03.md | validado |
| 4 | Fondo de pantalla personal: una imagen por día para iPhone | prd-DISC-001-04.md | validado |
| 5 | En vivo ahora: quién toca y quién sigue en cada escenario, con reloj simulable | prd-DISC-001-05.md | identificado |
| 6 | Grupos: crear, invitar por link o código, unirse y ver selecciones | prd-DISC-001-06.md | identificado |
| 7 | Fondo de pantalla del grupo: indicador de amigos que coinciden | prd-DISC-001-07.md | identificado |

**Dependencias:** 2←1 · 3←2 · 4←3 · 5←3 · 6←3 · 7←4,6. **Orden de implementación:** 1 → 2 → 3 → 4
→ 5 → 6 → 7. Cada PRD se implementa después como su propio ticket FEATURE.
