import { describe, expect, it } from "vitest";

import {
  ASK_THE_ADMIN,
  CANCEL,
  CREATE_GROUP_BUTTON,
  DELETE_GROUP_BUTTON,
  DELETE_GROUP_CONFIRM,
  DELETE_GROUP_WARNING,
  deleteGroupTitle,
  extraFriendsLabel,
  formatInviteExpiry,
  friendsPickedLabel,
  GROUP_PICKER_LABEL,
  GROUP_LOAD_FAILED,
  GROUP_NAME_LABEL,
  type GroupMessageCode,
  groupMessageFor,
  GROUPS_LOAD_FAILED,
  inviteShareText,
  joinGroupMessageFor,
  LEAVE_GROUP_BUTTON,
  LEAVE_GROUP_CONFIRM,
  leaveGroupTitle,
  LINK_COPIED,
  LINK_COPY_FAILED,
  LINK_EXPIRED,
  LINK_REGENERATED,
  memberCountLabel,
  NAME_SAVED,
  NO_ACTIVE_LINK,
  NO_GROUP_OPTION,
  NO_GROUPS,
  REMOVE_MEMBER_BUTTON,
  removeMemberLabel,
  RENAME_GROUP_LABEL,
  SAVE_NAME_BUTTON,
} from "@/lib/group-messages";

// `satisfies` makes a code missing from (or extra to) the exported union a compile error.
const CATALOG = {
  INVALID_NAME: "El nombre tiene que tener entre 1 y 40 caracteres.",
  USER_GROUP_LIMIT: "Ya estás en 10 grupos, el máximo.",
  GROUP_FULL: "El grupo está completo (20 integrantes).",
  INVALID_INVITE: "Este link de invitación ya no es válido. Pedile uno nuevo a alguien del grupo.",
  NOT_FOUND: "No encontramos ese grupo.",
  NOT_ADMIN: "Solo quien administra el grupo puede hacer esto.",
  MEMBER_NOT_FOUND: "Esa persona ya no está en el grupo.",
  UNAUTHENTICATED: "Tu sesión terminó. Volvé a iniciar sesión.",
  SERVICE_UNAVAILABLE: "No pudimos guardar. Probá de nuevo en un rato.",
} satisfies Record<GroupMessageCode, string>;

describe("group-messages", () => {
  it("group-messages: vencimiento en hora de Argentina y texto de cada código", () => {
    for (const [code, text] of Object.entries(CATALOG)) {
      expect(groupMessageFor(code)).toBe(text);
    }
    for (const unknown of ["", "NOPE", "toString", "__proto__", "P2002"]) {
      expect(groupMessageFor(unknown)).toBe(CATALOG.SERVICE_UNAVAILABLE);
    }
    // Joining has its own generic error; every other code reads the same.
    expect(joinGroupMessageFor("SERVICE_UNAVAILABLE")).toBe(
      "No pudimos unirte. Probá de nuevo en un rato.",
    );
    expect(joinGroupMessageFor("NOPE")).toBe("No pudimos unirte. Probá de nuevo en un rato.");
    expect(joinGroupMessageFor("GROUP_FULL")).toBe(CATALOG.GROUP_FULL);
    expect(joinGroupMessageFor("USER_GROUP_LIMIT")).toBe(CATALOG.USER_GROUP_LIMIT);
    expect(joinGroupMessageFor("INVALID_INVITE")).toBe(CATALOG.INVALID_INVITE);

    // 06:15 UTC on Friday 21/11/2025 is 03:15 in Buenos Aires (UTC−3), whatever the runner's zone.
    expect(formatInviteExpiry(new Date("2025-11-21T06:15:00.000Z"))).toBe(
      "Vence el viernes 21/11 a las 03:15",
    );
    // 02:30 UTC on Sunday is still Saturday 23:30 in Argentina.
    expect(formatInviteExpiry(new Date("2026-03-15T02:30:00.000Z"))).toBe(
      "Vence el sábado 14/03 a las 23:30",
    );
    // Midnight is 00, not 24.
    expect(formatInviteExpiry(new Date("2026-03-14T03:00:00.000Z"))).toBe(
      "Vence el sábado 14/03 a las 00:00",
    );
  });

  it("group-messages: los textos de las pantallas de grupos", () => {
    expect(GROUPS_LOAD_FAILED).toBe("No pudimos cargar tus grupos. Probá de nuevo en un rato.");
    expect(GROUP_LOAD_FAILED).toBe("No pudimos cargar el grupo. Probá de nuevo en un rato.");
    expect(NO_GROUPS).toBe("Todavía no estás en ningún grupo");
    expect(GROUP_NAME_LABEL).toBe("Nombre del grupo");
    expect(CREATE_GROUP_BUTTON).toBe("Crear grupo");
    expect(LINK_COPIED).toBe("Link copiado");
    expect(LINK_COPY_FAILED).toBe("No pudimos copiarlo: mantené apretado el link para copiarlo");
    expect(LINK_EXPIRED).toBe("El link venció");
    expect(NO_ACTIVE_LINK).toBe("No hay un link activo");
    expect(ASK_THE_ADMIN).toBe("Pedile a quien administra el grupo un link nuevo.");
    expect(LINK_REGENERATED).toBe("Link nuevo generado");
    expect(inviteShareText("Los del Lolla")).toStrictEqual({
      title: "Los del Lolla · Mi Grilla",
      text: 'Sumate a "Los del Lolla" en Mi Grilla.',
    });
    expect(memberCountLabel(1)).toBe("1 integrante");
    expect(memberCountLabel(3)).toBe("3 integrantes");
  });

  it("test-group-picks-messages: friendsPickedLabel y extraFriendsLabel arman los textos", () => {
    expect(GROUP_PICKER_LABEL).toBe("Grupo");
    expect(NO_GROUP_OPTION).toBe("Sin grupo");
    expect(friendsPickedLabel(["Ana Pérez", "Bruno"])).toBe("Lo eligieron: Ana Pérez, Bruno");
    expect(friendsPickedLabel(["Ana Pérez"])).toBe("Lo eligieron: Ana Pérez");
    expect(extraFriendsLabel(2)).toBe("+2");
    expect(extraFriendsLabel(16)).toBe("+16");
  });

  it("group-messages: los textos de administrar y salir de un grupo", () => {
    expect(RENAME_GROUP_LABEL).toBe("Cambiar nombre");
    expect(SAVE_NAME_BUTTON).toBe("Guardar nombre");
    expect(NAME_SAVED).toBe("Nombre guardado");
    expect(REMOVE_MEMBER_BUTTON).toBe("Sacar");
    expect(removeMemberLabel("Bruno")).toBe("Sacar a Bruno");
    expect(LEAVE_GROUP_BUTTON).toBe("Salir del grupo");
    expect(leaveGroupTitle("Los del Lolla")).toBe("¿Salir de Los del Lolla?");
    expect(LEAVE_GROUP_CONFIRM).toBe("Salir");
    expect(DELETE_GROUP_BUTTON).toBe("Borrar grupo");
    expect(deleteGroupTitle("Los del Lolla")).toBe("¿Borrar Los del Lolla?");
    expect(DELETE_GROUP_WARNING).toBe("Se borra para todos sus integrantes.");
    expect(DELETE_GROUP_CONFIRM).toBe("Borrar");
    expect(CANCEL).toBe("Cancelar");
  });
});
