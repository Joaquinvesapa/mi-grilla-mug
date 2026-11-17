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

### Changed

- [FEAT-002] La pantalla principal `/` requiere sesión iniciada; sin sesión lleva a `/login`.
- [FEAT-002] La CI recibe las variables de Better Auth y el job `e2e` migra la base antes de correr.
