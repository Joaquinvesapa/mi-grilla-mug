# ADR-006: Link de invitación cifrado en reposo y vuelta a la invitación después de entrar

| Field | Value |
|-------|-------|
| Date | 2026-11-18 |
| Ticket | FEAT-006a |
| Status | Accepted |

## Context
FEAT-006a (`docs/daw/prd/prd-FEAT-006a.md`) pide un link de invitación por grupo que cualquier
integrante vuelve a ver y compartir (FR-04), que vence a las 72 h (NFR-01), imposible de adivinar
(NFR-02), y que alguien sin sesión vuelva a la invitación después de entrar o registrarse (FR-07).
FEAT-002 había cerrado la redirección abierta sin aceptar ningún destino de vuelta (R-16 de
`docs/daw/security/threat-FEAT-002.md`).

## Options considered

### Option 1: guardar solo un hash del token
- **Pros:** si la base se filtra, los tokens no sirven para unirse.
- **Cons:** el link no se puede volver a mostrar; compartirlo obligaría a generar uno nuevo, que
  invalida el de los demás (contradice FR-04 y FR-05).

### Option 2: guardar el token en claro
- **Pros:** lo más simple; cualquier integrante ve el mismo link.
- **Cons:** con la base filtrada, un token vigente permite unirse hasta que vence; aceptarlo era un
  riesgo sobre una credencial que nadie con autoridad había aprobado.

### Option 3: HMAC para buscar y cifrado autenticado para mostrar
- **Pros:** la base no guarda el token utilizable; los integrantes lo vuelven a ver descifrándolo.
- **Cons:** dos columnas y una clave del servidor; rotar `BETTER_AUTH_SECRET` invalida los links
  vigentes (viven 72 h).

### Option 4: volver a la invitación con una cookie en vez de un parámetro
- **Pros:** la URL de `/login` queda limpia.
- **Cons:** estado de servidor por visitante anónimo, y no sobrevive a abrir el link en otro
  navegador; un parámetro validado resuelve lo mismo sin estado.

## Decision
Se eligió la opción 3: token de 32 bytes de `crypto.randomBytes` en base64url (43 caracteres); la
base guarda `token_hash` (HMAC-SHA256, único, para buscar) y `token_ciphertext` (AES-256-GCM con IV
aleatorio, para mostrarlo), con claves derivadas por HKDF de `BETTER_AUTH_SECRET`; una fila por
grupo y `expires_at` a las 72 h. Para FR-07 se eligió un parámetro `next` en `/login` y `/register`,
aceptado solo si coincide exactamente con `/invitacion/` más un token con ese formato; cualquier
otro valor se ignora y el destino es `/`. R-16 se angosta en lugar de reabrirse.

## Consequences
- Nuevas tablas `groups`, `group_members` y `group_invites`, y la ruta `/invitacion/[token]`.
- `src/server/invite-crypto.ts` concentra las claves y las operaciones; `src/lib/return-path.ts`
  valida el destino de vuelta, usado por `auth-actions.ts`, login, registro y `src/proxy.ts`.
- Rotar `BETTER_AUTH_SECRET` deja inválidos los links vigentes, y el administrador genera uno nuevo.
