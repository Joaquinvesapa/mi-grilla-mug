/**
 * The Spanish texts for the group codes `src/server/groups.ts` returns, plus `UNAUTHENTICATED` (the
 * actions' guard), and the visible expiry of a link. Pure: no I/O. The server only returns codes, so
 * no message from Prisma or `pg` can reach the screen (R-08).
 */
import { FESTIVAL_TIME_ZONE } from "@/lib/festival-time";
import { GROUP_NAME_MAX_LENGTH, MAX_GROUP_MEMBERS, MAX_GROUPS_PER_USER } from "@/lib/group-rules";

export type GroupMessageCode =
  | "INVALID_NAME"
  | "USER_GROUP_LIMIT"
  | "GROUP_FULL"
  | "INVALID_INVITE"
  | "NOT_FOUND"
  | "NOT_ADMIN"
  | "MEMBER_NOT_FOUND"
  | "UNAUTHENTICATED"
  | "SERVICE_UNAVAILABLE";

const CATALOG = {
  INVALID_NAME: `El nombre tiene que tener entre 1 y ${GROUP_NAME_MAX_LENGTH} caracteres.`,
  USER_GROUP_LIMIT: `Ya estás en ${MAX_GROUPS_PER_USER} grupos, el máximo.`,
  GROUP_FULL: `El grupo está completo (${MAX_GROUP_MEMBERS} integrantes).`,
  INVALID_INVITE: "Este link de invitación ya no es válido. Pedile uno nuevo a alguien del grupo.",
  NOT_FOUND: "No encontramos ese grupo.",
  NOT_ADMIN: "Solo quien administra el grupo puede hacer esto.",
  MEMBER_NOT_FOUND: "Esa persona ya no está en el grupo.",
  UNAUTHENTICATED: "Tu sesión terminó. Volvé a iniciar sesión.",
  SERVICE_UNAVAILABLE: "No pudimos guardar. Probá de nuevo en un rato.",
} as const satisfies Record<GroupMessageCode, string>;

/** Joining says what failed: it does not save anything the person wrote. */
const JOIN_UNAVAILABLE = "No pudimos unirte. Probá de nuevo en un rato.";

// A Map, so `toString` or `__proto__` are not catalog entries.
const MESSAGES: ReadonlyMap<string, string> = new Map(Object.entries(CATALOG));

/** The catalog text for a code; anything outside the catalog reads as `SERVICE_UNAVAILABLE`. */
export function groupMessageFor(code: string): string {
  return MESSAGES.get(code) ?? CATALOG.SERVICE_UNAVAILABLE;
}

/** The same catalog for "Unirme", whose generic error is its own. */
export function joinGroupMessageFor(code: string): string {
  return code !== "SERVICE_UNAVAILABLE" && MESSAGES.has(code)
    ? groupMessageFor(code)
    : JOIN_UNAVAILABLE;
}

const EXPIRY_FORMAT = new Intl.DateTimeFormat("es-AR", {
  timeZone: FESTIVAL_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Vence el viernes 21/11 a las 03:15", on Argentina's clock whatever the device's zone (FR-04). */
export function formatInviteExpiry(date: Date): string {
  const parts = new Map(EXPIRY_FORMAT.formatToParts(date).map((part) => [part.type, part.value]));
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.get(type) ?? "";
  return `Vence el ${part("weekday")} ${part("day")}/${part("month")} a las ${part("hour")}:${part("minute")}`;
}

// The screens' own texts ("Grupos", the group's screen and its invite link), kept here with the
// catalog so every group text lives in one place.

/** `/grupos` when the list cannot be read. */
export const GROUPS_LOAD_FAILED = "No pudimos cargar tus grupos. Probá de nuevo en un rato.";
/** `/grupos/[groupId]` when the group cannot be read (not someone else's: that is a 404). */
export const GROUP_LOAD_FAILED = "No pudimos cargar el grupo. Probá de nuevo en un rato.";
export const NO_GROUPS = "Todavía no estás en ningún grupo";
export const GROUP_NAME_LABEL = "Nombre del grupo";
export const CREATE_GROUP_BUTTON = "Crear grupo";
export const LINK_COPIED = "Link copiado";
export const LINK_COPY_FAILED = "No pudimos copiarlo: mantené apretado el link para copiarlo";
export const LINK_EXPIRED = "El link venció";
/** No link, or one that cannot be opened (a rotated secret). */
export const NO_ACTIVE_LINK = "No hay un link activo";
/** For a member who is not the admin, when there is no link to share. */
export const ASK_THE_ADMIN = "Pedile a quien administra el grupo un link nuevo.";
export const LINK_REGENERATED = "Link nuevo generado";
/** `/invitacion/[token]` (FR-06): the preview's lead-in, its button and its own load error. */
export const INVITATION_LEAD = "Te invitaron a sumarte a";
export const JOIN_GROUP_BUTTON = "Unirme";
export const INVITATION_LOAD_FAILED = "No pudimos cargar la invitación. Probá de nuevo en un rato.";
export const BACK_TO_SCHEDULE = "Volver a la grilla";

/** The group's screen, for its admin: renaming it and taking a member out (FR-01). */
export const RENAME_GROUP_LABEL = "Cambiar nombre";
export const SAVE_NAME_BUTTON = "Guardar nombre";
export const NAME_SAVED = "Nombre guardado";
export const REMOVE_MEMBER_BUTTON = "Sacar";
/** The "Sacar" button's accessible name: which row it takes out. */
export function removeMemberLabel(memberName: string): string {
  return `Sacar a ${memberName}`;
}
/** Leaving (FR-02, everyone) and deleting (FR-01, the admin), each asking first. */
export const LEAVE_GROUP_BUTTON = "Salir del grupo";
export const LEAVE_GROUP_CONFIRM = "Salir";
export function leaveGroupTitle(groupName: string): string {
  return `¿Salir de ${groupName}?`;
}
export const DELETE_GROUP_BUTTON = "Borrar grupo";
export const DELETE_GROUP_CONFIRM = "Borrar";
export const DELETE_GROUP_WARNING = "Se borra para todos sus integrantes.";
export function deleteGroupTitle(groupName: string): string {
  return `¿Borrar ${groupName}?`;
}
export const CANCEL = "Cancelar";
/** Any group action tried without a connection (FR-04, AC-28): nothing is sent. */
export const OFFLINE_ACTION = "Necesitás conexión para hacer esto";

/** The title and text the system share sheet gets with the link. */
export function inviteShareText(groupName: string): { title: string; text: string } {
  return { title: `${groupName} · Mi Grilla`, text: `Sumate a "${groupName}" en Mi Grilla.` };
}

/** "1 integrante", "3 integrantes". */
export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? "integrante" : "integrantes"}`;
}

// The group on the grid (FEAT-006c).

/** The picker's label, and its option for no group (FR-03). */
export const GROUP_PICKER_LABEL = "Grupo";
export const NO_GROUP_OPTION = "Sin grupo";

/** "Lo eligieron: Ana Pérez, Bruno": the accessible name of a show's initials. */
export function friendsPickedLabel(names: readonly string[]): string {
  return `Lo eligieron: ${names.join(", ")}`;
}

/** "+2": the friends beyond the 3 initials shown. */
export function extraFriendsLabel(count: number): string {
  return `+${count}`;
}
