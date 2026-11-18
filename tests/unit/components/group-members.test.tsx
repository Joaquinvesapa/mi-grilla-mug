import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import type { GroupChangeState } from "@/app/group-actions";
import { GroupMembers, type GroupMembersProps } from "@/components/group-members";
import { groupMessageFor } from "@/lib/group-messages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const OFFLINE = "Necesitás conexión para hacer esto";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

const GROUP_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";

type RemoveAction = GroupMembersProps["removeAction"];

const MEMBERS: GroupMembersProps["members"] = [
  { name: "Ana Pérez", initials: "AP", isAdmin: true, userId: "user-ana", isSelf: true },
  { name: "Bruno", initials: "BR", isAdmin: false, userId: "user-bruno", isSelf: false },
];

function renderMembers({
  isAdmin = false,
  removeAction = vi.fn<RemoveAction>(async () => ({ ok: true })),
}: { isAdmin?: boolean; removeAction?: Mock<RemoveAction> } = {}) {
  render(
    <GroupMembers
      groupId={GROUP_ID}
      members={MEMBERS}
      isAdmin={isAdmin}
      removeAction={removeAction}
    />,
  );
  return { removeAction };
}

function rows() {
  const [ana, bruno] = within(screen.getByRole("list", { name: "Integrantes" })).getAllByRole(
    "listitem",
  );
  if (!ana || !bruno) {
    throw new Error("two rows expected");
  }
  return { ana, bruno };
}

describe("GroupMembers", () => {
  it("group-members: nombre, iniciales y marca de administrador", () => {
    renderMembers();

    expect(
      within(screen.getByRole("list", { name: "Integrantes" })).getAllByRole("listitem"),
    ).toHaveLength(2);
    const { ana, bruno } = rows();
    expect(within(ana).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(ana).getByText("AP")).toHaveClass("size-11");
    expect(within(ana).getByText("Administrador")).toBeInTheDocument();

    expect(within(bruno).getByText("Bruno")).toBeInTheDocument();
    expect(within(bruno).getByText("BR")).toHaveClass("size-11");
    expect(within(bruno).queryByText("Administrador")).toBeNull();
    // A member who does not manage the group sees no "Sacar" at all (AC-16).
    expect(screen.queryByRole("button", { name: /^Sacar/ })).toBeNull();
  });

  it("group-members: Sacar manda el grupo y el integrante, sin confirmación", async () => {
    const { removeAction } = renderMembers({ isAdmin: true });

    const { ana, bruno } = rows();
    expect(within(ana).queryByRole("button", { name: /^Sacar/ })).toBeNull();
    const remove = within(bruno).getByRole("button", { name: "Sacar a Bruno" });
    expect(remove).toHaveTextContent("Sacar");
    // 44 px: jsdom has no layout, so the size is read from the shadcn Button's size.
    expect(remove).toHaveAttribute("data-size", "default");

    await act(async () => {
      fireEvent.click(remove);
    });

    expect(removeAction).toHaveBeenCalledTimes(1);
    const sent = removeAction.mock.calls[0]?.[1];
    expect(sent?.get("groupId")).toBe(GROUP_ID);
    expect(sent?.get("memberUserId")).toBe("user-bruno");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("group-members: si sacar es rechazado, la fila muestra el motivo", async () => {
    const removeAction = vi.fn<RemoveAction>(async (): Promise<GroupChangeState> => ({
      ok: false,
      error: groupMessageFor("MEMBER_NOT_FOUND"),
    }));
    renderMembers({ isAdmin: true, removeAction });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sacar a Bruno" }));
    });

    expect(within(rows().bruno).getByRole("alert")).toHaveTextContent(
      "Esa persona ya no está en el grupo.",
    );
  });

  it("test-forms-offline-ac28: sacar sin conexión avisa en la fila y no llama a la acción", async () => {
    setOnline(false);
    const { removeAction } = renderMembers({ isAdmin: true });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sacar a Bruno" }));
    });

    expect(removeAction).not.toHaveBeenCalled();
    expect(within(rows().bruno).getByRole("alert")).toHaveTextContent(OFFLINE);
    expect(screen.getByRole("button", { name: "Sacar a Bruno" })).toBeEnabled();
  });
});
