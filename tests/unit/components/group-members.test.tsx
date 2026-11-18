import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GroupMembers } from "@/components/group-members";

afterEach(cleanup);

describe("GroupMembers", () => {
  it("group-members: nombre, iniciales y marca de administrador", () => {
    render(
      <GroupMembers
        members={[
          { name: "Ana Pérez", initials: "AP", isAdmin: true },
          { name: "Bruno", initials: "BR", isAdmin: false },
        ]}
      />,
    );

    const list = screen.getByRole("list", { name: "Integrantes" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);

    const [ana, bruno] = rows;
    if (!ana || !bruno) {
      throw new Error("two rows expected");
    }
    expect(within(ana).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(ana).getByText("AP")).toHaveClass("size-11");
    expect(within(ana).getByText("Administrador")).toBeInTheDocument();

    expect(within(bruno).getByText("Bruno")).toBeInTheDocument();
    expect(within(bruno).getByText("BR")).toHaveClass("size-11");
    expect(within(bruno).queryByText("Administrador")).toBeNull();
  });
});
