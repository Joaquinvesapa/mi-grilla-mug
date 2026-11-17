import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

const BASE = "#191724";

describe("manifest (AC-02)", () => {
  it('se instala como app "Mi Grilla" a pantalla completa', () => {
    const result = manifest();

    expect(result.name).toBe("Mi Grilla");
    expect(result.short_name).toBe("Mi Grilla");
    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/");
    expect(result.scope).toBe("/");
  });

  it("pinta el arranque y la barra con el fondo de la app (#191724)", () => {
    const result = manifest();

    expect(result.background_color).toBe(BASE);
    expect(result.theme_color).toBe(BASE);
  });

  it("declara los íconos PNG de 192 y 512 px y uno de 512 px maskable", () => {
    const icons = manifest().icons ?? [];

    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/192", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icons/512", sizes: "512x512", type: "image/png" }),
        expect.objectContaining({
          src: "/icons/512",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        }),
      ]),
    );
    // Every non-maskable icon is a plain "any" icon: a maskable one is only ever listed apart.
    for (const icon of icons.filter((entry) => entry.purpose !== "maskable")) {
      expect([undefined, "any"]).toContain(icon.purpose);
    }
  });

  it("solo apunta a tamaños que sirve /icons/[size]", () => {
    const icons = manifest().icons ?? [];

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.src).toMatch(/^\/icons\/(192|512)$/);
    }
  });

  it("no menciona a Lollapalooza en ningún campo (AC-13)", () => {
    const text = JSON.stringify(manifest());

    // Guard against a vacuous pass: the manifest has to say something for this to mean anything.
    expect(text).toContain("Mi Grilla");
    expect(text).not.toMatch(/lollapalooza/i);
  });
});
