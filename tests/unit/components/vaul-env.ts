import { vi } from "vitest";

// jsdom has no `window.matchMedia`, and Vaul (the menu's sheet) asks it whether the app runs
// standalone when the sheet opens. Nothing here matches: a browser tab, not the installed app.
// Stubbed with vi.stubGlobal, so `vi.unstubAllGlobals()` (in the file's afterAll) takes it back.
export function stubMatchMedia(): void {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}
