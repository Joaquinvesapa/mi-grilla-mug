# Decisiones FIX-004

Decisiones de CODE que no estaban escritas en el fix-plan. Ninguna cambia un requisito del RCA. El
usuario eligió `autonomy: minimal`, así que no se le preguntó ninguna: las aceptó el
`daw-module-verifier` y quedan acá para que se revisen en VERIFY.

1. **`TestDatabaseEnv` es `Readonly<Record<string, string | undefined>>`** y no
   `{ TEST_DATABASE_URL?: string; DATABASE_URL?: string }`, como decía el paso 1. Con solo claves
   opcionales, TypeScript lo trata como weak type y rechaza `process.env` (Next le agrega un
   `NODE_ENV` obligatorio). El comportamiento es el mismo.
2. **Una `DATABASE_URL` vacía cuenta como ausente**, en lugar de "inválida, entonces la misma base".
   En la CI no hay `DATABASE_URL`, y el setup guarda `""` en `MI_GRILLA_DEVELOPMENT_DATABASE_URL`,
   porque asignar `undefined` a `process.env` lo convierte en el string `"undefined"`. Con la regla
   literal, el job `integration` se negaría a correr.
3. **Sin nombre de base en la URL, se compara contra el usuario**, porque es la base a la que conecta
   `pg` en ese caso. Del lado de `DATABASE_URL`, la query sigue el orden de `pg`: `host` gana sobre
   `hostaddr` y `dbname` sobre `database`. Un override vacío (`?host=`) cae al valor de la URL.
4. **Una URL que no se puede decodificar (`%zz`) es inusable.** Si es `TEST_DATABASE_URL`, se
   rechaza con `UnsupportedTestDatabaseUrlError`; si es `DATABASE_URL`, se toma como la misma base.
   Antes, `decodeURIComponent` lanzaba un `URIError` sin tipar (WARN 2 de la auditoría de calidad).
5. **`test-workflow-test-database` reemplaza a `test-workflow-seed-step`.** El viejo exigía
   `db:migrate` → `db:seed` → suite, y esos pasos ya no existen en la CI. El nuevo exige
   `db:test:prepare` antes de la suite y que no queden `db:migrate` ni `db:seed`.
6. **El test de regresión se corrió contra una base descartable** (`mi_grilla_fix004_scratch`,
   borrada después), no contra la de desarrollo: con el setup viejo, su `beforeEach` habría borrado
   las 452 cuentas y 36 grupos del usuario. Cualquier base distinta de `TEST_DATABASE_URL` reproduce
   el bug.
7. **Se borró `test-results/`**, que era de root, de una corrida de la madrugada anterior al ticket.
   Hacía fallar `pnpm test:e2e:docker` con `EACCES` antes de correr un solo test. Es salida generada
   e ignorada por git.
