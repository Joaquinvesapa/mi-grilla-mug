import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import { GroupDangerZone, type GroupDangerZoneProps } from "@/components/group-danger-zone";
import { groupMessageFor } from "@/lib/group-messages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const GROUP_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";

type ExitAction = GroupDangerZoneProps["leaveAction"];

type ExitMock = Mock<ExitAction>;

function renderZone(isAdmin: boolean, overrides: { deleteAction?: ExitMock } = {}) {
  const leaveAction: ExitMock = vi.fn<ExitAction>(async () => ({ ok: false, error: "unused" }));
  const deleteAction: ExitMock =
    overrides.deleteAction ?? vi.fn<ExitAction>(async () => ({ ok: false, error: "unused" }));
  render(
    <GroupDangerZone
      groupId={GROUP_ID}
      groupName="Los del Lolla"
      isAdmin={isAdmin}
      leaveAction={leaveAction}
      deleteAction={deleteAction}
    />,
  );
  return { leaveAction, deleteAction };
}

async function tap(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("GroupDangerZone", () => {
  it("test-delete-needs-confirmation: Borrar grupo no envía hasta tocar Borrar, y Cancelar no envía nada", async () => {
    const { deleteAction, leaveAction } = renderZone(true);

    await tap(screen.getByRole("button", { name: "Borrar grupo" }));
    expect(deleteAction).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog", { name: "¿Borrar Los del Lolla?" });
    expect(dialog).toHaveTextContent("Se borra para todos sus integrantes.");
    await tap(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(deleteAction).not.toHaveBeenCalled();

    await tap(screen.getByRole("button", { name: "Borrar grupo" }));
    const again = screen.getByRole("alertdialog", { name: "¿Borrar Los del Lolla?" });
    const confirm = within(again).getByRole("button", { name: "Borrar" });
    expect(confirm).toHaveAttribute("type", "submit");
    expect(confirm).toHaveAttribute("data-variant", "destructive");
    await tap(confirm);

    expect(deleteAction).toHaveBeenCalledTimes(1);
    expect(deleteAction.mock.calls[0]?.[1].get("groupId")).toBe(GROUP_ID);
    expect(leaveAction).not.toHaveBeenCalled();
  });

  it("test-leave-needs-confirmation: Salir del grupo no envía hasta tocar Salir en el diálogo", async () => {
    const { leaveAction, deleteAction } = renderZone(false);
    expect(screen.queryByRole("button", { name: "Borrar grupo" })).toBeNull();

    await tap(screen.getByRole("button", { name: "Salir del grupo" }));
    expect(leaveAction).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog", { name: "¿Salir de Los del Lolla?" });
    await tap(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(leaveAction).not.toHaveBeenCalled();

    await tap(screen.getByRole("button", { name: "Salir del grupo" }));
    const again = screen.getByRole("alertdialog", { name: "¿Salir de Los del Lolla?" });
    await tap(within(again).getByRole("button", { name: "Salir" }));

    expect(leaveAction).toHaveBeenCalledTimes(1);
    expect(leaveAction.mock.calls[0]?.[1].get("groupId")).toBe(GROUP_ID);
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("group-danger-zone: si borrar es rechazado, el diálogo muestra el motivo y Borrar se deshabilita mientras envía", async () => {
    let answer: (state: { ok: false; error: string }) => void = () => {};
    const deleteAction = vi.fn<ExitAction>(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    renderZone(true, { deleteAction });

    await tap(screen.getByRole("button", { name: "Borrar grupo" }));
    const dialog = screen.getByRole("alertdialog");
    await tap(within(dialog).getByRole("button", { name: "Borrar" }));
    expect(within(dialog).getByRole("button", { name: "Borrar" })).toBeDisabled();

    await act(async () => {
      answer({ ok: false, error: groupMessageFor("NOT_ADMIN") });
    });

    expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toHaveTextContent(
      "Solo quien administra el grupo puede hacer esto.",
    );
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Borrar" }),
    ).toBeEnabled();
  });
});
