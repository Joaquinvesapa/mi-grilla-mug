import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupPicker } from "@/components/group-picker";
import type { GroupPicks } from "@/lib/group-picks";

afterEach(cleanup);

const GROUPS: GroupPicks[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Los del colegio", friends: [] },
  { id: "22222222-2222-4222-8222-222222222222", name: "Facu y amigos", friends: [] },
];

describe("GroupPicker", () => {
  it('test-picker-options: el selector lista los grupos y "Sin grupo", con 16 px y 44 px de alto', () => {
    const onChange = vi.fn<(groupId: string | null) => void>();
    render(<GroupPicker groups={GROUPS} value={GROUPS[0]!.id} onChange={onChange} />);

    const select = screen.getByRole("combobox", { name: "Grupo" });
    // In the order the groups arrive (the most recent first), "Sin grupo" last.
    const options = within(select).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Los del colegio",
      "Facu y amigos",
      "Sin grupo",
    ]);
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      GROUPS[0]!.id,
      GROUPS[1]!.id,
      "",
    ]);
    expect(select).toHaveValue(GROUPS[0]!.id);
    // 16 px so iOS does not zoom into it, 44 px tall as a tap target (mobile-native, NFR-02).
    expect(select).toHaveClass("h-11", "text-base");

    fireEvent.change(select, { target: { value: GROUPS[1]!.id } });
    expect(onChange).toHaveBeenLastCalledWith(GROUPS[1]!.id);
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('test-picker-options: con value null queda elegido "Sin grupo"', () => {
    render(<GroupPicker groups={GROUPS} value={null} onChange={() => {}} />);

    expect(screen.getByRole("combobox", { name: "Grupo" })).toHaveValue("");
  });

  it("test-picker-unknown-value: un valor desconocido del select es rechazado y no cambia el grupo", () => {
    const onChange = vi.fn<(groupId: string | null) => void>();
    render(<GroupPicker groups={GROUPS} value={GROUPS[0]!.id} onChange={onChange} />);
    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Grupo" });

    // A value the options do not carry, as a tampered DOM would send it.
    const forged = document.createElement("option");
    forged.value = "33333333-3333-4333-8333-333333333333";
    select.append(forged);
    fireEvent.change(select, { target: { value: forged.value } });

    expect(onChange).not.toHaveBeenCalled();
    // Controlled: the select goes back to the group on screen.
    expect(select).toHaveValue(GROUPS[0]!.id);
  });
});
