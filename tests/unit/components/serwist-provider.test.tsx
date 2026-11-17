import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const received = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("@serwist/turbopack/react", () => ({
  SerwistProvider: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
    received.props.push(props);
    return <div data-testid="serwist-provider">{children}</div>;
  },
}));

import { SerwistProvider, SW_URL } from "@/components/serwist-provider";

function lastProps() {
  const props = received.props.at(-1);
  expect(props, "SerwistProvider de Serwist no se montó").toBeDefined();
  return props!;
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  received.props.length = 0;
});

describe("SerwistProvider", () => {
  it("registra /serwist/sw.js con alcance /", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<SerwistProvider>contenido</SerwistProvider>);

    expect(SW_URL).toBe("/serwist/sw.js");
    expect(lastProps()).toMatchObject({ swUrl: "/serwist/sw.js", options: { scope: "/" } });
    expect(lastProps().disable).toBe(false);
  });

  it("no cachea las páginas que se visitan (R-06): cacheOnNavigation en false", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<SerwistProvider>contenido</SerwistProvider>);

    expect(lastProps().cacheOnNavigation).toBe(false);
  });

  it("no recarga la app al volver la señal: eso lo decide solo la pantalla sin conexión", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<SerwistProvider>contenido</SerwistProvider>);

    expect(lastProps().reloadOnOnline).toBe(false);
  });

  it("no registra el service worker fuera del build de producción (ADR-002)", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<SerwistProvider>contenido</SerwistProvider>);

    expect(lastProps().disable).toBe(true);
  });

  it("renderiza a sus hijos dentro del provider de Serwist", () => {
    render(
      <SerwistProvider>
        <p>la app</p>
      </SerwistProvider>,
    );

    expect(screen.getByTestId("serwist-provider")).toContainElement(screen.getByText("la app"));
  });
});
