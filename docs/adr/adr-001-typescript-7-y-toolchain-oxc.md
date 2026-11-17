# ADR-001: TypeScript 7 con oxlint y oxfmt en lugar de ESLint y Prettier

| Field | Value |
|-------|-------|
| Date | 2026-11-16 |
| Ticket | FEAT-001 |
| Status | Accepted |

## Context

El stack del proyecto preveía TypeScript 5.x, ESLint y Prettier. Para el scaffold, el usuario pidió
TypeScript 7, el compilador nativo escrito en Go. El paquete npm de TypeScript 7 (7.0.2) no expone
la API clásica de JavaScript: `require("typescript")` solo devuelve la versión. Esa API es la que
usan typescript-eslint (que soporta TypeScript hasta la 6.0) y el chequeo de tipos de `next build`.

## Options considered

### Option 1: TypeScript 6.0 con ESLint, typescript-eslint y Prettier
- **Pros:** cadena de herramientas probada, con soporte completo de Next.js.
- **Cons:** no es la versión que pidió el usuario, y el chequeo de tipos es mucho más lento.

### Option 2: TypeScript 7 más TypeScript 6.0 de soporte para ESLint
- **Pros:** chequeo de tipos con TypeScript 7, y ESLint con reglas que usan tipos.
- **Cons:** dos versiones de TypeScript en el proyecto, con un alias y binarios que chocan.

### Option 3: TypeScript 7 con ESLint sin reglas que usan tipos
- **Pros:** una sola versión de TypeScript.
- **Cons:** se pierden las reglas que usan tipos, como las promesas sin `await`.

### Option 4: TypeScript 7 con la toolchain de oxc (oxlint, oxlint-tsgolint y oxfmt)
- **Pros:**
  - Una sola versión de TypeScript.
  - El lint que usa tipos corre sobre typescript-go, el mismo motor que TypeScript 7.
  - Lint, formato y chequeo de tipos son nativos y rápidos.
- **Cons:**
  - Hay menos reglas que en ESLint.
  - oxfmt todavía no llegó a la versión 1.0 (está en la 0.79).
  - `next build` no puede chequear tipos.

## Decision

Se eligió la opción 4. El usuario lo decidió el 2026-11-16: primero "cambiemos eslint por oxlint", y
después pidió el formateador de oxc ("este como formatter", con el link a la documentación de oxfmt).
Así se cumple TypeScript 7 sin mantener una segunda versión, el lint que usa tipos corre sobre el mismo
motor, y todas las herramientas de calidad quedan en una sola familia.

## Consequences

- **Versiones fijadas:** `typescript` 7.0.2, `oxlint` 1.94, `oxlint-tsgolint` 7.0 y `oxfmt` 0.79.
  No se instalan ESLint, `eslint-config-next` ni Prettier.
- **`next.config.ts`** lleva `typescript.ignoreBuildErrors: true`. Los tipos se chequean en un paso
  propio, `tsc --noEmit` con TypeScript 7, tanto en local como en la CI.
- **Reglas de Next:** las de `@next/eslint-plugin-next` se cubren con las reglas de Next y React que
  trae oxlint. Lo que esas reglas no cubren queda sin lint.
- **Orden de las clases de Tailwind:** queda en manos de oxfmt. Si oxfmt no las ordena, quedan sin
  ordenar. Este proyecto no usa `prettier-plugin-tailwindcss`.
- **Riesgo aceptado:** Next.js 16 todavía puede necesitar la API de TypeScript para configurar
  `tsconfig.json`. Esto se verifica en el primer bloque del scaffold. Si falla, este ADR se reemplaza
  por otro.
