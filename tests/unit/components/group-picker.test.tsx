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

  it('test-group-picker-without-no-group: con withNoGroup={false} no hay "Sin grupo", usa la etiqueta dada y rechaza un "" inválido', () => {
    const onChange = vi.fn<(groupId: string | null) => void>();
    render(
      <GroupPicker
        groups={GROUPS}
        value={GROUPS[1]!.id}
        onChange={onChange}
        withNoGroup={false}
        label="Grupo del fondo"
      />,
    );

    // The label passed, not the grid picker's.
    expect(screen.queryByRole("combobox", { name: "Grupo" })).toBeNull();
    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Grupo del fondo" });
    const options = within(select).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Los del colegio",
      "Facu y amigos",
    ]);
    expect(select).toHaveValue(GROUPS[1]!.id);
    expect(select).toHaveClass("h-11", "text-base");

    // An empty value, as a tampered DOM would send it: there is no "Sin grupo" to choose.
    const forged = document.createElement("option");
    forged.value = "";
    select.append(forged);
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(select, { target: { value: GROUPS[0]!.id } });
    expect(onChange).toHaveBeenLastCalledWith(GROUPS[0]!.id);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("test-group-picker-without-no-group: sin las props nuevas, la etiqueta es Grupo y Sin grupo sigue", () => {
    render(<GroupPicker groups={GROUPS} value={null} onChange={() => {}} />);

    const select = screen.getByRole("combobox", { name: "Grupo" });
    expect(within(select).getByRole("option", { name: "Sin grupo" })).toBeInTheDocument();
    expect(select).not.toHaveAttribute("aria-disabled");
  });

  it("con disabled queda aria-disabled, sigue enfocable y no informa cambios", () => {
    const onChange = vi.fn<(groupId: string | null) => void>();
    render(<GroupPicker groups={GROUPS} value={GROUPS[0]!.id} onChange={onChange} disabled />);
    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Grupo" });

    // aria-disabled, not `disabled`: a focused control that becomes disabled loses the focus.
    expect(select).toHaveAttribute("aria-disabled", "true");
    expect(select).not.toBeDisabled();
    // Nor can a tap open it (the iOS wheel) while it refuses: no pointer events, keeping the focus.
    expect(select).toHaveClass("aria-disabled:pointer-events-none", "aria-disabled:opacity-50");
    fireEvent.change(select, { target: { value: GROUPS[1]!.id } });
    expect(onChange).not.toHaveBeenCalled();
    expect(select).toHaveValue(GROUPS[0]!.id);
  });

  it("test-group-picker-long-name: un nombre de 40 caracteres no desborda a 360 px: el selector se achica y lo trunca, la etiqueta no", () => {
    const longName = "Los amigos del colegio y de la facultad!";
    expect(longName).toHaveLength(40);
    render(
      <GroupPicker
        groups={[{ id: GROUPS[0]!.id, name: longName }]}
        value={GROUPS[0]!.id}
        onChange={() => {}}
        withNoGroup={false}
        label="Grupo del fondo"
      />,
    );
    const select = screen.getByRole("combobox", { name: "Grupo del fondo" });
    const wrapper = select.closest("[data-slot='native-select-wrapper']");
    const row = wrapper?.parentElement;
    const label = row?.querySelector("label");

    // jsdom does no layout: the classes that let the row fit its container are what is checked.
    // The row never grows past its container, and the select's wrapper (`w-fit`) may shrink in it.
    expect(row).toHaveClass("min-w-0", "max-w-full");
    expect(row).toHaveClass(
      "[&>[data-slot=native-select-wrapper]]:min-w-0",
      "[&>[data-slot=native-select-wrapper]]:max-w-full",
    );
    // The label keeps its width; the select cuts the name with an ellipsis.
    expect(label).toHaveClass("shrink-0");
    expect(select).toHaveClass("truncate", "h-11", "text-base");
  });
});
