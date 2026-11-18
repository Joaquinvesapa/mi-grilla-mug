import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Server Actions read the session from next/headers: the in-memory jar plays the browser that
// holds the cookie Better Auth set on sign-up.
vi.mock("next/headers", async () => {
  const jar = await import("./next-cookie-jar");
  return { ...jar.nextHeadersModule, headers: async () => jar.requestHeaders() };
});
// Outside a Next request there is no cache to revalidate: only the call is checked.
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

import { createGroupAction, regenerateInviteAction } from "@/app/group-actions";
import { groupMessageFor } from "@/lib/group-messages";
import { getAccounts } from "@/server/accounts";
import { getDb } from "@/server/db";
import { createGroup, getGroup, joinGroup } from "@/server/groups";

import { clearCookies } from "./next-cookie-jar";

const INITIAL = { error: null, name: "" };
const REDIRECT_TO_GROUP = /^NEXT_REDIRECT;[a-z]+;\/grupos\/([0-9a-f-]{36});/;

/** Signs up through the real accounts service: the jar now holds this account's session cookie. */
async function signUp(email: string, name: string): Promise<string> {
  const result = await getAccounts().registerAccount(
    { email, password: "festival2026", name },
    new Headers(),
  );
  expect(result).toStrictEqual({ ok: true });
  const user = await getDb().user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

/** The digest of the NEXT_REDIRECT `redirect()` throws, or a failure if the action returned. */
async function redirectDigest(run: () => Promise<unknown>): Promise<string> {
  try {
    const returned = await run();
    throw new Error(`expected a redirect, got ${JSON.stringify(returned)}`);
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== "string") {
      throw error;
    }
    return digest;
  }
}

async function groupCount(): Promise<number> {
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM groups`;
  return rows[0]?.count ?? -1;
}

async function tokenOf(userId: string, groupId: string): Promise<string> {
  const result = await getGroup(userId, groupId);
  if (!result.ok || !result.group.invite) {
    throw new Error("no readable invite");
  }
  return result.group.invite.token;
}

beforeEach(() => {
  clearCookies();
  cache.revalidatePath.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("group-actions", () => {
  it("group-actions: crear un grupo redirige a su pantalla", async () => {
    const anaId = await signUp("ana@mail.com", "Ana Pérez");

    const digest = await redirectDigest(() =>
      createGroupAction(INITIAL, form({ name: "  Los del Lolla  " })),
    );

    const groupId = REDIRECT_TO_GROUP.exec(digest)?.[1];
    expect(groupId, digest).toBeDefined();
    const group = await getGroup(anaId, groupId);
    expect(group.ok && group.group.name).toBe("Los del Lolla");
    expect(group.ok && group.group.members).toStrictEqual([
      { name: "Ana Pérez", initials: "AP", isAdmin: true },
    ]);
  });

  it("group-actions: un nombre inválido no crea nada y conserva lo escrito", async () => {
    await signUp("ana@mail.com", "Ana");
    const tooLong = "x".repeat(41);

    expect(await createGroupAction(INITIAL, form({ name: tooLong }))).toStrictEqual({
      error: groupMessageFor("INVALID_NAME"),
      name: tooLong,
    });
    expect(await groupCount()).toBe(0);
  });

  it("group-actions: sin sesión crear es rechazado (no autorizado)", async () => {
    expect(await createGroupAction(INITIAL, form({ name: "Los del Lolla" }))).toStrictEqual({
      error: groupMessageFor("UNAUTHENTICATED"),
      name: "Los del Lolla",
    });
    expect(await groupCount()).toBe(0);
  });

  it("group-actions: crear con la base caída devuelve el error genérico", async () => {
    await signUp("ana@mail.com", "Ana");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    // The session still reads; the write is what fails, as with a dropped connection.
    vi.spyOn(getDb(), "$transaction").mockRejectedValue(new Error("connect ECONNREFUSED secret"));

    const state = await createGroupAction(INITIAL, form({ name: "Los del Lolla" }));

    expect(state).toStrictEqual({
      error: "No pudimos guardar. Probá de nuevo en un rato.",
      name: "Los del Lolla",
    });
    expect(JSON.stringify(state)).not.toContain("ECONNREFUSED");
    expect(errors.mock.calls.flat().join(" ")).not.toContain("ECONNREFUSED");
  });

  it("group-actions: un integrante común que regenera el link es rechazado", async () => {
    const anaId = await signUp("ana@mail.com", "Ana");
    const created = await createGroup(anaId, "Los del Lolla");
    if (!created.ok) {
      throw new Error(created.code);
    }
    const before = await tokenOf(anaId, created.groupId);
    // Beto signs up (the jar now holds his session) and joins with the link.
    const betoId = await signUp("beto@mail.com", "Beto");
    expect(await joinGroup(betoId, before)).toMatchObject({ ok: true, alreadyMember: false });

    const result = await regenerateInviteAction({ ok: true }, form({ groupId: created.groupId }));

    expect(result).toStrictEqual({ ok: false, error: groupMessageFor("NOT_ADMIN") });
    expect(await tokenOf(anaId, created.groupId)).toBe(before);
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("group-actions: el administrador regenera el link y la pantalla del grupo se revalida", async () => {
    const anaId = await signUp("ana@mail.com", "Ana");
    const created = await createGroup(anaId, "Los del Lolla");
    if (!created.ok) {
      throw new Error(created.code);
    }
    const before = await tokenOf(anaId, created.groupId);

    expect(
      await regenerateInviteAction({ ok: true }, form({ groupId: created.groupId })),
    ).toStrictEqual({ ok: true });

    expect(await tokenOf(anaId, created.groupId)).not.toBe(before);
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/grupos/${created.groupId}`);
  });

  it("group-actions: sin sesión regenerar es rechazado y un grupo ajeno es NOT_FOUND", async () => {
    const anaId = await signUp("ana@mail.com", "Ana");
    const created = await createGroup(anaId, "Los del Lolla");
    if (!created.ok) {
      throw new Error(created.code);
    }

    clearCookies();
    expect(
      await regenerateInviteAction({ ok: true }, form({ groupId: created.groupId })),
    ).toStrictEqual({ ok: false, error: groupMessageFor("UNAUTHENTICATED") });

    await signUp("carla@mail.com", "Carla");
    expect(
      await regenerateInviteAction({ ok: true }, form({ groupId: created.groupId })),
    ).toStrictEqual({ ok: false, error: groupMessageFor("NOT_FOUND") });
  });
});
