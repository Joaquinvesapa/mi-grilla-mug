# Changelog

Todos los cambios notables de Mi Grilla se registran en este archivo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- [FEAT-001] Base del proyecto: Next.js 16, TypeScript 7, Tailwind 4 con shadcn/ui y paleta Rosé
  Pine, y la toolchain de oxc (oxlint y oxfmt).
- [FEAT-001] Pantalla de inicio con shell nativo de iPhone: safe areas, `100dvh`, toques sin demora
  y la guía "Cómo instalarla".
- [FEAT-001] Base PostgreSQL con Prisma 7 y el chequeo de salud `GET /api/health`.
- [FEAT-001] PWA instalable con Serwist: manifest, íconos y la pantalla "Sin conexión".
- [FEAT-001] `/demo`: la app dentro de un marco de iPhone para mostrarla desde desktop.
- [FEAT-001] CI en GitHub Actions con calidad, integración contra PostgreSQL real y E2E en WebKit y
  Chromium.
- [FEAT-002] Cuentas con Better Auth: registro con email, contraseña y nombre visible, inicio y
  cierre de sesión, y sesión de 30 días que no se renueva con el uso.
- [FEAT-002] Bloqueo de un email por 15 minutos después de 5 intentos fallidos en 15 minutos, con
  el mismo mensaje exista o no la cuenta.
- [FEAT-002] Pantallas `/login` y `/register` con control para mostrar la contraseña y teclado de
  email sin zoom en el iPhone.
- [FEAT-003a] La grilla del festival en la pantalla principal: los 3 días y los 91 shows en formato
  escenarios × horarios, con 3 escenarios a la vista a 360–430 px, scroll horizontal y vertical,
  encabezados y horas fijos, y los shows de después de medianoche en el día en que empiezan.
- [FEAT-003a] Selección propia: tocar un show lo marca o desmarca como cambio pendiente; "Guardar"
  lo guarda en la cuenta y "Descartar" vuelve a lo guardado; los choques entre shows elegidos se
  marcan, y cerrar sesión con cambios pendientes pide confirmación.
- [FEAT-003a] La grilla versionada en `data/schedule.json` y el seed `pnpm db:seed`, que la carga en
  la base (tablas de días, escenarios, shows y selección).
- [FEAT-003b] La grilla y la selección se ven sin conexión en un celular donde ya se vieron con
  conexión: la app guarda una copia en el dispositivo, que se borra al cerrar sesión o al entrar
  otra cuenta.
- [FEAT-003b] "Guardar" sin conexión deja la selección guardada en el celular, con un aviso, y se
  sincroniza sola con la cuenta al abrir la app con conexión o al volver la señal; si otra cuenta
  entra en ese celular, no la ve ni se le sincroniza.
- [FEAT-004] "Descargar fondo", al lado de los días: genera la grilla del día en pantalla como
  imagen de 1290 × 2796 para la pantalla de bloqueo del iPhone, con los shows elegidos encendidos
  y el resto opacos (todos encendidos si no hay elegidos), libre arriba y abajo para la hora y los
  botones, y con la marca "Mi Grilla".
- [FEAT-004] El fondo usa lo que se ve en pantalla, incluidos los cambios sin guardar y la
  selección pendiente de sincronizar, y se genera también sin conexión.
- [FEAT-004] En el iPhone se guarda en Fotos con la hoja de compartir; en una computadora se
  descarga como `mi-grilla-<día>.png`. Después, una guía de 4 pasos para ponerlo de fondo.

### Changed

- [FEAT-002] La pantalla principal `/` requiere sesión iniciada; sin sesión lleva a `/login`.
- [FEAT-002] La CI recibe las variables de Better Auth y el job `e2e` migra la base antes de correr.
- [FEAT-003a] La pantalla principal deja la presentación ("Muy pronto") y pasa a ser la grilla; el
  saludo, la guía "Cómo instalarla" y "Cerrar sesión" van en un menú que se abre desde abajo.
- [FEAT-003a] La CI siembra la grilla (`pnpm db:seed`) en los jobs `integration` y `e2e`.
- [FEAT-003b] Sin conexión, "Cerrar sesión" queda deshabilitado con su motivo, y la pantalla "Sin
  conexión" muestra la grilla guardada en el celular cuando la hay.
- [FIX-001] En un PR, el job `e2e` de la CI corre solo el proyecto `iphone-webkit` (82 casos en vez
  de 254); al mergear a `main` sigue corriendo los 4 proyectos.
- [FIX-001] `AGENTS.md` fija cuándo se corren los E2E en DAW: solo el E2E del bloque en CODE, la
  suite completa al cierre de CODE, y en VERIFY la misma corrida si el código no cambió.
